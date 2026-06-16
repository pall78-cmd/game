import { useState, useEffect, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Check, CheckCheck, Copy, Download } from 'lucide-react';
import { UNO_CARD_SVG } from '../constants/boardGameDeck';
import { MessageParser } from '../utils/messageParser';
import { bgmManager } from '../utils/bgmManager';

export const AudioPlayer = ({ url, isPlaying, onToggle }: { url: string, isPlaying: boolean, onToggle: () => void }) => {
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (isPlaying) {
            audioRef.current?.play().catch(() => onToggle());
            bgmManager.onVoiceNotePlay();
        } else {
            audioRef.current?.pause();
            bgmManager.onVoiceNoteEnd();
        }

        return () => {
            if (isPlaying) {
                bgmManager.onVoiceNoteEnd();
            }
        };
    }, [isPlaying]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const bars = 24;
            const barWidth = 3;
            const barSpacing = 2;
            const centerY = canvas.height / 2;

            for (let i = 0; i < bars; i++) {
                const barX = i * (barWidth + barSpacing);
                const progressRatio = i / bars;
                const isPlayed = progressRatio < (progress / 100);

                let height = 4;
                if (isPlaying) {
                    const wave1 = Math.sin((Date.now() * 0.006) + (i * 0.3));
                    const wave2 = Math.cos((Date.now() * 0.01) + (i * 0.4));
                    height = Math.abs(wave1 + wave2) * 8 + 4;
                } else if (isPlayed) {
                    height = 6;
                }

                ctx.fillStyle = isPlayed ? '#EAB308' : 'rgba(255, 255, 255, 0.2)';
                
                ctx.beginPath();
                const rx = barX;
                const ry = centerY - height / 2;
                const rw = barWidth;
                const rh = height;
                ctx.roundRect ? ctx.roundRect(rx, ry, rw, rh, 1.5) : ctx.rect(rx, ry, rw, rh);
                ctx.fill();
            }
            animationId = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animationId);
    }, [isPlaying, progress]);

    const formatTime = (time: number) => {
        if (isNaN(time) || !isFinite(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center gap-3 min-w-[200px] py-2 px-3 bg-black/20 rounded-xl">
            <button onClick={onToggle} className="w-10 h-10 rounded-full bg-gold/20 border border-gold/40 text-gold flex items-center justify-center active:scale-90 transition-transform shadow-lg shrink-0">
                {isPlaying ? <span className="text-[10px] font-bold">||</span> : <span className="ml-0.5 text-sm">▶</span>}
            </button>
            <span className="text-xs text-white/50 font-mono tracking-tighter shrink-0 w-8 text-center bg-black/10 py-0.5 rounded border border-white/5">
                {formatTime(currentTime)}
            </span>
            <div className="flex-1 flex flex-col justify-center min-w-[100px] relative px-1">
                <canvas 
                    ref={canvasRef} 
                    width={118} 
                    height={20} 
                    className="w-full h-5 rounded opacity-90"
                />
                <div className="h-[2px] bg-white/10 rounded-full overflow-hidden w-full mt-1">
                    <div className="h-full bg-gold transition-all duration-100" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
            <span className="text-[10px] text-white/40 font-mono tracking-tighter shrink-0">
                {formatTime(duration)}
            </span>
            <a 
                href={url} 
                download={`voice-note-${Date.now()}.mp3`}
                target="_blank" 
                rel="noreferrer"
                className="w-8 h-8 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center shrink-0 active:scale-90 duration-100"
                title="Download Voice Note"
                onClick={(e) => e.stopPropagation()}
            >
                <Download className="w-3.5 h-3.5" />
            </a>
            <audio 
                ref={audioRef} 
                src={url} 
                onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                onTimeUpdate={() => {
                    if (audioRef.current) {
                        setCurrentTime(audioRef.current.currentTime);
                        setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
                    }
                }} 
                onEnded={() => {
                    onToggle();
                    setCurrentTime(0);
                    setProgress(0);
                }} 
                className="hidden" 
            />
        </div>
    );
};

export const FateCardDisplay = ({ raw }: { raw: string }) => {
    try {
        const d = JSON.parse(raw);
        const contentStr = d.content || "";
        let type = "FATE";
        let content = contentStr;

        if (contentStr.startsWith("GAME ")) {
            const parts = contentStr.split(":");
            type = parts[0];
            content = parts.slice(1).join(":").trim();
        } else if (!contentStr.includes(":")) {
            type = "ORACLE SPEAKS";
            content = contentStr;
        } else {
            const parts = contentStr.split(":");
            type = parts[0] || "FATE";
            content = parts.slice(1).join(":").trim() || contentStr;
        }

        return (
            <motion.div 
                initial={{ rotateY: 90, opacity: 0, scale: 0.8 }}
                animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 100 }}
                className="p-5 rounded-2xl border-2 border-gold/40 bg-gradient-to-br from-zinc-900 via-black to-zinc-900 text-center space-y-4 shadow-[0_0_30px_rgba(212,175,55,0.2)] relative overflow-hidden group"
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.1)_0%,transparent_70%)] animate-pulse-slow"></div>
                
                <div className="relative z-10">
                    <div className="text-[9px] font-header tracking-[6px] uppercase opacity-70 text-gold mb-1">{type}</div>
                    <div className="h-[1px] w-12 bg-gold/30 mx-auto mb-4"></div>
                    <div className="font-mystic text-2xl italic text-white leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        "{content}"
                    </div>
                    <div className="text-[8px] opacity-40 uppercase tracking-[3px] font-header mt-4">
                        Invoked by <span className="text-gold/80">{d.invoker}</span>
                    </div>
                </div>
                
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-gold/5 rounded-full blur-3xl group-hover:bg-gold/10 transition-colors"></div>
            </motion.div>
        );
    } catch { return <div className="p-3 text-red-500 border border-red-500/20 rounded-lg text-xs italic">Takdir yang Terdistorsi</div>; }
};

