import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { UnoGameState, Card } from '../utils/UnoEngine';
import { UNO_CARD_SVG } from '../constants/boardGameDeck';

interface UnoBoardProps {
    socket: Socket;
    gameId: string;
    username: string;
    onLeave: () => void;
    initialGameState?: UnoGameState | null;
}

export const ReactUnoBoard: React.FC<UnoBoardProps> = ({ socket, gameId, username, onLeave, initialGameState }) => {
    const [gameState, setGameState] = useState<UnoGameState | null>(initialGameState || null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [pendingWildCardIndex, setPendingWildCardIndex] = useState<number | null>(null);

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

    const handleDrawCard = () => {
        if (!gameState || gameState.status !== 'playing') return;
        const myIndex = gameState.players.findIndex(p => p.id === socket.id);
        if (myIndex === gameState.currentPlayerIndex) {
            socket.emit('gameAction', { gameId, action: 'draw' });
        }
    };

    const handlePlayCard = (index: number) => {
        if (!gameState || gameState.status !== 'playing') return;
        const myIndex = gameState.players.findIndex(p => p.id === socket.id);
        if (myIndex !== gameState.currentPlayerIndex) return;

        const me = gameState.players[myIndex];
        const card = me.hand[index];
        
        if (card.value === 'Wild' || card.value === 'Wild Draw 4' || card.value === 'Wild Draw Color') {
            setPendingWildCardIndex(index);
            setShowColorPicker(true);
        } else {
            socket.emit('gameAction', { gameId, action: 'play', payload: { cardIndex: index } });
        }
    };

    const handleCallUno = () => {
        socket.emit('gameAction', { gameId, action: 'callUno' });
    };

    const handleColorChosen = (color: string) => {
        if (pendingWildCardIndex !== null) {
            socket.emit('gameAction', { gameId, action: 'play', payload: { cardIndex: pendingWildCardIndex, chosenColor: color } });
            setPendingWildCardIndex(null);
            setShowColorPicker(false);
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
                    <h1 className="text-xl font-bold tracking-widest">UNO FLIP</h1>
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
                            {opp.hasCalledUno && <span className="text-xs text-red-500 font-bold mt-1">UNO!</span>}
                        </div>
                    ))}
                </div>

                {/* Center Play Area */}
                {gameState.status === 'playing' && (
                    <div className="flex items-center gap-12">
                        {/* Deck */}
                        <div 
                            className={`relative w-32 h-48 rounded-xl cursor-pointer transition-transform ${isMyTurn ? 'hover:scale-105 hover:-translate-y-2' : 'opacity-50'}`}
                            onClick={handleDrawCard}
                        >
                            <div className="absolute inset-0 bg-indigo-900 rounded-xl border-4 border-white/20 flex items-center justify-center shadow-xl">
                                <span className="text-white/30 font-bold rotate-45 text-2xl">UNO</span>
                            </div>
                            <div className="absolute -bottom-8 left-0 right-0 text-center text-sm text-white/50">
                                {gameState.deck.length} cards
                            </div>
                        </div>

                        {/* Discard Pile */}
                        <div className="relative w-32 h-48">
                            {gameState.discardPile.length > 0 && (
                                <div 
                                    className="absolute inset-0 shadow-2xl"
                                    dangerouslySetInnerHTML={{ 
                                        __html: UNO_CARD_SVG(
                                            gameState.discardPile[gameState.discardPile.length - 1].side, 
                                            gameState.discardPile[gameState.discardPile.length - 1].color, 
                                            gameState.discardPile[gameState.discardPile.length - 1].value
                                        ) 
                                    }}
                                />
                            )}
                        </div>

                        {/* Current Color Indicator */}
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-sm text-white/50 uppercase tracking-widest">Current Color</span>
                            <div 
                                className="w-16 h-16 rounded-full border-4 border-white/20 shadow-lg"
                                style={{ backgroundColor: gameState.currentColor === 'Black' ? '#18181b' : gameState.currentColor.toLowerCase() }}
                            />
                            <span className="text-xs text-white/30 mt-2">
                                Direction: {gameState.direction === 1 ? '→' : '←'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Player Hand */}
                {myPlayer && gameState.status === 'playing' && (
                    <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center">
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`px-6 py-2 rounded-full font-bold tracking-widest ${isMyTurn ? 'bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.5)]' : 'bg-white/10 text-white/50'}`}>
                                {isMyTurn ? 'YOUR TURN' : 'WAITING...'}
                            </div>
                            {myPlayer.hand.length <= 2 && !myPlayer.hasCalledUno && (
                                <button 
                                    onClick={handleCallUno}
                                    className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-colors"
                                >
                                    CALL UNO!
                                </button>
                            )}
                        </div>
                        
                        <div className="flex justify-center flex-wrap gap-[-40px] px-8 max-w-full">
                            {myPlayer.hand.map((card, i) => {
                                // Simple playability check for visual feedback
                                const topCard = gameState.discardPile[gameState.discardPile.length - 1];
                                const isPlayable = isMyTurn && (
                                    card.color === 'Black' || 
                                    card.color === gameState.currentColor || 
                                    card.value === topCard?.value
                                );

                                return (
                                    <motion.div
                                        key={`${card.id}-${i}`}
                                        initial={{ y: 50, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        whileHover={isPlayable ? { y: -20, scale: 1.1, zIndex: 50 } : {}}
                                        className={`relative w-24 h-36 -ml-8 first:ml-0 transition-all ${isPlayable ? 'cursor-pointer hover:z-50' : 'opacity-50 grayscale cursor-not-allowed'}`}
                                        style={{ zIndex: i }}
                                        onClick={() => isPlayable && handlePlayCard(i)}
                                    >
                                        <div 
                                            className="w-full h-full shadow-xl"
                                            dangerouslySetInnerHTML={{ __html: UNO_CARD_SVG(card.side, card.color, card.value) }}
                                        />
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>

            {/* Action Log Overlay */}
            {gameState.status === 'playing' && gameState.actionLog && (
                <div className="absolute bottom-4 left-4 w-72 h-48 bg-black/60 border border-white/20 rounded-lg p-3 overflow-y-auto pointer-events-auto flex flex-col z-10">
                    <div className="space-y-1 mt-auto">
                        {gameState.actionLog.map((log, i) => (
                            <div key={i} className="text-white/80 text-xs font-mono">{log}</div>
                        ))}
                        <div ref={(el) => { el?.scrollIntoView({ behavior: 'smooth' }) }} />
                    </div>
                </div>
            )}

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

            {/* Color Picker Modal */}
            <AnimatePresence>
                {showColorPicker && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex items-center justify-center"
                    >
                        <motion.div 
                            initial={{ scale: 0.8, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.8, y: 50 }}
                            className="bg-zinc-900 p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center gap-6"
                        >
                            <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Choose Color</h2>
                            <div className="grid grid-cols-2 gap-4">
                                {(gameState.isDarkSide ? ['Pink', 'Teal', 'Purple', 'Orange'] : ['Red', 'Blue', 'Green', 'Yellow']).map(color => {
                                    const darkColors: { [key: string]: string } = {
                                        'Purple': '#7e22ce',
                                        'Orange': '#f97316',
                                        'Pink': '#ec4899',
                                        'Teal': '#14b8a6'
                                    };
                                    const bgColor = gameState.isDarkSide ? darkColors[color] : color.toLowerCase();
                                    return (
                                        <button
                                            key={color}
                                            onClick={() => handleColorChosen(color)}
                                            className="w-24 h-24 rounded-2xl shadow-lg transition-transform hover:scale-110 active:scale-95 flex items-center justify-center"
                                            style={{ backgroundColor: bgColor }}
                                        >
                                            <div className="w-16 h-16 rounded-full border-4 border-white/30"></div>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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
