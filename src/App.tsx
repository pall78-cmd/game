import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Check, CheckCheck, Copy } from 'lucide-react';
import { UNO_CARD_SVG } from './constants/boardGameDeck';

import { ConnectionManager } from './utils/ConnectionManager';
import { supabaseClient } from '../supabase';
import { ORACLE_CONFIG } from './config';
import { GAME_DECK } from './constants/deck';
import { drawUnoFlipCard } from './constants/boardGames';
import { MessageParser } from './utils/messageParser';
import { AudioManager } from './utils/audioManager';
import { bgmManager, AVAILABLE_BGMS } from './utils/bgmManager';
import { StorageManager } from './utils/StorageManager';
import { CryptoUtils } from './utils/crypto';
import { ReactUnoBoard } from './components/ReactUnoBoard';
import { Leaderboard } from './components/Leaderboard';
import SideA from './components/SideA';
import SideB from './components/SideB';

// --- CONSTANTS & UTILS ---
const SUPA_URL = (import.meta as any).env.VITE_SUPA_URL || ORACLE_CONFIG?.SUPA_URL;
const SUPA_KEY = import.meta.env.VITE_SUPA_KEY || ORACLE_CONFIG?.SUPA_KEY;

if (!SUPA_URL || !SUPA_KEY) {
    console.error("Supabase configuration missing! Check environment variables.");
}

const safeStorage = {
    get: (key: string) => {
        try { return localStorage.getItem(key); } catch { return null; }
    },
    set: (key: string, value: string) => {
        try { localStorage.setItem(key, value); } catch { }
    }
};

// --- COMPONENTS ---


