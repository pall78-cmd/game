const fs = require('fs');

const storageManagerContent = `import { SupabaseClient } from '@supabase/supabase-js';

export class StorageManager {
    private supabase: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        this.supabase = supabaseClient;
    }

    async uploadImage(file: File): Promise<string> {
        try {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
            const sanitizedExt = fileExt.replace(/[^a-z0-9]/g, '');
            const fileName = \`\${Date.now()}-\${Math.floor(Math.random() * 10000)}.\${sanitizedExt}\`;
            const filePath = \`uploads/\${fileName}\`;
            
            console.log(\`Uploading image to 'gambar' bucket: \${filePath}\`);
            
            const { error } = await this.supabase.storage.from('gambar').upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type || 'image/jpeg'
            });
            
            if (error) {
                console.error("Supabase Storage Error:", error);
                if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
                    throw new Error("Koneksi gagal (Fetch Failed). Pastikan bucket 'gambar' sudah dibuat dan memiliki policy publik.");
                }
                throw new Error(error.message);
            }
            
            const { data: { publicUrl } } = this.supabase.storage.from('gambar').getPublicUrl(filePath);
            return publicUrl;
        } catch (err: any) {
            console.error("StorageManager.uploadImage Exception:", err);
            throw err;
        }
    }

    async uploadVoiceNote(blob: Blob, ext: string): Promise<string> {
        try {
            const sanitizedExt = ext.replace(/[^a-z0-9]/g, '');
            const fileName = \`vn-\${Date.now()}-\${Math.floor(Math.random() * 10000)}.\${sanitizedExt}\`;
            
            const { error } = await this.supabase.storage.from('voice note').upload(fileName, blob, {
                cacheControl: '3600',
                upsert: false,
                contentType: blob.type || (ext === 'mp4' ? 'audio/mp4' : 'audio/webm')
            });
            
            if (error) {
                console.error("Supabase VN Storage Error:", error);
                throw new Error(error.message);
            }
            
            const { data: { publicUrl } } = this.supabase.storage.from('voice note').getPublicUrl(fileName);
            return publicUrl;
        } catch (err: any) {
            console.error("StorageManager.uploadVoiceNote Exception:", err);
            throw err;
        }
    }
}
`;
fs.writeFileSync('src/utils/StorageManager.ts', storageManagerContent, 'utf8');

const connectionManagerContent = `import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

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
        const existingList = existingChannels.filter(c => c.topic === \`realtime:\${channelName}\`);
        for (const existing of existingList) {
            await this.supabase.removeChannel(existing);
        }

        console.log(\`[ConnectionManager] Subscribing to \${channelName}...\`);
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
        console.log(\`[ConnectionManager] Status: \${status}\`, err || '');
        
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

        console.log(\`[ConnectionManager] Reconnecting in \${delay}ms...\`);
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
`;
fs.writeFileSync('src/utils/ConnectionManager.ts', connectionManagerContent, 'utf8');

const useGameRoomContent = `import { useEffect, useState, useRef } from 'react';
import { supabaseClient } from '../../supabase';
import { UnoEngine, UnoGameState } from './UnoEngine';
import { TebakKataEngine, TebakKataState } from './TebakKataEngine';

export function useGameRoom(gameId: string, playerID: string, playerName: string, gameType: 'UNO' | 'TEBAK_KATA') {
    const [gameState, setGameState] = useState<UnoGameState | TebakKataState | null>(null);
    const [players, setPlayers] = useState<{id: string, name: string}[]>([]);
    const [isHost, setIsHost] = useState(false);
    const [error, setError] = useState('');
    
    const engineRef = useRef<UnoEngine | TebakKataEngine | null>(null);
    const channelRef = useRef<any>(null);

    useEffect(() => {
        if (!gameId) return;

        const channelName = \`\${gameType.toLowerCase()}-\${gameId}\`;
        const channel = supabaseClient.channel(channelName, {
            config: {
                broadcast: { self: true },
                presence: { key: playerID }
            }
        });
        channelRef.current = channel;

        channel
            .on('presence', { event: 'join' }, ({ newPresences }) => {
                console.log(\`\${gameType} player joined:\`, newPresences);
            })
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const currentPlayers: {id: string, name: string}[] = [];
                let firstPres: string | null = null;
                
                Object.keys(state).sort().forEach(key => {
                    const presences = state[key] as any[];
                    if (presences.length > 0) {
                        if (!firstPres) firstPres = key;
                        currentPlayers.push({ id: key, name: presences[0].name });
                    }
                });
                
                setPlayers(currentPlayers);
                if (firstPres === playerID && !isHost) {
                    setIsHost(true);
                }
            })
            .on('broadcast', { event: 'game_action' }, ({ payload }) => {
                if (isHost && engineRef.current) {
                    const { action, args } = payload;
                    const engine = engineRef.current as any;
                    if (typeof engine[action] === 'function') {
                        if (Array.isArray(args)) {
                            engine[action](...args);
                        } else {
                            engine[action](args);
                        }
                        channel.send({
                            type: 'broadcast',
                            event: 'state_update',
                            payload: { state: engine.state }
                        });
                        setGameState({ ...engine.state });
                    }
                }
            })
            .on('broadcast', { event: 'state_update' }, ({ payload }) => {
                setGameState(payload.state);
                if (isHost && engineRef.current) {
                     engineRef.current.state = payload.state;
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ playerId: playerID, gameType, name: playerName });
                    channel.send({
                        type: 'broadcast',
                        event: 'request_state',
                        payload: { sender: playerID }
                    });
                }
            });

        channel.on('broadcast', { event: 'request_state' }, ({ payload }) => {
             if (isHost && engineRef.current) {
                 channel.send({
                     type: 'broadcast',
                     event: 'state_update',
                     payload: { state: engineRef.current.state }
                 });
             }
        });

        return () => {
             channel.unsubscribe();
        };
    }, [gameId, playerID, isHost]);

    useEffect(() => {
        if (isHost && !engineRef.current && players.length > 0) {
            if (!gameState) {
                if (gameType === 'UNO') {
                    const playerIds = players.map(p => p.id);
                    const playerNames = players.map(p => p.name);
                    const engine = new UnoEngine(playerIds, playerNames);
                    engineRef.current = engine;
                    channelRef.current?.send({
                        type: 'broadcast',
                        event: 'state_update',
                        payload: { state: engine.state }
                    });
                    setGameState({ ...engine.state });
                } else {
                    const engine = new TebakKataEngine(players.map(p => p.id));
                    engineRef.current = engine;
                    channelRef.current?.send({
                        type: 'broadcast',
                        event: 'state_update',
                        payload: { state: engine.state }
                    });
                    setGameState({ ...engine.state });
                }
            } else {
               if (gameType === 'UNO') {
                    const engine = new UnoEngine([], []);
                    engine.state = gameState as UnoGameState;
                    engineRef.current = engine;
               } else {
                    const engine = new TebakKataEngine([]);
                    engine.state = gameState as TebakKataState;
                    engineRef.current = engine;
               }
            }
        }
    }, [isHost, players.length, gameType, gameState]);

    const sendAction = (action: string, ...args: any[]) => {
        if (isHost && engineRef.current) {
             const engine = engineRef.current as any;
             if (typeof engine[action] === 'function') {
                 engine[action](...args);
                 channelRef.current?.send({
                     type: 'broadcast',
                     event: 'state_update',
                     payload: { state: engine.state }
                 });
                 setGameState({ ...engine.state });
             }
        } else {
            channelRef.current?.send({
                type: 'broadcast',
                event: 'game_action',
                payload: { action, args }
            });
        }
    };

    return { gameState, players, isHost, error, sendAction, setGameState };
}
`;
fs.writeFileSync('src/utils/useGameRoom.ts', useGameRoomContent, 'utf8');

