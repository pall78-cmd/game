import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UnoGameState, UnoCard } from '../utils/UnoEngine';
import { UNO_CARD_SVG } from '../constants/boardGameDeck';

interface UnoBoardProps {
    G: UnoGameState;
    ctx: any;
    moves: any;
    playerID: string | null;
    matchID: string;
    username?: string;
    onLeave?: () => void;
    onGameEnd?: (winner: string, players: string[]) => void;
}

export const ReactUnoBoard: React.FC<UnoBoardProps> = ({ G, ctx, moves, playerID, matchID, username, onLeave, onGameEnd }) => {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [pendingWildCardIndex, setPendingWildCardIndex] = useState<number | null>(null);

    React.useEffect(() => {
        if (G && G.status === 'finished' && G.winner) {
            const playerNames = G.players.map(p => p.name || p.id);
            onGameEnd?.(G.winner, playerNames);
        }
    }, [G?.status, G?.winner]);

    const handleDrawCard = () => {
        if (G.status !== 'playing') return;
        const myIndex = G.players.findIndex(p => p.id === playerID);
        if (myIndex === G.currentPlayerIndex) {
            moves.drawCard();
        }
    };

    const handlePlayCard = (index: number) => {
        if (G.status !== 'playing') return;
        const myIndex = G.players.findIndex(p => p.id === playerID);
        if (myIndex !== G.currentPlayerIndex) return;

        const me = G.players[myIndex];
        const card = me.hand[index];
        const sideData = G.isDarkSide ? card.dark : card.light;
        
        if (sideData.value === 'Wild' || sideData.value === 'Wild Draw 4' || sideData.value === 'Wild Draw Color' || sideData.value === 'Wild Draw 2') {
            setPendingWildCardIndex(index);
            setShowColorPicker(true);
        } else {
            moves.playCard(index);
        }
    };

    const handleCallUno = () => {
        moves.callUno();
    };

    const handleColorChosen = (color: string) => {
        if (pendingWildCardIndex !== null) {
            moves.playCard(pendingWildCardIndex, color);
            setPendingWildCardIndex(null);
            setShowColorPicker(false);
        }
    };

    if (!G) {
        return <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center text-white">Loading game state...</div>;
    }

    const myPlayer = G.players.find(p => p.id === playerID);
    const isMyTurn = G.players[G.currentPlayerIndex]?.id === playerID;
    const opponents = G.players.filter(p => p.id !== playerID);

    const isDark = G.isDarkSide;
    const sideStr = isDark ? 'Dark' : 'Light';

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
                    <h1 className="text-xl font-bold tracking-widest">UNO FLIP</h1>
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
                            {opp.hasCalledUno && <span className="text-xs text-red-500 font-bold mt-1">UNO!</span>}
                        </div>
                    ))}
                </div>

                {/* Center Play Area */}
                {G.status === 'playing' && (
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
                                {G.deck.length} cards
                            </div>
                        </div>

                        {/* Discard Pile */}
                        <div className="relative w-32 h-48">
                            {G.discardPile.length > 0 && (
                                <div 
                                    className="absolute inset-0 shadow-2xl"
                                    dangerouslySetInnerHTML={{ 
                                        __html: UNO_CARD_SVG(
                                            sideStr, 
                                            (isDark ? G.discardPile[G.discardPile.length - 1].dark : G.discardPile[G.discardPile.length - 1].light).color, 
                                            (isDark ? G.discardPile[G.discardPile.length - 1].dark : G.discardPile[G.discardPile.length - 1].light).value
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
                                style={{ backgroundColor: G.currentColor === 'Black' ? '#18181b' : (G.currentColor || 'transparent').toLowerCase() }}
                            />
                            <span className="text-xs text-white/30 mt-2">
                                Direction: {G.direction === 1 ? '→' : '←'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Player Hand */}
                {myPlayer && G.status === 'playing' && (
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
                                const topCard = G.discardPile[G.discardPile.length - 1];
                                const topSide = topCard ? (isDark ? topCard.dark : topCard.light) : null;
                                const sideData = isDark ? card.dark : card.light;
                                
                                const isPlayable = isMyTurn && (
                                    sideData.color === 'Black' || 
                                    sideData.color === G.currentColor || 
                                    sideData.value === topSide?.value
                                );

                                return (
                                    <motion.div
                                        key={`${card.suit}-${card.value}-${i}`}
                                        initial={{ y: 50, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        whileHover={isPlayable ? { y: -20, scale: 1.1, zIndex: 50 } : {}}
                                        className={`relative w-24 h-36 -ml-8 first:ml-0 transition-all ${isPlayable ? 'cursor-pointer hover:z-50' : 'opacity-50 grayscale cursor-not-allowed'}`}
                                        style={{ zIndex: i }}
                                        onClick={() => isPlayable && handlePlayCard(i)}
                                    >
                                        <div 
                                            className="w-full h-full shadow-xl"
                                            dangerouslySetInnerHTML={{ __html: UNO_CARD_SVG(sideStr, sideData.color, sideData.value) }}
                                        />
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

                {/* Color Picker Modal */}
                <AnimatePresence>
                    {showColorPicker && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
                        >
                            <motion.div 
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0.9 }}
                                className="bg-zinc-900 p-8 rounded-2xl border border-white/10 flex flex-col items-center"
                            >
                                <h3 className="text-xl font-bold mb-6">Choose Color</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {(isDark ? ['Pink', 'Teal', 'Purple', 'Orange'] : ['Red', 'Yellow', 'Green', 'Blue']).map(color => (
                                        <button
                                            key={color}
                                            onClick={() => handleColorChosen(color)}
                                            className="w-24 h-24 rounded-xl shadow-lg border-2 border-white/20 hover:scale-105 transition-transform"
                                            style={{ backgroundColor: color.toLowerCase() }}
                                        />
                                    ))}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
