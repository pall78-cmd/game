import { useEffect, useState, useRef } from 'react';
import { supabaseClient } from '../../supabase';
import { UnoEngine, UnoGameState } from './UnoEngine';
import { TebakKataEngine, TebakKataState } from './TebakKataEngine';

export function useGameRoom(gameId: string, playerID: string, playerName: string, gameType: 'UNO' | 'TEBAK_KATA') {
    const [gameState, setGameState] = useState<UnoGameState | TebakKataState | null>(null);
    const [players, setPlayers] = useState<{id: string, name: string}[]>([]);
    const [isHost, setIsHost] = useState(false);
    const [error, setError] = useState('');
    const [maxPlayers, setMaxPlayers] = useState<number>(4);
    
    const engineRef = useRef<UnoEngine | TebakKataEngine | null>(null);
    const channelRef = useRef<any>(null);

    useEffect(() => {
        if (!gameId) return;
        const fetchLobbyConfig = async () => {
            try {
                const { data, error } = await supabaseClient
                    .from('game_lobbies')
                    .select('max_players')
                    .eq('match_id', gameId);
                if (!error && data && data.length > 0 && data[0].max_players) {
                    setMaxPlayers(data[0].max_players);
                }
            } catch (err) {
                console.error("Gagal mengambil konfigurasi lobby:", err);
            }
        };
        fetchLobbyConfig();
    }, [gameId]);

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

    // Sync players in lobby if game status is 'waiting'
    useEffect(() => {
        if (!isHost || !engineRef.current || players.length === 0) return;
        
        const stateStatus = engineRef.current.state?.status || (gameState as any)?.status;
        if (stateStatus !== 'waiting') return;

        const currentCount = players.length;
        const isFull = currentCount >= maxPlayers;

        if (gameType === 'UNO') {
            const engineState = engineRef.current.state as UnoGameState;
            const enginePlayers = engineState.players || [];
            const presenceIds = players.map(p => p.id).join(',');
            const engineIds = enginePlayers.map(p => p.id).join(',');
            
            let didChange = false;
            if (presenceIds !== engineIds) {
                const updatedPlayers = players.map((p, idx) => {
                    const existing = enginePlayers.find(ep => ep.id === p.id);
                    let hand = existing ? [...existing.hand] : [];
                    if (hand.length === 0) {
                        for (let k = 0; k < 7; k++) {
                            if (engineState.deck && engineState.deck.length > 0) {
                                const card = engineState.deck.pop();
                                if (card) hand.push(card);
                            }
                        }
                    }
                    return {
                        id: p.id,
                        name: p.name || existing?.name || `Player ${idx + 1}`,
                        hand: hand,
                        score: existing?.score || 0,
                        hasCalledUno: existing?.hasCalledUno || false
                    };
                });
                
                engineState.players = updatedPlayers;
                didChange = true;
            }

            if (isFull) {
                engineRef.current.start();
                didChange = true;
            }

            if (didChange) {
                saveToDb(engineState);
                channelRef.current?.send({
                    type: 'broadcast',
                    event: 'state_update',
                    payload: { state: engineState }
                });
                setGameState({ ...engineState });
            }
        } else {
            const state = engineRef.current.state as TebakKataState;
            const enginePlayers = state.players || [];
            const presenceIds = players.map(p => p.id).join(',');
            const engineIds = enginePlayers.join(',');
            
            let didChange = false;
            if (presenceIds !== engineIds) {
                state.players = players.map(p => p.id);
                
                const newScores: Record<string, number> = {};
                players.forEach(p => {
                    newScores[p.id] = state.scores[p.id] || 0;
                });
                state.scores = newScores;
                didChange = true;
            }

            if (isFull) {
                (engineRef.current as any).start();
                didChange = true;
            }

            if (didChange) {
                saveToDb(state);
                channelRef.current?.send({
                    type: 'broadcast',
                    event: 'state_update',
                    payload: { state: state }
                });
                setGameState({ ...state });
            }
        }

        const updateLobbyStatus = async () => {
            try {
                await supabaseClient
                    .from('game_lobbies')
                    .update({
                        current_players: currentCount,
                        status: isFull ? 'playing' : 'waiting'
                    })
                    .eq('match_id', gameId);
            } catch (err) {
                console.error("Gagal mengupdate status lobby di database:", err);
            }
        };
        updateLobbyStatus();

    }, [isHost, players, gameType, gameState, maxPlayers, gameId]);

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