const sideAFix = fs.readFileSync('src/components/SideA.tsx', 'utf8')
    .replace("import { ConnectionManager } from '../utils/ConnectionManager';", "import { ConnectionManager } from '../utils/ConnectionManager';\nimport { supabaseClient } from '../../supabase';")
    .replace(/new ConnectionManager\(setConnStatus\)/g, 'new ConnectionManager(supabaseClient, setConnStatus)')
    .replace(/new StorageManager\(\)/g, 'new StorageManager(supabaseClient)')
    .replace(/connManagerRef\.current\.reconnectAction\(\)/g, 'connManagerRef.current.triggerReconnect()')
    .replace(/connManagerRef\.current\.sendTyping\(([^,]+),\s*([^\)]+)\)/g, "connManagerRef.current.channel?.send({ type: 'broadcast', event: 'typing', payload: { user: $1, typing: $2 } })")
    .replace(/connManagerRef\.current\.sendReadStatus\(([^)]+)\)/g, "connManagerRef.current.channel?.send({ type: 'broadcast', event: 'read', payload: { user: $1 } })")
    .replace(/const data = await fetch\('\/api\/messages'\)\.then\(res => res\.json\(\)\);/g, "let query = supabaseClient.from('Pesan').select('*').order('id', { ascending: true });\nconst { data } = await query;")
    .replace(/await fetch\('\/api\/clear-messages', \{ method: 'POST' \}\);/g, "let deleteQuery = supabaseClient.from('Pesan').delete().neq('id', 0);\nawait deleteQuery;")
    .replace(/\/\/ Removed storage call/g, '/* Removed storage */')
    .replace(/supabaseClient\.storage\.from/g, '/* removed storage call */ supabaseClient.storage.from');
fs.writeFileSync('src/components/SideA.tsx', sideAFix, 'utf8');

const sideBFix = fs.readFileSync('src/components/SideB.tsx', 'utf8')
    .replace("import { ConnectionManager } from '../utils/ConnectionManager';", "import { ConnectionManager } from '../utils/ConnectionManager';\nimport { supabaseClient } from '../../supabase';")
    .replace(/new ConnectionManager\(setConnStatus\)/g, 'new ConnectionManager(supabaseClient, setConnStatus)')
    .replace(/new StorageManager\(\)/g, 'new StorageManager(supabaseClient)')
    .replace(/connManagerRef\.current\.reconnectAction\(\)/g, 'connManagerRef.current.triggerReconnect()')
    .replace(/connManagerRef\.current\.sendTyping\(([^,]+),\s*([^\)]+)\)/g, "connManagerRef.current.channel?.send({ type: 'broadcast', event: 'typing', payload: { user: $1, typing: $2 } })")
    .replace(/connManagerRef\.current\.sendReadStatus\(([^)]+)\)/g, "connManagerRef.current.channel?.send({ type: 'broadcast', event: 'read', payload: { user: $1 } })")
    .replace(/const data = await fetch\('\/api\/messages'\)\.then\(res => res\.json\(\)\);/g, "let query = supabaseClient.from('Pesan').select('*').order('id', { ascending: true });\nconst { data } = await query;")
    .replace(/await fetch\('\/api\/clear-messages', \{ method: 'POST' \}\);/g, "let deleteQuery = supabaseClient.from('Pesan').delete().neq('id', 0);\nawait deleteQuery;")
    .replace(/\/\/ Removed storage call/g, '/* Removed storage */')
    .replace(/supabaseClient\.storage\.from/g, '/* removed storage call */ supabaseClient.storage.from');
fs.writeFileSync('src/components/SideB.tsx', sideBFix, 'utf8');
