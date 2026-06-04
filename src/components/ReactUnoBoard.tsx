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
    displayGameId?: string;
    username?: string;
    onLeave?: () => void;
    onGameEnd?: (winner: string, players: string[]) => void;
}

export const ReactUnoBoard: React.FC<UnoBoardProps> = ({ G, ctx, moves, playerID, matchID, displayGameId, username, onLeave, onGameEnd }) => {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [pendingWildCardIndex, setPendingWildCardIndex] = useState<number | null>(null);
    const displayId = displayGameId || matchID;

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
        <div className="fixed inset-0 bg-zinc-950 z-[1000] flex flex-col font-sans overflow-hidden text-white select-none">
            {/* Header */}
            <div className="flex-shrink-0 flex justify-between items-center px-4 py-3 bg-black/60 border-b border-white/5 backdrop-blur-md z-30">
                <div className="flex items-center gap-3">
                    {onLeave && (
                        <button 
                            onClick={onLeave} 
                            className="bg-white/5 hover:bg-white/10 text-white/80 active:scale-95 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border border-white/10"
                        >
                            ← Kembali
                        </button>
                    )}
                    <h1 className="text-sm sm:text-base font-black tracking-widest text-indigo-400">UNO FLIP</h1>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-white/40 text-[10px] sm:text-xs">Room: <strong className="text-white/90 font-mono">{displayId}</strong></span>
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse ml-1" />
                    <span className="text-white/60 text-[10px] sm:text-xs hidden sm:inline">{G.players.length} Pemain</span>
                </div>
            </div>

            {/* Game Area */}
            <div className="flex-1 relative flex flex-col justify-between p-4 overflow-hidden">
                
                {G.status === 'waiting' && (
                    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/90 backdrop-blur-sm">
                        <div className="bg-zinc-900/90 p-6 rounded-2xl border border-white/10 text-center max-w-xs w-full shadow-2xl mx-4">
                            <h2 className="text-xl font-bold mb-2 text-indigo-400">Menunggu Pemain...</h2>
                            <p className="text-white/50 text-xs mb-6">
                                Bagikan ID Game: <span className="text-white font-mono bg-white/10 px-2 py-1 rounded inline-block mt-1 font-bold">{displayId}</span>
                            </p>
                            <button
                                onClick={() => moves.startGame()}
                                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl transition-all duration-150 shadow-lg active:scale-95"
                            >
                                Mulai Permainan
                            </button>
                        </div>
                    </div>
                )}

                {/* Opponents Badges Block (Compressed & Beautiful) */}
                <div className="w-full flex flex-wrap justify-center gap-2 px-2 py-1 z-10 select-none max-h-[30%] overflow-y-auto no-scrollbar">
                    {opponents.map((opp, i) => {
                        const isOppActive = G.players[G.currentPlayerIndex]?.id === opp.id;
                        return (
                            <div 
                                key={opp.id} 
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border text-[11px] sm:text-xs transition-all duration-300 ${
                                    isOppActive 
                                        ? 'border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.25)] bg-yellow-400/[0.03]' 
                                        : 'border-white/5'
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs ${
                                    isOppActive ? 'bg-yellow-400 text-black' : 'bg-zinc-700 text-white/90'
                                }`}>
                                    {opp.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold max-w-[80px] break-all truncate leading-tight">{opp.name}</span>
                                    <span className="text-[10px] text-white/40 leading-none mt-0.5">{opp.hand.length} kartu</span>
                                </div>
                                {opp.hasCalledUno && (
                                    <span className="text-[9px] text-red-400 bg-red-400/10 px-1 py-0.5 rounded font-black animate-pulse uppercase">UNO</span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Center Play Area (Responsive, scalable) */}
                {G.status === 'playing' && (
                    <div className="flex items-center justify-center gap-6 sm:gap-12 my-auto py-2 z-0 scale-90 sm:scale-100 select-none">
                        {/* Deck */}
                        <div 
                            className={`relative w-20 sm:w-28 h-30 sm:h-40 rounded-xl cursor-pointer transition-all duration-150 ${
                                isMyTurn ? 'hover:scale-105 active:scale-95' : 'opacity-60 cursor-not-allowed'
                            }`}
                            onClick={handleDrawCard}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-indigo-950 rounded-xl border-2 sm:border-3 border-white/15 flex flex-col items-center justify-center shadow-lg">
                                <span className="text-white/30 font-black rotate-45 text-lg sm:text-xl tracking-widest">UNO</span>
                                <span className="text-[9px] text-indigo-300/60 mt-1 font-mono">{G.deck.length} kartu</span>
                            </div>
                        </div>

                        {/* Discard Pile */}
                        <div className="relative w-20 sm:w-28 h-30 sm:h-40 flex items-center justify-center">
                            {G.discardPile.length > 0 ? (
                                <div 
                                    className="w-full h-full shadow-xl rounded-xl overflow-hidden"
                                    dangerouslySetInnerHTML={{ 
                                        __html: UNO_CARD_SVG(
                                            sideStr, 
                                            (isDark ? G.discardPile[G.discardPile.length - 1].dark : G.discardPile[G.discardPile.length - 1].light).color, 
                                            (isDark ? G.discardPile[G.discardPile.length - 1].dark : G.discardPile[G.discardPile.length - 1].light).value
                                        ) 
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-white/20 text-xs">Kosong</div>
                            )}
                        </div>

                        {/* State Widget */}
                        <div className="flex flex-col items-center gap-1 bg-zinc-900/60 p-2 rounded-xl border border-white/5 shadow-md">
                            <span className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Warna</span>
                            <div 
                                className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border border-white/20 shadow-inner"
                                style={{ backgroundColor: (G.currentColor as any) === 'Black' ? '#18181b' : (G.currentColor || 'transparent').toLowerCase() }}
                            />
                            <span className="text-[9px] text-white/50 font-mono mt-0.5">
                                {G.direction === 1 ? 'Kanan →' : '← Kiri'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Player Hand Deck (Ultra UI Refinement) */}
                {myPlayer && G.status === 'playing' && (
                    <div className="w-full flex flex-col items-center flex-shrink-0 z-20 bg-zinc-950/60 pb-2 pt-1 border-t border-white/5">
                        
                        {/* Status Label & Call Uno row */}
                        <div className="flex items-center justify-between w-full max-w-md px-4 mb-2">
                            <div className={`px-4 py-1 rounded-full text-2xs sm:text-xs font-black tracking-widest uppercase ${
                                isMyTurn 
                                    ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.3)] animate-pulse' 
                                    : 'bg-white/5 text-white/40 border border-white/5'
                            }`}>
                                {isMyTurn ? 'GILIRAN KAMU' : 'MENUNGGU LAWAN...'}
                            </div>
                            
                            {myPlayer.hand.length <= 2 && !myPlayer.hasCalledUno && (
                                <button 
                                    onClick={handleCallUno}
                                    className="px-4 py-1 bg-red-600 hover:bg-red-500 active:scale-95 text-white text-2xs sm:text-xs font-black rounded-full shadow-[0_0_12px_rgba(220,38,38,0.4)] transition-all duration-150"
                                >
                                    TERIAK UNO!
                                </button>
                            )}
                        </div>
                        
                        {/* Horizontal Swipeable list of cards (No wrap, high optimization) */}
                        <div className="w-full max-w-full overflow-x-auto no-scrollbar py-2 px-1 select-none flex justify-start sm:justify-center">
                            <div className="flex items-end min-w-max pb-2 px-6">
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
                                        <div
                                            key={`${card.suit}-${card.value}-${i}`}
                                            className={`relative w-[60px] sm:w-[84px] h-[90px] sm:h-[126px] -ml-[18px] sm:-ml-[28px] first:ml-0 transition-all duration-150 origin-bottom transform ${
                                                isPlayable 
                                                    ? 'cursor-pointer hover:-translate-y-5 hover:scale-110 hover:!z-[200] hover:filter-none' 
                                                    : 'opacity-35 grayscale scale-95 pointer-events-none'
                                            }`}
                                            style={{ zIndex: i }}
                                            onClick={() => isPlayable && handlePlayCard(i)}
                                        >
                                            <div 
                                                className="w-full h-full shadow-lg rounded-lg overflow-hidden border border-white/5"
                                                dangerouslySetInnerHTML={{ __html: UNO_CARD_SVG(sideStr, sideData.color, sideData.value) }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Winner Screen */}
                {G.status === 'finished' && (
                    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 backdrop-blur-sm p-4">
                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-4xl sm:text-5xl font-black text-yellow-400 mb-6 tracking-widest text-center"
                        >
                            {G.winner === myPlayer?.name ? 'KAMU MENANG!' : `${G.winner} MENANG!`}
                        </motion.div>
                        {onLeave && (
                            <button 
                                onClick={onLeave}
                                className="px-8 py-3 bg-white text-black font-extrabold rounded-full hover:bg-white/90 active:scale-95 transition-all duration-150 shadow-xl"
                            >
                                Kembali ke Hub
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
                            className="absolute inset-0 bg-black/85 flex items-center justify-center z-50 backdrop-blur-sm"
                        >
                            <motion.div 
                                initial={{ scale: 0.95 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0.95 }}
                                className="bg-zinc-900/95 p-6 rounded-2xl border border-white/10 flex flex-col items-center max-w-xs w-full shadow-2xl mx-4"
                            >
                                <h3 className="text-base font-black tracking-widest text-indigo-400 mb-4">PILIH WARNA AKTIF</h3>
                                <div className="grid grid-cols-2 gap-3 w-full">
                                    {(isDark ? ['Pink', 'Teal', 'Purple', 'Orange'] : ['Red', 'Yellow', 'Green', 'Blue']).map(color => (
                                        <button
                                            key={color}
                                            onClick={() => handleColorChosen(color)}
                                            className="w-full aspect-square rounded-xl shadow-md border-2 border-white/10 text-white/90 font-bold active:scale-95 transition-all duration-100 flex flex-col items-center justify-center gap-1"
                                            style={{ backgroundColor: color.toLowerCase() }}
                                        >
                                            <span className="text-[10px] uppercase font-black tracking-wider bg-black/25 px-2 py-0.5 rounded">{color}</span>
                                        </button>
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
