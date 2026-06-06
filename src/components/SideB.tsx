import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Check, CheckCheck, Copy, Settings, X, User, Volume2, Shield, Eye, Trash2, LogOut, Sliders } from 'lucide-react';
import { UNO_CARD_SVG } from '../constants/boardGameDeck';

import { ConnectionManager } from '../utils/ConnectionManager';
import { supabaseClient } from '../../supabase';
import { ORACLE_CONFIG } from '../config';
import { GAME_DECK } from '../constants/deck';
import { drawUnoFlipCard } from '../constants/boardGames';
import { MessageParser } from '../utils/messageParser';
import { AudioManager } from '../utils/audioManager';
import { bgmManager, AVAILABLE_BGMS } from '../utils/bgmManager';
import { StorageManager } from '../utils/StorageManager';
import { CryptoUtils } from '../utils/crypto';
import { SupabaseMultiplayerWrapper } from './SupabaseMultiplayerWrapper';
import { Lobby } from './Lobby';
import { LoadingScreen } from './LoadingScreen';
import { Leaderboard } from './Leaderboard';
import { CosmicOracleModal } from './CosmicOracleModal';

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

export default function SideB({ onBack }: { onBack: () => void }) {
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const [gameId, setGameId] = useState(() => {
        try { return localStorage.getItem('sideb_game_id') || ''; } catch { return ''; }
    });
    const [actualMatchId, setActualMatchId] = useState(() => {
        try { return localStorage.getItem('sideb_actual_match_id') || ''; } catch { return ''; }
    });
    const [numPlayers, setNumPlayers] = useState(4);
    const [showUnoBoard, setShowUnoBoard] = useState(() => {
        try { return localStorage.getItem('sideb_show_uno_board') === 'true'; } catch { return false; }
    });
    const [showTebakKataBoard, setShowTebakKataBoard] = useState(() => {
        try { return localStorage.getItem('sideb_show_tebak_kata_board') === 'true'; } catch { return false; }
    });
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [bgioPlayerID, setBgioPlayerID] = useState<string>(() => {
        try { return localStorage.getItem('sideb_bgio_player_id') || ''; } catch { return ''; }
    });
    const [bgioCredentials, setBgioCredentials] = useState<string>('');
    const [gameType, setGameType] = useState<'UNO' | 'TEBAKKATA'>(() => {
        try { return (localStorage.getItem('sideb_game_type') as 'UNO' | 'TEBAKKATA') || 'UNO'; } catch { return 'UNO'; }
    });

    const [isConnectingGame, setIsConnectingGame] = useState(false);

    useEffect(() => {
        try {
            if (gameId) localStorage.setItem('sideb_game_id', gameId);
            else localStorage.removeItem('sideb_game_id');
        } catch {}
    }, [gameId]);

    useEffect(() => {
        try {
            if (actualMatchId) localStorage.setItem('sideb_actual_match_id', actualMatchId);
            else localStorage.removeItem('sideb_actual_match_id');
        } catch {}
    }, [actualMatchId]);

    useEffect(() => {
        try {
            localStorage.setItem('sideb_show_uno_board', String(showUnoBoard));
        } catch {}
    }, [showUnoBoard]);

    useEffect(() => {
        try {
            localStorage.setItem('sideb_show_tebak_kata_board', String(showTebakKataBoard));
        } catch {}
    }, [showTebakKataBoard]);

    useEffect(() => {
        try {
            localStorage.setItem('sideb_game_type', gameType);
        } catch {}
    }, [gameType]);

    useEffect(() => {
        try {
            if (bgioPlayerID) localStorage.setItem('sideb_bgio_player_id', bgioPlayerID);
            else localStorage.removeItem('sideb_bgio_player_id');
        } catch {}
    }, [bgioPlayerID]);

    useEffect(() => {
        const handleCancelGame = () => {
            setIsConnectingGame(false);
            setShowUnoBoard(false);
            setShowTebakKataBoard(false);
            setGameId('');
            setActualMatchId('');
            setBgioPlayerID('');
        };
        window.addEventListener('cancelGameConnection', handleCancelGame);
        return () => window.removeEventListener('cancelGameConnection', handleCancelGame);
    }, []);

    const createGame = (type: 'UNO' | 'TEBAKKATA' = 'TEBAKKATA') => {
        if (!gameId) {
            showToast("Masukkan Game ID terlebih dahulu!", "error");
            return;
        }
        setIsConnectingGame(true);
        setGameType(type);
        setActualMatchId(gameId);
        
        // Use user's selected name or random id as player ID for peer-to-peer logic
        // Because of Supabase, we can use a unique player ID for each connect
        setBgioPlayerID(localStorage.getItem('oracle_user_id') || Math.random().toString(36).substring(7));
        
        setTimeout(() => {
            setIsConnectingGame(false);
            if (type === 'UNO') {
                setShowUnoBoard(true);
            } else {
                setShowTebakKataBoard(true);
            }
        }, 500);
        setShowMenu(false);
    };

    const joinGame = () => {
        if (!gameId) {
            showToast("Masukkan Game ID terlebih dahulu!", "error");
            return;
        }
        setIsConnectingGame(true);
        // Ask Supabase which side it is... but for simplicity, we assume the user knows or it defaults to UNO. We can support choosing later or auto-detect. 
        // For now, if someone is joining an existing game via lobby or manually, we might just default to TEBAKKATA or parse it if we stored it in game_lobbies.
        const type = gameId.toUpperCase().includes('UNO') ? 'UNO' : 'TEBAKKATA';
        setGameType(type);
        setActualMatchId(gameId.replace('UNO-', '').replace('TEBAK-', ''));
        
        setBgioPlayerID(localStorage.getItem('oracle_user_id') || Math.random().toString(36).substring(7));

        setTimeout(() => {
            setIsConnectingGame(false);
            if (type === 'UNO') {
                setShowUnoBoard(true);
            } else {
                setShowTebakKataBoard(true);
            }
        }, 500);
        setShowMenu(false);
    };

    const [layer, setLayer] = useState('MAIN');

    const currentRoom = 'B' as 'A'|'B';
    const currentRoomRef = useRef<'A'|'B'>('B');

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
    const [showOracleModal, setShowOracleModal] = useState(false);
    const [showPatchNotes, setShowPatchNotes] = useState(() => {
        try { return safeStorage.get('patch_v17_11_seen') !== 'true'; } catch { return false; }
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
                }, (presences) => {
                    setOnlineUsers(presences);
                });
                connManagerRef.current.trackUser(username, 'B');
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
        const filteredByRoom = messages.filter(m => {
            const isRoomB = m.nama.startsWith('ROOM_B|');
            return currentRoomRef.current === 'B' ? isRoomB : !isRoomB;
        });
        return filteredByRoom.map(m => {
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
                supabaseClient.from('Pesan').update({ is_read: true }).in('id', idsToUpdate).then(({ error }) => {});
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

        const handleSendOracleProphecy = useCallback((prophecyText: string) => {
        bgmManager.onFateCardDraw();

        const payload = JSON.stringify({
            content: prophecyText,
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
                console.error("Gagal mengirim ramalan:", error);
                setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
                showToast("Gagal mengirim ramalan ke obrolan", "error");
            } else if (data && data[0]) {
                setMessages(prev => {
                    if (prev.some(m => m.id === data[0].id)) return prev;
                    const filtered = prev.filter(m => m.id !== optimisticMsg.id && !(m.id < 0 && m.teks === data[0].teks));
                    return [...filtered, data[0]];
                });
            }
        });
    }, [username, getEncKey, showToast]);

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

                        // Trigger Oracle AI auto-reply if keyword matched
                        const lowerTeks = teks.toLowerCase();
                        const isOracleTrigger = lowerTeks.includes('@oracle') || lowerTeks.includes('/oracle') || lowerTeks.trim().startsWith('oracle ');
                        if (isOracleTrigger) {
                            let clnQuestion = teks.replace(/@oracle/gi, '').replace(/\/oracle/gi, '').trim();
                            if (clnQuestion.toLowerCase().startsWith('oracle')) {
                                clnQuestion = clnQuestion.substring(6).trim();
                            }
                            const targetRoom = currentRoomRef.current || 'B';
                            setTimeout(() => {
                                fetch('/api/oracle-tarot', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        username,
                                        question: clnQuestion || "Sapaan kosmik",
                                        ritual: 'chat',
                                        room: targetRoom
                                    })
                                }).then(r => r.json()).then(resData => {
                                    if (resData && resData.prophecy) {
                                        handleSendOracleProphecy(resData.prophecy);
                                    }
                                }).catch(err => {
                                    console.error("Oracle auto-reply failed:", err);
                                });
                            }, 1200);
                        }
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
        }
        
        try {
            const nama = `${username}|${avatar}|${userColor}`;
            const encKey = getEncKey();
            const finalTeks = CryptoUtils.encrypt(contentStr, encKey);
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
                    console.error("Gagal mengirim boardgame:", error);
                    setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
                } else if (data && data[0]) {
                    setMessages(prev => {
                        if (prev.some(m => m.id === data[0].id)) return prev;
                        const filtered = prev.filter(m => m.id !== optimisticMsg.id && !(m.id < 0 && m.teks === data[0].teks));
                        return [...filtered, data[0]];
                    });
                }
            });
        } catch (err: any) {
            showToast(`Gagal mengirim: ${err.message}`, "error");
        }
    };

    const isRecordingRef = useRef(false);
    const isStartingRef = useRef(false);

    const startRecording = async (e?: React.SyntheticEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (isRecordingRef.current || isStartingRef.current) return;
        
        isStartingRef.current = true;
        try {
            const started = await audioManagerRef.current.startRecording();
            if (started) {
                isRecordingRef.current = true;
                setIsRecording(true);
                bgmManager.onVoiceNoteStart();
            }
        } catch (e: any) {
            showToast("Gagal akses mic", "error");
        } finally {
            isStartingRef.current = false;
        }
    };

    const stopRecording = async (e?: React.SyntheticEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!isRecordingRef.current) return;

        isRecordingRef.current = false;
        setIsRecording(false);
        
        const result = await audioManagerRef.current.stopRecording();
        bgmManager.onVoiceNoteStop();
        
        if (result && result.blob && storageManagerRef.current) {
            const { blob, ext } = result;
            setIsUploading(true);
            try {
                const publicUrl = await storageManagerRef.current.uploadVoiceNote(blob, ext);
                const nama = `${username}|${avatar}|${userColor}`;
                const encKey = getEncKey();
                
                let teks = `[VN]${publicUrl}`;
                if (replyingTo) {
                    const context = MessageParser.createReplyContext(replyingTo, getEncKey());
                    teks = `[REPLY:${JSON.stringify(context)}]${teks}`;
                }
                if (isViewOnce) teks = `[VO]${teks}`;

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
                        console.error("Gagal mengirim VN:", error);
                        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
                    } else if (data && data[0]) {
                        setMessages(prev => {
                            if (prev.some(m => m.id === data[0].id)) return prev;
                            const filtered = prev.filter(m => m.id !== optimisticMsg.id && !(m.id < 0 && m.teks === data[0].teks));
                            return [...filtered, data[0]];
                        });
                    }
                });
                setReplyingTo(null);
                setIsViewOnce(false);
            } catch (e: any) { 
                console.error("Upload VN Error:", e);
                showToast(`Gagal kirim VN: ${e.message || 'Unknown error'}`, "error"); 
            }
            finally { setIsUploading(false); }
        }
    };

    const clearSelectedFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        } else {
            (clearSelectedFile as any)();
        }
    };

    const handleStartEdit = useCallback((msg: any) => {
        const parsed = MessageParser.parse(msg.teks, getEncKey());
        if (parsed.content.startsWith('🔒')) {
            showToast("Tidak dapat mengedit pesan yang gagal didekripsi.", "error");
            return;
        }
        // If it's an image, we only edit the caption part
        let editContent = parsed.content;
        if (parsed.type === 'img') {
            const parts = parsed.content.split('\n');
            editContent = parts.slice(1).join('\n');
        }
        
        setInputText(editContent);
        setEditingMsg(msg);
        setIsViewOnce(parsed.isVO);
        setReplyingTo(null); // Cancel reply if editing
        
        // Adjust textarea height
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.style.height = '48px';
                textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
            }
        }, 0);
    }, []);

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

    const handleDrawBoardGame = async (game: 'UNO' | 'UNO_DARK') => {
        bgmManager.onFateCardDraw();
        
        let contentStr = '';
        if (game === 'UNO') {
            const card = drawUnoFlipCard('Light');
            contentStr = `BOARDGAME:UNO_FLIP:${card.side}:${card.color}:${card.value}`;
        } else if (game === 'UNO_DARK') {
            const card = drawUnoFlipCard('Dark');
            contentStr = `BOARDGAME:UNO_FLIP:${card.side}:${card.color}:${card.value}`;
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

        setFateMode(false);
        supabaseClient.from('Pesan').insert([{ nama: finalNama, teks: finalTeks }]).select().then(({ data, error }) => {
            if (error) {
                console.error("Gagal menggambar kartu:", error);
                setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
                showToast("Gagal menggambar kartu ke obrolan", "error");
            } else if (data && data[0]) {
                setMessages(prev => {
                    if (prev.some(m => m.id === data[0].id)) return prev;
                    const filtered = prev.filter(m => m.id !== optimisticMsg.id && !(m.id < 0 && m.teks === data[0].teks));
                    return [...filtered, data[0]];
                });
            }
        });
    };

    const handleChaosPinSubmit = () => {
        if (chaosPinInput === '131225') {
            try { sessionStorage.setItem('chaos_unlocked', 'true'); } catch {}
            setIsChaosUnlocked(true);
            setShowChaosPinModal(false);
            setChaosPinInput('');
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            handleDrawFate('chaos', true); // Automatically draw after unlock
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
            if (currentRoomRef.current === 'B') {
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
            if (currentRoomRef.current === 'B') {
                deleteQuery = deleteQuery.like('nama', 'ROOM_B|%');
            } else {
                deleteQuery = deleteQuery.not('nama', 'like', 'ROOM_B|%');
            }
            await deleteQuery;
            setMessages([]);
            showToast("Riwayat pesan dan media telah dibersihkan.", "success");
            setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
            showToast("Gagal menghapus: " + err.message, "error");
        }
    };

        return (
        <motion.div 
            animate={oracleEffect ? { x: [-5, 5, -5, 5, 0], y: [-2, 2, -2, 2, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="h-[100dvh] w-full flex flex-col font-sans text-sm text-white/90 overflow-hidden overflow-x-hidden supports-[height:100dvh]:h-[100dvh]"
        >
            <header className="flex items-center justify-between p-3 border-b border-white/10 bg-black/60 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] z-50 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-lg transition-colors">
                        🚪
                    </button>
                    <div>
                        <h1 className="font-bold text-base flex items-center gap-2">
                            Oracle Chamber
                            <span className="text-[9px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-sm uppercase tracking-wider border border-gold/30">
                                Side {currentRoom}
                            </span>
                        </h1>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${connStatus === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <p className="text-[10px] text-white/40 uppercase tracking-widest">{connStatus}</p>
                            </div>
                            {onlineUsers.filter(u => u.room === 'B').length > 0 && (
                                <div className="flex items-center gap-1 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 text-[10px] text-purple-300 font-mono">
                                    <span className="w-1 h-1 rounded-full bg-purple-400 animate-ping" />
                                    <span>{onlineUsers.filter(u => u.room === 'B').length} SISI B ACTIVE</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <button 
                    onClick={() => setShowMenu(!showMenu)} 
                    className="p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-gold hover:bg-gold/10 hover:border-gold/30 transition-all duration-300 relative group flex items-center justify-center shadow-lg active:scale-95"
                    title="Pengaturan"
                >
                    <Settings className="w-4.5 h-4.5 transition-transform duration-500 group-hover:rotate-45" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-gold opacity-0 group-hover:opacity-100 transition-opacity"></span>
                </button>
            </header>

            <main ref={feedRef as any} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {filterType !== 'all' && (
                    <div className="sticky top-0 z-30 bg-black/80 backdrop-blur p-2 mb-4 rounded-lg border border-gold/20 flex justify-between items-center animate-fade-in">
                        <span className="text-xs text-gold uppercase tracking-widest">
                            Filter: {filterType === 'unread' ? 'Belum Dibaca' : `Sender: ${filterSender}`}
                        </span>
                        <button onClick={() => { setFilterType('all'); setFilterSender(''); }} className="text-xs text-white/50 hover:text-white">CLEAR</button>
                    </div>
                )}
                {filteredMessages.map((msg, index) => {
                    const msgDate = new Date(msg.created_at);
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    
                    let dateLabel = msgDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                    if (msgDate.toDateString() === today.toDateString()) {
                        dateLabel = "Hari Ini";
                    } else if (msgDate.toDateString() === yesterday.toDateString()) {
                        dateLabel = "Kemarin";
                    }

                    let showDate = false;
                    if (index === 0) {
                        showDate = true;
                    } else {
                        const prevMsgDate = new Date(filteredMessages[index - 1].created_at);
                        if (msgDate.toDateString() !== prevMsgDate.toDateString()) {
                            showDate = true;
                        }
                    }

                    return (
                        <div key={msg.id} className="space-y-2">
                            {showDate && (
                                <div className="flex justify-center my-4">
                                    <div className="bg-black/40 backdrop-blur-md border border-white/10 text-white/60 text-[10px] uppercase tracking-widest px-3 py-1 rounded-full">
                                        {dateLabel}
                                    </div>
                                </div>
                            )}
                            <Bubble 
                                msg={msg} 
                                isMe={msg.nama.split('|')[0] === username} 
                                onReply={setReplyingTo} 
                                onEdit={handleStartEdit}
                                onViewOnce={handleViewOnce}
                                isPlayingAudio={currentAudioId === msg.id} 
                                onPlayAudio={setCurrentAudioId}
                                onVisible={handleMessageVisible}
                                encryptionKey={encryptionKey}
                                onImageClick={setSelectedImage}
                            />
                        </div>
                    );
                })}
                {filteredMessages.length === 0 && (
                    <div className="text-center py-10 opacity-30 italic font-mystic">
                        Tidak ada pesan yang ditemukan dalam takdir ini...
                    </div>
                )}
            </main>

            <AnimatePresence>
                {toast && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border backdrop-blur-2xl flex items-center gap-3 ${
                            toast.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-200' : 
                            toast.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-200' : 
                            'bg-gold/20 border-gold/50 text-gold'
                        }`}
                    >
                        {toast.type === 'error' && <span className="text-lg">⚠️</span>}
                        {toast.type === 'success' && <span className="text-lg">✅</span>}
                        {toast.type === 'info' && <span className="text-lg">ℹ️</span>}
                        <span className="text-sm font-medium tracking-wide">{toast.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <footer className="p-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-black/60 border-t border-white/10 backdrop-blur-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-40 shrink-0">
                {replyingTo && (
                    <div 
                        className="bg-white/5 p-2 rounded-t-xl flex justify-between items-center mb-2 border-l-4 border-gold cursor-pointer hover:bg-white/10 transition-colors"
                        onClick={() => {
                            const el = document.getElementById(`msg-${replyingTo.id}`);
                            if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                el.classList.add('bg-white/20', 'rounded-lg', 'transition-all', 'duration-500');
                                setTimeout(() => {
                                    el.classList.remove('bg-white/20', 'rounded-lg');
                                }, 1500);
                            }
                        }}
                    >
                        <div className="text-xs italic break-words whitespace-pre-wrap line-clamp-2 overflow-hidden opacity-70">
                            Replying to <span className="font-bold text-gold">{replyingTo.nama.split('|')[0]}</span>: {MessageParser.getPreview(replyingTo.teks, encryptionKey)}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setReplyingTo(null); }} className="text-lg opacity-50 hover:opacity-100 ml-2 shrink-0">×</button>
                    </div>
                )}
                {editingMsg && (
                    <div className="bg-white/5 p-2 rounded-t-xl flex justify-between items-center mb-2 border-l-4 border-blue-400">
                        <div className="text-xs italic truncate opacity-70">
                            Editing message...
                        </div>
                        <button onClick={() => { 
                            setEditingMsg(null); 
                            setInputText(''); 
                            if (textareaRef.current) textareaRef.current.style.height = '48px';
                        }} className="text-lg opacity-50">×</button>
                    </div>
                )}
                {selectedFile && (
                    <div className="bg-white/5 p-2 rounded-t-xl flex justify-between items-center mb-2 border-l-4 border-blue-500">
                        <div className="text-xs italic truncate opacity-70">
                            📎 {selectedFile.name}
                        </div>
                        <button onClick={clearSelectedFile} className="text-lg opacity-50">×</button>
                    </div>
                )}
                {typingUsers.size > 0 && (
                    <div className="px-4 py-1 text-[10px] text-gold/70 italic flex items-center gap-1">
                        {Array.from(typingUsers).join(', ')} is typing
                        <span className="flex gap-0.5 ml-1">
                            <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-1 h-1 bg-gold/70 rounded-full" />
                            <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1 h-1 bg-gold/70 rounded-full" />
                            <motion.span animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1 h-1 bg-gold/70 rounded-full" />
                        </span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setShowOracleModal(true)} 
                        className="w-12 h-12 rounded-full flex items-center justify-center bg-violet-600/25 border border-violet-500/20 hover:bg-violet-600/40 hover:scale-105 active:scale-95 transition-all outline-none"
                        title="Ritual Oracle AI"
                    >
                        <span className="text-xl">🔮</span>
                    </button>
                    {currentRoomRef.current === 'B' ? (
                        <div className="relative">
                            <button onClick={() => setBoardGameMenuOpen(!boardGameMenuOpen)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${boardGameMenuOpen ? 'bg-gold text-black' : 'bg-white/10'}`}>
                                <span className="font-header text-xl">🎲</span>
                            </button>
                            {boardGameMenuOpen && (
                                <div className="absolute bottom-14 left-0 bg-zinc-900 border border-white/10 rounded-xl p-2 flex flex-col gap-2 z-50 w-32">
                                    <button onClick={() => { handleSendBoardGame('UNO'); setBoardGameMenuOpen(false); }} className="px-4 py-2 hover:bg-white/10 rounded-lg text-sm">UNO</button>
                                    <button onClick={() => { handleSendBoardGame('UNO_DARK'); setBoardGameMenuOpen(false); }} className="px-4 py-2 hover:bg-white/10 rounded-lg text-sm">UNO (Dark)</button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button onClick={() => setFateMode(!fateMode)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${fateMode ? 'bg-gold text-black' : 'bg-white/10'}`}>
                            <span className="font-header text-xl">?</span>
                        </button>
                    )}
                    <div className="flex-1 relative flex items-end group">
                        <textarea 
                            ref={textareaRef}
                            value={inputText} 
                            onChange={e => { 
                                setInputText(e.target.value); 
                                handleTyping(); 
                                if (textareaRef.current) {
                                    textareaRef.current.style.height = '48px';
                                    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
                                }
                            }}
                            placeholder="Kirim pesan..." 
                            className="w-full min-h-[48px] max-h-[120px] bg-white/10 hover:bg-white/15 focus:bg-white/15 rounded-3xl px-5 py-3 pr-12 outline-none focus:ring-2 ring-gold/50 transition-all resize-none overflow-y-auto custom-scrollbar border border-white/5"
                            rows={1}
                            style={{ height: '48px' }}
                        />
                        <label className="absolute right-4 bottom-3 cursor-pointer opacity-50 hover:opacity-100 transition-opacity">
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*" />
                            <span className="text-xl">📎</span>
                        </label>
                    </div>
                    <button 
                        onMouseDown={!(inputText.trim() || selectedFile) ? startRecording : undefined}
                        onMouseUp={!(inputText.trim() || selectedFile) ? stopRecording : undefined}
                        onMouseLeave={!(inputText.trim() || selectedFile) ? stopRecording : undefined}
                        onTouchStart={!(inputText.trim() || selectedFile) ? startRecording : undefined}
                        onTouchEnd={!(inputText.trim() || selectedFile) ? stopRecording : undefined}
                        onClick={(inputText.trim() || selectedFile) ? handleSend : undefined}
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all select-none shadow-lg ${isRecording ? 'bg-red-500 animate-pulse shadow-red-500/50' : 'bg-gold text-black hover:scale-105 active:scale-95 shadow-gold/20'}`}
                    >
                        {(inputText.trim() || selectedFile) ? '➤' : (isRecording ? '⏹' : '🎤')}
                    </button>
                </div>
                <div className="flex justify-center mt-2 gap-4">
                    <button onClick={() => setIsViewOnce(!isViewOnce)} className={`text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border transition-all ${isViewOnce ? 'bg-red-500/20 border-red-500 text-red-400' : 'border-white/10 opacity-40'}`}>
                        Sekali Lihat {isViewOnce ? 'ON' : 'OFF'}
                    </button>
                </div>
            </footer>

            {fateMode && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[600] flex flex-col items-center justify-center p-6 animate-fade-in" onClick={() => setFateMode(false)}>
                    <div className="w-full max-w-xs space-y-4" onClick={e => e.stopPropagation()}>
                        <h2 className="font-header text-center text-gold text-xl tracking-[8px]">PILIH TAKDIR</h2>
                        <div className="grid grid-cols-1 gap-3">
                            {['light', 'deep', 'chaos'].map(cat => (
                                <button key={cat} onClick={() => handleDrawFate(cat)} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-left hover:border-gold/50 transition-all group relative overflow-hidden">
                                    <div className="flex justify-between items-center">
                                        <div className="font-header text-gold uppercase tracking-widest text-lg">{cat}</div>
                                        {cat === 'chaos' && <span className="text-xl opacity-70 group-hover:scale-110 transition-transform">🔒</span>}
                                    </div>
                                    <div className="text-[10px] opacity-40 uppercase mt-1 font-sans tracking-wide">
                                        {cat === 'chaos' ? 'Restricted Access • PIN Required' : `Invoke the spirits of ${cat}`}
                                    </div>
                                    <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showDeleteConfirmModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[600] flex flex-col items-center justify-center p-6 animate-fade-in" onClick={() => setShowDeleteConfirmModal(false)}>
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        className="w-full max-w-xs space-y-4 bg-zinc-900 border border-red-500/50 rounded-3xl p-8 text-center shadow-[0_0_40px_rgba(239,68,68,0.2)]" 
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="text-5xl mb-4 animate-bounce">⚠️</div>
                        <h2 className="font-header text-red-500 text-2xl tracking-[4px]">PERINGATAN</h2>
                        <p className="text-sm text-white/70 leading-relaxed">
                            Ini akan menghapus SEMUA pesan di database secara permanen beserta file media (Gambar & VN). Tindakan ini tidak dapat dibatalkan. Lanjutkan?
                        </p>
                        <div className="flex gap-3 pt-6">
                            <button onClick={() => setShowDeleteConfirmModal(false)} className="flex-1 py-3 rounded-xl bg-white/10 text-white text-xs font-bold tracking-widest uppercase hover:bg-white/20 transition-colors">Batal</button>
                            <button onClick={handleDeleteHistory} className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-500 border border-red-500/50 text-xs font-bold tracking-widest uppercase hover:bg-red-500/40 transition-colors">Hapus</button>
                        </div>
                    </motion.div>
                </div>
            )}


            {showChaosPinModal && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[600] flex flex-col items-center justify-center p-6 animate-fade-in">
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-full max-w-xs space-y-6 text-center bg-zinc-900 border border-red-500/30 p-8 rounded-3xl shadow-[0_0_40px_rgba(239,68,68,0.15)]"
                    >
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-2">
                            <span className="text-2xl animate-pulse">☢️</span>
                        </div>
                        <h2 className="font-header text-red-500 text-xl tracking-[8px] animate-pulse">RESTRICTED AREA</h2>
                        <p className="text-xs text-white/50 uppercase tracking-widest">Masukkan kode akses untuk membuka Chaos Mode</p>
                        <input 
                            type="password" 
                            value={chaosPinInput} 
                            onChange={e => setChaosPinInput(e.target.value)} 
                            className="w-full bg-black/50 text-center p-4 rounded-xl tracking-[12px] text-xl text-gold outline-none focus:ring-2 ring-red-500/50 border border-white/10 transition-all"
                            placeholder="••••••"
                            onKeyDown={e => e.key === 'Enter' && handleChaosPinSubmit()}
                        />
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => { setShowChaosPinModal(false); setChaosPinInput(''); }} className="flex-1 py-3 rounded-xl bg-white/10 text-white text-xs font-bold tracking-widest uppercase hover:bg-white/20 transition-colors">Batal</button>
                            <button onClick={handleChaosPinSubmit} className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-500 border border-red-500/50 text-xs font-bold tracking-widest uppercase hover:bg-red-500/40 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)]">Buka</button>
                        </div>
                    </motion.div>
                </div>
            )}

            {viewingSecret && (
                <div className="fixed inset-0 bg-black/98 backdrop-blur-xl z-[600] flex items-center justify-center p-8 animate-fade-in" onClick={() => setViewingSecret(null)}>
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0, rotateX: 20 }}
                        animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                        className="text-center space-y-8 max-w-sm w-full" 
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="text-red-500 font-header text-2xl tracking-[12px] uppercase animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">Secret Revealed</div>
                        <div className="bg-zinc-900/80 p-8 rounded-[2rem] border border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.15)] backdrop-blur-2xl">
                            <MessageContent 
                                type={viewingSecret.type} 
                                content={viewingSecret.content} 
                                msgId="secret" 
                                isPlayingAudio={currentAudioId === "secret"} 
                                onPlayAudio={setCurrentAudioId} 
                                isSecret={true}
                            />
                        </div>
                        <div className="text-xs text-red-500/50 uppercase tracking-[4px] animate-pulse">Pesan ini akan terbakar selamanya...</div>
                    </motion.div>
                </div>
            )}

            {isUploading && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gold text-black px-4 py-2 rounded-full text-xs font-bold shadow-2xl z-[600] animate-bounce">
                    TRANSMITTING...
                </div>
            )}

            <AnimatePresence>
                {showScrollButton && (
                    <motion.button 
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        onClick={scrollToBottom}
                        className="fixed bottom-24 right-4 w-10 h-10 bg-zinc-800/90 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center shadow-2xl z-[100] hover:bg-zinc-700 transition-colors"
                    >
                        <span className="text-white text-lg">↓</span>
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center">
                                {unreadCount}
                            </span>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>

            {selectedImage && (
                <div className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedImage(null)}>
                    <button className="absolute top-6 right-6 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors z-[601]" onClick={() => setSelectedImage(null)}>
                        ✕
                    </button>
                    <img 
                        src={selectedImage} 
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
                        onClick={e => e.stopPropagation()}
                        referrerPolicy="no-referrer"
                    />
                </div>
            )}

            {/* Backdrop Overlay for Settings */}
            <AnimatePresence>
                {showMenu && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowMenu(false)}
                        className="fixed inset-0 z-[490] bg-black/60 backdrop-blur-sm"
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showMenu && (
                    <motion.div 
                        initial={{ x: "100%", opacity: 0.9 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 0.9 }}
                        transition={{ type: "spring", damping: 26, stiffness: 220 }}
                        className="fixed right-0 top-0 bottom-0 z-[500] w-full sm:max-w-md bg-zinc-950/95 border-l border-white/10 backdrop-blur-3xl shadow-[-10px_0_50px_rgba(0,0,0,0.8)] flex flex-col h-full"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-15">
                            <div className="flex items-center gap-3">
                                <span className="p-2 rounded-lg bg-gold/10 border border-gold/30">
                                    <Settings className="w-5 h-5 text-gold animate-spin-slow" />
                                </span>
                                <div>
                                    <h2 className="font-header text-lg text-white font-bold tracking-wider">PENGATURAN</h2>
                                    <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">SISI {currentRoom} PORTAL</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowMenu(false)} 
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/75 hover:text-white transition-all hover:scale-105 active:scale-95"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar pb-16">
                            
                            {updateAvailable && (
                                <button 
                                    onClick={() => window.location.reload()} 
                                    className="w-full text-center px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-bold animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.15)] hover:bg-green-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping"></span>
                                    🔄 UPDATE TERSEDIA - KLIK UNTUK REFRESH
                                </button>
                            )}

                            {/* PROFIL PENGGUNA */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                                    <User className="w-4 h-4 text-gold" />
                                    <h3 className="text-xs font-mono font-bold text-white/50 uppercase tracking-widest">Profil Pengguna</h3>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4 shadow-inner">
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-14 h-14 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-2xl overflow-hidden shrink-0 shadow-lg group">
                                            {avatar.startsWith('http') || avatar.startsWith('data:image') ? (
                                                <img src={avatar} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            ) : (
                                                avatar
                                            )}
                                            <label className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity duration-200">
                                                <span className="text-[9px] uppercase font-bold text-white">UBAH</span>
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="hidden" 
                                                    onChange={async e => {
                                                        const file = e.target.files?.[0];
                                                        if (file && storageManagerRef.current) {
                                                            setIsUploading(true);
                                                            try {
                                                                const url = await storageManagerRef.current.uploadImage(file);
                                                                setAvatar(url);
                                                                safeStorage.set('oracle_avatar', url);
                                                                showToast("Avatar berhasil diperbarui", "success");
                                                            } catch (err: any) {
                                                                showToast("Gagal upload avatar", "error");
                                                            } finally {
                                                                setIsUploading(false);
                                                            }
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1 font-mono font-bold">Nama Panggilan</label>
                                            <input 
                                                type="text" 
                                                value={username} 
                                                onChange={e => {
                                                    setUsername(e.target.value);
                                                    safeStorage.set('oracle_user', e.target.value);
                                                }} 
                                                maxLength={20}
                                                className="w-full bg-black/40 text-white px-3 py-2 rounded-xl border border-white/10 focus:border-gold/30 outline-none transition-all placeholder:text-white/20 text-xs font-mono font-medium" 
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-2 font-mono font-bold">Pilih Warna Nama</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {['#D4AF37', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6'].map(color => (
                                                <button 
                                                    key={color} 
                                                    onClick={() => {
                                                        setUserColor(color);
                                                        safeStorage.set('oracle_color', color);
                                                    }} 
                                                    className={`w-6 h-6 rounded-full border transition-all duration-300 ${userColor === color ? 'scale-110 border-white ring-2 ring-gold/40' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`} 
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5 font-mono font-bold">Avatar Emoji</label>
                                        <div className="flex gap-1 text-lg justify-between flex-wrap bg-black/20 p-2 rounded-xl border border-white/5">
                                            {['🔮', '👻', '💀', '👽', '🦊', '🦉', '🦋', '🕸️'].map(emoji => (
                                                <button 
                                                    key={emoji} 
                                                    onClick={() => {
                                                        setAvatar(emoji);
                                                        safeStorage.set('oracle_avatar', emoji);
                                                    }} 
                                                    className={`hover:scale-125 transition-transform p-1 rounded-md ${avatar === emoji ? 'bg-white/5 scale-110' : ''}`}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* AUDIO & NOTIFIKASI */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                                    <Volume2 className="w-4 h-4 text-gold" />
                                    <h3 className="text-xs font-mono font-bold text-white/50 uppercase tracking-widest">Audio & Notifikasi</h3>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4 shadow-inner">
                                    <div>
                                        <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5 font-mono font-bold">Ambient Soundtrack</label>
                                        <select 
                                            value={bgmTrack} 
                                            onChange={e => setBgmTrack(parseInt(e.target.value))}
                                            className="w-full p-2.5 rounded-xl text-xs bg-black/40 border border-white/10 outline-none text-white focus:border-gold/30 transition-colors cursor-pointer"
                                        >
                                            {AVAILABLE_BGMS.map((track, idx) => (
                                                <option key={track.id} value={idx}>{track.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 bg-black/30 p-2.5 rounded-xl border border-white/5">
                                        <button 
                                            onClick={() => setIsBgmMuted(!isBgmMuted)} 
                                            className="text-lg w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-center hover:scale-105 transition-transform"
                                        >
                                            {isBgmMuted ? '🔇' : '🔊'}
                                        </button>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="1" 
                                            step="0.05" 
                                            value={bgmVolume} 
                                            onChange={e => setBgmVolume(parseFloat(e.target.value))} 
                                            className="w-full accent-gold h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        <div>
                                            <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5 font-mono font-bold">Mode Notifikasi</label>
                                            <select 
                                                className="w-full p-2.5 rounded-xl text-xs bg-black/40 border border-white/10 outline-none text-white focus:border-gold/30 transition-colors cursor-pointer"
                                                value={notifSettings.mode}
                                                onChange={(e) => setNotifSettings(prev => ({ ...prev, mode: e.target.value as any }))}
                                            >
                                                <option value="all">Semua Pesan</option>
                                                <option value="mention">Hanya Mention (@nama)</option>
                                                <option value="mute">Mute (Senyap)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5 font-mono font-bold">Anti-Spam Filter (Cooldown)</label>
                                            <select 
                                                className="w-full p-2.5 rounded-xl text-xs bg-black/40 border border-white/10 outline-none text-white focus:border-gold/30 transition-colors cursor-pointer"
                                                value={notifSettings.cooldown}
                                                onChange={(e) => setNotifSettings(prev => ({ ...prev, cooldown: parseInt(e.target.value) }))}
                                            >
                                                <option value="2">Cepat (2 dtk)</option>
                                                <option value="10">Sedang (10 dtk)</option>
                                                <option value="30">Lambat (30 dtk)</option>
                                                <option value="60">Sangat Lambat (1 mnt)</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={async () => {
                                            const permission = await Notification.requestPermission();
                                            if (permission === 'granted') {
                                                showToast("Izin Notifikasi Diberikan!", "success");
                                            } else {
                                                showToast("Izin ditolak. Jika di iOS, gunakan 'Add to Home Screen'.", "error");
                                            }
                                        }} 
                                        className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
                                    >
                                        🔔 Aktifkan Notifikasi Portal
                                    </button>
                                </div>
                            </section>

                            {/* PRIVASI & ENKRIPSI */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                                    <Shield className="w-4 h-4 text-gold" />
                                    <h3 className="text-xs font-mono font-bold text-white/50 uppercase tracking-widest">Enkripsi & Keamanan</h3>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3 shadow-inner">
                                    <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1 font-mono font-bold">Kunci Enkripsi Side {currentRoom}</label>
                                    <input 
                                        type="password" 
                                        placeholder="Kunci rahasia chat enkripsi..." 
                                        value={encryptionKey}
                                        onChange={e => {
                                            setEncryptionKey(e.target.value);
                                        }}
                                        className="w-full p-2.5 rounded-xl text-xs bg-black/40 border border-white/10 outline-none text-white focus:border-gold/30 transition-colors text-center tracking-widest"
                                    />
                                    <p className="text-[10px] text-white/30 leading-normal font-sans">
                                        Semua pesan akan dienkripsi secara end-to-end secara otomatis. Anggota Side `{currentRoom}` yang tidak memiliki kecocokan sandi tidak akan bisa mendeskripsikan pesan ini.
                                    </p>
                                </div>
                            </section>

                            {/* EXTRA FILTER */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                                    <Eye className="w-4 h-4 text-gold" />
                                    <h3 className="text-xs font-mono font-bold text-white/50 uppercase tracking-widest">Filter Chat</h3>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3 shadow-inner">
                                    <div className="grid grid-cols-1 gap-2.5">
                                        <button 
                                            onClick={() => setFilterType(filterType === 'unread' ? 'all' : 'unread')} 
                                            className={`p-2.5 rounded-xl text-xs transition-all border font-mono ${filterType === 'unread' ? 'bg-gold text-black border-gold font-bold shadow-[0_0_10px_rgba(212,175,55,0.2)]' : 'bg-black/30 border-white/10 text-white/70 hover:bg-white/5'}`}
                                        >
                                            {filterType === 'unread' ? '✓ Filter: Belum Dibaca Aktif' : 'Tampilkan Belum Dibaca'}
                                        </button>
                                        <select 
                                            onChange={e => { 
                                                if (e.target.value) {
                                                    setFilterType('sender'); 
                                                    setFilterSender(e.target.value); 
                                                } else {
                                                    setFilterType('all');
                                                    setFilterSender('');
                                                }
                                            }} 
                                            className="p-2.5 rounded-xl text-xs bg-black/40 border border-white/10 outline-none focus:border-gold/30 text-white transition-colors cursor-pointer"
                                            value={filterType === 'sender' ? filterSender : ''}
                                        >
                                            <option value="">Cari Berdasarkan Pengirim</option>
                                            {uniqueSenders.map(s => <option key={s} value={s}>Dari: {s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* GAME LOBBY */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                                    <span className="text-gold text-sm">🎮</span>
                                    <h3 className="text-xs font-mono font-bold text-white/50 uppercase tracking-widest">Game Lobby & Arena</h3>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4 shadow-inner">
                                    <div className="flex justify-end">
                                        <button 
                                            onClick={() => {
                                                setShowMenu(false);
                                                setShowLeaderboard(true);
                                            }}
                                            className="px-3 py-1.5 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95"
                                        >
                                            🏆 Leaderboard
                                        </button>
                                    </div>
                                    <Lobby 
                                        onJoinGame={async (matchId, lobbyGameType) => {
                                            setGameId(matchId);
                                            setActualMatchId(matchId);
                                            setGameType(lobbyGameType as any);
                                            setBgioPlayerID(localStorage.getItem('oracle_user_id') || Math.random().toString(36).substring(7));
                                            setIsConnectingGame(true);
                                            setShowMenu(false);
                                            setTimeout(() => {
                                                setIsConnectingGame(false);
                                                if (lobbyGameType === 'UNO') setShowUnoBoard(true);
                                                else setShowTebakKataBoard(true);
                                            }, 500);
                                        }}
                                        onCreateGame={async (lobbyGameType, numPlayers, settings, matchId) => {
                                            setGameId(matchId);
                                            setActualMatchId(matchId);
                                            setNumPlayers(numPlayers);
                                            setGameType(lobbyGameType as any);
                                            setBgioPlayerID(localStorage.getItem('oracle_user_id') || Math.random().toString(36).substring(7));
                                            setIsConnectingGame(true);
                                            setShowMenu(false);
                                            setTimeout(() => {
                                                setIsConnectingGame(false);
                                                if (lobbyGameType === 'UNO') setShowUnoBoard(true);
                                                else setShowTebakKataBoard(true);
                                            }, 500);
                                        }}
                                        currentAlias={username || ''}
                                        deviceId={bgioPlayerID || username || 'anon_device'}
                                    />
                                </div>
                            </section>

                            {/* SISTEM */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                                    <Sliders className="w-4 h-4 text-gold" />
                                    <h3 className="text-xs font-mono font-bold text-white/50 uppercase tracking-widest">Sistem</h3>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2.5 shadow-inner">
                                    {isIOS && (
                                        <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[10px] text-blue-300 flex items-center gap-2 leading-relaxed font-sans">
                                            <span>📱</span>
                                            <span>Untuk PWA di iOS: tap ikon Share lalu pilih <strong>Add to Home Screen</strong>.</span>
                                        </div>
                                    )}
                                    
                                    <button 
                                        onClick={async () => {
                                            if (deferredPrompt) {
                                                deferredPrompt.prompt();
                                                const { outcome } = await deferredPrompt.userChoice;
                                                if (outcome === 'accepted') setDeferredPrompt(null);
                                            } else {
                                                showToast("Silakan instal menggunakan menu browser Anda.", "info");
                                            }
                                        }} 
                                        className="w-full text-left p-2.5 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 text-xs font-mono text-white/80 transition-all flex items-center gap-2.5"
                                    >
                                        <span className="text-gold">⬇️</span> Pasang Portal Terdedikasi
                                    </button>
                                    
                                    <button 
                                        onClick={() => {
                                            showToast("Membersihkan sistem cache...", "info");
                                            if ('serviceWorker' in navigator) {
                                                caches.keys().then(names => {
                                                    for (let name of names) caches.delete(name);
                                                });
                                            }
                                            setTimeout(() => window.location.reload(), 1000);
                                        }} 
                                        className="w-full text-left p-2.5 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 text-xs font-mono text-white/80 transition-all flex items-center gap-2.5"
                                    >
                                        <span className="text-gold">🧹</span> Bersihkan Cache Virtual
                                    </button>
                                    
                                    <button 
                                        onClick={() => {
                                            const status = connStatus === 'ONLINE' ? "Koneksi Stabil, Latency <10ms" : "Koneksi Terputus/Loading";
                                            showToast(`Status: ${status}`, connStatus === 'ONLINE' ? "success" : "error");
                                        }} 
                                        className="w-full text-left p-2.5 rounded-xl bg-black/40 hover:bg-white/5 border border-white/10 text-xs font-mono text-white/80 transition-all flex items-center gap-2.5"
                                    >
                                        <span className="text-gold">📡</span> Diagnostik Jaringan Supabase
                                    </button>
                                </div>
                            </section>

                            {/* ZONA MERAH */}
                            <section className="space-y-3 pt-2">
                                <div className="flex items-center gap-2 border-b border-red-500/20 pb-2">
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                    <h3 className="text-xs font-mono font-bold text-red-400/60 uppercase tracking-widest">Zona Bahaya</h3>
                                </div>
                                <div className="bg-red-500/[0.02] border border-red-500/10 rounded-2xl p-4 space-y-2.5">
                                    <button 
                                        onClick={() => {
                                            setShowMenu(false);
                                            setShowDeleteConfirmModal(true);
                                        }} 
                                        className="w-full p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-mono font-semibold transition-all flex items-center justify-center gap-2"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Bersihkan Seluruh Chat Room
                                    </button>
                                    
                                    <button 
                                        onClick={() => {
                                            if (window.confirm("Apakah Anda yakin ingin melakukan total reset identitas Anda?")) {
                                                localStorage.clear();
                                                sessionStorage.clear();
                                                window.location.reload();
                                            }
                                        }} 
                                        className="w-full p-2.5 rounded-xl bg-black/30 hover:bg-red-500/10 border border-white/5 text-white/50 hover:text-red-400 text-xs font-mono transition-all flex items-center justify-center gap-2"
                                    >
                                        <LogOut className="w-3.5 h-3.5" /> Keluar & Hapus Identitas
                                    </button>
                                </div>
                            </section>

                            <div className="pt-6 text-center">
                                <p className="text-[9px] text-white/10 uppercase tracking-[4px] font-mono">Oracle App v17.11</p>
                                <p className="text-[8px] text-white/5 font-mono">The Refinement Suite</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {showUnoBoard && (
                <SupabaseMultiplayerWrapper 
                    gameId={actualMatchId}
                    gameType="UNO"
                    playerID={bgioPlayerID}
                    playerName={username}
                    onLeave={() => {
                        if (actualMatchId) {
                            supabaseClient.from('game_lobbies').delete().eq('match_id', actualMatchId).then(() => {});
                        }
                        setShowUnoBoard(false);
                        setGameId('');
                        setActualMatchId('');
                    }}
                    onGameEnd={(winner, players) => {
                         if (bgioPlayerID === '0' || players[0] === username) {
                              const cb = (msg: string) => {
/* We just handle normal messaging here */
  console.log("direct system message:", msg);
}; cb(`[Sistem] Game UNO telah selesai! Pemenang: ${winner}\nPemain: ${players.join(', ')}`);
                         }
                    }}
                />
            )}
            
            {showTebakKataBoard && (
                <SupabaseMultiplayerWrapper 
                    gameId={actualMatchId}
                    gameType="TEBAK_KATA"
                    playerID={bgioPlayerID}
                    playerName={username}
                    onLeave={() => {
                        if (actualMatchId) {
                            supabaseClient.from('game_lobbies').delete().eq('match_id', actualMatchId).then(() => {});
                        }
                        setShowTebakKataBoard(false);
                        setGameId('');
                        setActualMatchId('');
                    }}
                    onGameEnd={(winner, players) => {
                         if (bgioPlayerID === '0' || players[0] === username) {
                             const cb = (msg: string) => {
/* We just handle normal messaging here */
  console.log("direct system message:", msg);
}; cb(`[Sistem] Game Divinasi Kata selesai! Pemenang: ${winner}\nPemain: ${players.join(', ')}`);
                         }
                    }}
                />
            )}
            
            <CosmicOracleModal 
                isOpen={showOracleModal}
                onClose={() => setShowOracleModal(false)}
                onSendProphecy={handleSendOracleProphecy}
                username={username}
                room={currentRoom}
            />
            {showLeaderboard && (
                <Leaderboard onClose={() => setShowLeaderboard(false)} />
            )}
            {isConnectingGame && (
                <div className="fixed inset-0 z-50">
                    <LoadingScreen />
                    <button 
                        onClick={() => setIsConnectingGame(false)}
                        className="absolute top-4 right-4 text-white/50 hover:text-white z-50"
                    >
                        Batal
                    </button>
                </div>
            )}
        </motion.div>
    );
}
