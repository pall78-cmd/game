import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply } from 'lucide-react';

import { ConnectionManager } from './utils/ConnectionManager';
import { supabaseClient } from '../supabase';
import { ORACLE_CONFIG } from './config';
import { GAME_DECK } from './constants/deck';
import { MessageParser } from './utils/messageParser';
import { AudioManager } from './utils/audioManager';
import { bgmManager, AVAILABLE_BGMS } from './utils/bgmManager';
import { StorageManager } from './utils/StorageManager';
import { CryptoUtils } from './utils/crypto';

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

    return (
        <div className="flex items-center gap-3 min-w-[200px] py-2 px-3 bg-black/20 rounded-xl">
            <button onClick={onToggle} className="w-10 h-10 rounded-full bg-gold/20 border border-gold/40 text-gold flex items-center justify-center active:scale-90 transition-transform shadow-lg">
                {isPlaying ? <span className="text-[10px] font-bold">||</span> : <span className="ml-0.5 text-sm">▶</span>}
            </button>
            <div className="flex-1 space-y-1">
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gold transition-all duration-100" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
            <audio 
                ref={audioRef} 
                src={url} 
                onTimeUpdate={() => setProgress(audioRef.current ? (audioRef.current.currentTime / audioRef.current.duration) * 100 : 0)} 
                onEnded={onToggle} 
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

const MessageContent = ({ type, content, isPlayingAudio, msgId, onPlayAudio, isMe, isSecret = false }: any) => {
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
                <img src={url} className={`rounded-lg ${isSecret ? 'max-h-96' : 'max-h-64'} w-full object-contain`} referrerPolicy="no-referrer" />
                {caption && <p className={`font-sans ${isSecret ? 'text-lg text-center' : 'text-[15px]'} leading-tight break-words whitespace-pre-wrap`}>{caption}</p>}
            </div>
        );
    }
    return <p className={`font-sans ${isSecret ? 'text-xl text-center leading-relaxed' : 'text-[15px]'} leading-tight break-words whitespace-pre-wrap`}>{content}</p>;
};

