import { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Reply } from 'lucide-react';

import { ConnectionManager } from './utils/ConnectionManager';

// --- CONSTANTS & UTILS ---
const SUPA_URL = import.meta.env.VITE_SUPA_URL || (window as any).ORACLE_CONFIG?.SUPA_URL;
const SUPA_KEY = import.meta.env.VITE_SUPA_KEY || (window as any).ORACLE_CONFIG?.SUPA_KEY;

if (!SUPA_URL || !SUPA_KEY) {
    console.error("Supabase configuration missing! Check environment variables.");
}

const supabaseClient = createClient(SUPA_URL, SUPA_KEY);

const safeStorage = {
    get: (key: string) => {
        try { return localStorage.getItem(key); } catch { return null; }
    },
    set: (key: string, value: string) => {
        try { localStorage.setItem(key, value); } catch { }
    }
};

const uploadImage = async (file: File) => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;
        
        console.log(`Uploading image to 'bukti' bucket: ${filePath}`);
        
        const { error } = await supabaseClient.storage.from('bukti').upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });
        
        if (error) {
            console.error("Supabase Storage Error:", error);
            if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
                throw new Error("Koneksi gagal (Fetch Failed). Pastikan bucket 'bukti' sudah dibuat dan memiliki policy publik.");
            }
            throw new Error(error.message);
        }
        
        const { data: { publicUrl } } = supabaseClient.storage.from('bukti').getPublicUrl(filePath);
        return publicUrl;
    } catch (err: any) {
        console.error("uploadImage Exception:", err);
        throw err;
    }
};

// --- COMPONENTS ---

const AudioPlayer = ({ url, isPlaying, onToggle }: { url: string, isPlaying: boolean, onToggle: () => void }) => {
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (isPlaying) {
            audioRef.current?.play().catch(() => onToggle());
            if ((window as any).BGMManager) (window as any).BGMManager.onVoiceNotePlay();
        } else {
            audioRef.current?.pause();
            if ((window as any).BGMManager) (window as any).BGMManager.onVoiceNoteEnd();
        }
    }, [isPlaying, onToggle]);

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

const MessageContent = ({ type, content, currentAudioId, msgId, onPlayAudio, isMe, isSecret = false }: any) => {
    // Robust detection: if type is vn OR content starts with [VN] (fallback for parser delay)
    if (type === "vn" || (typeof content === 'string' && content.startsWith("[VN]"))) {
        const url = type === "vn" ? content : content.substring(4).trim();
        return <AudioPlayer url={url} isPlaying={currentAudioId === msgId} onToggle={() => onPlayAudio(currentAudioId === msgId ? null : msgId)} />;
    }

    if (type === "img" || (typeof content === 'string' && content.startsWith("[IMG]"))) {
        const rawContent = type === "img" ? content : content.substring(5).trim();
        const parts = rawContent.split("\n");
        const url = parts[0];
        const caption = parts.slice(1).join("\n");
        return (
            <div className="flex flex-col gap-2">
                <img src={url} className={`rounded-lg ${isSecret ? 'max-h-96' : 'max-h-64'} w-full object-contain`} referrerPolicy="no-referrer" />
                {caption && <p className={`font-sans ${isSecret ? 'text-lg text-center' : 'text-[15px] pr-12'} leading-tight break-words whitespace-pre-wrap`}>{caption}</p>}
            </div>
        );
    }
    return <p className={`font-sans ${isSecret ? 'text-xl text-center leading-relaxed' : 'text-[15px] pr-12'} leading-tight break-words whitespace-pre-wrap`}>{content}</p>;
};

