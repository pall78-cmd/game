import { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { lightDeck, deepDeck, chaosDeck } from './deck';

// --- CONSTANTS & UTILS ---
const SUPA_URL = import.meta.env.VITE_SUPA_URL;
const SUPA_KEY = import.meta.env.VITE_SUPA_KEY;

const supabaseClient = createClient(SUPA_URL, SUPA_KEY);

function parsePreviewText(text) {
    if (!text) return "";
    let actual = text;
    if (text.startsWith('[REPLY:')) {
        const endIdx = text.indexOf('}]');
        if (endIdx !== -1) actual = text.substring(endIdx + 2);
    }
    if (actual.startsWith('[IMG]')) return "📷 Photo";
    if (actual.startsWith('[VN]')) return "🎤 Voice Message";
    if (actual.startsWith('[VO]')) return "👁️ Secret Message";
    return actual.substring(0, 40) + (actual.length > 40 ? "..." : "");
}

const uploadImage = async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;
    const { data, error } = await supabaseClient.storage.from('bukti').upload(filePath, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabaseClient.storage.from('bukti').getPublicUrl(filePath);
    return publicUrl;
};

const safeStorage = {
    get: (key) => {
        try { return localStorage.getItem(key); } catch { return null; }
    },
    set: (key, value) => {
        try { localStorage.setItem(key, value); } catch { }
    }
};

const drawCard = (category) => {
    let deck;
    let wildcardChance = 0;

    if (category === 'light') {
        deck = lightDeck;
        wildcardChance = 0.15; // 15%
    } else if (category === 'deep') {
        deck = deepDeck;
        wildcardChance = 0.10; // 10%
    } else { // chaos
        deck = chaosDeck;
        wildcardChance = 0.06; // 6%
    }

    const isWildcard = Math.random() < wildcardChance;
    let cardType;

    if (isWildcard) {
        cardType = 'wildcard';
    } else {
        cardType = Math.random() < 0.5 ? 'truth' : 'dare';
    }

    const cardPool = deck[cardType];
    if (!cardPool || cardPool.length === 0) return `Tidak ada kartu ${cardType} tersisa.`;

    const randomIndex = Math.floor(Math.random() * cardPool.length);
    return cardPool[randomIndex];
};

// --- COMPONENTS ---

const AudioPlayer = ({ url, isPlaying, onToggle }) => {
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef(null);

    useEffect(() => {
        if (isPlaying) {
            audioRef.current?.play().catch(() => onToggle());
        } else {
            audioRef.current?.pause();
        }
    }, [isPlaying]);

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
                onTimeUpdate={() => setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100)} 
                onLoadedMetadata={() => setDuration(audioRef.current.duration)}
                onEnded={onToggle} 
                className="hidden" 
            />
        </div>
    );
};

const FateCardDisplay = ({ raw, onShare }) => {
    try {
        const d = JSON.parse(raw);
        const parts = d.content.split(":");
        const type = parts[0] || "FATE";
        const content = parts.slice(1).join(":").trim() || d.content;
        const isChaos = type.includes("CHAOS");

        return (
            <div className={`p-4 rounded-xl border border-gold/30 bg-gradient-to-br from-black to-zinc-900 text-center space-y-3 shadow-lg relative overflow-hidden group`}>
                <div className="text-[8px] font-header tracking-[4px] uppercase opacity-60 text-gold">{type}</div>
                <div className="font-mystic text-xl italic text-white/90 leading-normal">"{content}"</div>
                <div className="text-[7px] opacity-30 uppercase tracking-widest font-header pt-1">Invoked by {d.invoker}</div>
            </div>
        );
    } catch { return <div className="p-3 text-red-500 border border-red-500/20 rounded-lg text-xs italic">Takdir yang Terdistorsi</div>; }
};

