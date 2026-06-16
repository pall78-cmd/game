import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export type ConnectionStatus = 'CONNECTING' | 'ONLINE' | 'OFFLINE' | 'RECONNECTING' | 'FAILED' | 'RETRY_INIT';

export class ConnectionManager {
    private supabase: SupabaseClient;
    private onStatusChange: (status: ConnectionStatus) => void;
    private reconnectAttempts: number = 0;
    private readonly baseDelay: number = 5000; // 5s base delay instead of 1s to prevent redundant spams
    public channel: RealtimeChannel | null = null;
    private isReconnecting: boolean = false;
    private checkInterval: any = null;
    private lastHeartbeat: number = Date.now();
    private channelName: string | null = null;
    private onPayload: ((event: any) => void) | null = null;
    private onPresenceChange: ((presences: any[]) => void) | null = null;
    
    // Active/Inactive and connection state tracking variables
    private reconnectTimeoutId: any = null;
    private isInactive: boolean = false;
    private idleTimer: any = null;
    private presenceKey: string = 'user_presence';

    // Server-level heartbeat state tracking properties
    private trackUsername: string | null = null;
    private trackRoom: 'A' | 'B' | null = null;
    private serverHeartbeatInterval: any = null;

    constructor(supabaseClient: SupabaseClient, onStatusChange?: (status: ConnectionStatus) => void) {
        this.supabase = supabaseClient;
        this.onStatusChange = onStatusChange || (() => {});
        this.handleStatus = this.handleStatus.bind(this);
        this.reconnect = this.reconnect.bind(this);
        this.startHeartbeat = this.startHeartbeat.bind(this);
        
        // Start tracking user activity state
        this.resetIdleTimer();
        this.setupActivityListeners();
    }

