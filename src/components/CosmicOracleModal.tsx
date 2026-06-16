import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CosmicOracleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSendProphecy: (prophecyText: string) => void;
    username: string;
    room: 'A' | 'B';
}

export const CosmicOracleModal: React.FC<CosmicOracleModalProps> = ({
    isOpen,
    onClose,
    onSendProphecy,
    username,
    room
}) => {
    const [question, setQuestion] = useState('');
    const [ritual, setRitual] = useState<'tarot' | 'star' | 'whisper' | 'chat'>('tarot');
    const [loading, setLoading] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const statusTexts = {
        tarot: [
            "Menghubungkan indra batin ke semesta...",
            "Mengocok Kartu Tarot Takdir...",
            "Menarik kartu masa depanmu...",
            "Menafsirkan coretan takdir..."
        ],
        star: [
            "Memetakan langit malam...",
            "Mendekripsi konstelasi galaksi...",
            "Membaca koordinat rasi bintangmu...",
            "Memadatkan pesan angkasa..."
        ],
        whisper: [
            "Memasuki keheningan batin...",
            "Mendengarkan deburan angin takdir...",
            "Menangkap bisikan murni kosmos...",
            "Menyelaraskan harmoni jiwa..."
        ],
        chat: [
            "Membuka portal interaksi...",
            "Menyaring denyut nalar kosmik...",
            "Mengartikulasikan sabda kebenaran...",
            "Menyusun wejangan dimensi..."
        ]
    };

    const runStatusAnimation = (type: 'tarot' | 'star' | 'whisper' | 'chat') => {
        const texts = statusTexts[type];
        let index = 0;
        setStatusText(texts[0]);
        const interval = setInterval(() => {
            index++;
            if (index < texts.length) {
                setStatusText(texts[index]);
            } else {
                clearInterval(interval);
            }
        }, 1200);
        return interval;
    };

    const handleInviteProphecy = async () => {
        setLoading(true);
        setErrorMessage('');
        const intervalId = runStatusAnimation(ritual);

        try {
            const res = await fetch('/api/oracle-tarot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    question,
                    ritual,
                    room
                })
            });

            const data = await res.json();
            clearInterval(intervalId);

            if (!res.ok) {
                throw new Error(data.error || 'Terjadi gangguan badai kosmik.');
            }

            if (data.prophecy) {
                onSendProphecy(data.prophecy);
                setQuestion('');
                onClose();
            } else {
                throw new Error('Prophecy tidak valid.');
            }
        } catch (err: any) {
            console.error(err);
            setErrorMessage(err.message || 'Koneksi kosmik terputus.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div id="oracle-modal-overlay" className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="absolute inset-0" onClick={!loading ? onClose : undefined} />
                    
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 15 }}
                        className="w-full max-w-sm bg-zinc-950 border-2 border-amber-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(212,175,55,0.2)] relative overflow-hidden flex flex-col gap-4 z-10 text-white"
                    >
                        <div className="absolute -top-24 -left-24 w-48 h-48 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <h2 className="text-base font-bold tracking-widest text-amber-500 uppercase flex items-center gap-2">
                                    <span>🔮</span> Ritual Oracle AI
                                </h2>
                                <p className="text-[10px] text-white/50 tracking-wider uppercase mt-1">Sampaikan tanyamu ke gerbang takdir</p>
                            </div>
                            {!loading && (
                                <button 
                                    onClick={onClose}
                                    className="w-6 h-6 rounded-full flex items-center justify-center border border-white/10 hover:border-amber-500/50 hover:bg-white/5 transition-all text-[10px] text-white/60 hover:text-amber-500"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {errorMessage && (
                            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 italic text-center animate-shake">
                                ⚠️ {errorMessage}
                            </div>
                        )}

                        {loading ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-4 relative z-10">
                                <div className="relative w-16 h-16 flex items-center justify-center">
                                    <motion.div 
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                        className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-500 border-r-amber-500/30"
                                    />
                                    <motion.div 
                                        animate={{ rotate: -360 }}
                                        transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                                        className="absolute w-10 h-10 rounded-full border border-transparent border-t-violet-400 border-l-violet-400/50"
                                    />
                                    <span className="text-xl animate-pulse">🔮</span>
                                </div>
                                <div className="text-center">
                                    <p className="text-amber-500 text-xs italic animate-pulse">{statusText}</p>
                                    <p className="text-[9px] text-white/40 tracking-widest uppercase mt-2">Energi Gemini menyelaraskan frekuensi...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 relative z-10 text-left">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-amber-500/80">Keresahan / Pertanyaan Batin</label>
                                    <textarea
                                        value={question}
                                        onChange={(e) => setQuestion(e.target.value)}
                                        placeholder="Misal: Apakah jalanku sudah benar? Bagaimana asmaraku besok? Atau biarkan kosong untuk petunjuk umum..."
                                        className="w-full h-20 bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-amber-500/50 rounded-xl p-3 outline-none transition-all placeholder:text-white/25 text-xs resize-none"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-amber-500/80">Metode Penjajakan Takdir</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            type="button"
                                            onClick={() => setRitual('tarot')}
                                            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all ${
                                                ritual === 'tarot' 
                                                    ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(212,175,55,0.1)] text-amber-500' 
                                                    : 'bg-white/5 border-white/10 hover:border-white/20 text-white/60'
                                            }`}
                                        >
                                            <span className="text-base">🃏</span>
                                            <span className="text-[8px] font-semibold tracking-wider uppercase">Tarot</span>
                                        </button>

                                        <button 
                                            type="button"
                                            onClick={() => setRitual('star')}
                                            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all ${
                                                ritual === 'star' 
                                                    ? 'bg-violet-600/20 border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.1)] text-violet-300' 
                                                    : 'bg-white/5 border-white/10 hover:border-white/20 text-white/60'
                                            }`}
                                        >
                                            <span className="text-base">🌌</span>
                                            <span className="text-[8px] font-semibold tracking-wider uppercase">Bintang</span>
                                        </button>

                                        <button 
                                            type="button"
                                            onClick={() => setRitual('whisper')}
                                            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all ${
                                                ritual === 'whisper' 
                                                    ? 'bg-emerald-600/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)] text-emerald-300' 
                                                    : 'bg-white/5 border-white/10 hover:border-white/20 text-white/60'
                                            }`}
                                        >
                                            <span className="text-base">🍃</span>
                                            <span className="text-[8px] font-semibold tracking-wider uppercase">Semesta</span>
                                        </button>

                                        <button 
                                            type="button"
                                            onClick={() => setRitual('chat')}
                                            className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all ${
                                                ritual === 'chat' 
                                                    ? 'bg-fuchsia-600/20 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.1)] text-fuchsia-300' 
                                                    : 'bg-white/5 border-white/10 hover:border-white/20 text-white/60'
                                            }`}
                                        >
                                            <span className="text-base">💬</span>
                                            <span className="text-[8px] font-semibold tracking-wider uppercase">Tanya AI</span>
                                        </button>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleInviteProphecy}
                                    className="w-full mt-2 py-3 bg-amber-500 hover:scale-[1.02] active:scale-[0.98] text-black font-semibold tracking-widest rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.15)] transition-all flex items-center justify-center gap-2 uppercase text-[10px]"
                                >
                                    <span>🔮</span> Mulai Ritual takdir
                                </button>
                            </div>
                        )}
                        
                        <div className="h-[1px] w-full bg-white/10 my-1" />
                        <p className="text-[8px] text-center text-white/30 tracking-widest uppercase">Pesan Oracle dienkripsi penuh End-to-End di perangkat Anda</p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