const specialCardDetails: Record<string, {
    title: string;
    description: string;
    gradient: string;
    glowColor: string;
    shimmerClass: string;
    emoji: string;
    animation: {
        animate: any;
        transition: any;
    };
    particleColor: string;
}> = {
    '+1': {
        title: 'ATTACK +1',
        description: 'Pemain berikutnya harus mengambil 1 kartu!',
        gradient: 'from-amber-600/30 to-red-600/30 border-red-500',
        glowColor: 'rgba(239, 68, 68, 0.4)',
        shimmerClass: 'bg-red-500/10',
        emoji: '⚔️',
        animation: {
            animate: {
                scale: [0.8, 1.3, 0.95, 1],
                y: [50, -35, 5, 0],
                rotate: [0, -12, 12, 0],
            },
            transition: {
                type: 'spring',
                damping: 12,
                stiffness: 220,
                duration: 0.95
            }
        },
        particleColor: 'bg-red-500'
    },
    '+5': {
        title: 'BURNING ATTACK +5',
        description: 'Pemain berikutnya harus mengambil 5 kartu!',
        gradient: 'from-orange-600/50 via-red-600/40 to-yellow-600/30 border-orange-500 animate-pulse',
        glowColor: 'rgba(249, 115, 22, 0.7)',
        shimmerClass: 'bg-orange-500/20',
        emoji: '🔥',
        animation: {
            animate: {
                scale: [0.3, 1.45, 0.9, 1.05, 1],
                rotate: [0, 18, -18, 8, -8, 0],
                y: [80, -40, 10, 0],
            },
            transition: {
                type: 'spring',
                damping: 7,
                stiffness: 240,
                duration: 1.1
            }
        },
        particleColor: 'bg-orange-500'
    },
    'Flip': {
        title: 'DIMENSION SHIFT: FLIP!',
        description: 'Balik sisi tumpukan kartu sekarang!',
        gradient: 'from-indigo-600/40 via-purple-600/40 to-pink-600/30 border-purple-500',
        glowColor: 'rgba(168, 85, 247, 0.6)',
        shimmerClass: 'bg-purple-500/20',
        emoji: '🌀',
        animation: {
            animate: {
                rotateY: [0, 180, 360, 540, 720],
                scale: [0.8, 1.35, 0.75, 1.1, 1],
                rotateZ: [0, 15, -15, 0]
            },
            transition: {
                duration: 1.5,
                ease: 'easeInOut',
            }
        },
        particleColor: 'bg-purple-400'
    },
    'Skip': {
        title: 'TURN BLOCKED: SKIP',
        description: 'Lewati giliran pemain berikutnya!',
        gradient: 'from-sky-600/30 to-blue-600/30 border-sky-400',
        glowColor: 'rgba(56, 189, 248, 0.4)',
        shimmerClass: 'bg-sky-500/10',
        emoji: '❄️',
        animation: {
            animate: {
                scale: [0.8, 1.2, 0.9, 1],
                x: [-180, 25, -8, 0],
                skewX: [-20, 12, -4, 0]
            },
            transition: {
                duration: 0.9,
                ease: [0.16, 1, 0.3, 1]
            }
        },
        particleColor: 'bg-sky-300'
    },
    'Skip Everyone': {
        title: 'ZERO ZONE: SKIP EVERYONE',
        description: 'Semua pemain dilewati! Giliran Anda lagi!',
        gradient: 'from-cyan-600/40 via-sky-600/40 to-blue-800/30 border-cyan-400',
        glowColor: 'rgba(34, 211, 238, 0.5)',
        shimmerClass: 'bg-cyan-500/20',
        emoji: '❄️⚔️',
        animation: {
            animate: {
                scale: [0.8, 1.35, 0.85, 1.1, 1],
                y: [-120, 15, -5, 0],
                rotateY: [0, 180, 360]
            },
            transition: {
                duration: 1.1,
                ease: 'easeInOut'
            }
        },
        particleColor: 'bg-cyan-400'
    },
    'Reverse': {
        title: 'TEMPORAL FLUX: REVERSE',
        description: 'Balikkan arah putaran permainan!',
        gradient: 'from-emerald-600/30 to-teal-600/30 border-emerald-400',
        glowColor: 'rgba(52, 211, 153, 0.5)',
        shimmerClass: 'bg-emerald-500/10',
        emoji: '🔄',
        animation: {
            animate: {
                rotate: [0, -360, -720],
                scale: [0.8, 1.25, 0.9, 1.05, 1],
            },
            transition: {
                duration: 1.2,
                ease: [0.34, 1.56, 0.64, 1]
            }
        },
        particleColor: 'bg-emerald-400'
    },
    'Wild': {
        title: 'AURORA WILDCARD',
        description: 'Pilih warna baru yang kamu inginkan!',
        gradient: 'from-red-500/20 via-green-500/20 to-blue-500/20 border-white',
        glowColor: 'rgba(255, 255, 255, 0.5)',
        shimmerClass: 'bg-gradient-to-r from-red-500/10 via-yellow-500/10 to-blue-500/10',
        emoji: '🔮',
        animation: {
            animate: {
                scale: [0.6, 1.4, 0.85, 1.1, 1],
                rotateZ: [0, 360],
                rotateY: [0, 180, 360],
            },
            transition: {
                duration: 1.3,
                ease: 'easeInOut'
            }
        },
        particleColor: 'bg-pink-400'
    },
    'Wild Draw 2': {
        title: 'TEMPEST WILD DRAW 2',
        description: 'Pilih warna & pemain berikutnya ambil 2 kartu!',
        gradient: 'from-yellow-500/30 via-pink-500/20 to-indigo-500/30 border-yellow-400',
        glowColor: 'rgba(250, 204, 21, 0.6)',
        shimmerClass: 'bg-yellow-500/20 border-yellow-400',
        emoji: '⚡',
        animation: {
            animate: {
                scale: [0.8, 1.3, 0.9, 1.05, 1],
                rotateZ: [-15, 15, -10, 10, -5, 5, 0],
                y: [30, -20, 0]
            },
            transition: {
                duration: 1.0,
                ease: 'easeInOut'
            }
        },
        particleColor: 'bg-amber-300'
    },
    'Wild Draw Color': {
        title: 'COSMIC WILD DRAW COLOR',
        description: 'Tarik kartu sampai warna pilihan cocok!',
        gradient: 'from-purple-600/40 via-red-500/20 to-blue-600/40 border-purple-400',
        glowColor: 'rgba(192, 132, 252, 0.6)',
        shimmerClass: 'bg-purple-500/20',
        emoji: '🌌',
        animation: {
            animate: {
                scale: [0.8, 1.35, 0.85, 1.1, 1],
                skewX: [-15, 15, -5, 5, 0],
                rotateY: [0, 360]
            },
            transition: {
                duration: 1.4,
                ease: 'easeInOut'
            }
        },
        particleColor: 'bg-fuchsia-400'
    }
};

