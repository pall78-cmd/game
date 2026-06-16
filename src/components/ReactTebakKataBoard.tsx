import React, { useState } from 'react';
import { BoardProps } from 'boardgame.io/react';
import { TebakKataState } from '../game/TebakKataGame';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, HelpCircle, LogOut, Check, Sparkles, X } from 'lucide-react';
import { StreakManager } from '../utils/StreakManager';

export const ReactTebakKataBoard: React.FC<BoardProps<TebakKataState> & { 
    onLeave?: () => void, 
    onGameEnd?: (winner: string, players: string[]) => void,
    displayGameId?: string
}> = ({ G, ctx, moves, playerID, onLeave, onGameEnd, displayGameId }) => {
    const isPlayerTurn = playerID === ctx.currentPlayer;
    const [input, setInput] = useState('');
    const [showRules, setShowRules] = useState(false);

    React.useEffect(() => {
        if (G.status !== 'playing') return;
        try {
            const res = StreakManager.recordPlayToday();
            if (res.isNewMilestone) {
                localStorage.setItem('tebak_kata_new_milestone_claim', JSON.stringify({
                    streakCount: res.state.streakCount,
                    unlocked: true,
                    timestamp: Date.now()
                }));
            }
        } catch (e) {
            console.error("Gagal mencatat streak bermain harian:", e);
        }
    }, [G.status]);

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
        <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black z-[100] flex flex-col items-center p-3 sm:p-6 text-white overflow-y-auto no-scrollbar">
            {/* Lobi/Waiting Screen overlay */}
            {G.status === 'waiting' && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[200] p-4 text-white">
                    <div className="bg-zinc-950 border border-yellow-400/30 p-6 sm:p-8 rounded-3xl w-full max-w-sm shadow-[0_15px_35px_rgba(234,179,8,0.15)] text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.05)_0%,transparent_100%)] animate-pulse" />
                        <Sparkles className="w-10 h-10 text-yellow-400 mx-auto mb-3 animate-pulse" />
                        <h2 className="text-lg sm:text-xl font-black text-yellow-400 uppercase tracking-widest">LOBI DIVINASI KATA</h2>
                        <p className="text-white/60 text-xs mt-2 mb-6 leading-relaxed">
                            Bagikan ID game ini kepada kawan anda. Ketika siap memprediksi kata-kata sakral, klik tombol mulai di bawah!
                        </p>
                        <div className="bg-zinc-900/80 border border-white/5 p-3 rounded-2xl mb-6">
                            <span className="text-[10px] text-white/40 block uppercase tracking-wider font-mono font-bold">KODE KAMAR</span>
                            <span className="text-lg text-yellow-500 font-mono font-black tracking-widest">{displayGameId || 'UNKNOWN'}</span>
                        </div>
                        <div className="flex gap-3">
                            {onLeave && (
                                <button 
                                    onClick={onLeave}
                                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase text-[11px] tracking-wide rounded-xl transition-all cursor-pointer relative z-10"
                                >
                                    Batal
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (moves && moves.startGame) {
                                        moves.startGame();
                                    }
                                }}
                                className="flex-[2] py-3 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-black uppercase text-[11px] tracking-wider rounded-xl transition-all duration-150 shadow-md active:scale-95 cursor-pointer relative z-10"
                            >
                                Mulai Sekarang
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Header Block */}
            <div className="flex-shrink-0 flex justify-between items-center w-full max-w-4xl mb-4 sm:mb-8 relative py-2 border-b border-white/5">
                {onLeave ? (
                    <button 
                        onClick={onLeave} 
                        className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 active:scale-95 text-white/80 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all border border-white/10"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Keluar</span>
                    </button>
                ) : (
                    <div className="w-16" />
                )}
                
                <div className="text-center">
                    <h2 className="text-sm sm:text-lg font-black tracking-[4px] sm:tracking-[8px] bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent uppercase drop-shadow-md">
                        TEBAK KATA
                    </h2>
                    <span className="text-[8px] sm:text-[9px] text-zinc-500 font-bold uppercase tracking-widest block">Divinasi Suku Kata</span>
                </div>

                <button 
                    onClick={() => setShowRules(true)} 
                    className="flex items-center gap-1.5 bg-yellow-400/10 hover:bg-yellow-400/20 active:scale-95 text-yellow-400 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all border border-yellow-400/30 shadow-md"
                >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Aturan</span>
                </button>
            </div>
            
            {/* Players Status Core (Compact & Neat for mobile) */}
            <div className="flex space-x-3 mb-4 sm:mb-6 w-full max-w-xl overflow-x-auto justify-center scrollbar-hide py-1">
                {Object.entries(G.scores).map(([pId, score]) => {
                    const isCurrent = pId === ctx.currentPlayer;
                    const isMe = pId === playerID;
                    return (
                        <motion.div 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={pId} 
                            className={`flex flex-col items-center justify-center py-2 px-4 rounded-xl border transition-all duration-250 min-w-[100px] max-w-[140px] relative overflow-hidden shrink-0 ${
                                isCurrent 
                                    ? 'border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.25)] bg-yellow-500/10' 
                                    : 'border-white/5 bg-zinc-900/60'
                            }`}
                        >
                            {isCurrent && (
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.1)_0%,transparent_70%)] animate-pulse" />
                            )}
                            <div className="text-[8px] md:text-[9px] text-white/40 uppercase tracking-widest font-black leading-none mb-1 text-center">
                                {isMe ? 'Pemain (Anda)' : `Player ${parseInt(pId) + 1}`}
                            </div>
                            <div className="text-lg md:text-xl font-bold text-white flex items-center gap-1">
                                <span>{score}</span>
                                <span className="text-[10px] text-yellow-400/75 uppercase font-medium">pts</span>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Clue and Topic Section */}
            {(G as any).topic && (G as any).clue && (
                <div className="w-full max-w-xl bg-zinc-900/60 p-4 rounded-2xl border border-yellow-400/20 text-center mb-6 relative overflow-hidden shrink-0 shadow-lg">
                    <div className="absolute top-0 left-0 bg-yellow-400/10 text-yellow-400 text-[9px] px-2.5 py-1 rounded-br-lg font-bold font-mono uppercase tracking-widest border-r border-b border-yellow-400/10">
                        TOPIK: {(G as any).topic}
                    </div>
                    <p className="text-xs sm:text-sm mt-3 pt-2 text-zinc-300 italic font-medium leading-relaxed">
                        “{(G as any).clue}”
                    </p>
                </div>
            )}

            {/* Word Display Area Container (Scales very nicely to avoid overflow width-wise on standard screen widths) */}
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2.5 mb-6 sm:mb-10 max-w-full px-4 overflow-x-hidden">
                <AnimatePresence>
                    {G.word.split('').map((char, index) => {
                        const isRevealed = G.guessedLetters.includes(char) || char === ' ' || ctx.gameover;
                        return (
                            <motion.div 
                                key={`${index}-${char}`}
                                initial={{ opacity: 0, scale: 0.85 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`w-9 h-12 sm:w-12 sm:h-16 md:w-14 md:h-20 flex items-center justify-center text-xl sm:text-2xl md:text-3xl font-black rounded-lg ${
                                    char === ' ' 
                                        ? 'bg-transparent w-4' 
                                        : 'bg-zinc-900/90 border border-yellow-400/20 shadow-lg'
                                } transition-all relative overflow-hidden`}
                            >
                                {isRevealed && char !== ' ' ? (
                                    <motion.span 
                                        initial={{ opacity: 0, scale: 0, rotateY: 90 }}
                                        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                        className="text-yellow-400 font-extrabold tracking-normal relative z-10 drop-shadow-md"
                                    >
                                        {char}
                                    </motion.span>
                                ) : char !== ' ' && (
                                    <div className="absolute inset-x-1.5 bottom-1.5 h-1 bg-white/20 rounded-full" />
                                )}
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* GameOver or Game Control Center Block */}
            {ctx.gameover ? (
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center p-6 bg-zinc-900/90 rounded-2xl border border-yellow-400/30 shadow-[0_15px_35px_rgba(0,0,0,0.6)] backdrop-blur-md relative overflow-hidden max-w-sm w-full mx-auto"
                >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.1)_0%,transparent_100%)]" />
                    <Sparkles className="w-10 h-10 text-yellow-400 mx-auto mb-3 animate-bounce" />
                    <h3 className="text-[10px] font-black tracking-[4px] text-yellow-500/80 mb-1 uppercase">Pertandingan Selesai</h3>
                    <div className="text-xl font-black text-white my-3 drop-shadow">Pemain {parseInt(ctx.gameover.winner) + 1} Menang!</div>
                    <div className="text-xs text-white/70">Kata: <span className="text-yellow-400 font-black tracking-widest uppercase">{G.word}</span></div>
                    {onLeave && (
                        <button 
                            onClick={onLeave} 
                            className="mt-5 px-6 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black tracking-wider uppercase text-xs rounded-xl hover:from-yellow-300 hover:to-amber-400 transition-all shadow-md relative z-10 w-full active:scale-95"
                        >
                            Kembali ke Lobi
                        </button>
                    )}
                </motion.div>
            ) : (
                <div className="w-full max-w-md text-center flex flex-col items-center mt-auto pb-4">
                    {/* Status turn message */}
                    <motion.div 
                        animate={{ opacity: [0.65, 1, 0.65] }} 
                        transition={{ duration: 2, repeat: Infinity }}
                        className={`text-[9px] sm:text-[10px] font-black tracking-[3px] mb-4 sm:mb-6 uppercase px-4 py-1.5 rounded-full border ${
                            isPlayerTurn 
                                ? 'border-yellow-400/30 text-yellow-400 bg-yellow-500/10 shadow-[0_0_10px_rgba(234,179,8,0.15)]' 
                                : 'border-white/5 text-white/40 bg-zinc-900/40'
                        }`}
                    >
                        {isPlayerTurn ? 'TAKDIR DI TANGANMU' : `MENUNGGU PEMAIN ${parseInt(ctx.currentPlayer) + 1}...`}
                    </motion.div>
                    
                    {/* Alphabet layout optimized for compact touch targets on mobile */}
                    <div className="flex flex-wrap justify-center gap-1 sm:gap-1.5 w-full px-1">
                        {alphabet.map(letter => {
                            const isGuessed = G.guessedLetters.includes(letter);
                            const isCorrect = isGuessed && G.word.includes(letter);
                            const isWrong = isGuessed && !G.word.includes(letter);
                            
                            let btnClass = "w-[33px] h-[36px] sm:w-[44px] sm:h-[48px] rounded-lg font-black text-xs sm:text-sm transition-all font-sans relative overflow-hidden flex items-center justify-center ";
                            if (isCorrect) btnClass += "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 cursor-not-allowed opacity-50";
                            else if (isWrong) btnClass += "bg-red-950/20 text-white/20 border border-red-900/30 cursor-not-allowed opacity-30";
                            else if (isPlayerTurn) btnClass += "bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 text-white cursor-pointer active:scale-90 shadow-md hover:border-yellow-400/40 dynamic-hover";
                            else btnClass += "bg-black/20 text-white/25 border border-white/5 cursor-not-allowed opacity-40";

                            return (
                                <button
                                    key={letter}
                                    disabled={!isPlayerTurn || isGuessed}
                                    className={btnClass}
                                    onClick={() => handleGuess(letter)}
                                    title={letter}
                                >
                                    <span className="relative z-10 leading-none">{letter}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Rules Modal Overlay */}
            <AnimatePresence>
                {showRules && (
                    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[300] p-4">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-zinc-950 border border-yellow-400/30 p-6 rounded-3xl w-full max-w-md shadow-2xl relative"
                        >
                            <button 
                                onClick={() => setShowRules(false)}
                                className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            
                            <h3 className="text-lg font-black text-yellow-400 mb-4 flex items-center gap-2">
                                <HelpCircle className="w-5 h-5" />
                                <span>ATURAN DIVINASI KATA</span>
                            </h3>
                            
                            <ul className="space-y-3 text-xs text-zinc-300 leading-relaxed text-left list-decimal pl-4">
                                <li>
                                    <strong className="text-white">Tebak Huruf Bergiliran</strong>: Setiap pemain menebak huruf alfabet satu per satu secara bergiliran.
                                </li>
                                <li>
                                    <strong className="text-white">Sistem Skor (+10 pts)</strong>: Setiap huruf yang tertebak dengan benar memberikan <span className="text-yellow-400 font-bold">+10 poin</span> dikalikan jumlah huruf tersebut di dalam kata target.
                                </li>
                                <li>
                                    <strong className="text-white">Mekanisme Turn</strong>: Jika tebakan Anda <span className="text-green-400 font-bold">BENAR</span>, Anda dapat terus menebak huruf berikutnya (tetap giliran Anda). Jika tebakan Anda <span className="text-red-400 font-bold">SALAH</span>, giliran langsung beralih ke pemain berikutnya.
                                </li>
                                <li>
                                    <strong className="text-white">Kondisi Menang</strong>: Pemain yang berhasil membuka huruf terakhir yang melengkapi kata dinyatakan sebagai pemenang utama rasi bintang!
                                </li>
                                <li>
                                    <strong className="text-white">Streak Harian</strong>: Mainkan permainan tebak kata sekali sehari untuk mencatat streak dan menjaga api ramalan Anda agar tetap menyala sempurna.
                                </li>
                            </ul>
                            
                            <button 
                                onClick={() => setShowRules(false)}
                                className="mt-6 w-full py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-bold uppercase text-xs rounded-xl transition-all shadow-md active:scale-95"
                            >
                                Saya Mengerti
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
