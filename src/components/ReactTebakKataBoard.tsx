import React, { useState } from 'react';
import { BoardProps } from 'boardgame.io/react';
import { TebakKataState } from '../game/TebakKataGame';
import { motion, AnimatePresence } from 'framer-motion';

export const ReactTebakKataBoard: React.FC<BoardProps<TebakKataState> & { onLeave?: () => void, onGameEnd?: (winner: string, players: string[]) => void }> = ({ G, ctx, moves, playerID, onLeave, onGameEnd }) => {
    const isPlayerTurn = playerID === ctx.currentPlayer;
    const [input, setInput] = useState('');

    React.useEffect(() => {
        if (ctx.gameover && onGameEnd) {
            onGameEnd(ctx.gameover.winner, Object.keys(G.scores));
        }
    }, [ctx.gameover, onGameEnd, G.scores]);

    const handleGuess = (letter: string) => {
        if (!isPlayerTurn) return;
        if (G.guessedLetters.includes(letter)) return;
        moves.guessLetter(letter);
    };

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 z-[1000] flex flex-col items-center p-6 text-white overflow-y-auto">
            <div className="flex justify-between w-full max-w-4xl mb-12 relative items-center header-glow">
                {onLeave && (
                    <button onClick={onLeave} className="text-white/50 hover:text-gold transition-colors text-sm tracking-widest uppercase font-header">
                        ← Kembali
                    </button>
                )}
                <h2 className="text-3xl font-header tracking-[10px] text-gold absolute left-1/2 -translate-x-1/2 shadow-gold drop-shadow-xl text-center">
                    DIVINASI KATA
                </h2>
                <div className="w-20"></div> {/* Spacer for symmetry */}
            </div>
            
            <div className="flex space-x-6 mb-12 w-full max-w-4xl overflow-x-auto justify-center scrollbar-hide py-4">
                {Object.entries(G.scores).map(([pId, score]) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={pId} 
                        className={`flex flex-col items-center justify-center p-6 rounded-2xl border ${pId === ctx.currentPlayer ? 'border-gold shadow-[0_0_20px_rgba(212,175,55,0.3)] bg-gold/5' : 'border-white/10 bg-black/40'} min-w-[140px] transition-all backdrop-blur-sm relative overflow-hidden`}
                    >
                        {pId === ctx.currentPlayer && (
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.15)_0%,transparent_70%)] animate-pulse-slow"></div>
                        )}
                        <div className="text-xs text-white/50 font-header tracking-[4px] uppercase mb-2">Player {parseInt(pId) + 1} {pId === playerID ? '(You)' : ''}</div>
                        <div className="text-3xl font-mystic text-white">{score} <span className="text-sm text-gold/60 ml-1 font-sans">pts</span></div>
                    </motion.div>
                ))}
            </div>

            <div className="flex flex-wrap justify-center gap-3 mb-16 max-w-4xl px-4">
                <AnimatePresence>
                    {G.word.split('').map((char, index) => {
                        const isRevealed = G.guessedLetters.includes(char) || char === ' ' || ctx.gameover;
                        return (
                            <motion.div 
                                key={`${index}-${char}`}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`w-14 h-20 md:w-16 md:h-24 flex items-center justify-center text-4xl font-mystic rounded-xl ${char === ' ' ? 'bg-transparent' : 'bg-black/60 border border-gold/30 shadow-[0_4px_20px_rgba(0,0,0,0.5)]'} transition-all relative overflow-hidden`}
                            >
                                {isRevealed && char !== ' ' ? (
                                    <motion.span 
                                        initial={{ opacity: 0, scale: 0, rotateY: 90 }}
                                        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                        className="text-gold shadow-gold relative z-10 drop-shadow-md"
                                    >
                                        {char}
                                    </motion.span>
                                ) : char !== ' ' && (
                                    <div className="absolute inset-x-2 bottom-2 h-[2px] bg-white/20 rounded-full"></div>
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {ctx.gameover ? (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center p-10 bg-gold/5 rounded-3xl border border-gold/40 shadow-[0_0_40px_rgba(212,175,55,0.2)] backdrop-blur-md relative overflow-hidden max-w-lg w-full"
                >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.2)_0%,transparent_100%)] animate-pulse-slow"></div>
                    <h3 className="text-sm font-header tracking-[8px] text-gold/80 mb-4 uppercase inline-block border-b border-gold/30 pb-2 relative z-10">Realita Terungkap</h3>
                    <div className="text-4xl font-mystic text-white my-6 drop-shadow-lg relative z-10">Pemain {parseInt(ctx.gameover.winner) + 1} Berhasil!</div>
                    <div className="text-lg font-sans text-white/70 mt-2 relative z-10">Kata: <span className="text-gold font-bold tracking-widest">{G.word}</span></div>
                    {onLeave && (
                        <button onClick={onLeave} className="mt-8 px-8 py-3 bg-gold text-black font-bold tracking-widest uppercase rounded-full hover:bg-yellow-400 transition-colors shadow-lg shadow-gold/20 relative z-10 w-full active:scale-95">
                            Kembali ke Lobi
                        </button>
                    )}
                </motion.div>
            ) : (
                <div className="w-full max-w-3xl text-center flex flex-col items-center">
                    <motion.div 
                        animate={{ opacity: [0.5, 1, 0.5] }} 
                        transition={{ duration: 2, repeat: Infinity }}
                        className={`text-sm font-header tracking-[5px] mb-8 uppercase px-6 py-2 rounded-full border ${isPlayerTurn ? 'border-gold/50 text-gold bg-gold/5 shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'border-white/10 text-white/40 bg-black/40'}`}
                    >
                        {isPlayerTurn ? 'Takdir di Tanganmu' : `Menunggu P${parseInt(ctx.currentPlayer) + 1}...`}
                    </motion.div>
                    
                    <div className="flex flex-wrap justify-center gap-3 w-full">
                        {alphabet.map(letter => {
                            const isGuessed = G.guessedLetters.includes(letter);
                            const isCorrect = isGuessed && G.word.includes(letter);
                            const isWrong = isGuessed && !G.word.includes(letter);
                            
                            let btnClass = "w-12 h-12 sm:w-14 sm:h-14 rounded-xl font-bold text-lg sm:text-xl transition-all font-sans relative overflow-hidden ";
                            if (isCorrect) btnClass += "bg-gold/20 text-gold border border-gold/50 cursor-not-allowed opacity-60";
                            else if (isWrong) btnClass += "bg-red-900/30 text-white/20 border border-red-900/50 cursor-not-allowed opacity-30";
                            else if (isPlayerTurn) btnClass += "bg-white/5 border border-white/20 hover:border-gold hover:bg-gold/10 text-white cursor-pointer active:scale-90 shadow-md hover:shadow-[0_0_15px_rgba(212,175,55,0.3)]";
                            else btnClass += "bg-black/40 text-white/30 border border-white/5 cursor-not-allowed";

                            return (
                                <button
                                    key={letter}
                                    disabled={!isPlayerTurn || isGuessed}
                                    className={btnClass}
                                    onClick={() => handleGuess(letter)}
                                >
                                    <span className="relative z-10">{letter}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