export const BoardGameCardDisplay = ({ raw, invokerName }: { raw: string, invokerName?: string }) => {
    try {
        let contentStr = raw;
        let invoker = invokerName || "";
        
        if (raw.startsWith("{")) {
            const d = JSON.parse(raw);
            contentStr = d.content || "";
            invoker = d.invoker || invoker;
        }
        
        if (!contentStr.startsWith("BOARDGAME:")) return null;
        
        const parts = contentStr.split(":");
        if (parts.length < 3) return null;
        
        const gameType = parts[1];

        if (gameType === 'UNO_FLIP') {
            const side = parts[2] as 'Light' | 'Dark';
            const color = parts[3];
            const value = parts[4];
            
            const isSpecial = specialCardDetails[value];
            const particles = Array.from({ length: 6 });

            if (isSpecial) {
                return (
                    <div className="flex flex-col items-center justify-center py-4 px-2 select-none mx-auto pointer-events-none">
                        <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="mb-4 px-4 py-1.5 rounded-full border border-gold/40 bg-black/80 shadow-[0_0_15px_rgba(212,175,55,0.3)] text-center flex items-center gap-2 z-20 pointer-events-none"
                        >
                            <span className="text-sm">{isSpecial.emoji}</span>
                            <span className="font-header text-[11px] text-gold tracking-widest uppercase font-bold text-center">
                                {isSpecial.title}
                            </span>
                            <span className="text-sm">{isSpecial.emoji}</span>
                        </motion.div>

                        <div className="relative p-3.5 rounded-[24px] overflow-visible bg-zinc-950/50 border border-white/5 backdrop-blur-sm shadow-2xl pointer-events-none">
                            <div 
                                className="absolute inset-0 rounded-[24px] blur-2xl opacity-40 pointer-events-none transition-all duration-1000"
                                style={{ 
                                    boxShadow: `0 0 35px 15px ${isSpecial.glowColor}`,
                                    background: `radial-gradient(circle, ${isSpecial.glowColor} 0%, transparent 70%)`
                                }}
                            />

                            {particles.map((_, i) => {
                                const angle = (i / 6) * 2 * Math.PI;
                                const distanceBody = 60 + Math.random() * 60;
                                const xDest = Math.cos(angle) * distanceBody;
                                const yDest = Math.sin(angle) * distanceBody;
                                return (
                                    <motion.div
                                        key={i}
                                        initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
                                        animate={{ x: xDest, y: yDest, opacity: 0, scale: [0.6, 1.2, 0] }}
                                        transition={{ duration: 1.2, ease: "easeOut", delay: Math.random() * 0.05 }}
                                        className={`absolute w-1.5 h-1.5 rounded-full z-10 shadow-[0_0_8px_currentColor] text-white/55 pointer-events-none ${isSpecial.particleColor}`}
                                        style={{ left: "50%", top: "45%", transform: "translate(-50%, -50%)" }}
                                    />
                                );
                            })}

                            <div className="absolute inset-0 overflow-hidden rounded-[22px] pointer-events-none z-10">
                                <motion.div 
                                    initial={{ x: '-150%' }}
                                    animate={{ x: '150%' }}
                                    transition={{ repeat: 1, duration: 1.8, ease: 'linear', repeatDelay: 1 }}
                                    className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-12 pointer-events-none"
                                />
                            </div>

                            <motion.div
                                initial={{ rotateY: 90, opacity: 0, scale: 0.7 }}
                                animate={isSpecial.animation.animate}
                                transition={isSpecial.animation.transition}
                                className="w-40 h-60 relative shadow-2xl z-10 pointer-events-none"
                            >
                                <div className="w-full h-full pointer-events-none" dangerouslySetInnerHTML={{ __html: UNO_CARD_SVG(side, color, value) }} />
                            </motion.div>
                        </div>

                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.7 }}
                            transition={{ delay: 0.4 }}
                            className="mt-3.5 text-[10px] uppercase tracking-wider text-center text-zinc-300 font-sans max-w-[170px] whitespace-normal leading-relaxed font-bold pointer-events-none"
                        >
                            {isSpecial.description}
                        </motion.div>
                        
                        <div className="mt-1.5 text-[8px] opacity-40 uppercase tracking-widest text-zinc-400 whitespace-nowrap text-center pointer-events-none">
                            {invoker ? `Ditarik oleh ${invoker} ` : ''}({side} Side)
                        </div>
                    </div>
                );
            }

            return (
                <motion.div 
                    initial={{ rotateY: 90, opacity: 0, scale: 0.8 }}
                    animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 100 }}
                    className="w-40 h-60 relative shadow-lg mx-auto mb-6"
                >
                    <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: UNO_CARD_SVG(side, color, value) }} />
                    <div className="absolute -bottom-6 left-0 right-0 text-[8px] opacity-60 uppercase tracking-widest text-white whitespace-nowrap text-center">
                        {invoker ? `Ditarik oleh ${invoker} ` : ''}({side} Side)
                    </div>
                </motion.div>
            );
        }
        return null;
    } catch { return <div className="p-3 text-red-500 border border-red-500/20 rounded-lg text-xs italic">Kartu Rusak</div>; }
};

