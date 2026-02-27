import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export type ConnectionStatus = 'CONNECTING' | 'ONLINE' | 'OFFLINE' | 'RECONNECTING' | 'FAILED' | 'RETRY_INIT';

export class ConnectionManager {
    private supabase: SupabaseClient;
    private onStatusChange: (status: ConnectionStatus) => void;
    private reconnectAttempts: number = 0;
    private readonly maxAttempts: number = 10;
    private readonly baseDelay: number = 1000;
    public channel: RealtimeChannel | null = null;
    private isReconnecting: boolean = false;
    private checkInterval: any = null;
    private lastHeartbeat: number = Date.now();

    constructor(supabaseClient: SupabaseClient, onStatusChange?: (status: ConnectionStatus) => void) {
        this.supabase = supabaseClient;
        this.onStatusChange = onStatusChange || (() => {});
        
        // Bind methods
        this.handleStatus = this.handleStatus.bind(this);
        this.reconnect = this.reconnect.bind(this);
        this.startHeartbeat = this.startHeartbeat.bind(this);
    }

    /**
     * Initialize the realtime channel subscription with monitoring.
     */
    subscribe(channelName: string, onPayload: (event: any) => void) {
        if (this.channel) {
            this.supabase.removeChannel(this.channel);
        }

        console.log(`[ConnectionManager] Subscribing to ${channelName}...`);
        this.onStatusChange('CONNECTING');

        this.channel = this.supabase.channel(channelName)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Pesan' }, payload => {
                this.lastHeartbeat = Date.now();
                onPayload({ type: 'INSERT', payload });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Pesan' }, payload => {
                this.lastHeartbeat = Date.now();
                onPayload({ type: 'UPDATE', payload });
            })
            .on('broadcast', { event: 'typing' }, payload => {
                this.lastHeartbeat = Date.now();
                onPayload({ type: 'TYPING', payload });
            })
            .on('broadcast', { event: 'read' }, payload => {
                this.lastHeartbeat = Date.now();
                onPayload({ type: 'READ', payload });
            })
            .subscribe(this.handleStatus);

        this.startHeartbeat();
    }

    /**
     * Handle connection status updates from Supabase.
     */
    handleStatus(status: string, err?: any) {
        console.log(`[ConnectionManager] Status: ${status}`, err || '');
        
        switch (status) {
            case 'SUBSCRIBED':
                this.onStatusChange('ONLINE');
                this.reconnectAttempts = 0;
                this.isReconnecting = false;
                break;
            
            case 'CLOSED':
            case 'CHANNEL_ERROR':
            case 'TIMED_OUT':
                this.onStatusChange('OFFLINE');
                if (!this.isReconnecting) {
                    this.triggerReconnect();
                }
                break;
                
            default:
                // CONNECTING, etc.
                break;
        }
    }

    /**
     * Trigger the reconnection process with exponential backoff.
     */
    triggerReconnect() {
        this.isReconnecting = true;
        
        const delay = Math.min(
            this.baseDelay * Math.pow(1.5, this.reconnectAttempts), 
            30000 // Max 30 seconds delay
        );

        console.log(`[ConnectionManager] Reconnecting in ${delay}ms (Attempt ${this.reconnectAttempts + 1})`);
        this.onStatusChange('RECONNECTING');

        setTimeout(this.reconnect, delay);
    }

    /**
     * Execute the reconnection logic.
     */
    async reconnect() {
        if (this.reconnectAttempts >= this.maxAttempts) {
            console.error("[ConnectionManager] Max reconnect attempts reached. Please refresh.");
            this.onStatusChange('FAILED');
            return;
        }

        this.reconnectAttempts++;

        // Force remove and re-subscribe
        if (this.channel) {
            await this.supabase.removeChannel(this.channel);
        }
        
        // Signal the App to re-run the subscription effect.
        this.onStatusChange('RETRY_INIT'); 
    }

    /**
     * A manual heartbeat check to ensure we aren't silently disconnected.
     */
    startHeartbeat() {
        if (this.checkInterval) clearInterval(this.checkInterval);
        
        this.checkInterval = setInterval(() => {
            const now = Date.now();
            // If we haven't received any event or status update in 60 seconds, check connection
            if (now - this.lastHeartbeat > 60000 && !this.isReconnecting) {
                console.log("[ConnectionManager] No activity for 60s, pinging...");
                // We can send a dummy broadcast to check connection
                if (this.channel) {
                    this.channel.send({
                        type: 'broadcast',
                        event: 'ping',
                        payload: {}
                    }).then(() => {
                        this.lastHeartbeat = Date.now();
                        this.onStatusChange('ONLINE');
                    }).catch(() => {
                        console.warn("[ConnectionManager] Ping failed, triggering reconnect.");
                        this.handleStatus('CLOSED');
                    });
                }
            }
        }, 30000); // Check every 30s
    }

    cleanup() {
        if (this.checkInterval) clearInterval(this.checkInterval);
        if (this.channel) this.supabase.removeChannel(this.channel);
    }
}