const Bubble = ({ msg, isMe, onReply, onEdit, onViewOnce, onShare, currentAudioId, onPlayAudio, onVisible }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [swipeX, setSwipeX] = useState(0);
    const touchStartRef = useRef(0);
    const longPressTimerRef = useRef(null);
    const bubbleRef = useRef(null);

    useEffect(() => {
        if (!bubbleRef.current || isMe) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                onVisible(msg.id);
                observer.disconnect();
            }
        }, { threshold: 0.8 });
        observer.observe(bubbleRef.current);
        return () => observer.disconnect();
    }, [bubbleRef, msg.id, isMe, onVisible]);

    const content = msg.teks;
    const isOracle = msg.nama === "ORACLE";
    const isVO = content.startsWith("[VO]");
    const isVN = content.startsWith("[VN]");
    const isIMG = content.startsWith("[IMG]");

    let replyData = null;
    let actualContent = content;
    const replyRegex = /^\s*\[REPLY:(.+?)\](.*)$/s;
    const match = content.match(replyRegex);

    if (match) {
        try {
            replyData = JSON.parse(match[1]);
            actualContent = match[2].trim();
        } catch (e) {
            console.error('Failed to parse reply JSON:', e);
            actualContent = content;
        }
    } else {
        actualContent = content;
    }

    const identity = useMemo(() => {
        const parts = msg.nama.split('|');
        return { name: parts[0], avatar: parts[1] || '👤', color: parts[2] || '#D4AF37' };
    }, [msg.nama]);

    const handleTouchStart = (e) => {
        touchStartRef.current = e.touches[0].clientX;
        if (isMe && !isOracle) {
            longPressTimerRef.current = setTimeout(() => {
                if (navigator.vibrate) navigator.vibrate(50);
                onEdit(msg);
            }, 600);
        }
    };

    const handleTouchMove = (e) => {
        const diff = e.touches[0].clientX - touchStartRef.current;
        if (Math.abs(diff) > 10 && longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
        }
        if (diff > 0 && diff < 80) {
            setSwipeX(diff);
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        if (swipeX > 40) {
            if (navigator.vibrate) navigator.vibrate(20);
            onReply(msg);
        }
        setSwipeX(0);
    };

    const formatTime = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderReplyPreview = (data) => {
        return (
            <div className="mb-1 p-2 rounded bg-black/10 border-l-4 border-gold/50 text-[10px] opacity-80 italic truncate">
                <span className="font-bold text-gold not-italic">{data.name}:</span> {parsePreviewText(data.text)}
            </div>
        );
    };

    return (
        <div 
            ref={bubbleRef}
            className={`flex flex-col mb-2 animate-fade-in relative transition-transform duration-200 ${isOracle ? 'items-center w-full my-4' : isMe ? 'items-end' : 'items-start'}`}
            style={{ transform: `translateX(${swipeX}px)` }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {swipeX > 20 && (
                <div className="absolute left-[-30px] top-1/2 -translate-y-1/2 text-gold opacity-50">↩️</div>
            )}

            {!isOracle && (
                <div className={`flex items-center gap-1.5 mb-0.5 px-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-[10px]">{identity.avatar}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: identity.color }}>{identity.name}</span>
                </div>
            )}
            
            <div className={`relative p-2.5 w-fit max-w-[85%] rounded-xl border transition-all shadow-sm ${isOracle ? 'w-full max-w-sm bg-transparent border-none' : isVO ? 'bg-red-950/40 border-red-500/30 text-red-400 cursor-pointer' : isMe ? 'bg-[#056162] border-none text-white rounded-tr-none' : 'bg-[#262d31] border-none text-white rounded-tl-none'}`} onClick={() => isVO && onViewOnce(msg)}>
                {!isOracle && (
                    <div className={`absolute top-0 w-0 h-0 border-t-[10px] border-t-transparent ${isMe ? 'right-[-8px] border-l-[10px] border-l-[#056162]' : 'left-[-8px] border-r-[10px] border-r-[#262d31]'}`}></div>
                )}

                {replyData && renderReplyPreview(replyData)}
                
                <div className="flex flex-col">
                    {isOracle ? <FateCardDisplay raw={actualContent} onShare={onShare} /> :
                     isVO ? <div className="flex items-center gap-3"><span className="text-xl">👁️</span><div className="flex flex-col"><span className="text-[9px] font-header tracking-widest uppercase">Secret Glimpse</span><span className="text-[7px] opacity-40 uppercase">Tap to reveal</span></div></div> :
                     isVN ? <AudioPlayer url={actualContent.replace("[VN]", "")} isPlaying={currentAudioId === msg.id} onToggle={() => onPlayAudio(currentAudioId === msg.id ? null : msg.id)} /> :
                     isIMG ? <img src={actualContent.replace("[IMG]", "")} className="rounded-lg max-h-64 w-full object-contain" /> :
                     <p className="font-sans text-[15px] leading-tight break-words whitespace-pre-wrap pr-12">{actualContent}</p>
                    }
                    
                    {!isOracle && (
                        <div className="flex items-center justify-end gap-1 mt-1 self-end">
                            <span className="text-[9px] opacity-50 font-sans">{formatTime(msg.created_at)}</span>
                            {isMe && <span className={`text-[10px] ${msg.is_read ? 'text-[#34b7f1]' : 'text-white/40'}`}>✓✓</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MAIN APP ---

function App() {
    const [isAdult, setIsAdult] = useState(() => safeStorage.get('oracle_adult') === 'true');
    const [chaosUnlocked, setChaosUnlocked] = useState(() => safeStorage.get('oracle_chaos_unlocked') === 'true');
    const [layer, setLayer] = useState(() => {
        const adult = safeStorage.get('oracle_adult');
        const user = safeStorage.get('oracle_user');
        if (adult === null) return 'AGE';
        if (user === null) return 'NAME';
        return safeStorage.get('oracle_unlocked') === 'true' ? 'MAIN' : 'SECURITY';
    });

    const [username, setUsername] = useState(() => safeStorage.get('oracle_user') || '');
    const [avatar, setAvatar] = useState(() => safeStorage.get('oracle_avatar') || '🔮');
    const [userColor, setUserColor] = useState(() => safeStorage.get('oracle_color') || '#D4AF37');
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isViewOnce, setIsViewOnce] = useState(false);
    const [fateMode, setFateMode] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [currentAudioId, setCurrentAudioId] = useState(null);
    const [typingUsers, setTypingUsers] = useState({});
    const [replyingTo, setReplyingTo] = useState(null);
    const [editingMsg, setEditingMsg] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [viewingSecret, setViewingSecret] = useState(null);
    const [pinInput, setPinInput] = useState('');
    const [chaosPinInput, setChaosPinInput] = useState('');
    const [showChaosUnlock, setShowChaosUnlock] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const [activeCard, setActiveCard] = useState(null);
    const [readReceipts, setReadReceipts] = useState({});
    const feedRef = useRef(null);
    const lastTypingRef = useRef(0);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }
    }, []);

    useEffect(() => {
        if (layer !== 'MAIN') return;

        const initialize = async () => {
            const { data: messagesData } = await supabaseClient.from('Pesan').select('*').order('id', { ascending: true });
            if (messagesData) setMessages(messagesData);

            const { data: cardData } = await supabaseClient.from('Tantangan').select('*').eq('is_active', true).single();
            if (cardData) setActiveCard(cardData);
        };

        initialize();
        
        const channel = supabaseClient.channel('msgs');
        
        channel
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Pesan' }, (p) => {
                setMessages(prev => [...prev, p.new]);
            })
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
                if (payload.user !== username) {
                    setTypingUsers(prev => ({ ...prev, [payload.user]: payload.isTyping ? Date.now() : 0 }));
                }
            })
            .on('broadcast', { event: 'read' }, ({ payload }) => {
                setMessages(prev => prev.map(m => 
                    m.id === payload.messageId ? { ...m, is_read: true } : m
                ));
            })
            .subscribe();
        
        const typingCleanup = setInterval(() => {
            const now = Date.now();
            setTypingUsers(prev => {
                const next = { ...prev };
                let changed = false;
                for (const user in next) {
                    if (next[user] > 0 && now - next[user] > 3000) {
                        next[user] = 0;
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
        }, 1000);

        return () => {
            supabaseClient.removeChannel(channel);
            clearInterval(typingCleanup);
        };
    }, [layer]);

    useEffect(() => {
        if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }, [messages]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleSend = async () => {
        if (!inputText.trim()) return;
        
        const nama = `${username}|${avatar}|${userColor}`;
        let teks = inputText;

        if (editingMsg) {
            await supabaseClient.from('Pesan').update({ teks }).eq('id', editingMsg.id);
            setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, teks } : m));
            setEditingMsg(null);
            setInputText('');
            return;
        }

        if (replyingTo) {
            const replyContext = {
                name: replyingTo.nama.split('|')[0],
                text: replyingTo.teks
            };
            teks = `[REPLY:${JSON.stringify(replyContext)}]${inputText}`;
        }

        if (isViewOnce) teks = `[VO]${teks}`;
        
        await supabaseClient.from('Pesan').insert([{ nama, teks }]);
        setInputText('');
        setIsViewOnce(false);
        setReplyingTo(null);
    };

    const handleTyping = () => {
        const now = Date.now();
        if (now - lastTypingRef.current > 2000) {
            lastTypingRef.current = now;
            supabaseClient.channel('msgs').send({
                type: 'broadcast',
                event: 'typing',
                payload: { user: username, isTyping: true },
            });
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const url = await uploadImage(file);
            const nama = `${username}|${avatar}|${userColor}`;
            const teks = `[IMG]${url}`;
            await supabaseClient.from('Pesan').insert([{ nama, teks }]);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Gagal mengunggah gambar.');
        } finally {
            setIsUploading(false);
            setShowAttachmentMenu(false);
        }
    };

    const handleClearChat = async () => {
        await supabaseClient.from('Pesan').delete().gt('id', 0);
        setMessages([]);
        setShowClearConfirm(false);
    };

    const handleDrawFateCard = async (category) => {
        if (activeCard) {
            alert("Satu kartu takdir sudah aktif.");
            return;
        }
        const isChaos = category === 'chaos';
        if (isChaos && !chaosUnlocked) {
            setShowChaosUnlock(true);
            return;
        }
        const cardContent = drawCard(category);
        const { data, error } = await supabaseClient.from('Tantangan').insert([{ card_content: cardContent, invoker: username, is_active: true }]).select().single();
        
        if (error || !data) {
            console.error("Gagal menarik takdir:", error);
            alert("Gagal menarik takdir. Coba lagi.");
            return;
        }
        setActiveCard(data);
        setFateMode(false);
    };

    // Layer Renderers
    const renderAgeGate = () => (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-center p-4 animate-fade-in">
            <h1 className="font-header text-2xl text-gold tracking-[8px] mb-4">VERIFIKASI USIA</h1>
            <p className="font-mystic text-lg mb-8 max-w-sm">Aplikasi ini mengandung konten dewasa dan tidak cocok untuk semua penonton. Mohon konfirmasi bahwa Anda berusia 18 tahun atau lebih.</p>
            <div className="flex gap-4">
                <button onClick={() => { safeStorage.set('oracle_adult', 'true'); setIsAdult(true); setLayer('NAME'); }} className="px-8 py-2 bg-gold text-black font-bold rounded-lg shadow-lg transition-transform active:scale-95">SAYA 18+</button>
                <button onClick={() => window.location.href = 'about:blank'} className="px-8 py-2 bg-gray-700 text-white rounded-lg">Keluar</button>
            </div>
        </div>
    );

    const renderNameScreen = () => (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-center p-4 animate-fade-in">
            <h1 className="font-header text-2xl text-gold tracking-[8px] mb-4">IDENTITAS</h1>
            <p className="font-mystic text-lg mb-6">Pilih nama, avatar, dan warna untuk dikenali.</p>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Nama..." className="bg-white/10 text-center p-2 rounded-lg mb-4 w-64" />
            <div className="flex gap-4 mb-6">
                <input type="text" value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="Avatar..." className="bg-white/10 text-center p-2 rounded-lg w-20" />
                <input type="color" value={userColor} onChange={e => setUserColor(e.target.value)} className="w-20 h-10 rounded-lg" />
            </div>
            <button onClick={() => { safeStorage.set('oracle_user', username); safeStorage.set('oracle_avatar', avatar); safeStorage.set('oracle_color', userColor); setLayer('SECURITY'); }} className="px-8 py-2 bg-gold text-black font-bold rounded-lg shadow-lg transition-transform active:scale-95">Lanjutkan</button>
        </div>
    );

    const renderSecurityScreen = () => (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-center p-4 animate-fade-in">
            <h1 className="font-header text-2xl text-gold tracking-[8px] mb-4">AKSES</h1>
            <p className="font-mystic text-lg mb-6">Masukkan PIN untuk membuka Oracle.</p>
            <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} className="bg-white/10 text-center p-2 rounded-lg mb-4 w-64 tracking-[8px]" />
            <button onClick={() => {
                if (pinInput === '179') { // Your PIN
                    safeStorage.set('oracle_unlocked', 'true');
                    setLayer('MAIN');
                } else {
                    alert('PIN salah.');
                }
            }} className="px-8 py-2 bg-gold text-black font-bold rounded-lg shadow-lg transition-transform active:scale-95">Buka</button>
        </div>
    );

    if (layer === 'AGE') return renderAgeGate();
    if (layer === 'NAME') return renderNameScreen();
    if (layer === 'SECURITY') return renderSecurityScreen();

    return (
        <div className="h-screen w-screen bg-void flex flex-col font-sans text-sm text-white/90">
            {/* Header */}
            <header className="flex items-center justify-between p-3 border-b border-white/10 glass">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-lg font-header text-gold shadow-md">O</div>
                    <div>
                        <h1 className="font-bold text-base">Oracle Chamber</h1>
                        <p className="text-xs text-white/50">Connected</p>
                    </div>
                </div>
                <button onClick={() => setShowMenu(true)} className="text-2xl">⋮</button>
            </header>

            {/* Feed */}
            <main ref={feedRef} className="flex-1 overflow-y-auto p-3 custom-scrollbar feed-container">
                {messages.map(msg => <Bubble key={msg.id} msg={msg} isMe={msg.nama.startsWith(username)} onReply={setReplyingTo} onEdit={setEditingMsg} onViewOnce={setViewingSecret} currentAudioId={currentAudioId} onPlayAudio={setCurrentAudioId} onVisible={(id) => supabaseClient.channel('msgs').send({ type: 'broadcast', event: 'read', payload: { messageId: id } })} />)}
            </main>

            {/* Footer / Input */}
            <footer className="p-3 glass border-t border-white/10">
                {replyingTo && (
                    <div className="bg-black/20 p-2 rounded-t-lg flex justify-between items-center">
                        <div className="border-l-4 border-gold pl-2 text-xs italic truncate">
                            Replying to <span className="font-bold not-italic text-gold">{replyingTo.nama.split('|')[0]}</span>: {parsePreviewText(replyingTo.teks)}
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="text-xl">×</button>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <button onClick={() => setFateMode(!fateMode)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${fateMode ? 'bg-gold text-black scale-110' : 'bg-white/10'}`}>
                        <span className="font-header text-xl">?</span>
                    </button>
                    <div className="flex-1 relative">
                        <input 
                            type="text" 
                            value={inputText} 
                            onChange={e => { setInputText(e.target.value); handleTyping(); }}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setIsInputFocused(false)}
                            placeholder="Kirim pesan..." 
                            className="w-full h-12 bg-white/5 rounded-full px-5 pr-14 text-white placeholder-white/40 border border-transparent focus:border-gold/50 outline-none transition-all"
                        />
                        <button onClick={() => setShowAttachmentMenu(true)} className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl text-white/60">+</button>
                    </div>
                    <button onClick={handleSend} className="w-12 h-12 rounded-full bg-gold text-black flex items-center justify-center text-2xl active:scale-90 transition-transform">
                        <span>➤</span>
                    </button>
                </div>
            </footer>

            {/* Fate Mode Overlay */}
            {fateMode && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in z-50" onClick={() => setFateMode(false)}>
                    <div className="bg-zinc-900/80 border border-gold/20 p-6 rounded-2xl shadow-2xl space-y-4 w-80" onClick={e => e.stopPropagation()}>
                        <h2 className="font-header text-center text-gold text-lg tracking-[5px]">PILIH TAKDIR</h2>
                        <p className="text-center text-xs text-white/60 font-mystic italic">Pilih mode untuk menentukan intensitas permainan.</p>
                        <div className="space-y-3 pt-2">
                            <button onClick={() => handleDrawFateCard('light')} className="w-full text-left p-3 bg-black/20 rounded-lg border border-transparent hover:border-gold/50 transition-all">
                                <h3 className="font-bold">Light</h3>
                                <p className="text-xs text-white/50">Percakapan ringan dan menyenangkan.</p>
                            </button>
                            <button onClick={() => handleDrawFateCard('deep')} className="w-full text-left p-3 bg-black/20 rounded-lg border border-transparent hover:border-gold/50 transition-all">
                                <h3 className="font-bold">Deep</h3>
                                <p className="text-xs text-white/50">Pertanyaan mendalam untuk koneksi lebih.</p>
                            </button>
                            <button onClick={() => handleDrawFateCard('chaos')} className={`w-full text-left p-3 rounded-lg transition-all ${chaosUnlocked ? 'bg-black/20 hover:border-gold/50' : 'bg-red-900/30 text-white/50'}`}>
                                <h3 className="font-bold flex items-center gap-2">{chaosUnlocked ? 'Chaos (18+)' : 'Chaos (Terkunci)'}</h3>
                                <p className="text-xs">Tantangan liar dan tak terduga.</p>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
