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

    useEffect(() => {
        if (!gameId) return;

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
