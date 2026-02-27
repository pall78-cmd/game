/**
 * Connection Manager for ORACLE
 * Handles Supabase Realtime connection stability, auto-reconnection, and status monitoring.
 */

class ConnectionManager {
    constructor(supabaseClient, onStatusChange) {
        this.supabase = supabaseClient;
        this.onStatusChange = onStatusChange || (() => {});
        this.reconnectAttempts = 0;
        this.maxAttempts = 10;
        this.baseDelay = 1000; // 1 second
        this.channel = null;
        this.isReconnecting = false;
        this.checkInterval = null;
        this.lastHeartbeat = Date.now();
        
        // Bind methods
        this.handleStatus = this.handleStatus.bind(this);
        this.reconnect = this.reconnect.bind(this);
        this.startHeartbeat = this.startHeartbeat.bind(this);
    }

    /**
     * Initialize the realtime channel subscription with monitoring.
     * @param {string} channelName - The name of the channel to subscribe to.
     * @param {function} onPayload - Callback for receiving messages.
     */
    subscribe(channelName, onPayload) {
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
    handleStatus(status, err) {
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
        
        // The subscription logic is handled by the consumer re-calling subscribe, 
        // OR we can just re-subscribe the existing channel object if Supabase client supports it.
        // However, usually it's cleaner to rebuild the channel.
        // To keep it simple here, we assume the App component will react to 'RECONNECTING' 
        // or we just re-trigger the subscription if we stored the params.
        
        // Actually, Supabase client handles some auto-reconnect, but often fails on network switch.
        // We will signal the App to re-run the subscription effect.
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

window.ConnectionManager = ConnectionManager;
