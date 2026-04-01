import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply, Check, CheckCheck, Copy } from 'lucide-react';
import { io, Socket } from "socket.io-client";
import { UNO_CARD_SVG, REMI_CARD_SVG } from './constants/boardGameDeck';

import { ConnectionManager } from './utils/ConnectionManager';
import { supabaseClient } from '../supabase';
import { ORACLE_CONFIG } from './config';
import { GAME_DECK } from './constants/deck';
import { drawUnoFlipCard, drawRemiCard } from './constants/boardGames';
import { MessageParser } from './utils/messageParser';
import { AudioManager } from './utils/audioManager';
import { bgmManager, AVAILABLE_BGMS } from './utils/bgmManager';
import { StorageManager } from './utils/StorageManager';
import { CryptoUtils } from './utils/crypto';
import { ReactUnoBoard } from './components/ReactUnoBoard';
import { ReactRemiBoard } from './components/ReactRemiBoard';
import { Leaderboard } from './components/Leaderboard';
import SideA from './components/SideA';
import SideB from './components/SideB';

// --- CONSTANTS & UTILS ---
const SUPA_URL = import.meta.env.VITE_SUPA_URL || ORACLE_CONFIG?.SUPA_URL;
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
        const cardColorOrSuit = parts[2];
        const cardValue = parts[3];

        if (gameType === 'UNO_FLIP') {
            const side = parts[2] as 'Light' | 'Dark';
            const color = parts[3];
            const value = parts[4];
            
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
        } else if (gameType === 'REMI') {
            return (
                <motion.div 
                    initial={{ rotateY: 90, opacity: 0, scale: 0.8 }}
                    animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 100 }}
                    className="w-40 h-60 relative shadow-lg mx-auto mb-6"
                >
                    <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: REMI_CARD_SVG(cardColorOrSuit, cardValue) }} />
                    {invoker && (
                        <div className="absolute -bottom-6 left-0 right-0 text-[8px] opacity-60 uppercase tracking-widest text-white whitespace-nowrap text-center">
                            Ditarik oleh {invoker}
                        </div>
                    )}
                </motion.div>
            );
        } else if (gameType === 'REMI41') {
            if (parts.length < 10) return null;
            const cards = [
                { suit: parts[2], value: parts[3] },
                { suit: parts[4], value: parts[5] },
                { suit: parts[6], value: parts[7] },
                { suit: parts[8], value: parts[9] }
            ];

            return (
                <div className="flex flex-col items-center gap-6">
                    <div className="flex justify-center relative">
                        {cards.map((card, idx) => (
                            <motion.div 
                                key={idx}
                                initial={{ rotateY: 90, opacity: 0, x: -50 }}
                                animate={{ rotateY: 0, opacity: 1, x: 0 }}
                                transition={{ type: 'spring', damping: 12, stiffness: 100, delay: idx * 0.1 }}
                                className="w-24 h-36 sm:w-32 sm:h-48 relative shadow-md hover:z-20 hover:-translate-y-4 transition-transform"
                                style={{ 
                                    zIndex: idx,
                                    marginLeft: idx === 0 ? 0 : '-40px',
                                    transform: `rotate(${idx * 5 - 10}deg)`
                                }}
                            >
                                <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: REMI_CARD_SVG(card.suit, card.value) }} />
                            </motion.div>
                        ))}
                    </div>
                    <div className="text-[10px] opacity-60 uppercase tracking-widest text-white whitespace-nowrap">
                        Ditarik oleh {invoker}
                    </div>
                </div>
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
    const [socket, setSocket] = useState<Socket | null>(null);
    const [gameState, setGameState] = useState<any>(null);
    const [gameId, setGameId] = useState('');
    const [showUnoBoard, setShowUnoBoard] = useState(false);
    const [showRemiBoard, setShowRemiBoard] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);

    useEffect(() => {
        const socketUrl = import.meta.env.VITE_APP_URL || 'https://game-production-a33c.up.railway.app';
        const newSocket = io(socketUrl, { transports: ['websocket'] });
        setSocket(newSocket);
        return () => { newSocket.close(); };
    }, []);

    useEffect(() => {
        if (!socket) return;
        const handleGameUpdate = (data: any) => {
            if (data.type === "STATE_UPDATE") {
                setGameState(data.state);
                // If we joined a game but don't have a board open, open the correct one
                if (!showUnoBoard && !showRemiBoard && data.state.players.length > 0) {
                    if ('hasCalledUno' in data.state.players[0]) {
                        setShowUnoBoard(true);
                    } else {
                        setShowRemiBoard(true);
                    }
                }
            }
        };
        const handleGameError = (msg: string) => {
            alert(msg);
            setShowUnoBoard(false);
            setShowRemiBoard(false);
            setGameId('');
        };
        socket.on("gameUpdate", handleGameUpdate);
        socket.on("gameError", handleGameError);
        return () => { 
            socket.off("gameUpdate", handleGameUpdate); 
            socket.off("gameError", handleGameError);
        };
    }, [socket, showUnoBoard, showRemiBoard]);

    const createGame = (gameType: 'UNO' | 'REMI41' = 'REMI41') => {
        if (!gameId) {
            showToast("Masukkan Game ID terlebih dahulu!", "error");
            return;
        }
        socket?.emit("createGame", { gameId, gameType, playerName: username });
        setShowMenu(false);
    };

    const joinGame = () => {
        if (!gameId) {
            showToast("Masukkan Game ID terlebih dahulu!", "error");
            return;
        }
        socket?.emit("joinGame", { gameId, playerName: username });
        setShowMenu(false);
    };

    const drawCard = () => {
        socket?.emit("gameAction", { gameId, action: 'draw' });
    };

    const discardCard = (cardIndex: number) => {
        socket?.emit("gameAction", { gameId, action: 'discard', payload: { cardIndex } });
    };

    const [layer, setLayer] = useState(() => {
        if (safeStorage.get('oracle_adult') === null) return 'AGE';
        if (safeStorage.get('oracle_user') === null) return 'NAME';
        return safeStorage.get('oracle_unlocked') === 'true' ? 'LOBBY' : 'SECURITY';
    });

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
            connManagerRef.current.subscribe('msgs', (event: any) => {
                if (event.type === 'INSERT') {
                    const newMsg = event.payload.new;
                    const isRoomB = newMsg.nama.startsWith('ROOM_B|');
                    if (currentRoomRef.current === 'B' && !isRoomB) return;
                    if (currentRoomRef.current === 'A' && isRoomB) return;

                    setMessages(prev => [...prev, newMsg]);
                    
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
            connManagerRef.current.channel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { user: finalUser }
            });
            
            typingTimeoutRef.current = setTimeout(() => {
                typingTimeoutRef.current = null;
            }, 1000);
        }
    };

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
                clearSelectedFile();
                
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
                await supabaseClient.from('Pesan').update({ teks: finalTeks }).eq('id', editingMsg.id);
                setEditingMsg(null);
                showToast("Pesan diperbarui", "success");
            } else {
                const encKey = getEncKey();
                const finalTeks = CryptoUtils.encrypt(teks, encKey);
                const encryptedNama = CryptoUtils.encrypt(nama, encKey);
                const finalNama = currentRoomRef.current === 'B' ? `ROOM_B|${encryptedNama}` : `ROOM_A|${encryptedNama}`;
                forceScrollRef.current = true;
                await supabaseClient.from('Pesan').insert([{ nama: finalNama, teks: finalTeks }]);
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
        } else if (game === 'REMI41') {
            const cards = [drawRemiCard(), drawRemiCard(), drawRemiCard(), drawRemiCard()];
            contentStr = `BOARDGAME:REMI41:${cards.map(c => `${c.suit}:${c.value}`).join(':')}`;
        }
        
        try {
            const nama = `${username}|${avatar}|${userColor}`;
            const encKey = getEncKey();
            const finalTeks = CryptoUtils.encrypt(contentStr, encKey);
            const encryptedNama = CryptoUtils.encrypt(nama, encKey);
            const finalNama = currentRoomRef.current === 'B' ? `ROOM_B|${encryptedNama}` : `ROOM_A|${encryptedNama}`;
            forceScrollRef.current = true;
            await supabaseClient.from('Pesan').insert([{ nama: finalNama, teks: finalTeks }]);
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
                await supabaseClient.from('Pesan').insert([{ nama: finalNama, teks: finalTeks }]);
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
            clearSelectedFile();
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

        await supabaseClient.from('Pesan').insert([{ nama: finalNama, teks: finalTeks }]);
        setFateMode(false);
    };

    const handleDrawBoardGame = async (game: 'UNO' | 'UNO_DARK' | 'REMI BESAR' | 'REMI 41') => {
        bgmManager.onFateCardDraw();
        
        let contentStr = '';
        if (game === 'UNO') {
            const card = drawUnoFlipCard('Light');
            contentStr = `BOARDGAME:UNO_FLIP:${card.side}:${card.color}:${card.value}`;
        } else if (game === 'UNO_DARK') {
            const card = drawUnoFlipCard('Dark');
            contentStr = `BOARDGAME:UNO_FLIP:${card.side}:${card.color}:${card.value}`;
        } else if (game === 'REMI BESAR') {
            const card = drawRemiCard();
            contentStr = `BOARDGAME:REMI:${card.suit}:${card.value}`;
        } else if (game === 'REMI 41') {
            const cards = [drawRemiCard(), drawRemiCard(), drawRemiCard(), drawRemiCard()];
            contentStr = `BOARDGAME:REMI41:${cards.map(c => `${c.suit}:${c.value}`).join(':')}`;
        }

        const payload = JSON.stringify({
            content: contentStr,
            invoker: username
        });

        const encKey = getEncKey();
        const finalTeks = CryptoUtils.encrypt(payload, encKey);
        const encryptedNama = CryptoUtils.encrypt('ORACLE', encKey);
        const finalNama = currentRoomRef.current === 'B' ? `ROOM_B|${encryptedNama}` : `ROOM_A|${encryptedNama}`;

        await supabaseClient.from('Pesan').insert([{ nama: finalNama, teks: finalTeks }]);
        setFateMode(false);
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
            if (currentRoom === 'B') {
                selectQuery = selectQuery.like('nama', 'ROOM_B|%');
            } else {
                selectQuery = selectQuery.not('nama', 'like', 'ROOM_B|%');
            }
            const { data: messagesToDelete } = await selectQuery;
            
            if (messagesToDelete && messagesToDelete.length > 0) {
                const buktiFilesToRemove: string[] = [];
                const vnFilesToRemove: string[] = [];
                
                messagesToDelete.forEach(msg => {
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
        <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 to-zinc-900 flex flex-col items-center justify-center text-center p-4 animate-fade-in">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col items-center w-full max-w-sm"
            >
                <div className="w-20 h-20 bg-gold/20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(212,175,55,0.3)]">
                    <span className="text-4xl">🏛️</span>
                </div>
                <h2 className="text-2xl font-header text-gold mb-2 tracking-widest">LOBBY</h2>
                <p className="text-zinc-400 mb-8 text-sm">Pilih dimensi yang ingin Anda masuki.</p>
                
                <div className="w-full flex flex-col gap-4">
                    <button onClick={() => { setCurrentRoom('A'); setLayer('MAIN'); }} className="w-full px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 hover:border-gold/50 hover:shadow-[0_0_25px_rgba(212,175,55,0.2)] hover:scale-105 active:scale-95 transition-all tracking-widest uppercase flex items-center justify-between">
                        <span>Side A</span>
                        <span className="text-gold">→</span>
                    </button>
                    <button onClick={() => { setCurrentRoom('B'); setLayer('MAIN'); }} className="w-full px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-xl hover:bg-white/10 hover:border-gold/50 hover:shadow-[0_0_25px_rgba(212,175,55,0.2)] hover:scale-105 active:scale-95 transition-all tracking-widest uppercase flex items-center justify-between">
                        <span>Side B</span>
                        <span className="text-gold">→</span>
                    </button>
                </div>
            </motion.div>
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
