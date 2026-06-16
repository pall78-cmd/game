import { useEffect, useState, useRef } from 'react';
import { supabaseClient } from '../../supabase';
import { UnoEngine, UnoGameState } from './UnoEngine';
import { TebakKataEngine, TebakKataState } from './TebakKataEngine';

export function useGameRoom(gameId: string, playerID: string, playerName: string, gameType: 'UNO' | 'TEBAK_KATA', initialIsHost?: boolean) {
    const [gameState, setGameState] = useState<UnoGameState | TebakKataState | null>(null);
    const [players, setPlayers] = useState<{id: string, name: string}[]>([]);
    const [isHost, setIsHost] = useState(initialIsHost || false);
    const [error, setError] = useState('');
    const [maxPlayers, setMaxPlayers] = useState<number>(4);
    const [lobbyHostId, setLobbyHostId] = useState<string | null>(null);
    
    const engineRef = useRef<UnoEngine | TebakKataEngine | null>(null);
    const channelRef = useRef<any>(null);

    useEffect(() => {
        if (!gameId) return;
        let active = true;
        let retryCount = 0;
        const maxRetries = 6;

        const fetchLobbyConfig = async () => {
            try {
                const { data, error } = await supabaseClient
                    .from('game_lobbies')
                    .select('max_players, host_id')
                    .eq('match_id', gameId);
                
                if (!active) return;

                if (!error && data && data.length > 0) {
                    if (data[0].max_players) {
                        setMaxPlayers(data[0].max_players);
                    }
                    if (data[0].host_id) {
                        setLobbyHostId(data[0].host_id);
                        setIsHost(data[0].host_id === playerID);
                    }
                } else {
                    // Try again after a short delay if not found (compensates for db row writing lag)
                    if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(fetchLobbyConfig, 400);
                    }
                }
            } catch (err) {
                console.error("Gagal mengambil konfigurasi lobby:", err);
                if (retryCount < maxRetries && active) {
                    retryCount++;
                    setTimeout(fetchLobbyConfig, 800);
                }
            }
        };
        fetchLobbyConfig();
        return () => {
            active = false;
        };
    }, [gameId, playerID]);

    const saveToDb = async (state: any) => {
        if (!gameId || !state) return;
        try {
            // Optimistic Concurrency Control (Version Lock)
            const { data: currentDbState } = await supabaseClient
                .from('boardgame_state')
                .select('state')
                .eq('match_id', gameId)
                .maybeSingle();

            const currentDbVersion = currentDbState?.state?.version || 0;
            const newStateVersion = state.version || 0;

            if (currentDbState && currentDbVersion > newStateVersion) {
                console.warn(`[useGameRoom] Version Lock Rejected write. DB version (${currentDbVersion}) is newer than write version (${newStateVersion}).`);
                return;
            }

            const nextVersion = Math.max(currentDbVersion + 1, newStateVersion + 1);
            const stateWithVersion = { ...state, version: nextVersion };

            const { error: upsertErr } = await supabaseClient.from('boardgame_state').upsert({
                match_id: gameId,
                state: stateWithVersion,
                initial_state: stateWithVersion,
                metadata: { type: gameType, last_updated: new Date().toISOString() },
                log: []
            }, { onConflict: 'match_id' });

            if (upsertErr) {
                console.error("Gagal melakukan penulisan state game ke database:", upsertErr);
            } else {
                state.version = nextVersion;
            }
        } catch (err) {
            console.error("Gagal melakukan penulisan state game ke database:", err);
        }
    };

    // Keep isHost state synced in a ref for callbacks to avoid re-subscribing the channel
    const isHostRef = useRef(isHost);
    useEffect(() => {
        isHostRef.current = isHost;
    }, [isHost]);

    const lobbyHostIdRef = useRef<string | null>(null);
    useEffect(() => {
        lobbyHostIdRef.current = lobbyHostId;
    }, [lobbyHostId]);

    // Synchronize isHost state deterministically when lobbyHostId is retrieved
    useEffect(() => {
        if (!gameId) return;
        if (lobbyHostId) {
            setIsHost(lobbyHostId === playerID);
        } else if (initialIsHost) {
            setIsHost(true);
        }
    }, [lobbyHostId, playerID, gameId, initialIsHost]);

    // Engine instantiation on BOTH Host and Guest
    useEffect(() => {
        if (gameState) {
            if (!engineRef.current) {
                if (gameType === 'UNO') {
                    const engine = new UnoEngine([], []);
                    engine.state = gameState as UnoGameState;
                    engineRef.current = engine;
                    console.log("[useGameRoom] Engine UnoEngine initialized with loaded state");
                } else {
                    const engine = new TebakKataEngine([]);
                    engine.state = gameState as TebakKataState;
                    engineRef.current = engine;
                    console.log("[useGameRoom] Engine TebakKataEngine initialized with loaded state");
                }
            } else {
                // Keep existing engine state synced with database gameState
                engineRef.current.state = gameState as any;
            }
        } else {
            // No gameState loaded yet. If we are the Host, create the initial default game state!
            if (isHost && players.length > 0 && !engineRef.current) {
                console.log("[useGameRoom] Generating new default game state on Host client...");
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
            }
        }
    }, [isHost, players.length, gameType, gameState]);

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
                
                if (lobbyHostIdRef.current) {
                    setIsHost(lobbyHostIdRef.current === playerID);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'boardgame_state',
                filter: `match_id=eq.${gameId}`
            }, (payload: any) => {
                console.log("[useGameRoom] Postgres Realtime state update received:", payload);
                if (payload.new && payload.new.state) {
                    const incomingVersion = payload.new.state.version || 0;
                    const currentLocalVersion = engineRef.current?.state?.version || 0;
                    
                    if (incomingVersion >= currentLocalVersion) {
                        setGameState(payload.new.state);
                        if (engineRef.current) {
                            engineRef.current.state = payload.new.state;
                        }
                    } else {
                        console.log(`[useGameRoom] Ignored stale incoming state (income: v${incomingVersion}, local: v${currentLocalVersion})`);
                    }
                }
            })
            .on('broadcast', { event: 'game_action' }, ({ payload }) => {
                const { action, args } = payload;
                if (engineRef.current) {
                    const engine = engineRef.current as any;
                    if (typeof engine[action] === 'function') {
                        if (Array.isArray(args)) {
                            engine[action](...args);
                        } else {
                            engine[action](args);
                        }
                        if (isHostRef.current) {
                            saveToDb(engine.state);
                        }
                        setGameState({ ...engine.state });
                    }
                }
            })
            .on('broadcast', { event: 'state_update' }, ({ payload }) => {
                setGameState(payload.state);
                if (engineRef.current) {
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
             if (engineRef.current) {
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
                
                // Update match status in game_lobbies row to 'playing'
                supabaseClient
                    .from('game_lobbies')
                    .update({ status: 'playing' })
                    .eq('match_id', gameId)
                    .then(() => {});
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
                
                // Update match status in game_lobbies row to 'playing'
                supabaseClient
                    .from('game_lobbies')
                    .update({ status: 'playing' })
                    .eq('match_id', gameId)
                    .then(() => {});
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
        if (engineRef.current) {
            const engine = engineRef.current as any;
            if (typeof engine[action] === 'function') {
                console.log(`[useGameRoom] Executing action local: ${action}`, args);
                
                // Apply move locally so active player is highly responsive
                engine[action](...args);
                
                // Save to database
                saveToDb(engine.state);
                
                // Broadcast state update to everyone else so other screens refresh instantly
                channelRef.current?.send({
                    type: 'broadcast',
                    event: 'state_update',
                    payload: { state: engine.state }
                });
                
                // Update local hook state
                setGameState({ ...engine.state });

                // If starting the game, update lobby table in Supabase
                if (action === 'start' || action === 'startGame') {
                    supabaseClient
                        .from('game_lobbies')
                        .update({ status: 'playing' })
                        .eq('match_id', gameId)
                        .then(() => {
                            console.log("[useGameRoom] DB Game Lobby status transitioned to playing");
                        });
                }
            } else {
                console.error(`[useGameRoom] Action ${action} is not a function on engine`);
            }
        } else {
            console.warn('[useGameRoom] engineRef.current is not initialized; fallback send over broadcast');
            channelRef.current?.send({
                type: 'broadcast',
                event: 'game_action',
                payload: { action, args }
            });
        }
    };

    return { gameState, players, isHost, error, sendAction, setGameState };
}