const Bubble = memo(({ msg, isMe, onReply, onEdit, onViewOnce, isPlayingAudio, onPlayAudio, onVisible, encryptionKey }: any) => {
    const bubbleRef = useRef<HTMLDivElement>(null);
    const [swipeX, setSwipeX] = useState(0);
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
        return MessageParser.parse(msg.teks);
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
        return (
            <div ref={bubbleRef} className="flex flex-col items-center w-full my-6 px-4 animate-slide-up">
                <div className="w-full max-w-sm">
                    <FateCardDisplay raw={parsed.content} />
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
                    className={`relative flex flex-col p-2.5 shadow-xl transition-all ${
                        isMe 
                        ? 'bg-[#056162] text-white rounded-2xl rounded-tr-none' 
                        : 'bg-[#262d31] text-white rounded-2xl rounded-tl-none'
                    } ${parsed.isVO ? 'bg-red-950/40 border border-red-500/30 text-red-400 cursor-pointer' : ''}`}
                    onClick={() => parsed.isVO && onViewOnce(msg)}
                >
                    {!isMe && (
                        <span className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: identity.color }}>
                            {identity.name}
                        </span>
                    )}

                    {parsed.replyData && (
                        <div 
                            className="mb-2 p-2 rounded bg-black/20 border-l-4 border-gold/50 text-[10px] opacity-80 italic truncate max-w-full cursor-pointer hover:bg-black/40 transition-colors"
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
                            <span className="font-bold text-gold not-italic">{parsed.replyData.name}:</span> {MessageParser.getPreview(parsed.replyData.text)}
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
                            />
                        )}
                        
                        <div className="flex items-center justify-end gap-1 mt-1 self-end opacity-60">
                            {parsed.isEdited && (
                                <span className="text-[8px] italic mr-1">
                                    (diedit)
                                </span>
                            )}
                            <span className="text-[8px] uppercase tracking-tighter">
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && (
                                <span className={`text-[10px] font-bold leading-none ${msg.is_read ? 'text-[#34b7f1]' : 'text-white/40'}`}>
                                    {msg.is_read ? '✓✓' : '✓'}
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
        return safeStorage.get('oracle_unlocked') === 'true' ? 'MAIN' : 'SECURITY';
    });

    const [username, setUsername] = useState(() => safeStorage.get('oracle_user') || '');
    const [avatar, setAvatar] = useState(() => safeStorage.get('oracle_avatar') || '🔮');
    const [userColor, setUserColor] = useState(() => safeStorage.get('oracle_color') || '#D4AF37');
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [isViewOnce, setIsViewOnce] = useState(false);
    const [fateMode, setFateMode] = useState(false);
    const [currentAudioId, setCurrentAudioId] = useState<number | null>(null);
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [editingMsg, setEditingMsg] = useState<any>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [encryptionKey, setEncryptionKey] = useState(() => safeStorage.get('enc_key') || '');
    const [isRecording, setIsRecording] = useState(false);
    const [viewingSecret, setViewingSecret] = useState<any>(null);
    const [pinInput, setPinInput] = useState('');
    const [showChaosPinModal, setShowChaosPinModal] = useState(false);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [chaosPinInput, setChaosPinInput] = useState('');
    const [isChaosUnlocked, setIsChaosUnlocked] = useState(() => {
        try { return sessionStorage.getItem('chaos_unlocked') === 'true'; } catch { return false; }
    });
    const [isUploading, setIsUploading] = useState(false);
    const isUploadingRef = useRef(false);
    const [connStatus, setConnStatus] = useState('OFFLINE');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [oracleEffect, setOracleEffect] = useState(false);

    const [bgmVolume, setBgmVolume] = useState(0.3);
    const [isBgmMuted, setIsBgmMuted] = useState(false);
    const [bgmTrack, setBgmTrack] = useState(0);

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
            if (bgm && !bgm.isPlaying && !bgm.isMuted) {
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
        setBgmTrack(bgmManager.getTrackIndex());
    }, []);

    useEffect(() => {
        if (layer !== 'MAIN') return;

        const initialize = async () => {
            const { data } = await supabaseClient.from('Pesan').select('*').order('id', { ascending: true });
            if (data) setMessages(data);

            connManagerRef.current = new ConnectionManager(supabaseClient, setConnStatus);
            connManagerRef.current.subscribe('msgs', (event: any) => {
                if (event.type === 'INSERT') {
                    const newMsg = event.payload.new;
                        setMessages(prev => [...prev, newMsg]);
                        
                        // Decrypt nama for notifications and effects
                        let decNama = newMsg.nama;
                        try {
                            const encKey = safeStorage.get('enc_key') || '';
                            decNama = CryptoUtils.decrypt(newMsg.nama, encKey);
                        } catch (e) {}

                        // Oracle Effect
                        if (decNama === "ORACLE") {
                            setOracleEffect(true);
                            setTimeout(() => setOracleEffect(false), 1000);
                            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                        }

                        // Notification logic
                        const isBackground = document.hidden || !document.hasFocus();
                        if (isBackground && decNama.split('|')[0] !== username && !decNama.startsWith('🔒')) {
                            const settings = notifSettingsRef.current;
                            if (settings.mode === 'mute') return;

                            let decTeks = newMsg.teks;
                            try {
                                const encKey = safeStorage.get('enc_key') || '';
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

                            if (Notification.permission === 'granted') {
                                const senderName = decNama.split('|')[0];
                                pendingNotifsRef.current[senderName] = (pendingNotifsRef.current[senderName] || 0) + 1;

                                if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);

                                notifTimeoutRef.current = setTimeout(() => {
                                    navigator.serviceWorker.ready.then(registration => {
                                        const senders = Object.keys(pendingNotifsRef.current);
                                        if (senders.length === 0) return;

                                        let title = '';
                                        let body = '';
                                        const previewText = MessageParser.getPreview(newMsg.teks) || (decTeks.startsWith('[') ? 'Mengirim media...' : decTeks);

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
                                        });

                                        pendingNotifsRef.current = {};
                                    });
                                }, settings.cooldown * 1000);
                            }
                        }
                    } else if (event.type === 'UPDATE') {
                        setMessages(prev => prev.map(m => m.id === event.payload.new.id ? event.payload.new : m));
                    } else if (event.type === 'TYPING') {
                        let typer = event.payload.payload.user;
                        try {
                            const encKey = safeStorage.get('enc_key') || '';
                            typer = CryptoUtils.decrypt(typer, encKey);
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
                const { data } = await supabaseClient.from('Pesan').select('*').order('id', { ascending: true });
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
            let decNama = m.nama;
            try {
                decNama = CryptoUtils.decrypt(m.nama, encryptionKey);
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
        if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }, [filteredMessages]);

    const handleTyping = () => {
        if (typingTimeoutRef.current) return;
        
        if (connManagerRef.current && connManagerRef.current.channel) {
            const encKey = safeStorage.get('enc_key') || '';
            const encUser = CryptoUtils.encrypt(username, encKey);
            connManagerRef.current.channel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { user: encUser }
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
                    const parsed = MessageParser.parse(editingMsg.teks);
                    if (parsed.replyData) {
                        teks = `[REPLY:${JSON.stringify(parsed.replyData)}]${teks}`;
                    }
                }
            } else if (editingMsg) {
                const parsed = MessageParser.parse(editingMsg.teks);
                if (parsed.type === 'img') {
                    const url = parsed.content.split('\n')[0];
                    teks = teks.trim() ? `[IMG]${url}\n${teks}` : `[IMG]${url}`;
                }
                if (parsed.replyData) {
                    teks = `[REPLY:${JSON.stringify(parsed.replyData)}]${teks}`;
                }
            }

            if (replyingTo) {
                const context = MessageParser.createReplyContext(replyingTo);
                teks = `[REPLY:${JSON.stringify(context)}]${teks}`;
            }

            if (isViewOnce) teks = `[VO]${teks}`;
            
            if (editingMsg) {
                if (!teks.endsWith("[EDITED]")) {
                    teks = `${teks} [EDITED]`;
                }
                const encKey = safeStorage.get('enc_key') || '';
                const finalTeks = CryptoUtils.encrypt(teks, encKey);
                await supabaseClient.from('Pesan').update({ teks: finalTeks }).eq('id', editingMsg.id);
                setEditingMsg(null);
                showToast("Pesan diperbarui", "success");
            } else {
                const encKey = safeStorage.get('enc_key') || '';
                const finalTeks = CryptoUtils.encrypt(teks, encKey);
                const finalNama = CryptoUtils.encrypt(nama, encKey);
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
                const encKey = safeStorage.get('enc_key') || '';
                const finalTeks = CryptoUtils.encrypt(`[VN]${publicUrl}`, encKey);
                const finalNama = CryptoUtils.encrypt(nama, encKey);
                await supabaseClient.from('Pesan').insert([{ nama: finalNama, teks: finalTeks }]);
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
        const parsed = MessageParser.parse(msg.teks);
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

        const encKey = safeStorage.get('enc_key') || '';
        const finalTeks = CryptoUtils.encrypt(payload, encKey);
        const finalNama = CryptoUtils.encrypt('ORACLE', encKey);

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
        const parsed = MessageParser.parse(msg.teks);
        setViewingSecret({ ...msg, ...parsed });
        
        // Burn logic
        setTimeout(() => {
            supabaseClient.from('Pesan').delete().eq('id', msg.id).then(() => {
                setMessages(prev => prev.filter(m => m.id !== msg.id));
                setViewingSecret(null);
            });
        }, 10000); // 10 seconds to view
    }, []);

    const handleDeleteHistory = async () => {
        setShowDeleteConfirmModal(false);
        try {
            // 1. Ambil semua pesan untuk mencari file media
            const { data: messagesToDelete } = await supabaseClient.from('Pesan').select('teks');
            
            if (messagesToDelete && messagesToDelete.length > 0) {
                const buktiFilesToRemove: string[] = [];
                const vnFilesToRemove: string[] = [];
                
                messagesToDelete.forEach(msg => {
                    const parsed = MessageParser.parse(msg.teks);
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
            const { error } = await supabaseClient.from('Pesan').delete().neq('id', 0);
            if (error) throw error;
            
            setMessages([]);
            showToast("Riwayat pesan dan media telah dibersihkan.", "success");
            setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
            showToast("Gagal menghapus: " + err.message, "error");
        }
    };

    if (layer === 'AGE') return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-center p-4 animate-fade-in">
            <h1 className="font-header text-2xl text-gold tracking-[8px] mb-4">VERIFIKASI USIA</h1>
            <p className="font-mystic text-lg mb-8 max-w-sm">Konfirmasi usia Anda.</p>
            <div className="flex gap-4">
                <button onClick={() => { safeStorage.set('oracle_adult', 'true'); setLayer('NAME'); }} className="px-8 py-2 bg-gold text-black font-bold rounded-lg shadow-lg">SAYA 18+</button>
                <button onClick={() => window.location.href = 'https://google.com'} className="px-8 py-2 bg-gray-700 text-white rounded-lg">Keluar</button>
            </div>
        </div>
    );

    if (layer === 'NAME') return (
        <div className="fixed inset-0 bg-[#111b21] flex flex-col items-center justify-center text-center p-6 animate-fade-in">
            <h1 className="font-header text-3xl text-gold tracking-[10px] mb-8 drop-shadow-lg">IDENTITAS</h1>
            
            <div className="relative w-32 h-32 mb-8 rounded-full bg-[#2a2f32] border-2 border-gold/50 flex items-center justify-center overflow-hidden group shadow-2xl">
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
            </div>

            <div className="w-full max-w-xs flex flex-col gap-4 mb-8">
                <div className="relative">
                    <input 
                        type="text" 
                        value={username} 
                        onChange={e => setUsername(e.target.value)} 
                        placeholder="Nama Panggilan" 
                        className="w-full bg-[#2a2f32] text-white text-center p-4 rounded-xl border border-white/10 focus:border-gold/50 outline-none transition-all shadow-inner placeholder:text-white/30 font-medium" 
                    />
                </div>
                
                <div className="flex gap-4 items-center justify-center bg-[#2a2f32] p-4 rounded-xl border border-white/10 shadow-md">
                    <span className="text-xs text-white/50 uppercase tracking-widest font-bold">Warna Tema</span>
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 shadow-lg cursor-pointer">
                        <input type="color" value={userColor} onChange={e => setUserColor(e.target.value)} className="absolute -inset-4 w-20 h-20 cursor-pointer" />
                    </div>
                </div>

                <div className="flex gap-2 text-2xl justify-center flex-wrap bg-[#2a2f32] p-4 rounded-xl border border-white/10 shadow-md">
                    {['🔮', '👻', '💀', '👽', '🦊', '🦉', '🦋', '🕸️'].map(emoji => (
                        <button key={emoji} onClick={() => setAvatar(emoji)} className="hover:scale-125 transition-transform p-1">{emoji}</button>
                    ))}
                </div>
            </div>

            <button 
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
                className={`w-full max-w-xs px-10 py-4 bg-gradient-to-r from-gold/80 to-gold text-black font-bold rounded-full shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all tracking-widest uppercase ${isUploading || !username.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {isUploading ? 'Menyimpan...' : 'Lanjutkan'}
            </button>
        </div>
    );

    if (layer === 'SECURITY') return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-center p-4 animate-fade-in">
            <h1 className="font-header text-2xl text-gold tracking-[8px] mb-4">AKSES</h1>
            <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} className="bg-white/10 text-center p-2 rounded-lg mb-4 w-64 tracking-[8px]" />
            <button onClick={() => {
                if (pinInput === '179' || pinInput === '010304') {
                    safeStorage.set('oracle_unlocked', 'true');
                    setLayer('MAIN');
                } else showToast('PIN salah.', "error");
            }} className="px-8 py-2 bg-gold text-black font-bold rounded-lg shadow-lg">Buka</button>
        </div>
    );

    return (
        <motion.div 
            animate={oracleEffect ? { x: [-5, 5, -5, 5, 0], y: [-2, 2, -2, 2, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="h-[100dvh] w-full bg-void flex flex-col font-sans text-sm text-white/90 overflow-hidden overflow-x-hidden supports-[height:100dvh]:h-[100dvh]"
        >
            <header className="flex items-center justify-between p-3 border-b border-white/10 bg-black/40 backdrop-blur-md z-50 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-lg font-header text-gold">O</div>
                    <div>
                        <h1 className="font-bold text-base">Oracle Chamber</h1>
                        <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${connStatus === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">{connStatus}</p>
                        </div>
                    </div>
                </div>
                <button onClick={() => setShowMenu(!showMenu)} className="text-2xl opacity-60">⋮</button>
            </header>

            <main ref={feedRef as any} className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {filterType !== 'all' && (
                    <div className="sticky top-0 z-30 bg-black/80 backdrop-blur p-2 mb-4 rounded-lg border border-gold/20 flex justify-between items-center animate-fade-in">
                        <span className="text-xs text-gold uppercase tracking-widest">
                            Filter: {filterType === 'unread' ? 'Belum Dibaca' : `Sender: ${filterSender}`}
                        </span>
                        <button onClick={() => { setFilterType('all'); setFilterSender(''); }} className="text-xs text-white/50 hover:text-white">CLEAR</button>
                    </div>
                )}
                {filteredMessages.map(msg => (
                    <Bubble 
                        key={msg.id} 
                        msg={msg} 
                        isMe={msg.nama.split('|')[0] === username} 
                        onReply={setReplyingTo} 
                        onEdit={handleStartEdit}
                        onViewOnce={handleViewOnce}
                        isPlayingAudio={currentAudioId === msg.id} 
                        onPlayAudio={setCurrentAudioId}
                        onVisible={handleMessageVisible}
                        encryptionKey={encryptionKey}
                    />
                ))}
                {filteredMessages.length === 0 && (
                    <div className="text-center py-10 opacity-30 italic font-mystic">
                        Tidak ada pesan yang ditemukan dalam takdir ini...
                    </div>
                )}
            </main>

            <AnimatePresence>
                {toast && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl border backdrop-blur-xl flex items-center gap-3 ${
                            toast.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-200' : 
                            toast.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-200' : 
                            'bg-gold/20 border-gold/50 text-gold'
                        }`}
                    >
                        <span className="text-sm font-medium tracking-wide">{toast.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <footer className="p-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-black/60 border-t border-white/10 backdrop-blur-xl z-40 shrink-0">
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
                        <div className="text-xs italic truncate opacity-70">
                            Replying to <span className="font-bold text-gold">{replyingTo.nama.split('|')[0]}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setReplyingTo(null); }} className="text-lg opacity-50 hover:opacity-100">×</button>
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
                    <div className="px-4 py-1 text-[10px] text-gold/70 italic animate-pulse">
                        {Array.from(typingUsers).join(', ')} is typing...
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <button onClick={() => setFateMode(!fateMode)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${fateMode ? 'bg-gold text-black' : 'bg-white/10'}`}>
                        <span className="font-header text-xl">?</span>
                    </button>
                    <div className="flex-1 relative flex items-end">
                        <textarea 
                            ref={textareaRef}
                            value={inputText} 
                            onChange={e => { 
                                setInputText(e.target.value); 
                                handleTyping(); 
                                e.target.style.height = '48px';
                                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                            }}
                            placeholder="Kirim pesan..." 
                            className="w-full min-h-[48px] max-h-[120px] bg-white/5 rounded-[24px] px-5 py-3 pr-12 outline-none focus:ring-1 ring-gold/30 transition-all resize-none overflow-y-auto"
                            rows={1}
                            style={{ height: '48px' }}
                        />
                        <label className="absolute right-4 bottom-3 cursor-pointer opacity-40 hover:opacity-100">
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*" />
                            📎
                        </label>
                    </div>
                    <button 
                        onMouseDown={!(inputText.trim() || selectedFile) ? startRecording : undefined}
                        onMouseUp={!(inputText.trim() || selectedFile) ? stopRecording : undefined}
                        onMouseLeave={!(inputText.trim() || selectedFile) ? stopRecording : undefined}
                        onTouchStart={!(inputText.trim() || selectedFile) ? startRecording : undefined}
                        onTouchEnd={!(inputText.trim() || selectedFile) ? stopRecording : undefined}
                        onClick={(inputText.trim() || selectedFile) ? handleSend : undefined}
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all select-none ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gold text-black'}`}
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
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6 animate-fade-in" onClick={() => setFateMode(false)}>
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
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex flex-col items-center justify-center p-6 animate-fade-in" onClick={() => setShowDeleteConfirmModal(false)}>
                    <div className="w-full max-w-xs space-y-4 bg-zinc-900 border border-red-500/50 rounded-2xl p-6 text-center" onClick={e => e.stopPropagation()}>
                        <div className="text-4xl mb-2">⚠️</div>
                        <h2 className="font-header text-red-500 text-xl tracking-[4px]">PERINGATAN</h2>
                        <p className="text-xs text-white/70 leading-relaxed">
                            Ini akan menghapus SEMUA pesan di database secara permanen beserta file media (Gambar & VN). Tindakan ini tidak dapat dibatalkan. Lanjutkan?
                        </p>
                        <div className="flex gap-3 pt-4">
                            <button onClick={() => setShowDeleteConfirmModal(false)} className="flex-1 py-2 rounded-lg bg-white/10 text-white text-xs font-bold tracking-widest uppercase hover:bg-white/20 transition-colors">Batal</button>
                            <button onClick={handleDeleteHistory} className="flex-1 py-2 rounded-lg bg-red-500/20 text-red-500 border border-red-500/50 text-xs font-bold tracking-widest uppercase hover:bg-red-500/40 transition-colors">Hapus</button>
                        </div>
                    </div>
                </div>
            )}

            {showChaosPinModal && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex flex-col items-center justify-center p-6 animate-fade-in">
                    <div className="w-full max-w-xs space-y-6 text-center">
                        <h2 className="font-header text-red-500 text-xl tracking-[8px] animate-pulse">RESTRICTED AREA</h2>
                        <p className="text-xs text-white/50 uppercase tracking-widest">Masukkan kode akses untuk membuka Chaos Mode</p>
                        <input 
                            type="password" 
                            value={chaosPinInput} 
                            onChange={e => setChaosPinInput(e.target.value)} 
                            className="w-full bg-white/10 text-center p-3 rounded-lg tracking-[8px] text-gold outline-none focus:ring-1 ring-red-500/50"
                            placeholder="••••••"
                            onKeyDown={e => e.key === 'Enter' && handleChaosPinSubmit()}
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setShowChaosPinModal(false); setChaosPinInput(''); }} className="flex-1 p-3 rounded-lg border border-white/10 text-white/50 hover:bg-white/5 transition-all text-xs uppercase tracking-widest">Batal</button>
                            <button onClick={handleChaosPinSubmit} className="flex-1 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 font-bold hover:bg-red-500/30 transition-all text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.2)]">Buka</button>
                        </div>
                    </div>
                </div>
            )}

            {viewingSecret && (
                <div className="fixed inset-0 bg-black/98 z-[200] flex items-center justify-center p-8 animate-fade-in" onClick={() => setViewingSecret(null)}>
                    <div className="text-center space-y-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                        <div className="text-red-500 font-header tracking-[8px] uppercase animate-pulse">Secret Revealed</div>
                        <div className="bg-white/5 p-6 rounded-3xl border border-red-500/20">
                            <MessageContent 
                                type={viewingSecret.type} 
                                content={viewingSecret.content} 
                                msgId="secret" 
                                isPlayingAudio={currentAudioId === "secret"} 
                                onPlayAudio={setCurrentAudioId} 
                                isSecret={true}
                            />
                        </div>
                        <div className="text-[10px] text-white/20 uppercase tracking-widest">Pesan ini akan terbakar selamanya...</div>
                    </div>
                </div>
            )}

            {isUploading && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gold text-black px-4 py-2 rounded-full text-xs font-bold shadow-2xl z-[300] animate-bounce">
                    TRANSMITTING...
                </div>
            )}

            {showMenu && (
                <div className="fixed inset-0 z-[150]" onClick={() => setShowMenu(false)}>
                    <div className="absolute top-16 right-4 w-64 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl py-2 animate-fade-in" onClick={e => e.stopPropagation()}>
                        {updateAvailable && (
                            <button onClick={() => window.location.reload()} className="w-full text-left px-4 py-3 text-xs uppercase tracking-widest hover:bg-white/5 text-green-400 border-b border-white/5 font-bold animate-pulse">
                                🔄 Update Tersedia (Klik)
                            </button>
                        )}
                        {isIOS && (
                            <div className="px-4 py-3 text-xs uppercase tracking-widest text-gold border-b border-white/5">
                                📱 Install: Tap Share → Add to Home Screen
                            </div>
                        )}
                        {/* Always show install button for debugging, but handle the case where deferredPrompt is null */}
                        <button onClick={async () => {
                            if (deferredPrompt) {
                                deferredPrompt.prompt();
                                const { outcome } = await deferredPrompt.userChoice;
                                if (outcome === 'accepted') setDeferredPrompt(null);
                            } else {
                                showToast("Gunakan menu browser untuk install (Add to Home Screen)", "info");
                            }
                        }} className="w-full text-left px-4 py-3 text-xs uppercase tracking-widest hover:bg-white/5 text-gold border-b border-white/5 font-bold animate-pulse">
                            ⬇️ Install Aplikasi
                        </button>
                        <div className="px-4 py-3 border-b border-white/5">
                            <div className="text-[10px] uppercase tracking-widest opacity-50 mb-2">Background Music</div>
                            <select 
                                value={bgmTrack} 
                                onChange={e => setBgmTrack(parseInt(e.target.value))}
                                className="w-full p-2 mb-3 rounded text-xs bg-white/5 border border-white/10 outline-none text-white"
                            >
                                {AVAILABLE_BGMS.map((track, idx) => (
                                    <option key={track.id} value={idx} className="bg-black text-white">{track.name}</option>
                                ))}
                            </select>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setIsBgmMuted(!isBgmMuted)} className="text-xl">
                                    {isBgmMuted ? '🔇' : '🔊'}
                                </button>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.1" 
                                    value={bgmVolume} 
                                    onChange={e => setBgmVolume(parseFloat(e.target.value))} 
                                    className="w-full accent-gold h-1 bg-white/10 rounded-full appearance-none"
                                />
                            </div>
                        </div>
                        <div className="px-4 py-3 border-b border-white/5">
                            <div className="text-[10px] uppercase tracking-widest opacity-50 mb-2">Keamanan Ruangan</div>
                            <input 
                                type="password" 
                                placeholder="Kunci Enkripsi (Opsional)" 
                                value={encryptionKey}
                                onChange={e => {
                                    setEncryptionKey(e.target.value);
                                    safeStorage.set('enc_key', e.target.value);
                                }}
                                className="w-full p-2 rounded text-xs bg-white/5 border border-white/10 outline-none focus:border-gold transition-colors text-white"
                            />
                            <div className="text-[8px] opacity-50 mt-1">Gunakan kunci yang sama dengan teman untuk membaca pesan rahasia.</div>
                        </div>
                        <div className="px-4 py-3 border-b border-white/5">
                            <div className="text-[10px] uppercase tracking-widest opacity-50 mb-2">Filter Chat</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setFilterType('unread')} className={`p-2 rounded text-xs border ${filterType === 'unread' ? 'bg-gold text-black border-gold' : 'bg-white/5 border-white/10'}`}>Belum Dibaca</button>
                                <select 
                                    onChange={e => { setFilterType('sender'); setFilterSender(e.target.value); }} 
                                    className="p-2 rounded text-xs bg-white/5 border border-white/10 outline-none"
                                    value={filterSender}
                                >
                                    <option value="">Pilih Pengirim</option>
                                    {uniqueSenders.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="px-4 py-3 border-t border-white/5 bg-white/5">
                            <div className="text-[10px] uppercase tracking-widest text-gold font-bold mb-2">Notifikasi & Privasi</div>
                            <div className="space-y-2">
                                <button onClick={async () => {
                                    const permission = await Notification.requestPermission();
                                    if (permission === 'granted') {
                                        showToast("Izin Notifikasi Diberikan!", "success");
                                    } else {
                                        showToast("Izin ditolak. Jika di iOS, gunakan 'Add to Home Screen'.", "error");
                                    }
                                }} className="w-full text-left py-1 text-xs opacity-80 hover:opacity-100 transition-opacity">🔔 Minta Izin Notifikasi</button>
                                
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] opacity-60">Mode Notifikasi</label>
                                    <select 
                                        className="bg-black/50 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-gold/50"
                                        value={notifSettings.mode}
                                        onChange={(e) => setNotifSettings(prev => ({ ...prev, mode: e.target.value as any }))}
                                    >
                                        <option value="all">Semua Pesan</option>
                                        <option value="mention">Hanya Mention (@nama)</option>
                                        <option value="mute">Senyap (Mute)</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] opacity-60">Anti-Spam (Grup Notifikasi)</label>
                                    <select 
                                        className="bg-black/50 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-gold/50"
                                        value={notifSettings.cooldown}
                                        onChange={(e) => setNotifSettings(prev => ({ ...prev, cooldown: parseInt(e.target.value) }))}
                                    >
                                        <option value="2">Cepat (2 Detik)</option>
                                        <option value="10">Sedang (10 Detik)</option>
                                        <option value="30">Lambat (30 Detik)</option>
                                        <option value="60">Sangat Lambat (1 Menit)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div className="px-4 py-3 border-t border-white/5 bg-white/5">
                            <div className="text-[10px] uppercase tracking-widest text-gold font-bold mb-2">Maintenance & System</div>
                            <div className="grid grid-cols-1 gap-1">
                                <button onClick={() => {
                                    showToast("Membersihkan cache...", "info");
                                    if ('serviceWorker' in navigator) {
                                        caches.keys().then(names => {
                                            for (let name of names) caches.delete(name);
                                        });
                                    }
                                    setTimeout(() => window.location.reload(), 1000);
                                }} className="text-left py-1 text-[10px] opacity-60 hover:opacity-100 transition-opacity">🛠️ Clear System Cache</button>
                                <button onClick={() => {
                                    const status = connStatus === 'ONLINE' ? "Koneksi Stabil" : "Koneksi Bermasalah";
                                    showToast(`Status: ${status}`, connStatus === 'ONLINE' ? "success" : "error");
                                }} className="text-left py-1 text-[10px] opacity-60 hover:opacity-100 transition-opacity">📡 Check Connection</button>
                            </div>
                        </div>

                        <button onClick={() => setShowDeleteConfirmModal(true)} className="w-full text-left px-4 py-3 text-xs uppercase tracking-widest hover:bg-white/5 text-red-400 border-t border-white/5">🗑️ Hapus Riwayat</button>
                        <button onClick={() => {
                            localStorage.clear();
                            sessionStorage.clear();
                            window.location.reload();
                        }} className="w-full text-left px-4 py-3 text-xs uppercase tracking-widest hover:bg-white/5 text-red-400">🚪 Reset Identitas</button>
                        <div className="px-4 py-2 text-[8px] text-white/20 text-center uppercase tracking-widest border-t border-white/5">
                            v1.4.0 • Maintenance Mode
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

export default App;