const AudioPlayer = ({ url, isPlaying, onToggle }: { url: string, isPlaying: boolean, onToggle: () => void }) => {
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

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
    }, [isPlaying]); // Removed onToggle from dependencies to prevent re-running on every render

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
            <span className="text-xs text-white/80 font-mono tracking-tighter shrink-0 w-16 text-center">
                {formatTime(currentTime)}
            </span>
            <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-[100px]">
                <div className="flex items-end gap-[2px] h-4 w-full">
                    {Array.from({ length: 24 }).map((_, i) => (
                        <motion.div 
                            key={i}
                            className="w-1 bg-gold/60 rounded-full"
                            animate={isPlaying ? { 
                                height: ['20%', `${Math.random() * 60 + 40}%`, '20%'] 
                            } : { height: '20%' }}
                            transition={{ 
                                repeat: Infinity, 
                                duration: 0.5 + Math.random() * 0.5, 
                                delay: Math.random() * 0.5 
                            }}
                            style={{ height: '20%' }}
                        />
                    ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden w-full">
                        <div className="h-full bg-gold transition-all duration-100" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>
            <span className="text-[10px] text-white/50 font-mono tracking-tighter shrink-0">
                {formatTime(duration)}
            </span>
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

const FateCardDisplay = ({ raw }: { raw: string }) => {
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

const BoardGameCardDisplay = ({ raw, invokerName }: { raw: string, invokerName?: string }) => {
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
                        {/* Glowing badge */}
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

                        {/* Card Arena with custom glow backdrops */}
                        <div className="relative p-3.5 rounded-[24px] overflow-visible bg-zinc-950/50 border border-white/5 backdrop-blur-sm shadow-2xl pointer-events-none">
                            {/* Pulsing Backglow */}
                            <div 
                                className="absolute inset-0 rounded-[24px] blur-2xl opacity-40 pointer-events-none transition-all duration-1000"
                                style={{ 
                                    boxShadow: `0 0 35px 15px ${isSpecial.glowColor}`,
                                    background: `radial-gradient(circle, ${isSpecial.glowColor} 0%, transparent 70%)`
                                }}
                            />

                            {/* Sparkle explosion particles */}
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

                            {/* Shimmer sweeping beam */}
                            <div className="absolute inset-0 overflow-hidden rounded-[22px] pointer-events-none z-10">
                                <motion.div 
                                    initial={{ x: '-150%' }}
                                    animate={{ x: '150%' }}
                                    transition={{ repeat: 1, duration: 1.8, ease: 'linear', repeatDelay: 1 }}
                                    className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-12 pointer-events-none"
                                />
                            </div>

                            {/* Card Body */}
                            <motion.div
                                initial={{ rotateY: 90, opacity: 0, scale: 0.7 }}
                                animate={isSpecial.animation.animate}
                                transition={isSpecial.animation.transition}
                                className="w-40 h-60 relative shadow-2xl z-10 pointer-events-none"
                            >
                                <div className="w-full h-full pointer-events-none" dangerouslySetInnerHTML={{ __html: UNO_CARD_SVG(side, color, value) }} />
                            </motion.div>
                        </div>

                        {/* Description */}
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

const formatText = (text: string) => {
    if (!text) return '';
    let formatted = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    // URL Parsing
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline underline-offset-2">$1</a>');

    formatted = formatted.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');
    formatted = formatted.replace(/~(.*?)~/g, '<del>$1</del>');
    formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-black/30 rounded px-1 py-0.5 font-mono text-[0.9em]">$1</code>');
    return formatted;
};

const MessageContent = ({ type, content, isPlayingAudio, msgId, onPlayAudio, isMe, isSecret = false, onImageClick, invokerName }: any) => {
    if (type === "boardgame") {
        return <BoardGameCardDisplay raw={content} invokerName={invokerName} />;
    }

    // Robust detection: if type is vn OR content starts with [VN] (fallback for parser delay)
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

const Bubble = memo(({ msg, isMe, onReply, onEdit, onViewOnce, isPlayingAudio, onPlayAudio, onVisible, encryptionKey, onImageClick }: any) => {
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

// --- MAIN APP ---

function App() {
    const [layer, setLayer] = useState(() => {
        if (safeStorage.get('oracle_adult') === null) return 'AGE';
        if (safeStorage.get('oracle_user') === null) return 'NAME';
        return safeStorage.get('oracle_unlocked') === 'true' ? 'LOBBY' : 'SECURITY';
    });

    const [isTransitioningTo, setIsTransitioningTo] = useState<'A' | 'B' | null>(null);
    const [currentRoom, setCurrentRoom] = useState<'A' | 'B'>('A');
    const currentRoomRef = useRef<'A' | 'B'>('A');
    useEffect(() => { currentRoomRef.current = currentRoom; }, [currentRoom]);

    const getEncKey = useCallback(() => {
        const room = currentRoomRef.current;
        return safeStorage.get(`enc_key_${room}`) || (room === 'A' ? safeStorage.get('enc_key') : '') || '';
    }, []);

    const [username, setUsername] = useState(() => safeStorage.get('oracle_user') || '');
    const [avatar, setAvatar] = useState(() => safeStorage.get('oracle_avatar') || '🔮');
    const [userColor, setUserColor] = useState(() => safeStorage.get('oracle_color') || '#D4AF37');
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [isViewOnce, setIsViewOnce] = useState(false);
    const [fateMode, setFateMode] = useState(false);
    const [boardGameMenuOpen, setBoardGameMenuOpen] = useState(false);
    const [currentAudioId, setCurrentAudioId] = useState<string | number | null>(null);
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [editingMsg, setEditingMsg] = useState<any>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [encryptionKeyA, setEncryptionKeyA] = useState(() => safeStorage.get('enc_key_A') || safeStorage.get('enc_key') || '');
    const [encryptionKeyB, setEncryptionKeyB] = useState(() => safeStorage.get('enc_key_B') || '');
    const encryptionKey = currentRoom === 'A' ? encryptionKeyA : encryptionKeyB;

    const setEncryptionKey = (key: string) => {
        if (currentRoom === 'A') {
            setEncryptionKeyA(key);
            safeStorage.set('enc_key_A', key);
            safeStorage.set('enc_key', key);
        } else {
            setEncryptionKeyB(key);
            safeStorage.set('enc_key_B', key);
        }
    };
    const [isRecording, setIsRecording] = useState(false);
    const [viewingSecret, setViewingSecret] = useState<any>(null);
    const [pinInput, setPinInput] = useState('');
    const [showChaosPinModal, setShowChaosPinModal] = useState(false);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [showPatchNotes, setShowPatchNotes] = useState(() => {
        try { return safeStorage.get('patch_v17_11_seen') !== 'true'; } catch { return false; }
    });
    const [showLobbyUpdate, setShowLobbyUpdate] = useState(() => {
        try { return safeStorage.get('lobby_update_seen') !== 'true'; } catch { return true; }
    });
    const [chaosPinInput, setChaosPinInput] = useState('');
    const [isChaosUnlocked, setIsChaosUnlocked] = useState(() => {
        try { return sessionStorage.getItem('chaos_unlocked') === 'true'; } catch { return false; }
    });
    const [isUploading, setIsUploading] = useState(false);
    const isUploadingRef = useRef(false);
    const [connStatus, setConnStatus] = useState('OFFLINE');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [oracleEffect, setOracleEffect] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const showScrollButtonRef = useRef(false);

    useEffect(() => {
        if (selectedImage) {
            bgmManager.onImageOpen();
        } else {
            bgmManager.onImageClose();
        }
    }, [selectedImage]);

    useEffect(() => {
        showScrollButtonRef.current = showScrollButton;
    }, [showScrollButton]);

    const [bgmVolume, setBgmVolume] = useState(0.3);
    const [isBgmMuted, setIsBgmMuted] = useState(false);
    const [bgmTrack, setBgmTrack] = useState(() => bgmManager.getTrackIndex());

    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(isIosDevice && !(window.navigator as any).standalone);
    }, []);

    const [filterType, setFilterType] = useState<'all' | 'unread' | 'sender'>('all');
    const [filterSender, setFilterSender] = useState('');
    const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    const feedRef = useRef<HTMLElement>(null);
    const audioManagerRef = useRef<any>(null);
    const connManagerRef = useRef<ConnectionManager | null>(null);
    const typingTimeoutRef = useRef<any>(null);
    const storageManagerRef = useRef<StorageManager | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [unreadCount, setUnreadCount] = useState(0);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [toast, setToast] = useState<{ message: string, type: 'info' | 'error' | 'success' } | null>(null);

    const [notifSettings, setNotifSettings] = useState<{ mode: 'all' | 'mention' | 'mute', cooldown: number }>(() => {
        const saved = safeStorage.get('notif_settings');
        return saved ? JSON.parse(saved) : { mode: 'all', cooldown: 2 };
    });
    const notifSettingsRef = useRef(notifSettings);
    const pendingNotifsRef = useRef<{ [sender: string]: number }>({});
    const notifTimeoutRef = useRef<any>(null);

    useEffect(() => {
        notifSettingsRef.current = notifSettings;
        safeStorage.set('notif_settings', JSON.stringify(notifSettings));
    }, [notifSettings]);

    const showToast = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const notificationAudioRef = useRef<HTMLAudioElement>(new Audio('https://rruxlxoeelxjjjmhafkc.supabase.co/storage/v1/object/public/suara/notification.mp3')); // Placeholder or use a real URL

    // Smart BGM Autoplay Logic
    useEffect(() => {
        const handleInteraction = () => {
            const bgm = bgmManager;
            if (bgm && (!bgm.isPlaying || bgm.audio.paused) && !bgm.isMuted) {
                bgm.isPlaying = false; // Force reset state if it was stuck
                bgm.play();
            }
        };

        window.addEventListener('click', handleInteraction);
        window.addEventListener('touchstart', handleInteraction);
        window.addEventListener('keydown', handleInteraction);
        
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    useEffect(() => {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }

        // Register Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    console.log('SW registered:', reg);
                    
                    // Check for existing permission
                    if (Notification.permission === 'default') {
                        // Don't auto-prompt, but maybe show a hint later
                    }

                    reg.onupdatefound = () => {
                        const installingWorker = reg.installing;
                        if (installingWorker) {
                            installingWorker.onstatechange = () => {
                                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    setUpdateAvailable(true);
                                }
                            };
                        }
                    };
                })
                .catch(err => console.error('SW registration failed:', err));
        }
    }, []);

    // BGM Control Effect
    useEffect(() => {
        const bgm = bgmManager;
        if (bgm) {
            bgm.setVolume(bgmVolume);
            bgm.mute(isBgmMuted);
            if (bgmTrack !== bgm.getTrackIndex()) {
                bgm.setTrack(bgmTrack);
            }
        }
    }, [bgmVolume, isBgmMuted, bgmTrack]);



    useEffect(() => {
        if (layer !== 'MAIN') return;

        const initialize = async () => {
            let query = supabaseClient.from('Pesan').select('*').order('id', { ascending: true });
            if (currentRoomRef.current === 'B') {
                query = query.like('nama', 'ROOM_B|%');
            } else {
                query = query.not('nama', 'like', 'ROOM_B|%');
            }
            const { data } = await query;
            if (data) setMessages(data);

            connManagerRef.current = new ConnectionManager(supabaseClient, setConnStatus);
            await connManagerRef.current.subscribe('chat_room', (event: any) => {
                if (event.type === 'INSERT') {
                    const newMsg = event.payload.new;
                    const isRoomB = newMsg.nama.startsWith('ROOM_B|');
                    if (currentRoomRef.current === 'B' && !isRoomB) return;
                    if (currentRoomRef.current === 'A' && isRoomB) return;

                    setMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev;
                        const filtered = prev.filter(m => !(m.id < 0 && m.teks === newMsg.teks));
                        return [...filtered, newMsg];
                    });
                    
                    // Decrypt nama for notifications and effects
                    let rawNama = newMsg.nama;
                    if (rawNama.startsWith('ROOM_B|') || rawNama.startsWith('ROOM_A|')) {
                        rawNama = rawNama.substring(7);
                    }
                    let decNama = rawNama;
                    try {
                        const encKey = getEncKey();
                        decNama = CryptoUtils.decrypt(rawNama, encKey);
                    } catch (e) {}

                        // Oracle Effect
                        if (decNama === "ORACLE") {
                            setOracleEffect(true);
                            setTimeout(() => setOracleEffect(false), 1000);
                            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                        }

                        // Notification logic
                        const isBackground = document.hidden || !document.hasFocus();
                        const isScrolledUp = showScrollButtonRef.current;
                        
                        if ((isBackground || isScrolledUp) && decNama.split('|')[0] !== username && !decNama.startsWith('🔒')) {
                            const settings = notifSettingsRef.current;
                            if (settings.mode === 'mute') return;

                            let decTeks = newMsg.teks;
                            try {
                                const encKey = getEncKey();
                                decTeks = CryptoUtils.decrypt(newMsg.teks, encKey);
                            } catch (e) {}

                            if (settings.mode === 'mention' && !decTeks.includes(`@${username}`)) return;

                            // Play sound
                            if (notificationAudioRef.current) {
                                notificationAudioRef.current.play().catch(() => {});
                            }
                            
                            // Update badge
                            setUnreadCount(prev => {
                                const next = prev + 1;
                                if ('setAppBadge' in navigator) navigator.setAppBadge(next);
                                return next;
                            });

                            if (isBackground && Notification.permission === 'granted') {
                                const senderName = decNama.split('|')[0];
                                pendingNotifsRef.current[senderName] = (pendingNotifsRef.current[senderName] || 0) + 1;

                                if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);

                                notifTimeoutRef.current = setTimeout(() => {
                                    navigator.serviceWorker.ready.then(registration => {
                                        const senders = Object.keys(pendingNotifsRef.current);
                                        if (senders.length === 0) return;

                                        let title = '';
                                        let body = '';
                                        const previewText = MessageParser.getPreview(newMsg.teks, getEncKey()) || (decTeks.startsWith('[') ? 'Mengirim media...' : decTeks);

                                        if (senders.length === 1) {
                                            const count = pendingNotifsRef.current[senders[0]];
                                            title = count > 1 ? `${count} pesan baru dari ${senders[0]}` : `Pesan dari ${senders[0]}`;
                                            body = count > 1 ? `Anda memiliki ${count} pesan yang belum dibaca dari ${senders[0]}.` : previewText;
                                        } else {
                                            const total = Object.values(pendingNotifsRef.current).reduce((a, b) => a + b, 0);
                                            title = `${total} pesan baru di Oracle Chamber`;
                                            body = `Pesan dari: ${senders.join(', ')}`;
                                        }

                                        registration.showNotification(title, {
                                            body,
                                            icon: decNama.split('|')[1] || 'https://cdn-icons-png.flaticon.com/512/1684/1684426.png',
                                            badge: 'https://cdn-icons-png.flaticon.com/512/1684/1684426.png',
                                            tag: 'oracle-group',
                                            renotify: true,
                                            vibrate: [200, 100, 200]
                                        } as any);

                                        pendingNotifsRef.current = {};
                                    });
                                }, settings.cooldown * 1000);
                            }
                        }
                    } else if (event.type === 'UPDATE') {
                        const updatedMsg = event.payload.new;
                        const isRoomB = updatedMsg.nama.startsWith('ROOM_B|');
                        if (currentRoomRef.current === 'B' && !isRoomB) return;
                        if (currentRoomRef.current === 'A' && isRoomB) return;
                        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
                    } else if (event.type === 'DELETE') {
                        const deletedId = event.payload.old?.id;
                        if (deletedId) {
                            setMessages(prev => prev.filter(m => m.id !== deletedId));
                        }
                    } else if (event.type === 'TYPING') {
                        let typer = event.payload.payload.user;
                        const isRoomB = typer.startsWith('ROOM_B|');
                        if (currentRoomRef.current === 'B' && !isRoomB) return;
                        if (currentRoomRef.current === 'A' && isRoomB) return;
                        
                        let rawTyper = typer;
                        if (rawTyper.startsWith('ROOM_B|') || rawTyper.startsWith('ROOM_A|')) {
                            rawTyper = rawTyper.substring(7);
                        }
                        
                        try {
                            const encKey = getEncKey();
                            typer = CryptoUtils.decrypt(rawTyper, encKey);
                        } catch (e) {}

                        if (typer && typer !== username && !typer.startsWith('🔒')) {
                            setTypingUsers(prev => {
                                const next = new Set(prev);
                                next.add(typer);
                                return next;
                            });
                            
                            // Clear typing status after 3 seconds
                            setTimeout(() => {
                                setTypingUsers(prev => {
                                    const next = new Set(prev);
                                    next.delete(typer);
                                    return next;
                                });
                            }, 3000);
                        }
                    }
                });
        };

        const handleVisibilityChange = async () => {
            if (!document.hidden) {
                setUnreadCount(0);
                if ('setAppBadge' in navigator) navigator.clearAppBadge();
                
                console.log("Tab is visible again, syncing messages...");
                setConnStatus('RECONNECTING');
                
                // 1. Fetch latest messages to catch up
                let query = supabaseClient.from('Pesan').select('*').order('id', { ascending: true });
                if (currentRoomRef.current === 'B') {
                    query = query.like('nama', 'ROOM_B|%');
                } else {
                    query = query.not('nama', 'like', 'ROOM_B|%');
                }
                const { data } = await query;
                if (data) setMessages(data);

                // 2. Force reconnect realtime channel
                if (connManagerRef.current) {
                    connManagerRef.current.triggerReconnect();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        initialize();
        audioManagerRef.current = new AudioManager();
        storageManagerRef.current = new StorageManager(supabaseClient);
        bgmManager.play();
        bgmManager.setVolume(bgmVolume);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (connManagerRef.current) connManagerRef.current.cleanup();
        };
    }, [layer, username]);

    const decryptedMessages = useMemo(() => {
        return messages.map(m => {
            let rawNama = m.nama;
            if (rawNama.startsWith('ROOM_B|') || rawNama.startsWith('ROOM_A|')) {
                rawNama = rawNama.substring(7);
            }
            let decNama = rawNama;
            try {
                decNama = CryptoUtils.decrypt(rawNama, encryptionKey);
            } catch (e) {}
            return { ...m, nama: decNama };
        });
    }, [messages, encryptionKey]);

    const filteredMessages = useMemo(() => {
        if (filterType === 'unread') return decryptedMessages.filter(m => !m.is_read && m.nama.split('|')[0] !== username);
        if (filterType === 'sender' && filterSender) return decryptedMessages.filter(m => m.nama.split('|')[0] === filterSender);
        return decryptedMessages;
    }, [decryptedMessages, filterType, filterSender, username]);

    const uniqueSenders = useMemo(() => {
        const senders = new Set(decryptedMessages.map(m => m.nama.split('|')[0]));
        return Array.from(senders).filter(s => s !== username && s !== 'ORACLE' && !s.startsWith('🔒'));
    }, [decryptedMessages, username]);

    const pendingReadUpdates = useRef<Set<number>>(new Set());
    const readUpdateTimer = useRef<any>(null);

    const handleMessageVisible = useCallback((id: number) => {
        pendingReadUpdates.current.add(id);
        
        if (readUpdateTimer.current) clearTimeout(readUpdateTimer.current);
        
        readUpdateTimer.current = setTimeout(() => {
            const idsToUpdate = Array.from(pendingReadUpdates.current);
            if (idsToUpdate.length > 0) {
                supabaseClient.from('Pesan').update({ is_read: true }).in('id', idsToUpdate).then(({ error }) => {
                    if (error) console.error("Failed to update read status:", error);
                });
                pendingReadUpdates.current.clear();
            }
        }, 1000);
    }, []);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = '48px';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [inputText]);

    const handleScroll = useCallback(() => {
        if (!feedRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
        // Show button if we are more than 150px away from the bottom
        const isScrolledUp = scrollHeight - scrollTop - clientHeight > 150;
        setShowScrollButton(isScrolledUp);
        
        if (!isScrolledUp) {
            setUnreadCount(0);
        }
    }, []);

    const scrollToBottom = useCallback(() => {
        if (feedRef.current) {
            feedRef.current.scrollTo({
                top: feedRef.current.scrollHeight,
                behavior: 'smooth'
            });
            setShowScrollButton(false);
            setUnreadCount(0);
        }
    }, []);

    useEffect(() => {
        const handleImageLoad = () => {
            if (!showScrollButtonRef.current) {
                scrollToBottom();
            }
        };
        window.addEventListener('imageLoaded', handleImageLoad);
        return () => window.removeEventListener('imageLoaded', handleImageLoad);
    }, [scrollToBottom]);

    const forceScrollRef = useRef(false);

    useEffect(() => {
        if (feedRef.current) {
            if (!showScrollButton || forceScrollRef.current) {
                feedRef.current.scrollTop = feedRef.current.scrollHeight;
                forceScrollRef.current = false;
                setShowScrollButton(false);
            }
        }
    }, [filteredMessages, showScrollButton]);

    const handleTyping = () => {
        if (typingTimeoutRef.current) return;
        
        if (connManagerRef.current && connManagerRef.current.channel) {
            const encKey = getEncKey();
            const encUser = CryptoUtils.encrypt(username, encKey);
            const finalUser = currentRoomRef.current === 'B' ? `ROOM_B|${encUser}` : `ROOM_A|${encUser}`;
            connManagerRef.current.channel?.send({ type: 'broadcast', event: 'typing', payload: { user: finalUser, typing: true } });
            
            typingTimeoutRef.current = setTimeout(() => {
                typingTimeoutRef.current = null;
            }, 1000);
        }
    };

        const startRecording = () => { setIsRecording(true); };
    const stopRecording = () => { setIsRecording(false); };
    const handleFileChange = (e: any) => { if (e.target.files) setSelectedFile(e.target.files[0]); };
    const clearSelectedFile = () => { setSelectedFile(null); };
    const handleStartEdit = (msg: any) => { setInputText(msg.content); };
    const handleDrawFate = async (category: string, skipPin = false) => {
        if (category === 'chaos' && !skipPin && !isChaosUnlocked) {
            setShowChaosPinModal(true);
            return;
        }

        bgmManager.onFateCardDraw();

        const deck = (GAME_DECK as any)[category];
        const isWildcard = Math.random() < deck.wildcardChance;
        const type = isWildcard ? 'wildcard' : (Math.random() < 0.5 ? 'truth' : 'dare');
        const pool = deck[type];
        const content = pool[Math.floor(Math.random() * pool.length)];
        
        const payload = JSON.stringify({
            content: `${category.toUpperCase()} ${type.toUpperCase()}: ${content}`,
            invoker: username
        });

        const encKey = getEncKey();
        const finalTeks = CryptoUtils.encrypt(payload, encKey);
        const encryptedNama = CryptoUtils.encrypt('ORACLE', encKey);
        const finalNama = currentRoomRef.current === 'B' ? `ROOM_B|${encryptedNama}` : `ROOM_A|${encryptedNama}`;

        const optimisticMsg = {
            id: -Date.now(),
            nama: finalNama,
            teks: finalTeks,
            created_at: new Date().toISOString(),
            is_read: true,
        };
        setMessages(prev => [...prev, optimisticMsg]);

        setFateMode(false);
        supabaseClient.from('Pesan').insert([{ nama: finalNama, teks: finalTeks }]).select().then(({ data, error }) => {
            if (error) {
                console.error("Gagal mengirim takdir:", error);
                setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
                showToast("Gagal mengirim takdir ke obrolan", "error");
            } else if (data && data[0]) {
                setMessages(prev => {
                    if (prev.some(m => m.id === data[0].id)) return prev;
                    const filtered = prev.filter(m => m.id !== optimisticMsg.id && !(m.id < 0 && m.teks === data[0].teks));
                    return [...filtered, data[0]];
                });
            }
        });
    };
    const drawRemiCard = () => { return { suit: 'hearts', value: 'A' }; };

    const handleSend = async () => {
        if (isUploadingRef.current) return;
        if (!inputText.trim() && !selectedFile) return;
        
        isUploadingRef.current = true;
        setIsUploading(true);
        try {
            const nama = `${username}|${avatar}|${userColor}`;
            let teks = inputText;

            if (selectedFile && storageManagerRef.current) {
                bgmManager.onImageSend();
                const url = await storageManagerRef.current.uploadImage(selectedFile);
                teks = teks.trim() ? `[IMG]${url}\n${teks}` : `[IMG]${url}`;
                (clearSelectedFile as any)();
                
                if (editingMsg) {
                    const parsed = MessageParser.parse(editingMsg.teks, getEncKey());
                    if (parsed.replyData && !replyingTo) {
                        teks = `[REPLY:${JSON.stringify(parsed.replyData)}]${teks}`;
                    }
                }
            } else if (editingMsg) {
                const parsed = MessageParser.parse(editingMsg.teks, getEncKey());
                if (parsed.type === 'img') {
                    const url = parsed.content.split('\n')[0];
                    teks = teks.trim() ? `[IMG]${url}\n${teks}` : `[IMG]${url}`;
                }
                if (parsed.replyData && !replyingTo) {
                    teks = `[REPLY:${JSON.stringify(parsed.replyData)}]${teks}`;
                }
            }

            if (replyingTo) {
                const context = MessageParser.createReplyContext(replyingTo, getEncKey());
                teks = `[REPLY:${JSON.stringify(context)}]${teks}`;
            }

            if (isViewOnce) teks = `[VO]${teks}`;
            
            if (editingMsg) {
                if (!teks.endsWith("[EDITED]")) {
                    teks = `${teks} [EDITED]`;
                }
                const encKey = getEncKey();
                const finalTeks = CryptoUtils.encrypt(teks, encKey);
                supabaseClient.from('Pesan').update({ teks: finalTeks }).eq('id', editingMsg.id).select().then(({ data, error }) => {
                    if (error) {
                        console.error("Gagal update pesan:", error);
                    } else if (data && data[0]) {
                        setMessages(prev => prev.map(m => m.id === data[0].id ? data[0] : m));
                    }
                });
                setEditingMsg(null);
                showToast("Pesan diperbarui", "success");
            } else {
                const encKey = getEncKey();
                const finalTeks = CryptoUtils.encrypt(teks, encKey);
                const encryptedNama = CryptoUtils.encrypt(nama, encKey);
                const finalNama = currentRoomRef.current === 'B' ? `ROOM_B|${encryptedNama}` : `ROOM_A|${encryptedNama}`;
                forceScrollRef.current = true;

                const optimisticMsg = {
                    id: -Date.now(),
                    nama: finalNama,
                    teks: finalTeks,
                    created_at: new Date().toISOString(),
                    is_read: true,
                };
                setMessages(prev => [...prev, optimisticMsg]);

                supabaseClient.from('Pesan').insert([{ nama: finalNama, teks: finalTeks }]).select().then(({ data, error }) => {
                    if (error) {
                        console.error("Gagal mengirim pesan:", error);
                        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
                        showToast("Gagal mengirim pesan", "error");
                    } else if (data && data[0]) {
                        setMessages(prev => {
                            if (prev.some(m => m.id === data[0].id)) return prev;
                            const filtered = prev.filter(m => m.id !== optimisticMsg.id && !(m.id < 0 && m.teks === data[0].teks));
                            return [...filtered, data[0]];
                        });
                    }
                });
            }

            setInputText('');
            if (textareaRef.current) {
                textareaRef.current.style.height = '48px';
            }
            setIsViewOnce(false);
            setReplyingTo(null);
        } catch (err: any) {
            showToast(`Gagal mengirim: ${err.message}`, "error");
        } finally {
            isUploadingRef.current = false;
            setIsUploading(false);
        }
    };

    const handleSendBoardGame = async (game: string) => {
        let contentStr = '';
        if (game === 'UNO') {
            const card = drawUnoFlipCard('Light');
            contentStr = `BOARDGAME:UNO_FLIP:${card.side}:${card.color}:${card.value}`;
        } else if (game === 'UNO_DARK') {
            const card = drawUnoFlipCard('Dark');
            contentStr = `BOARDGAME:UNO_FLIP:${card.side}:${card.color}:${card.value}`;
        } else if (game === 'REMI') {
            const card = drawRemiCard();
            contentStr = `BOARDGAME:REMI:${card.suit}:${card.value}`;
        }

        const payload = JSON.stringify({
            content: contentStr,
            invoker: username
        });

        const encKey = getEncKey();
        const finalTeks = CryptoUtils.encrypt(payload, encKey);
        const encryptedNama = CryptoUtils.encrypt('ORACLE', encKey);
        const finalNama = currentRoomRef.current === 'B' ? `ROOM_B|${encryptedNama}` : `ROOM_A|${encryptedNama}`;

        const optimisticMsg = {
            id: -Date.now(),
            nama: finalNama,
            teks: finalTeks,
            created_at: new Date().toISOString(),
            is_read: true,
        };
        setMessages(prev => [...prev, optimisticMsg]);

        supabaseClient.from('Pesan').insert([{ nama: finalNama, teks: finalTeks }]).select().then(({ data, error }) => {
            if (error) {
                console.error("Gagal mengirim pesan boardgame:", error);
                setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
            } else if (data && data[0]) {
                setMessages(prev => {
                    if (prev.some(m => m.id === data[0].id)) return prev;
                    const filtered = prev.filter(m => m.id !== optimisticMsg.id && !(m.id < 0 && m.teks === data[0].teks));
                    return [...filtered, data[0]];
                });
            }
        });
        setFateMode(false);
    };

    const handleChaosPinSubmit = () => {
        if (chaosPinInput === '131225') {
            try { sessionStorage.setItem('chaos_unlocked', 'true'); } catch {}
            setIsChaosUnlocked(true);
            setShowChaosPinModal(false);
            setChaosPinInput('');
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            (handleDrawFate as any)('chaos', true); // Automatically draw after unlock
        } else {
            if (navigator.vibrate) navigator.vibrate(200);
            showToast("Akses Ditolak. PIN Salah.", "error");
            setChaosPinInput('');
        }
    };

    const handleViewOnce = useCallback((msg: any) => {
        const parsed = MessageParser.parse(msg.teks, getEncKey());
        setViewingSecret({ ...msg, ...parsed });
        
        // Burn logic
        setTimeout(() => {
            supabaseClient.from('Pesan').delete().eq('id', msg.id).then(() => {
                setMessages(prev => prev.filter(m => m.id !== msg.id));
                setViewingSecret(null);
                
                if (parsed.type === 'img') {
                    const url = parsed.content;
                    const urlParts = url.split('/gambar/');
                    if (urlParts.length > 1) {
                        const filePath = urlParts[1].split('?')[0];
                        supabaseClient.storage.from('gambar').remove([filePath]).catch(console.error);
                    }
                } else if (parsed.type === 'vn') {
                    const url = parsed.content;
                    const urlParts = url.includes('/voice%20note/') 
                        ? url.split('/voice%20note/') 
                        : url.split('/voice_note/');
                    if (urlParts.length > 1) {
                        const filePath = urlParts[1].split('?')[0];
                        supabaseClient.storage.from('voice note').remove([filePath]).catch(console.error);
                    }
                }
            });
        }, 10000); // 10 seconds to view
    }, []);

    const handleDeleteHistory = async () => {
        setShowDeleteConfirmModal(false);
        try {
            // 1. Ambil semua pesan untuk mencari file media
            let selectQuery = supabaseClient.from('Pesan').select('teks');
            if (currentRoom === 'B') {
                selectQuery = selectQuery.like('nama', 'ROOM_B|%');
            } else {
                selectQuery = selectQuery.not('nama', 'like', 'ROOM_B|%');
            }
            const { data: messagesToDelete } = await selectQuery;
            
            if (messagesToDelete && messagesToDelete.length > 0) {
                const buktiFilesToRemove: string[] = [];
                const vnFilesToRemove: string[] = [];
                
                messagesToDelete.forEach((msg: any) => {
                    const parsed = MessageParser.parse(msg.teks, getEncKey());
                    if (parsed.type === 'img') {
                        const url = parsed.content;
                        const urlParts = url.split('/gambar/');
                        if (urlParts.length > 1) {
                            const filePath = urlParts[1].split('?')[0];
                            buktiFilesToRemove.push(filePath);
                        }
                    } else if (parsed.type === 'vn') {
                        const url = parsed.content;
                        const urlParts = url.includes('/voice%20note/') 
                            ? url.split('/voice%20note/') 
                            : url.split('/voice note/');
                        if (urlParts.length > 1) {
                            const filePath = urlParts[1].split('?')[0];
                            vnFilesToRemove.push(filePath);
                        }
                    }
                });

                // 2. Hapus file dari storage bucket masing-masing
                if (buktiFilesToRemove.length > 0) {
                    const { error: storageError } = await supabaseClient.storage.from('gambar').remove(buktiFilesToRemove);
                    if (storageError) console.error("Gagal menghapus file gambar:", storageError);
                }
                if (vnFilesToRemove.length > 0) {
                    const { error: storageError } = await supabaseClient.storage.from('voice note').remove(vnFilesToRemove);
                    if (storageError) console.error("Gagal menghapus file voicenote:", storageError);
                }
            }

            // 3. Hapus semua pesan dari database
            let deleteQuery = supabaseClient.from('Pesan').delete().neq('id', 0);
            if (currentRoom === 'B') {
                deleteQuery = deleteQuery.like('nama', 'ROOM_B|%');
            } else {
                deleteQuery = deleteQuery.not('nama', 'like', 'ROOM_B|%');
            }
            const { error } = await deleteQuery;
            if (error) throw error;
            
            setMessages([]);
            showToast("Riwayat pesan dan media telah dibersihkan.", "success");
            setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
            showToast("Gagal menghapus: " + err.message, "error");
        }
    };

    if (layer === 'AGE') return (
        <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 to-zinc-900 flex flex-col items-center justify-center text-center p-4 animate-fade-in">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col items-center max-w-sm w-full"
            >
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6">
                    <span className="text-2xl">🔞</span>
                </div>
                <h1 className="font-header text-2xl text-gold tracking-[8px] mb-4">VERIFIKASI USIA</h1>
                <p className="font-mystic text-sm text-white/60 mb-8">Anda harus berusia 18 tahun atau lebih untuk memasuki Oracle Chamber.</p>
                <div className="flex flex-col gap-4 w-full">
                    <button onClick={() => { safeStorage.set('oracle_adult', 'true'); setLayer('NAME'); }} className="w-full px-8 py-4 bg-gold text-black font-bold rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.2)] hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] hover:scale-105 active:scale-95 transition-all tracking-widest uppercase">
                        SAYA 18+
                    </button>
                    <button onClick={() => window.location.href = 'https://google.com'} className="w-full px-8 py-4 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-all tracking-widest uppercase border border-white/10">
                        Keluar
                    </button>
                </div>
            </motion.div>
        </div>
    );

    if (layer === 'NAME') return (
        <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 to-zinc-900 flex flex-col items-center justify-center text-center p-6 animate-fade-in">
            <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-header text-3xl text-gold tracking-[10px] mb-8 drop-shadow-lg"
            >
                IDENTITAS
            </motion.h1>
            
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring" }}
                className="relative w-32 h-32 mb-8 rounded-full bg-white/5 border-2 border-gold/30 flex items-center justify-center overflow-hidden group shadow-[0_0_30px_rgba(212,175,55,0.15)] backdrop-blur-md"
            >
                {(avatar.startsWith('http') || avatar.startsWith('data:image')) ? (
                    <img src={avatar} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                    <span className="text-6xl">{avatar || '👤'}</span>
                )}
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-sm text-white font-bold mb-1">Ubah Foto</span>
                    <span className="text-[10px] text-white/70">Tap untuk upload</span>
                </div>
                <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && storageManagerRef.current) {
                            setIsUploading(true);
                            try {
                                const url = await storageManagerRef.current.uploadImage(file);
                                setAvatar(url);
                            } catch (err: any) {
                                showToast("Gagal upload avatar", "error");
                            } finally {
                                setIsUploading(false);
                            }
                        }
                    }} 
                />
            </motion.div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="w-full max-w-xs flex flex-col gap-4 mb-8"
            >
                <div className="relative">
                    <input 
                        type="text" 
                        value={username} 
                        onChange={e => setUsername(e.target.value)} 
                        placeholder="Nama Panggilan" 
                        className="w-full bg-white/5 text-white text-center p-4 rounded-2xl border border-white/10 focus:border-gold/50 outline-none transition-all shadow-inner placeholder:text-white/30 font-medium backdrop-blur-sm focus:bg-white/10" 
                    />
                </div>
                
                <div className="flex gap-4 items-center justify-center bg-white/5 p-4 rounded-2xl border border-white/10 shadow-md backdrop-blur-sm">
                    <span className="text-xs text-white/50 uppercase tracking-widest font-bold">Warna Tema</span>
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 shadow-lg cursor-pointer hover:scale-110 transition-transform">
                        <input type="color" value={userColor} onChange={e => setUserColor(e.target.value)} className="absolute -inset-4 w-20 h-20 cursor-pointer" />
                    </div>
                </div>

                <div className="flex gap-2 text-2xl justify-center flex-wrap bg-white/5 p-4 rounded-2xl border border-white/10 shadow-md backdrop-blur-sm">
                    {['🔮', '👻', '💀', '👽', '🦊', '🦉', '🦋', '🕸️'].map(emoji => (
                        <button key={emoji} onClick={() => setAvatar(emoji)} className="hover:scale-125 transition-transform p-1">{emoji}</button>
                    ))}
                </div>
            </motion.div>

            <motion.button 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                onClick={() => { 
                    if (!username.trim()) {
                        showToast("Nama tidak boleh kosong", "error");
                        return;
                    }
                    safeStorage.set('oracle_user', username); 
                    safeStorage.set('oracle_avatar', avatar); 
                    safeStorage.set('oracle_color', userColor); 
                    setLayer('SECURITY'); 
                }} 
                disabled={isUploading || !username.trim()}
                className={`w-full max-w-xs px-10 py-4 bg-gradient-to-r from-gold/80 to-gold text-black font-bold rounded-2xl shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] hover:scale-105 active:scale-95 transition-all tracking-widest uppercase ${isUploading || !username.trim() ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
            >
                {isUploading ? 'Menyimpan...' : 'Lanjutkan'}
            </motion.button>
        </div>
    );

    if (layer === 'SECURITY') return (
        <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 to-zinc-900 flex flex-col items-center justify-center text-center p-4 animate-fade-in">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col items-center"
            >
                <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mb-6">
                    <span className="text-2xl">🔒</span>
                </div>
                <h1 className="font-header text-2xl text-gold tracking-[8px] mb-6">AKSES</h1>
                <input 
                    type="password" 
                    value={pinInput} 
                    onChange={e => setPinInput(e.target.value)} 
                    className="bg-black/50 text-center p-4 rounded-xl mb-6 w-64 tracking-[12px] text-xl text-white outline-none focus:ring-2 ring-gold/50 border border-white/10 transition-all" 
                    placeholder="••••"
                />
                <button onClick={() => {
                    if (pinInput === '179' || pinInput === '010304') {
                        safeStorage.set('oracle_unlocked', 'true');
                        setLayer('LOBBY');
                    } else showToast('PIN salah.', "error");
                }} className="w-full px-8 py-4 bg-gold text-black font-bold rounded-xl shadow-[0_0_15px_rgba(212,175,55,0.2)] hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] hover:scale-105 active:scale-95 transition-all tracking-widest uppercase">
                    Buka Gerbang
                </button>
            </motion.div>
        </div>
    );

    if (layer === 'LOBBY') return (
        <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black overflow-y-auto flex items-center justify-center p-4 md:p-8">
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-red-900/10 blur-[100px] animate-pulse" />
                <div className="absolute bottom-1/4 -right-20 w-80 h-80 rounded-full bg-purple-900/10 blur-[100px] animate-pulse" style={{ animationDelay: '1.5s' }} />
            </div>

            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-md bg-white/[0.02] border border-white/10 rounded-[32px] backdrop-blur-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-hidden p-6 md:p-8 flex flex-col justify-between gap-6"
            >
                <div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gold/15 rounded-xl flex items-center justify-center border border-gold/30 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                            <span className="text-xl">🏛️</span>
                        </div>
                        <div>
                            <h1 className="font-header text-lg text-gold tracking-widest uppercase font-bold">ORACLE GATE</h1>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Dimension Bridge V2.1</p>
                        </div>
                    </div>

                    {/* Interactive Identity Card */}
                    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 mb-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-30 group-hover:opacity-100 transition-opacity">
                            <span className="text-[9px] text-gold uppercase tracking-wider">Active User</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full border-2 flex items-center justify-center text-3xl bg-zinc-900/80 shadow-md relative group-hover:scale-105 transition-transform overflow-hidden" style={{ borderColor: userColor }}>
                                {(avatar.startsWith('http') || avatar.startsWith('data:image')) ? (
                                    <img src={avatar} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <span>{avatar}</span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="text" 
                                        value={username} 
                                        onChange={e => {
                                            setUsername(e.target.value);
                                            safeStorage.set('oracle_user', e.target.value);
                                        }}
                                        className="bg-transparent text-white font-bold text-base outline-none border-b border-transparent focus:border-gold/30 w-full"
                                        placeholder="Nama Anda"
                                    />
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: userColor }} />
                                    <span className="text-xs text-zinc-400 font-mono tracking-wide">Sync Connected</span>
                                </div>
                            </div>
                        </div>
                        {/* Color Theme Selector Inline Upgrade */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-[10px] text-zinc-400">
                            <span className="uppercase tracking-widest font-mono">Customize Aura:</span>
                            <div className="flex items-center gap-2">
                                <div className="relative w-5 h-5 rounded-full overflow-hidden border border-white/20">
                                    <input type="color" value={userColor} onChange={e => {
                                        setUserColor(e.target.value);
                                        safeStorage.set('oracle_color', e.target.value);
                                    }} className="absolute -inset-2 cursor-pointer w-10 h-10" />
                                </div>
                                <button onClick={() => setLayer('NAME')} className="text-[9px] uppercase tracking-wider text-gold font-bold hover:underline">
                                    Ganti Avatar
                                </button>
                            </div>
                        </div>
                    </div>

                    <p className="text-zinc-400 text-xs mb-6 leading-relaxed">Pilihlah portal dimensi di bawah ini untuk memulai obrolan terenkripsi Anda.</p>

                    {/* Interactive Dimensi Buttons */}
                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={() => {
                                setIsTransitioningTo('A');
                                setTimeout(() => {
                                    setCurrentRoom('A');
                                    setLayer('MAIN');
                                    setIsTransitioningTo(null);
                                }, 1000);
                            }} 
                            className="w-full p-5 bg-gradient-to-r from-white/[0.02] to-white/[0.04] border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 hover:border-red-500/50 hover:shadow-[0_0_25px_rgba(239,68,68,0.15)] group hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all tracking-widest uppercase flex items-center justify-between text-left"
                        >
                            <div>
                                <span className="block font-header text-sm text-white group-hover:text-red-400 transition-colors">DIMENSI SISI A</span>
                                <span className="text-[9px] text-zinc-400 tracking-wider lowercase block mt-0.5 font-sans font-normal">lumina / classic secure chat layout</span>
                            </div>
                            <span className="text-red-500 text-xl group-hover:translate-x-1 transition-transform">→</span>
                        </button>
                        
                        <button 
                            onClick={() => {
                                setIsTransitioningTo('B');
                                setTimeout(() => {
                                    setCurrentRoom('B');
                                    setLayer('MAIN');
                                    setIsTransitioningTo(null);
                                }, 1000);
                            }} 
                            className="w-full p-5 bg-gradient-to-r from-white/[0.02] to-white/[0.04] border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 hover:border-purple-500/50 hover:shadow-[0_0_25px_rgba(168,85,247,0.15)] group hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all tracking-widest uppercase flex items-center justify-between text-left"
                        >
                            <div>
                                <span className="block font-header text-sm text-white group-hover:text-purple-400 transition-colors">DIMENSI SISI B</span>
                                <span className="text-[9px] text-zinc-400 tracking-wider lowercase block mt-0.5 font-sans font-normal">nox / immersive gaming & chaos chaos</span>
                            </div>
                            <span className="text-purple-500 text-xl group-hover:translate-x-1 transition-transform">→</span>
                        </button>
                    </div>
                </div>

                <div className="mt-8 pt-4 border-t border-white/5 flex flex-col items-center gap-3">
                    <div className="text-[9px] text-zinc-600 font-mono text-center uppercase">
                        ORACLE SECURITY PROTOCOL • HIGH ENCRYPTED END-TO-END
                    </div>
                    <button 
                        onClick={() => setShowPatchNotes(true)}
                        className="text-[10px] text-emerald-400/80 hover:text-emerald-300 transition-colors font-mono tracking-widest uppercase flex items-center gap-1.5 hover:underline"
                    >
                        <span>📢</span> Lihat Log Update V2.1
                    </button>
                </div>
            </motion.div>

            {/* Floating Patch Notes Modal Overlay */}
            <AnimatePresence>
                {showPatchNotes && (
                    <div 
                        className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto"
                        onClick={() => {
                            setShowPatchNotes(false);
                            safeStorage.set('patch_v17_11_seen', 'true');
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ duration: 0.3 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative z-10 w-full max-w-lg bg-zinc-900 border border-emerald-500/30 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(16,185,129,0.2)] overflow-hidden flex flex-col my-8"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/20 via-emerald-500 to-emerald-500/20" />
                            
                            {/* Close Button "X" */}
                            <button 
                                onClick={() => {
                                    setShowPatchNotes(false);
                                    safeStorage.set('patch_v17_11_seen', 'true');
                                }}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors text-sm"
                                title="Tutup"
                            >
                                ✕
                            </button>

                            <div className="mb-6 pr-8">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <h3 className="font-header text-sm text-emerald-400 tracking-widest uppercase font-bold">MAJOR SYSTEM UPDATE (ORACLE V2)</h3>
                                </div>
                                <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Version 17.11 - Active Patches</p>
                            </div>

                            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1 select-none custom-scrollbar">
                                {/* Card 1: Animasi Dynamic Spesial */}
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                                    <div className="flex gap-3">
                                        <span className="text-xl">✨</span>
                                        <div>
                                            <h4 className="text-xs uppercase tracking-wider text-gold font-bold font-header">New Kinetic Card Animations</h4>
                                            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                                                Sistem penarikan kartu spesial (<code className="text-red-400 bg-red-400/10 px-1 rounded">+1</code>, <code className="text-orange-400 bg-orange-400/10 px-1 rounded">+5</code>, <code className="text-purple-400 bg-purple-400/10 px-1 rounded">Flip</code>, <code className="text-indigo-400 bg-indigo-400/10 px-1 rounded">Skip</code>, <code className="text-emerald-400 bg-emerald-400/10 px-1 rounded">Reverse</code>, & <code className="text-pink-400 bg-pink-400/10 px-1 rounded">Wildcard</code>) kini dilengkapi dengan efek animasi transisi 3D, shimmering beam, ledakan partikel fuchsia-gold, dan backglow berpendar yang dinamis!
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: Safe Flow & Anti-Lag Engine */}
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                                    <div className="flex gap-3">
                                        <span className="text-xl">⚡</span>
                                        <div>
                                            <h4 className="text-xs uppercase tracking-wider text-gold font-bold font-header">Non-Blocking Particle Engine</h4>
                                            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                                                Animasi partikel dan vibrator dikonfigurasi secara asinkron. Animasi tidak akan memblokir aktivitas ketik ataupun merusak jalannya permainan kartu Anda—tetap mulus dan responsif di perangkat mobile maupun desktop.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 3: Backend & Sync Optimizations */}
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                                    <div className="flex gap-3">
                                        <span className="text-xl">⚙️</span>
                                        <div>
                                            <h4 className="text-xs uppercase tracking-wider text-gold font-bold font-header">Supabase Connection Manager v2</h4>
                                            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                                                Penanganan pengiriman takdir (Oracle/Draw) kini didelegasikan menggunakan antrian asinkron non-blocking yang diproteksi interseptor error. Menghindari crash atau delay ketika jaringan tidak stabil.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 4: Modernized Minimalist Frontend Sizing */}
                                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 transition-colors">
                                    <div className="flex gap-3">
                                        <span className="text-xl">🎨</span>
                                        <div>
                                            <h4 className="text-xs uppercase tracking-wider text-gold font-bold font-header">Aesthetics Re-fresh & Typography</h4>
                                            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                                                Memperbaiki visual kaku di panel input. Teks diatur menggunakan Inter dan display Space Grotesk halus dengan tracking-widest. Spacing dinamis memberikan kesan elegan, misterius, dan modern.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <span className="text-[10px] text-zinc-500">SYSTEM OPTIMIZED • STABLE</span>
                                <button
                                    onClick={() => {
                                        setShowPatchNotes(false);
                                        safeStorage.set('patch_v17_11_seen', 'true');
                                    }}
                                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] uppercase tracking-widest font-bold rounded-xl transition-colors whitespace-nowrap"
                                >
                                    Mengerti & Tutup
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Portal Transition Overlay */}
            <AnimatePresence>
                {isTransitioningTo && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 overflow-hidden"
                    >
                        {/* 3D Spinning Oracle Dimension Vortex */}
                        <motion.div
                            animate={{ 
                                rotate: 360,
                                scale: [1, 2, 12],
                            }}
                            transition={{ duration: 1.0, ease: "easeInOut" }}
                            className={`w-72 h-72 rounded-full blur-[80px] opacity-70 ${isTransitioningTo === 'A' ? 'bg-gradient-to-r from-red-600 via-amber-500 to-indigo-700' : 'bg-gradient-to-r from-purple-600 via-fuchsia-500 to-sky-700'}`}
                        />
                        
                        {/* Portal Ring Overlay */}
                        <motion.div
                            initial={{ scale: 0.3, rotate: 0, opacity: 0 }}
                            animate={{ scale: [0.3, 2, 5], rotate: [0, 180, 360], opacity: [0, 0.8, 0] }}
                            transition={{ duration: 1.0, ease: "easeOut" }}
                            className="absolute w-96 h-96 border-4 border-dashed rounded-full pointer-events-none"
                            style={{ borderColor: isTransitioningTo === 'A' ? '#EF4444' : '#A855F7' }}
                        />

                        {/* Mystical Text */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: [0.9, 1.05, 1.2], opacity: [0, 1, 0] }}
                            transition={{ duration: 0.9, ease: "easeInOut" }}
                            className="absolute text-center px-4"
                        >
                            <h2 className="font-header text-xl md:text-3xl tracking-[10px] text-white font-bold uppercase mb-3 text-gold">
                                {isTransitioningTo === 'A' ? 'MEMASUKI DIMENSI LUMINA' : 'MEMASUKI DIMENSI NOX'}
                            </h2>
                            <p className="font-mono text-xs tracking-widest text-white/50 uppercase opacity-80">Menggeser Koordinat Realitas...</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    if (layer === 'MAIN') {
        if (currentRoom === 'A') {
            return <SideA onBack={() => setLayer('LOBBY')} />;
        } else {
            return <SideB onBack={() => setLayer('LOBBY')} />;
        }
    }

    return null;
}

export default App;
