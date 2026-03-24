import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { Game41State, Card } from '../utils/Game41Engine';
import { REMI_CARD_SVG } from '../constants/boardGameDeck';

interface RemiBoardProps {
    socket: Socket;
    gameId: string;
    username: string;
    onLeave: () => void;
    initialGameState?: Game41State | null;
}

export const ReactRemiBoard: React.FC<RemiBoardProps> = ({ socket, gameId, username, onLeave, initialGameState }) => {
    const [gameState, setGameState] = useState<Game41State | null>(initialGameState || null);

    useEffect(() => {
        const handleGameUpdate = (data: any) => {
            if (data.type === 'STATE_UPDATE') {
                setGameState(data.state);
            }
        };

        socket.on('gameUpdate', handleGameUpdate);
        return () => {
            socket.off('gameUpdate', handleGameUpdate);
        };
    }, [socket]);

    const handleStartGame = () => {
        socket.emit('gameAction', { gameId, action: 'start' });
    };

    const handleDrawDeck = () => {
        if (!gameState || gameState.status !== 'playing') return;
        const myIndex = gameState.players.findIndex(p => p.id === socket.id);
        const myPlayer = gameState.players[myIndex];
        if (myIndex === gameState.currentPlayerIndex && myPlayer && myPlayer.hand.length === 4) {
            socket.emit('gameAction', { gameId, action: 'draw' });
        }
    };

    const handleDrawDiscard = () => {
        if (!gameState || gameState.status !== 'playing') return;
        const myIndex = gameState.players.findIndex(p => p.id === socket.id);
        const myPlayer = gameState.players[myIndex];
        if (myIndex === gameState.currentPlayerIndex && myPlayer && myPlayer.hand.length === 4) {
            socket.emit('gameAction', { gameId, action: 'drawDiscard' });
        }
    };

    const handleDiscard = (index: number) => {
        if (!gameState || gameState.status !== 'playing') return;
        const myIndex = gameState.players.findIndex(p => p.id === socket.id);
        const myPlayer = gameState.players[myIndex];
        if (myIndex === gameState.currentPlayerIndex && myPlayer && myPlayer.hand.length === 5) {
            socket.emit('gameAction', { gameId, action: 'discard', payload: { cardIndex: index } });
        }
    };

    if (!gameState) {
        return <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center text-white">Loading game state...</div>;
    }

    const myPlayer = gameState.players.find(p => p.id === socket.id);
    const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === socket.id;
    const opponents = gameState.players.filter(p => p.id !== socket.id);

    return (
        <div className="fixed inset-0 bg-zinc-950 z-[1000] flex flex-col font-sans overflow-hidden text-white">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-black/50 border-b border-white/10">
                <div className="flex items-center gap-4">
                    <button onClick={onLeave} className="text-white/70 hover:text-white transition-colors">
                        ← Leave Game
                    </button>
                    <h1 className="text-xl font-bold tracking-widest">REMI 41</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${socket.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-white/50 text-sm">{gameState.players.length} Players</span>
                    </div>
                </div>
            </div>

            {/* Game Area */}
            <div className="flex-1 relative flex flex-col items-center justify-center p-8 mt-16">
                
                {/* Opponents */}
                <div className="absolute top-8 left-0 right-0 flex justify-center gap-8 px-8">
                    {opponents.map((opp, i) => (
                        <div key={opp.id} className={`flex flex-col items-center p-4 rounded-xl bg-white/5 border ${gameState.players[gameState.currentPlayerIndex]?.id === opp.id ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'border-white/10'}`}>
                            <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-xl mb-2">
                                {opp.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold">{opp.name}</span>
                            <span className="text-sm text-white/50">{opp.hand.length} cards</span>
                            <span className="text-xs text-yellow-500 font-bold mt-1">Score: {opp.score}</span>
                        </div>
                    ))}
                </div>

                {/* Center Play Area */}
                {gameState.status === 'playing' && (
                    <div className="flex items-center gap-12">
                        {/* Deck */}
                        <div 
                            className={`relative w-32 h-48 rounded-xl cursor-pointer transition-transform ${isMyTurn && myPlayer.hand.length === 4 ? 'hover:scale-105 hover:-translate-y-2 shadow-[0_0_20px_rgba(255,255,255,0.3)]' : 'opacity-50'}`}
                            onClick={handleDrawDeck}
                        >
                            <div className="absolute inset-0 bg-blue-900 rounded-xl border-4 border-white/20 flex items-center justify-center shadow-xl">
                                <span className="text-white/30 font-bold rotate-45 text-2xl">REMI</span>
                            </div>
                            <div className="absolute -bottom-8 left-0 right-0 text-center text-sm text-white/50">
                                {gameState.deck.length} cards
                            </div>
                        </div>

                        {/* Discard Pile */}
                        <div 
                            className={`relative w-32 h-48 rounded-xl transition-transform ${isMyTurn && myPlayer.hand.length === 4 && gameState.discardPile.length > 0 ? 'cursor-pointer hover:scale-105 hover:-translate-y-2 shadow-[0_0_20px_rgba(255,255,255,0.3)]' : ''}`}
                            onClick={handleDrawDiscard}
                        >
                            {gameState.discardPile.length > 0 ? (
                                <div 
                                    className="absolute inset-0 shadow-2xl"
                                    dangerouslySetInnerHTML={{ 
                                        __html: REMI_CARD_SVG(
                                            gameState.discardPile[gameState.discardPile.length - 1].suit, 
                                            gameState.discardPile[gameState.discardPile.length - 1].value
                                        ) 
                                    }}
                                />
                            ) : (
                                <div className="absolute inset-0 border-2 border-dashed border-white/20 rounded-xl flex items-center justify-center">
                                    <span className="text-white/20 text-sm">Empty</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Player Hand */}
                {myPlayer && gameState.status === 'playing' && (
                    <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center">
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`px-6 py-2 rounded-full font-bold tracking-widest ${isMyTurn ? 'bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.5)]' : 'bg-white/10 text-white/50'}`}>
                                {isMyTurn ? (myPlayer.hand.length === 5 ? 'DISCARD A CARD' : 'DRAW A CARD') : 'WAITING...'}
                            </div>
                            <div className="px-4 py-2 bg-white/10 rounded-full text-white/80 font-bold">
                                Score: {myPlayer.score}
                            </div>
                        </div>
                        
                        <div className="flex justify-center flex-wrap gap-[-40px] px-8 max-w-full">
                            {myPlayer.hand.map((card, i) => {
                                const canDiscard = isMyTurn && myPlayer.hand.length === 5;

                                return (
                                    <motion.div
                                        key={`${card.id}-${i}`}
                                        initial={{ y: 50, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        whileHover={canDiscard ? { y: -20, scale: 1.1, zIndex: 50 } : {}}
                                        className={`relative w-24 h-36 -ml-8 first:ml-0 transition-all ${canDiscard ? 'cursor-pointer hover:z-50' : 'opacity-80'}`}
                                        style={{ zIndex: i }}
                                        onClick={() => canDiscard && handleDiscard(i)}
                                    >
                                        <div 
                                            className="w-full h-full shadow-xl"
                                            dangerouslySetInnerHTML={{ __html: REMI_CARD_SVG(card.suit, card.value) }}
                                        />
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>

            {/* Waiting Room Overlay */}
            {gameState.status === 'waiting' && (
                <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-zinc-900 p-8 rounded-2xl border border-white/10 max-w-md w-full text-center">
                        <h2 className="text-2xl font-bold text-white mb-6">Waiting Room</h2>
                        <div className="space-y-2 mb-8 text-left">
                            {gameState.players.map((p) => (
                                <div key={p.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                                        {p.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-white">{p.name} {p.id === socket.id ? '(You)' : ''}</span>
                                </div>
                            ))}
                        </div>
                        {gameState.players.length >= 2 ? (
                            <button
                                onClick={handleStartGame}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors"
                            >
                                Start Game
                            </button>
                        ) : (
                            <div className="text-white/50">Waiting for more players... (Min 2)</div>
                        )}
                    </div>
                </div>
            )}

            {/* Winner Overlay */}
            {gameState.status === 'finished' && (
                <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center">
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", bounce: 0.5 }}
                        className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-500 mb-8 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]"
                    >
                        {gameState.winner} WINS!
                    </motion.div>
                    <button
                        onClick={onLeave}
                        className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all hover:scale-105"
                    >
                        Back to Lobby
                    </button>
                </div>
            )}
        </div>
    );
};
