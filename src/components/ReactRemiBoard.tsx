import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Game41State, Card } from '../utils/Game41Engine';
import { REMI_CARD_SVG } from '../constants/boardGameDeck';

interface RemiBoardProps {
    G: Game41State;
    ctx: any;
    moves: any;
    playerID: string | null;
    matchID: string;
    username?: string;
    onLeave?: () => void;
    onGameEnd?: (winner: string, players: string[]) => void;
}

export const ReactRemiBoard: React.FC<RemiBoardProps> = ({ G, ctx, moves, playerID, matchID, username, onLeave, onGameEnd }) => {
    React.useEffect(() => {
        if (G && G.status === 'finished' && G.winner) {
            const playerNames = G.players.map(p => p.name || p.id);
            onGameEnd?.(G.winner, playerNames);
        }
    }, [G?.status, G?.winner]);

    const handleDrawDeck = () => {
        if (G.status !== 'playing') return;
        const myIndex = G.players.findIndex(p => p.id === playerID);
        const myPlayer = G.players[myIndex];
        if (myIndex === G.currentPlayerIndex && myPlayer && myPlayer.hand.length === 4) {
            moves.drawCard();
        }
    };

    const handleDrawDiscard = () => {
        if (G.status !== 'playing') return;
        const myIndex = G.players.findIndex(p => p.id === playerID);
        const myPlayer = G.players[myIndex];
        if (myIndex === G.currentPlayerIndex && myPlayer && myPlayer.hand.length === 4) {
            moves.drawFromDiscard();
        }
    };

    const handleDiscard = (index: number) => {
        if (G.status !== 'playing') return;
        const myIndex = G.players.findIndex(p => p.id === playerID);
        const myPlayer = G.players[myIndex];
        if (myIndex === G.currentPlayerIndex && myPlayer && myPlayer.hand.length === 5) {
            moves.discardCard(index);
        }
    };

    if (!G) {
        return <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center text-white">Loading game state...</div>;
    }

    const myPlayer = G.players.find(p => p.id === playerID);
    const isMyTurn = G.players[G.currentPlayerIndex]?.id === playerID;
    const opponents = G.players.filter(p => p.id !== playerID);

    return (
        <div className="fixed inset-0 bg-zinc-950 z-[1000] flex flex-col font-sans overflow-hidden text-white">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-black/50 border-b border-white/10">
                <div className="flex items-center gap-4">
                    {onLeave && (
                        <button onClick={onLeave} className="text-white/70 hover:text-white transition-colors">
                            ← Leave Game
                        </button>
                    )}
                    <h1 className="text-xl font-bold tracking-widest">REMI 41</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full bg-green-500`}></div>
                        <span className="text-white/50 text-sm">{G.players.length} Players</span>
                    </div>
                </div>
            </div>

            {/* Game Area */}
            <div className="flex-1 relative flex flex-col items-center justify-center p-8 mt-16">
                
                {G.status === 'waiting' && (
                    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/80">
                        <div className="bg-zinc-900 p-8 rounded-2xl border border-white/10 text-center max-w-md w-full">
                            <h2 className="text-2xl font-bold mb-4">Waiting for players...</h2>
                            <p className="text-white/50 mb-8">
                                Share the Game ID: <span className="text-white font-mono bg-white/10 px-2 py-1 rounded">{matchID}</span>
                            </p>
                            <button
                                onClick={() => moves.startGame()}
                                className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-colors"
                            >
                                Start Game
                            </button>
                        </div>
                    </div>
                )}

                {/* Opponents */}
                <div className="absolute top-8 left-0 right-0 flex justify-center gap-8 px-8">
                    {opponents.map((opp, i) => (
                        <div key={opp.id} className={`flex flex-col items-center p-4 rounded-xl bg-white/5 border ${G.players[G.currentPlayerIndex]?.id === opp.id ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'border-white/10'}`}>
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
                {G.status === 'playing' && (
                    <div className="flex items-center gap-12">
                        {/* Deck */}
                        <div 
                            className={`relative w-32 h-48 rounded-xl cursor-pointer transition-transform ${isMyTurn && myPlayer?.hand.length === 4 ? 'hover:scale-105 hover:-translate-y-2' : 'opacity-50'}`}
                            onClick={handleDrawDeck}
                        >
                            <div className="absolute inset-0 bg-indigo-900 rounded-xl border-4 border-white/20 flex items-center justify-center shadow-xl">
                                <span className="text-white/30 font-bold rotate-45 text-2xl">REMI</span>
                            </div>
                            <div className="absolute -bottom-8 left-0 right-0 text-center text-sm text-white/50">
                                {G.deck.length} cards
                            </div>
                        </div>

                        {/* Discard Pile */}
                        <div 
                            className={`relative w-32 h-48 transition-transform ${isMyTurn && myPlayer?.hand.length === 4 && G.discardPile.length > 0 ? 'cursor-pointer hover:scale-105 hover:-translate-y-2' : ''}`}
                            onClick={handleDrawDiscard}
                        >
                            {G.discardPile.length > 0 ? (
                                <div 
                                    className="absolute inset-0 shadow-2xl"
                                    dangerouslySetInnerHTML={{ 
                                        __html: REMI_CARD_SVG(
                                            G.discardPile[G.discardPile.length - 1].suit, 
                                            G.discardPile[G.discardPile.length - 1].value
                                        ) 
                                    }}
                                />
                            ) : (
                                <div className="absolute inset-0 rounded-xl border-4 border-dashed border-white/20 flex items-center justify-center">
                                    <span className="text-white/30 text-sm text-center px-4">Discard Pile</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Player Hand */}
                {myPlayer && G.status === 'playing' && (
                    <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center">
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`px-6 py-2 rounded-full font-bold tracking-widest ${isMyTurn ? 'bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.5)]' : 'bg-white/10 text-white/50'}`}>
                                {isMyTurn ? (myPlayer.hand.length === 4 ? 'DRAW A CARD' : 'DISCARD A CARD') : 'WAITING...'}
                            </div>
                            <div className="px-6 py-2 bg-white/10 text-yellow-400 font-bold rounded-full">
                                Score: {myPlayer.score}
                            </div>
                        </div>
                        
                        <div className="flex justify-center flex-wrap gap-4 px-8 max-w-full">
                            {myPlayer.hand.map((card, i) => {
                                const isPlayable = isMyTurn && myPlayer.hand.length === 5;

                                return (
                                    <motion.div
                                        key={`${card.suit}-${card.value}-${i}`}
                                        initial={{ y: 50, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        whileHover={isPlayable ? { y: -20, scale: 1.1, zIndex: 50 } : {}}
                                        className={`relative w-32 h-48 transition-all ${isPlayable ? 'cursor-pointer hover:z-50' : 'opacity-90'}`}
                                        style={{ zIndex: i }}
                                        onClick={() => isPlayable && handleDiscard(i)}
                                    >
                                        <div 
                                            className="w-full h-full shadow-xl"
                                            dangerouslySetInnerHTML={{ __html: REMI_CARD_SVG(card.suit, card.value) }}
                                        />
                                        {isPlayable && (
                                            <div className="absolute -top-3 -right-3 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold opacity-0 hover:opacity-100 transition-opacity shadow-lg">
                                                ×
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Winner Screen */}
                {G.status === 'finished' && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
                        <motion.div 
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-6xl font-bold text-yellow-400 mb-8 tracking-widest text-center"
                        >
                            {G.winner === myPlayer?.name ? 'YOU WON!' : `${G.winner} WON!`}
                        </motion.div>
                        {onLeave && (
                            <button 
                                onClick={onLeave}
                                className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-colors"
                            >
                                Back to Lobby
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
