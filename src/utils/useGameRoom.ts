import { useEffect, useState, useRef } from 'react';
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

    const saveToDb = async (state: any) => {
        if (!gameId || !state) return;
        try {
            await supabaseClient.from('boardgame_state').upsert({
                match_id: gameId,
                state: state,
                initial_state: state,
                metadata: { type: gameType, last_updated: new Date().toISOString() },
                log: []
            }, { onConflict: 'match_id' });
        } catch (err) {
            console.error("Gagal melakukan penulisan state game ke database:", err);
        }
    };

    // Keep isHost state synced in a ref for callbacks to avoid re-subscribing the channel
    const isHostRef = useRef(isHost);
    useEffect(() => {
        isHostRef.current = isHost;
    }, [isHost]);

    useEffect(() => {
        if (!gameId) return;

        const loadInitialState = async () => {
            try {
                const { data, error } = await supabaseClient
                    .from('boardgame_state')
                    .select('state')
                    .eq('match_id', gameId)
                    .single();
                if (!error && data && data.state) {
                    setGameState(data.state);
                    if (engineRef.current) {
                        engineRef.current.state = data.state;
                    }
                }
            } catch (err) {
                console.error("Gagal mengambil state awal game dari database:", err);
            }
        };

        const channelName = `${gameType.toLowerCase()}-${gameId}`;
        const channel = supabaseClient.channel(channelName, {
            config: {
                broadcast: { self: true },
                presence: { key: playerID }
            }
        });
        channelRef.current = channel;

        channel
            .on('presence', { event: 'join' }, ({ newPresences }) => {
                console.log(`${gameType} player joined:`, newPresences);
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
                if (firstPres === playerID && !isHostRef.current) {
                    setIsHost(true);
                }
            })
            .on('broadcast', { event: 'game_action' }, ({ payload }) => {
                if (isHostRef.current && engineRef.current) {
                    const { action, args } = payload;
                    const engine = engineRef.current as any;
                    if (typeof engine[action] === 'function') {
                        if (Array.isArray(args)) {
                            engine[action](...args);
                        } else {
                            engine[action](args);
                        }
                        saveToDb(engine.state);
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
                if (isHostRef.current && engineRef.current) {
                     engineRef.current.state = payload.state;
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ playerId: playerID, gameType, name: playerName });
                    await loadInitialState();
                    channel.send({
                        type: 'broadcast',
                        event: 'request_state',
                        payload: { sender: playerID }
                    });
                }
            });

        channel.on('broadcast', { event: 'request_state' }, ({ payload }) => {
             if (isHostRef.current && engineRef.current) {
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
    }, [gameId, playerID]);

    useEffect(() => {
        if (isHost && !engineRef.current && players.length > 0) {
            if (!gameState) {
                if (gameType === 'UNO') {
                    const playerIds = players.map(p => p.id);
                    const playerNames = players.map(p => p.name);
                    const engine = new UnoEngine(playerIds, playerNames);
                    engineRef.current = engine;
                    saveToDb(engine.state);
                    channelRef.current?.send({
                        type: 'broadcast',
                        event: 'state_update',
                        payload: { state: engine.state }
                    });
                    setGameState({ ...engine.state });
                } else {
                    const engine = new TebakKataEngine(players.map(p => p.id));
                    engineRef.current = engine;
                    saveToDb(engine.state);
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
                 saveToDb(engine.state);
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
