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
        this.handleStatus = this.handleStatus.bind(this);
        this.reconnect = this.reconnect.bind(this);
        this.startHeartbeat = this.startHeartbeat.bind(this);
    }

    async subscribe(channelName: string, onPayload: (event: any) => void) {
        if (this.channel) {
            await this.supabase.removeChannel(this.channel);
            this.channel = null;
        }

        const existingChannels = this.supabase.getChannels();
        const existingList = existingChannels.filter(c => c.topic === `realtime:${channelName}`);
        for (const existing of existingList) {
            await this.supabase.removeChannel(existing);
        }

        console.log(`[ConnectionManager] Subscribing to ${channelName}...`);
        this.onStatusChange('CONNECTING');

        const newChannel = this.supabase.channel(channelName);

        newChannel
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
            });
        
        await newChannel.subscribe(this.handleStatus);
        this.channel = newChannel;

        this.startHeartbeat();
    }

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
        }
    }

    triggerReconnect() {
        this.isReconnecting = true;
        
        const delay = Math.min(
            this.baseDelay * Math.pow(1.5, this.reconnectAttempts), 
            30000
        );

        console.log(`[ConnectionManager] Reconnecting in ${delay}ms...`);
        this.onStatusChange('RECONNECTING');

        setTimeout(this.reconnect, delay);
    }

    async reconnect() {
        if (this.reconnectAttempts >= this.maxAttempts) {
            this.onStatusChange('FAILED');
            return;
        }

        this.reconnectAttempts++;

        if (this.channel) {
            await this.supabase.removeChannel(this.channel);
            this.channel = null;
        }
        
        this.onStatusChange('FAILED');
    }

    startHeartbeat() {
        if (this.checkInterval) clearInterval(this.checkInterval);
        
        this.checkInterval = setInterval(() => {
            const now = Date.now();
            if (now - this.lastHeartbeat > 60000 && !this.isReconnecting) {
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
        if (this.checkInterval) clearInterval(this.checkInterval);
        if (this.channel) this.supabase.removeChannel(this.channel);
    }
}