    private resetIdleTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.isInactive = false;
        this.idleTimer = setTimeout(() => {
            console.log("[ConnectionManager] Player idle for 10 minutes, marking as inactive.");
            this.isInactive = true;
        }, 600000); // 10 minutes idle timeout
    }

    private setupActivityListeners() {
        if (typeof window === 'undefined') return;

        const handleUserActivity = () => {
            this.resetIdleTimer();
            if (this.isInactive) {
                console.log("[ConnectionManager] Player active again. Reconnecting immediately!");
                this.isInactive = false;
                this.resetAndReconnect();
            }
        };

        const handleFocusAndVisibility = () => {
            if (document.visibilityState === 'visible') {
                console.log("[ConnectionManager] Window focused/visible. Waking up connection.");
                this.isInactive = false;
                this.resetAndReconnect();
            } else {
                console.log("[ConnectionManager] Tab backgrounded, keeping connection alive.");
            }
        };

        window.addEventListener('focus', handleFocusAndVisibility);
        window.addEventListener('visibilitychange', handleFocusAndVisibility);
        
        // Listen to UI interaction to reset idle timer
        window.addEventListener('click', handleUserActivity);
        window.addEventListener('keypress', handleUserActivity);
        window.addEventListener('touchstart', handleUserActivity);
    }

    public resetAndReconnect() {
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }

        if (this.channelName && this.onPayload) {
            console.log("[ConnectionManager] Immediate reconnection triggered.");
            this.subscribe(this.channelName, this.onPayload, this.onPresenceChange || undefined);
        }
    }

    async subscribe(channelName: string, onPayload: (event: any) => void, onPresenceChange?: (presences: any[]) => void, presenceKey?: string) {
        this.channelName = channelName;
        this.onPayload = onPayload;
        this.onPresenceChange = onPresenceChange || null;
        
        if (presenceKey) {
            this.presenceKey = presenceKey;
        } else if (this.presenceKey === 'user_presence') {
            // Generate a unique fallback key per connection to prevent different tabs/clients from stomping each other's status
            this.presenceKey = 'user_' + Math.random().toString(36).substring(2, 11);
        }
        
        if (this.channel) {
            try {
                await this.supabase.removeChannel(this.channel);
            } catch (err) {
                console.error("[ConnectionManager] Error removing main channel", err);
            }
            this.channel = null;
        }

        const existingChannels = this.supabase.getChannels();
        const existingList = existingChannels.filter(c => c.topic === `realtime:${channelName}`);
        for (const existing of existingList) {
            try {
                await this.supabase.removeChannel(existing);
            } catch (err) {
                console.error("[ConnectionManager] Error removing duplicate channels", err);
            }
        }

        console.log(`[ConnectionManager] Subscribing to channel ${channelName} with presence key: ${this.presenceKey}...`);
        this.onStatusChange('CONNECTING');

        const newChannel = this.supabase.channel(channelName, {
            config: {
                presence: {
                    key: this.presenceKey
                }
            }
        });

        newChannel
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Pesan' }, payload => {
                this.lastHeartbeat = Date.now();
                onPayload({ type: 'INSERT', payload });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Pesan' }, payload => {
                this.lastHeartbeat = Date.now();
                onPayload({ type: 'UPDATE', payload });
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'Pesan' }, payload => {
                this.lastHeartbeat = Date.now();
                onPayload({ type: 'DELETE', payload });
            })
            .on('broadcast', { event: 'typing' }, payload => {
                this.lastHeartbeat = Date.now();
                onPayload({ type: 'TYPING', payload });
            })
            .on('broadcast', { event: 'read' }, payload => {
                this.lastHeartbeat = Date.now();
                onPayload({ type: 'READ', payload });
            })
            .on('presence', { event: 'sync' }, () => {
                const presenceState = newChannel.presenceState();
                if (this.onPresenceChange) {
                    const activeUsers: any[] = [];
                    Object.keys(presenceState).forEach(key => {
                        const userPresenceList = presenceState[key];
                        if (Array.isArray(userPresenceList)) {
                            userPresenceList.forEach(item => {
                                activeUsers.push({ presence_id: key, ...item });
                            });
                        }
                    });
                    this.onPresenceChange(activeUsers);
                }
            });
        
        try {
            await newChannel.subscribe((status, err) => {
                this.handleStatus(status, err);
            });
            this.channel = newChannel;
        } catch (err) {
            console.error("[ConnectionManager] Subscription attempt failed", err);
            this.handleStatus('CHANNEL_ERROR', err);
        }

        this.startHeartbeat();
    }

    public trackUser(username: string, room: 'A' | 'B') {
        this.trackUsername = username;
        this.trackRoom = room;

        if (this.channel) {
            try {
                this.channel.track({
                    username,
                    room,
                    online_at: new Date().toISOString()
                });
            } catch (err) {
                console.error("[ConnectionManager] Error tracking user", err);
            }
        }

        this.startServerHeartbeat();
    }

    private startServerHeartbeat() {
        if (this.serverHeartbeatInterval) {
            clearInterval(this.serverHeartbeatInterval);
        }

        const sendHeartbeat = () => {
            if (!this.trackUsername || !this.trackRoom || this.isInactive) return;

            fetch('/api/players/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: this.trackUsername,
                    room: this.trackRoom
                })
            }).catch(err => {
                console.warn('[ConnectionManager] Server heartbeat ping failed', err);
            });
        };

        // Send immediately
        sendHeartbeat();

        // Heartbeat repeat every 10 seconds (aligned with server registry 10s cleaner cycle)
        this.serverHeartbeatInterval = setInterval(sendHeartbeat, 10000);
    }

    handleStatus(status: string, err?: any) {
        console.log(`[ConnectionManager] Status: ${status}`, err || '');
        
        switch (status) {
            case 'SUBSCRIBED':
                this.onStatusChange('ONLINE');
                this.reconnectAttempts = 0;
                this.isReconnecting = false;
                if (this.reconnectTimeoutId) {
                    clearTimeout(this.reconnectTimeoutId);
                    this.reconnectTimeoutId = null;
                }
                break;
            
            case 'CLOSED':
            case 'CHANNEL_ERROR':
            case 'TIMED_OUT':
                this.onStatusChange('OFFLINE');
                this.triggerReconnect();
                break;
        }
    }

    triggerReconnect() {
        if (this.reconnectTimeoutId) {
            console.log("[ConnectionManager] Reconnect already scheduled, skipping duplicate trigger.");
            return;
        }

        this.isReconnecting = true;
        this.onStatusChange('RECONNECTING');

        let delay = 15000;
        
        if (this.isInactive) {
            // When inactive/no player, reconnect every 3 minutes (180000ms)
            delay = 180000; 
            console.log(`[ConnectionManager] Active players not detected (idle/hidden). Scheduling slow reconnect in ${delay}ms...`);
        } else {
            // Backoff formula capped at 2 minutes
            delay = Math.min(
                this.baseDelay * Math.pow(1.5, this.reconnectAttempts), 
                120000
            );
            console.log(`[ConnectionManager] Reconnecting attempt ${this.reconnectAttempts + 1} scheduled in ${delay}ms...`);
        }

        this.reconnectTimeoutId = setTimeout(() => {
            this.reconnectTimeoutId = null;
            this.reconnect();
        }, delay);
    }

    async reconnect() {
        this.reconnectAttempts++;

        if (this.channel) {
            try {
                await this.supabase.removeChannel(this.channel);
            } catch (err) {
                console.error("[ConnectionManager] Error removing channel in reconnect", err);
            }
            this.channel = null;
        }
        
        if (this.channelName && this.onPayload) {
            console.log(`[ConnectionManager] Reconnecting attempt ${this.reconnectAttempts} for ${this.channelName}...`);
            try {
                await this.subscribe(this.channelName, this.onPayload, this.onPresenceChange || undefined);
            } catch (err) {
                console.error('[ConnectionManager] Reconnect subscribe failed', err);
                this.triggerReconnect();
            }
        } else {
            this.onStatusChange('FAILED');
            this.triggerReconnect();
        }
    }

    startHeartbeat() {
        if (this.checkInterval) clearInterval(this.checkInterval);
        
        this.checkInterval = setInterval(() => {
            const now = Date.now();
            if (this.isInactive) return; // Do not send heartbeat if user is inactive

            if (now - this.lastHeartbeat > 60000 && !this.reconnectTimeoutId) {
                if (this.channel) {
                    this.channel.send({
                        type: 'broadcast',
                        event: 'ping',
                        payload: {}
                    }).then(() => {
                        this.lastHeartbeat = Date.now();
                        this.onStatusChange('ONLINE');
                    }).catch(() => {
                        this.handleStatus('CLOSED');
                    });
                }
            }
        }, 30000);
    }

    cleanup() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        if (this.reconnectTimeoutId) clearTimeout(this.reconnectTimeoutId);
        if (this.checkInterval) clearInterval(this.checkInterval);
        if (this.serverHeartbeatInterval) {
            clearInterval(this.serverHeartbeatInterval);
            this.serverHeartbeatInterval = null;
        }

        // Notify server registry of leave
        if (this.trackUsername && this.trackRoom) {
            fetch('/api/players/leave', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: this.trackUsername,
                    room: this.trackRoom
                })
            }).catch(() => {});
        }

        if (this.channel) {
            try {
                this.supabase.removeChannel(this.channel);
            } catch (err) {}
        }
    }
}