const Bubble = ({ msg, isMe, onReply, onEdit, onViewOnce, currentAudioId, onPlayAudio, onVisible }: any) => {
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
        }, { threshold: 0.8 });
        observer.observe(bubbleRef.current);
        return () => observer.disconnect();
    }, [msg.id, isMe, msg.is_read, onVisible]);

    const parsed = useMemo(() => {
        if (!(window as any).MessageParser) return { type: 'text', content: msg.teks, isVO: false, replyData: null };
        return (window as any).MessageParser.parse(msg.teks);
    }, [msg.teks]);
    
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
            <div ref={bubbleRef} className="flex flex-col items-center w-full my-6 px-4 animate-fade-in">
                <div className="w-full max-w-sm">
                    <FateCardDisplay raw={parsed.content} />
                </div>
            </div>
        );
    }

    return (
        <div 
            ref={bubbleRef}
            className={`flex w-full mb-3 animate-fade-in relative px-3 ${isMe ? 'justify-end' : 'justify-start'}`}
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
                    <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm shrink-0 mb-1 avatar-animate shadow-lg">
                        {identity.avatar}
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
                        <div className="mb-2 p-2 rounded bg-black/20 border-l-4 border-gold/50 text-[10px] opacity-80 italic truncate max-w-full">
                            <span className="font-bold text-gold not-italic">{parsed.replyData.name}:</span> {(window as any).MessageParser?.getPreview(parsed.replyData.text)}
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
                                currentAudioId={currentAudioId} 
                                onPlayAudio={onPlayAudio} 
                                isMe={isMe} 
                            />
                        )}
                        
                        <div className="flex items-center justify-end gap-1 mt-1 self-end opacity-60">
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
};

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
    const [isRecording, setIsRecording] = useState(false);
    const [viewingSecret, setViewingSecret] = useState<any>(null);
    const [pinInput, setPinInput] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [connStatus, setConnStatus] = useState('OFFLINE');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [oracleEffect, setOracleEffect] = useState(false);

    const [bgmVolume, setBgmVolume] = useState(0.3);
    const [isBgmMuted, setIsBgmMuted] = useState(false);

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

    const [unreadCount, setUnreadCount] = useState(0);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const notificationAudioRef = useRef<HTMLAudioElement>(new Audio('https://rruxlxoeelxjjjmhafkc.supabase.co/storage/v1/object/public/suara/notification.mp3')); // Placeholder or use a real URL

    // Smart BGM Autoplay Logic
    useEffect(() => {
        const handleInteraction = () => {
            const bgm = (window as any).BGMManager;
            if (bgm && !bgm.isPlaying && !bgm.isMuted) {
                bgm.play();
            }
        };

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                setUnreadCount(0);
                if ('setAppBadge' in navigator) navigator.clearAppBadge();
            }
        };

        window.addEventListener('click', handleInteraction);
        window.addEventListener('touchstart', handleInteraction);
        window.addEventListener('keydown', handleInteraction);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        const handleBeforeInstallPrompt = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
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
        const bgm = (window as any).BGMManager;
        if (bgm) {
            bgm.setVolume(bgmVolume);
            bgm.mute(isBgmMuted);
        }
    }, [bgmVolume, isBgmMuted]);

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
                        
                        // Oracle Effect
                        if (newMsg.nama === "ORACLE") {
                            setOracleEffect(true);
                            setTimeout(() => setOracleEffect(false), 1000);
                            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                        }

                        // Notification logic
                        if (document.hidden && newMsg.nama.split('|')[0] !== username) {
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

                            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                                const previewText = (window as any).MessageParser 
                                    ? (window as any).MessageParser.getPreview(newMsg.teks)
                                    : (newMsg.teks.startsWith('[') ? 'Mengirim media...' : newMsg.teks);

                                navigator.serviceWorker.controller.postMessage({
                                    type: 'SHOW_NOTIFICATION',
                                    payload: {
                                        title: `Pesan dari ${newMsg.nama.split('|')[0]}`,
                                        text: previewText,
                                        icon: newMsg.nama.split('|')[1] || 'https://cdn-icons-png.flaticon.com/512/1684/1684426.png',
                                        tag: 'oracle-group'
                                    }
                                });
                            }
                        }
                    } else if (event.type === 'UPDATE') {
                        setMessages(prev => prev.map(m => m.id === event.payload.new.id ? event.payload.new : m));
                    } else if (event.type === 'TYPING') {
                        const typer = event.payload.payload.user;
                        if (typer && typer !== username) {
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

        initialize();
        if ((window as any).AudioManager) audioManagerRef.current = new (window as any).AudioManager();
        if ((window as any).BGMManager) {
            (window as any).BGMManager.play();
            (window as any).BGMManager.setVolume(bgmVolume);
        }

        return () => {
            if (connManagerRef.current) connManagerRef.current.cleanup();
        };
    }, [layer, username]);

    const filteredMessages = useMemo(() => {
        if (filterType === 'unread') return messages.filter(m => !m.is_read && m.nama.split('|')[0] !== username);
        if (filterType === 'sender' && filterSender) return messages.filter(m => m.nama.split('|')[0] === filterSender);
        return messages;
    }, [messages, filterType, filterSender, username]);

    const uniqueSenders = useMemo(() => {
        const senders = new Set(messages.map(m => m.nama.split('|')[0]));
        return Array.from(senders).filter(s => s !== username && s !== 'ORACLE');
    }, [messages, username]);

    useEffect(() => {
        if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }, [filteredMessages]);

    const handleTyping = () => {
        if (typingTimeoutRef.current) return;
        
        if (connManagerRef.current && connManagerRef.current.channel) {
            connManagerRef.current.channel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { user: username }
            });
            
            typingTimeoutRef.current = setTimeout(() => {
                typingTimeoutRef.current = null;
            }, 1000);
        }
    };

    const handleSend = async () => {
        if (!inputText.trim() && !selectedFile) return;
        
        setIsUploading(true);
        try {
            const nama = `${username}|${avatar}|${userColor}`;
            let teks = inputText;

            if (selectedFile) {
                if ((window as any).BGMManager) (window as any).BGMManager.onImageSend();
                const url = await uploadImage(selectedFile);
                teks = teks.trim() ? `[IMG]${url}\n${teks}` : `[IMG]${url}`;
                setSelectedFile(null);
            }

            if (replyingTo) {
                const context = (window as any).MessageParser.createReplyContext(replyingTo);
                teks = `[REPLY:${JSON.stringify(context)}]${teks}`;
            }

            if (isViewOnce) teks = `[VO]${teks}`;
            
            if (editingMsg) {
                // Keep the original tags if they were there? 
                // Actually, if we edit, we might want to re-apply the current state of VO/Reply
                // But usually edit is just for the text.
                // Let's re-apply the current UI state (isViewOnce, etc) to the edited text.
                await supabaseClient.from('Pesan').update({ teks }).eq('id', editingMsg.id);
                setEditingMsg(null);
            } else {
                await supabaseClient.from('Pesan').insert([{ nama, teks }]);
            }

            setInputText('');
            setIsViewOnce(false);
            setReplyingTo(null);
        } catch (err: any) {
            alert(`Gagal mengirim: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleVoiceNote = async () => {
        if (!isRecording) {
            try {
                await audioManagerRef.current.startRecording();
                setIsRecording(true);
                if ((window as any).BGMManager) (window as any).BGMManager.onVoiceNoteStart();
            } catch (e) { alert("Gagal akses mic"); }
        } else {
            setIsRecording(false);
            const blob = await audioManagerRef.current.stopRecording();
            if ((window as any).BGMManager) (window as any).BGMManager.onVoiceNoteStop();
            
            if (blob) {
                setIsUploading(true);
                try {
                    const fileName = `vn-${Date.now()}.mp4`;
                    const { error } = await supabaseClient.storage.from('bukti').upload(`audio/${fileName}`, blob);
                    if (error) throw error;
                    const { data: { publicUrl } } = supabaseClient.storage.from('bukti').getPublicUrl(`audio/${fileName}`);
                    
                    const nama = `${username}|${avatar}|${userColor}`;
                    await supabaseClient.from('Pesan').insert([{ nama, teks: `[VN]${publicUrl}` }]);
                } catch (e) { alert("Gagal kirim VN"); }
                finally { setIsUploading(false); }
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setSelectedFile(file);
    };

    const handleStartEdit = (msg: any) => {
        const parsed = (window as any).MessageParser.parse(msg.teks);
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
    };

    const handleDrawFate = async (category: string) => {
        if (category === 'chaos') {
            const pin = prompt("Masukkan PIN Chaos Mode:");
            if (pin !== '131201') {
                if (navigator.vibrate) navigator.vibrate(200);
                alert("Akses Ditolak. PIN Salah.");
                return;
            }
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        }

        if ((window as any).BGMManager) (window as any).BGMManager.onFateCardDraw();

        const deck = (window as any).GAME_DECK[category];
        const isWildcard = Math.random() < deck.wildcardChance;
        const type = isWildcard ? 'wildcard' : (Math.random() < 0.5 ? 'truth' : 'dare');
        const pool = deck[type];
        const content = pool[Math.floor(Math.random() * pool.length)];
        
        const payload = JSON.stringify({
            content: `${category.toUpperCase()} ${type.toUpperCase()}: ${content}`,
            invoker: username
        });

        await supabaseClient.from('Pesan').insert([{ nama: 'ORACLE', teks: payload }]);
        setFateMode(false);
    };

    const handleViewOnce = (msg: any) => {
        const parsed = (window as any).MessageParser.parse(msg.teks);
        setViewingSecret({ ...msg, ...parsed });
        
        // Burn logic
        setTimeout(() => {
            supabaseClient.from('Pesan').delete().eq('id', msg.id).then(() => {
                setMessages(prev => prev.filter(m => m.id !== msg.id));
                setViewingSecret(null);
            });
        }, 10000); // 10 seconds to view
    };

    const handleDeleteHistory = async () => {
        if (confirm("⚠️ PERINGATAN: Ini akan menghapus SEMUA pesan di database secara permanen. Lanjutkan?")) {
            const { error } = await supabaseClient.from('Pesan').delete().neq('id', 0);
            if (error) alert("Gagal menghapus: " + error.message);
            else {
                setMessages([]);
                alert("Riwayat telah dibersihkan.");
                window.location.reload();
            }
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
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-center p-4 animate-fade-in">
            <h1 className="font-header text-2xl text-gold tracking-[8px] mb-4">IDENTITAS</h1>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Nama..." className="bg-white/10 text-center p-2 rounded-lg mb-4 w-64" />
            
            <div className="flex flex-col gap-2 mb-6 items-center">
                <div className="flex gap-2">
                    <input type="text" value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="Avatar..." className="bg-white/10 text-center p-2 rounded-lg w-20" />
                    <input type="color" value={userColor} onChange={e => setUserColor(e.target.value)} className="w-20 h-10 rounded-lg" />
                </div>
                <div className="flex gap-2 text-xl">
                    {['🔮', '👻', '💀', '👽', '🦊', '🦉', '🦋', '🕸️'].map(emoji => (
                        <button key={emoji} onClick={() => setAvatar(emoji)} className="hover:scale-125 transition-transform">{emoji}</button>
                    ))}
                </div>
            </div>

            <button onClick={() => { safeStorage.set('oracle_user', username); safeStorage.set('oracle_avatar', avatar); safeStorage.set('oracle_color', userColor); setLayer('SECURITY'); }} className="px-8 py-2 bg-gold text-black font-bold rounded-lg shadow-lg">Lanjutkan</button>
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
                } else alert('PIN salah.');
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
                        isMe={msg.nama.startsWith(username)} 
                        onReply={setReplyingTo} 
                        onEdit={handleStartEdit}
                        onViewOnce={handleViewOnce}
                        currentAudioId={currentAudioId} 
                        onPlayAudio={setCurrentAudioId}
                        onVisible={(id: number) => supabaseClient.from('Pesan').update({ is_read: true }).eq('id', id)}
                    />
                ))}
                {filteredMessages.length === 0 && (
                    <div className="text-center py-10 opacity-30 italic font-mystic">
                        Tidak ada pesan yang ditemukan dalam takdir ini...
                    </div>
                )}
            </main>

            <footer className="p-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-black/60 border-t border-white/10 backdrop-blur-xl z-40 shrink-0">
                {replyingTo && (
                    <div className="bg-white/5 p-2 rounded-t-xl flex justify-between items-center mb-2 border-l-4 border-gold">
                        <div className="text-xs italic truncate opacity-70">
                            Replying to <span className="font-bold text-gold">{replyingTo.nama.split('|')[0]}</span>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="text-lg opacity-50">×</button>
                    </div>
                )}
                {editingMsg && (
                    <div className="bg-white/5 p-2 rounded-t-xl flex justify-between items-center mb-2 border-l-4 border-blue-400">
                        <div className="text-xs italic truncate opacity-70">
                            Editing message...
                        </div>
                        <button onClick={() => { setEditingMsg(null); setInputText(''); }} className="text-lg opacity-50">×</button>
                    </div>
                )}
                {selectedFile && (
                    <div className="bg-white/5 p-2 rounded-t-xl flex justify-between items-center mb-2 border-l-4 border-blue-500">
                        <div className="text-xs italic truncate opacity-70">
                            📎 {selectedFile.name}
                        </div>
                        <button onClick={() => setSelectedFile(null)} className="text-lg opacity-50">×</button>
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
                    <div className="flex-1 relative">
                        <input 
                            type="text" 
                            value={inputText} 
                            onChange={e => { setInputText(e.target.value); handleTyping(); }}
                            placeholder="Kirim pesan..." 
                            className="w-full h-12 bg-white/5 rounded-full px-5 pr-12 outline-none focus:ring-1 ring-gold/30 transition-all"
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                        />
                        <label className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer opacity-40 hover:opacity-100">
                            <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                            📎
                        </label>
                    </div>
                    <button 
                        onClick={(inputText.trim() || selectedFile) ? handleSend : handleVoiceNote} 
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gold text-black'}`}
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

            {viewingSecret && (
                <div className="fixed inset-0 bg-black/98 z-[200] flex items-center justify-center p-8 animate-fade-in" onClick={() => setViewingSecret(null)}>
                    <div className="text-center space-y-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                        <div className="text-red-500 font-header tracking-[8px] uppercase animate-pulse">Secret Revealed</div>
                        <div className="bg-white/5 p-6 rounded-3xl border border-red-500/20">
                            <MessageContent 
                                type={viewingSecret.type} 
                                content={viewingSecret.content} 
                                msgId="secret" 
                                currentAudioId={currentAudioId} 
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
                                alert("Browser Anda sudah menginstal aplikasi ini, atau tidak mendukung instalasi otomatis. \n\nCara Manual:\n- Android: Klik titik tiga (⋮) di Chrome -> 'Tambahkan ke Layar Utama'\n- iOS: Klik tombol Share -> 'Tambah ke Layar Utama'");
                            }
                        }} className="w-full text-left px-4 py-3 text-xs uppercase tracking-widest hover:bg-white/5 text-gold border-b border-white/5 font-bold animate-pulse">
                            ⬇️ Install Aplikasi
                        </button>
                        <div className="px-4 py-3 border-b border-white/5">
                            <div className="text-[10px] uppercase tracking-widest opacity-50 mb-2">Background Music</div>
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
                        <button onClick={async () => {
                            const permission = await Notification.requestPermission();
                            if (permission === 'granted') {
                                alert("Notifikasi diaktifkan!");
                                if (navigator.serviceWorker.controller) {
                                    navigator.serviceWorker.controller.postMessage({
                                        type: 'SHOW_NOTIFICATION',
                                        payload: {
                                            title: 'Oracle Chamber',
                                            text: 'Takdir akan selalu bersamamu.',
                                            tag: 'oracle-system'
                                        }
                                    });
                                }
                            } else {
                                alert("Izin notifikasi ditolak.");
                            }
                        }} className="w-full text-left px-4 py-3 text-xs uppercase tracking-widest hover:bg-white/5">🔔 Aktifkan Notifikasi</button>
                        <button onClick={handleDeleteHistory} className="w-full text-left px-4 py-3 text-xs uppercase tracking-widest hover:bg-white/5 text-red-400 border-t border-white/5">🗑️ Hapus Riwayat</button>
                        <button onClick={() => {
                            localStorage.clear();
                            window.location.reload();
                        }} className="w-full text-left px-4 py-3 text-xs uppercase tracking-widest hover:bg-white/5 text-red-400">🚪 Reset Identitas</button>
                        <div className="px-4 py-2 text-[8px] text-white/20 text-center uppercase tracking-widest border-t border-white/5">
                            v1.3.0 • Oracle Chamber
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

export default App;