export const formatText = (text: string) => {
    if (!text) return '';
    let formatted = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline underline-offset-2">$1</a>');

    formatted = formatted.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
    formatted = formatted.replace(/~(.*?)~/g, '<del>$1</del>');
    formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-black/30 rounded px-1 py-0.5 font-mono text-[0.9em]">$1</code>');
    return formatted;
};

export const MessageContent = ({ type, content, isPlayingAudio, msgId, onPlayAudio, isMe, isSecret = false, onImageClick, invokerName }: any) => {
    if (type === "boardgame") {
        return <BoardGameCardDisplay raw={content} invokerName={invokerName} />;
    }

    if (type === "vn" || (typeof content === 'string' && content.startsWith("[VN]"))) {
        const url = type === "vn" ? content : content.substring(4).trim();
        return <AudioPlayer url={url} isPlaying={isPlayingAudio} onToggle={() => onPlayAudio(isPlayingAudio ? null : msgId)} />;
    }

    if (type === "img" || (typeof content === 'string' && content.startsWith("[IMG]"))) {
        const rawContent = type === "img" ? content : content.substring(5).trim();
        const parts = rawContent.split("\n");
        const url = parts[0];
        const caption = parts.slice(1).join("\n");
        return (
            <div className="flex flex-col gap-2">
                <img 
                    src={url} 
                    className={`rounded-lg ${isSecret ? 'max-h-96 pointer-events-none select-none' : 'max-h-64'} w-full object-contain cursor-pointer hover:opacity-90 transition-opacity`} 
                    referrerPolicy="no-referrer" 
                    onClick={() => !isSecret && onImageClick && onImageClick(url)}
                    onLoad={() => {
                        const evt = new CustomEvent('imageLoaded');
                        window.dispatchEvent(evt);
                    }}
                    onContextMenu={(e) => isSecret && e.preventDefault()}
                    draggable={!isSecret}
                />
                {caption && <p 
                    className={`font-sans ${isSecret ? 'text-lg text-center' : 'text-[15px]'} leading-tight break-words whitespace-pre-wrap`}
                    dangerouslySetInnerHTML={{ __html: formatText(caption) }}
                />}
            </div>
        );
    }
    return <p 
        className={`font-sans ${isSecret ? 'text-xl text-center leading-relaxed' : 'text-[15px]'} leading-tight break-words whitespace-pre-wrap`}
        dangerouslySetInnerHTML={{ __html: formatText(content) }}
    />;
};

export const MessageBubble = memo(({ msg, isMe, onReply, onEdit, onViewOnce, isPlayingAudio, onPlayAudio, onVisible, encryptionKey, onImageClick }: any) => {
    const bubbleRef = useRef<HTMLDivElement>(null);
    const [swipeX, setSwipeX] = useState(0);
    const [isCopied, setIsCopied] = useState(false);
    const touchStartRef = useRef(0);
    const longPressTimer = useRef<any>(null);
    const isSwiping = useRef(false);

    useEffect(() => {
        if (!bubbleRef.current || isMe || msg.is_read) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                onVisible(msg.id);
                observer.disconnect();
            }
        }, { threshold: 0.1 });
        observer.observe(bubbleRef.current);
        return () => observer.disconnect();
    }, [msg.id, isMe, msg.is_read, onVisible]);

    const parsed = useMemo(() => {
        return MessageParser.parse(msg.teks, encryptionKey);
    }, [msg.teks, encryptionKey]);
    
    const identity = useMemo(() => {
        const parts = msg.nama.split('|');
        return { name: parts[0], avatar: parts[1] || '👤', color: parts[2] || '#D4AF37' };
    }, [msg.nama]);

    const handleTouchStart = (e: any) => {
        touchStartRef.current = e.touches[0].clientX;
        isSwiping.current = false;
        
        if (isMe && msg.nama !== "ORACLE") {
            longPressTimer.current = setTimeout(() => {
                if (!isSwiping.current) {
                    if (navigator.vibrate) navigator.vibrate(50);
                    onEdit(msg);
                }
            }, 600);
        }
    };

    const handleTouchMove = (e: any) => {
        const diff = e.touches[0].clientX - touchStartRef.current;
        if (Math.abs(diff) > 10) {
            isSwiping.current = true;
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
        }
        if (diff > 0 && diff < 100) setSwipeX(diff);
    };

    const handleTouchEnd = () => {
        if (swipeX > 60) {
            if (navigator.vibrate) navigator.vibrate(30);
            onReply(msg);
        }
        setSwipeX(0);
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    if (msg.nama === "ORACLE") {
        const isBoardGame = parsed.content.includes('"BOARDGAME:');
        return (
            <div ref={bubbleRef} className="flex flex-col items-center w-full my-6 px-4 animate-slide-up">
                <div className="w-full max-w-sm">
                    {isBoardGame ? (
                        <BoardGameCardDisplay raw={parsed.content} />
                    ) : (
                        <FateCardDisplay raw={parsed.content} />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div 
            id={`msg-${msg.id}`}
            ref={bubbleRef}
            className={`flex w-full mb-3 animate-slide-up relative px-3 ${isMe ? 'justify-end' : 'justify-start'}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => {
                if (isMe && msg.nama !== "ORACLE") {
                    e.preventDefault();
                    onEdit(msg);
                }
            }}
        >
            <AnimatePresence>
                {swipeX > 20 && (
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: swipeX / 60, x: (swipeX / 2) - 20 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-0 text-gold"
                    >
                        <Reply size={20} className={swipeX > 60 ? 'scale-125 transition-transform' : ''} />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={`flex max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                {!isMe && (
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm shrink-0 mb-1 avatar-animate shadow-lg overflow-hidden">
                        {identity.avatar.startsWith('http') || identity.avatar.startsWith('data:image') ? (
                            <img src={identity.avatar} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                            identity.avatar
                        )}
                    </div>
                )}

                <motion.div 
                    animate={{ x: swipeX }}
                    transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                    className={`relative flex flex-col p-3 shadow-2xl transition-all hover:scale-[1.01] ${
                        isMe 
                        ? 'bg-gradient-to-br from-emerald-900/90 to-emerald-800/90 backdrop-blur-md border border-emerald-500/20 text-white rounded-3xl rounded-tr-md' 
                        : 'bg-gradient-to-br from-zinc-800/90 to-zinc-900/90 backdrop-blur-md border border-white/10 text-white rounded-3xl rounded-tl-md'
                    } ${parsed.isVO ? 'bg-red-950/60 border border-red-500/40 text-red-400 cursor-pointer' : ''}`}
                    onClick={() => parsed.isVO && onViewOnce(msg)}
                >
                    {!isMe && (
                        <span className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: identity.color }}>
                            {identity.name}
                        </span>
                    )}

                    {parsed.replyData && (
                        <div 
                            className="mb-2 p-2 rounded bg-black/20 border-l-4 border-gold/50 text-[10px] opacity-80 italic break-words whitespace-pre-wrap line-clamp-3 overflow-hidden cursor-pointer hover:bg-black/40 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                const el = document.getElementById(`msg-${parsed.replyData?.id}`);
                                if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    el.classList.add('bg-white/20', 'rounded-lg', 'transition-all', 'duration-500');
                                    setTimeout(() => {
                                        el.classList.remove('bg-white/20', 'rounded-lg');
                                    }, 1500);
                                }
                            }}
                        >
                            <span className="font-bold text-gold not-italic">{parsed.replyData.name}:</span> {MessageParser.getPreview(parsed.replyData.text, encryptionKey)}
                        </div>
                    )}
                    
                    <div className="flex flex-col min-w-[60px]">
                        {parsed.isVO ? (
                            <div className="flex items-center gap-3 py-1">
                                <span className="text-xl">👁️</span>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-header tracking-widest uppercase">Secret Glimpse</span>
                                    <span className="text-[7px] opacity-40 uppercase">Tap to reveal</span>
                                </div>
                            </div>
                        ) : (
                            <MessageContent 
                                type={parsed.type} 
                                content={parsed.content} 
                                msgId={msg.id} 
                                isPlayingAudio={isPlayingAudio} 
                                onPlayAudio={onPlayAudio} 
                                isMe={isMe} 
                                onImageClick={onImageClick}
                                invokerName={identity.name}
                            />
                        )}
                        
                        <div className="flex items-center justify-end gap-1 mt-1 self-end opacity-60">
                            {(parsed.type === 'text' || (parsed.type === 'img' && parsed.content.includes('\n'))) && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        let textToCopy = '';
                                        if (parsed.type === 'text') {
                                            textToCopy = parsed.content;
                                        } else if (parsed.type === 'img') {
                                            const parts = parsed.content.split('\n');
                                            if (parts.length > 1) {
                                                textToCopy = parts.slice(1).join('\n');
                                            }
                                        }
                                        if (textToCopy) {
                                            navigator.clipboard.writeText(textToCopy);
                                            setIsCopied(true);
                                            setTimeout(() => setIsCopied(false), 2000);
                                        }
                                    }}
                                    className="mr-1 hover:text-white transition-colors cursor-pointer"
                                    title="Copy message"
                                >
                                    {isCopied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                </button>
                            )}
                            {parsed.isEdited && (
                                <span className="text-[8px] italic mr-1">
                                    (diedit)
                                </span>
                            )}
                            <span className="text-[8px] uppercase tracking-tighter">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && (
                                <span className={`flex items-center ml-1 ${msg.is_read ? 'text-[#34b7f1]' : 'text-white/40'}`}>
                                    <AnimatePresence mode="wait">
                                        {msg.is_read ? (
                                            <motion.div
                                                key="read"
                                                initial={{ scale: 0.5, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                            >
                                                <CheckCheck size={14} strokeWidth={2.5} />
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="unread"
                                                initial={{ scale: 0.5, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0.5, opacity: 0 }}
                                            >
                                                <Check size={14} strokeWidth={2.5} />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </span>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
});
