import React, { useState, useEffect, useRef } from 'react';
import { supabase, sendMessage, clearAllMessages } from './services/supabase';
import { Message, Layer } from './types';
import { initDeck, drawCard, Intensity } from './utils/deck';
import Bubble from './components/Bubble';

const safeStorage = {
  get: (key: string) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set: (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch { /* silences error */ }
  }
};

export default function App() {
  console.log("App rendering...");
  const [isAdult, setIsAdult] = useState(() => safeStorage.get('oracle_adult') === 'true');
  const [layer, setLayer] = useState<Layer>(() => {
    const adult = safeStorage.get('oracle_adult');
    const user = safeStorage.get('oracle_user');
    const unlocked = safeStorage.get('oracle_unlocked') === 'true';
    
    if (adult === null) return 'AGE';
    if (user === null) return 'NAME';
    if (unlocked) return 'MAIN';
    return 'SECURITY';
  });
  const [username, setUsername] = useState(() => safeStorage.get('oracle_user') || '');
  const [avatar, setAvatar] = useState(() => safeStorage.get('oracle_avatar') || '🔮');
  const [userColor, setUserColor] = useState(() => safeStorage.get('oracle_color') || '#D4AF37');
  
  const myIdentity = `${username}|${avatar}|${userColor}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [viewingSecret, setViewingSecret] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string, avatar: string, color: string, timestamp: number }>>({});
  const [fateMode, setFateMode] = useState(false);
  const [currentAudioId, setCurrentAudioId] = useState<number | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ file: File, url: string } | null>(null);
  const [imageCaption, setImageCaption] = useState('');

  useEffect(() => {
    return () => {
      if (previewImage) URL.revokeObjectURL(previewImage.url);
    };
  }, [previewImage]);
  const [isUploading, setIsUploading] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [knownEntities, setKnownEntities] = useState<Record<string, { id: string, name: string, avatar: string, color: string }>>(() => {
    const saved = safeStorage.get('oracle_entities');
    return saved ? JSON.parse(saved) : {};
  });
  const [isRecording, setIsRecording] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if ('Notification' in window) return Notification.permission;
    return 'denied';
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef(initDeck());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingRef = useRef(0);

  // Registrasi Service Worker yang lebih aman
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
        console.error("Global Error:", event.error);
        alert(`System Error: ${event.message}\n${event.error?.stack}`);
    };
    window.addEventListener('error', handleError);

    const isProduction = window.location.hostname.includes('github.io');
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Cegah registrasi jika di AI Studio preview atau domain tidak dikenal
    const isRestrictedEnv = window.location.hostname.includes('usercontent.goog') || window.location.hostname.includes('ai.studio');

    if ('serviceWorker' in navigator && !isRestrictedEnv && (isProduction || isLocal)) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Oracle: System active'))
        .catch(err => console.debug('Worker skipped:', err.message));
    }
  }, []);

  const [viewedMessages, setViewedMessages] = useState<Set<number>>(() => {
    const saved = safeStorage.get('oracle_viewed_vo');
    return new Set(saved ? JSON.parse(saved) : []);
  });

  // Remove loader on mount
  useEffect(() => {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 500);
    }
  }, []);

  async function requestNotifPermission() {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
  }

  // Mandatory Notification Enforcer - REMOVED per user request to "just allow it"
  // if (layer === 'MAIN' && notifPermission !== 'granted') {
  //     return (
  //         <div className="h-screen bg-black flex flex-col items-center justify-center p-8 text-center space-y-6 z-50">
  //             ...
  //         </div>
  //     );
  // }

  const parseForNotif = (text: string) => {
    if (text.startsWith('[IMG]')) return '📷 Photo';
    if (text.startsWith('[VN]')) return '🎤 Voice Message';
    if (text.startsWith('[VO]')) return '👁️ Secret Message';
    if (text.includes('[SHARED FATE]')) return '🔮 Shared Fate';

    // Handle Reply
    if (text.startsWith('[REPLY:{')) {
        const endIdx = text.indexOf('}]');
        if (endIdx !== -1) {
             return "↩️ " + text.substring(endIdx + 2);
        }
    }

    return text
        .replace(/\[REPLY:.*?\]/g, "↩️ ")
        .replace(/@(\w+)/g, "$1")
        .substring(0, 50) + (text.length > 50 ? '...' : '');
  };

  useEffect(() => {
    if (layer !== 'MAIN') return;

    const fetchMessages = async () => {
        try {
            const { data, error } = await supabase.from('Pesan').select('*').order('id', { ascending: true });
            if (error) throw error;
            if (data) setMessages(data);
            setTimeout(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, 500);
        } catch (err) {
            console.error("Connection failed:", err);
        }
    };

    fetchMessages();

    const sub = supabase.channel('msgs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Pesan' }, (p) => {
            const newMsg = p.new as Message;
            setMessages(prev => [...prev, newMsg]);
            
            if (document.hidden && newMsg.nama !== username && 'serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                    const senderName = (newMsg.nama || "").split('|')[0] || "Unknown";
                    reg.active?.postMessage({
                        type: 'SHOW_NOTIFICATION',
                        payload: { 
                            sender: senderName, 
                            body: parseForNotif(newMsg.teks)
                        }
                    });
                }).catch(() => {
                    // Fallback if SW fails
                    new Notification(`Oracle: ${newMsg.nama.split('|')[0]}`, {
                        body: parseForNotif(newMsg.teks),
                        icon: '/icon-192.png'
                    });
                });
            }

            setTimeout(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, 100);
        })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
            if (payload.identity === myIdentity) return;
            
            const [name, avatar, color] = payload.identity.split('|');
            setTypingUsers(prev => ({
                ...prev,
                [payload.identity]: { name, avatar, color, timestamp: Date.now() }
            }));
        })
        .subscribe();

    const typingInterval = setInterval(() => {
        const now = Date.now();
        setTypingUsers(prev => {
            const next = { ...prev };
            let changed = false;
            for (const id in next) {
                if (now - next[id].timestamp > 3000) {
                    delete next[id];
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, 1000);

    return () => { 
        supabase.removeChannel(sub); 
        clearInterval(typingInterval);
    };
  }, [layer, username, myIdentity]);

  useEffect(() => {
    if (messages.length === 0) return;
    
    const newEntities = { ...knownEntities };
    let changed = false;
    
    messages.forEach(m => {
        if (m.nama !== "ORACLE" && m.nama !== myIdentity && !newEntities[m.nama]) {
            const [name, avatar, color] = m.nama.split('|');
            newEntities[m.nama] = { id: m.nama, name: name || m.nama, avatar: avatar || '👤', color: color || '#fff' };
            changed = true;
        }
    });
    
    if (changed) {
        setKnownEntities(newEntities);
        safeStorage.set('oracle_entities', JSON.stringify(newEntities));
    }
  }, [messages, myIdentity, knownEntities]);

  const handleFate = async (int: Intensity) => {
      setFateMode(false);
      const { content, newDeck } = drawCard(deckRef.current, int);
      deckRef.current = newDeck;
      try {
          // Send as a special message but we'll also display it in the dedicated Fate panel
          await sendMessage("ORACLE", JSON.stringify({ content, invoker: myIdentity }));
      } catch (err) {
          console.error("Oracle error:", err);
      }
  };

  const handleViewOnce = async (m: Message) => {
      if (viewedMessages.has(m.id)) return;

      // 1. Show content in a secure overlay
      const content = m.teks.replace('[VO]', '');
      setViewingSecret(content);

      // 2. Mark as viewed locally immediately
      const newViewed = new Set(viewedMessages);
      newViewed.add(m.id);
      setViewedMessages(newViewed);
      safeStorage.set('oracle_viewed_vo', JSON.stringify(Array.from(newViewed)));

      // 3. Burn the message on server (Update to [OPENED])
      try {
          const { updateMessage } = await import('./services/supabase');
          await updateMessage(m.id, '[OPENED]');
      } catch (err) {
          console.error("Failed to burn message:", err);
      }
  };

  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ... (existing useEffects)

  const handleEdit = (m: Message) => {
      setEditingMsg(m);
      setInputText(m.teks);
      if (fileInputRef.current) fileInputRef.current.focus();
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    let text = inputText;
    
    if (isViewOnce && !editingMsg) {
        text = `[VO]${text}`;
        setIsViewOnce(false);
    }

    if (replyingTo && !editingMsg) {
        const replyContext = JSON.stringify({
            id: replyingTo.id,
            name: (replyingTo.nama || "").split('|')[0],
            text: replyingTo.teks.substring(0, 50)
        });
        text = `[REPLY:${replyContext}]${text}`;
        setReplyingTo(null);
    }

    setInputText('');
    
    if (editingMsg) {
        // Handle Edit
        try {
            const { updateMessage } = await import('./services/supabase');
            
            // Optimistic Update
            const updatedMessages = messages.map(m => 
                m.id === editingMsg.id ? { ...m, teks: text } : m
            );
            setMessages(updatedMessages);
            
            // Persist to LocalStorage
            safeStorage.set('oracle_messages', JSON.stringify(updatedMessages));
            
            // Update Server
            await updateMessage(editingMsg.id, text);
            
            setEditingMsg(null);
        } catch (err) {
            console.error("Edit failed:", err);
            alert("Failed to update message in the void.");
        }
    } else {
        // Handle Send
        try {
            await sendMessage(myIdentity, text);
        } catch (err) {
            console.error("Send failed:", err);
            setInputText(text);
        }
    }
  };

  // ... (rest of the code)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    const now = Date.now();
    if (now - lastTypingRef.current > 2000) {
        lastTypingRef.current = now;
        supabase.channel('msgs').send({
            type: 'broadcast',
            event: 'typing',
            payload: { identity: myIdentity }
        });
    }
  };

  const handleShare = (text: string) => {
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      // Fallback
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      alert("Copied to clipboard: " + text);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPreviewImage({ file, url });
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmImageUpload = async () => {
    if (!previewImage) return;
    setIsUploading(true);

    try {
      const { uploadImage } = await import('./services/supabase');
      const publicUrl = await uploadImage(previewImage.file);
      let messageText = imageCaption.trim() ? `[IMG]${publicUrl}\n${imageCaption}` : `[IMG]${publicUrl}`;
      
      if (isViewOnce) {
          messageText = `[VO]${messageText}`;
          setIsViewOnce(false);
      }

      await sendMessage(myIdentity, messageText);
      cancelImagePreview();
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload image.");
    } finally {
      setIsUploading(false);
    }
  };

  const cancelImagePreview = () => {
    if (previewImage) {
      URL.revokeObjectURL(previewImage.url);
    }
    setPreviewImage(null);
    setImageCaption('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], 'voice_note.webm', { type: 'audio/webm' });
        
        setIsUploading(true);
        try {
          const { uploadImage } = await import('./services/supabase'); // Reuse upload logic
          const publicUrl = await uploadImage(file);
          await sendMessage(myIdentity, `[VN]${publicUrl}`);
        } catch (err) {
          console.error("VN upload failed:", err);
        } finally {
          setIsUploading(false);
        }
        
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      setShowActions(false);
    } catch (err) {
      console.error("Mic access denied:", err);
      alert("Microphone access required for voice notes.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleReply = (m: Message) => {
    setReplyingTo(m);
  };

  const uniqueContacts = Object.values(knownEntities);

  if (layer === 'AGE') return (
    <div className="h-[100dvh] bg-black flex flex-col items-center justify-center p-6 text-center space-y-12 overflow-hidden relative z-50">
        <div className="space-y-4 animate-fade-in">
            <div className="text-6xl mb-4">🔮</div>
            <h1 className="font-header text-gold text-3xl tracking-[10px] uppercase">Oracle</h1>
            <p className="text-[10px] text-white/40 tracking-[3px] uppercase">Verifikasi Keberadaan</p>
        </div>
        
        <div className="w-full max-w-[280px] space-y-4 animate-slide-in">
            <button 
                onClick={() => { setIsAdult(true); safeStorage.set('oracle_adult', 'true'); setLayer('NAME'); }} 
                className="w-full py-5 bg-gold/10 border border-gold/40 rounded-2xl text-gold font-header tracking-[5px] text-xs hover:bg-gold/20 active:scale-95 transition-all shadow-[0_0_30px_rgba(212,175,55,0.1)]"
            >
                18+ TAHUN
            </button>
            <button 
                onClick={() => { setIsAdult(false); safeStorage.set('oracle_adult', 'false'); setLayer('NAME'); }} 
                className="w-full py-4 border border-white/10 rounded-2xl text-white/40 font-header tracking-[3px] text-[10px] hover:bg-white/5 active:scale-95 transition-all"
            >
                DI BAWAH 18
            </button>
        </div>
        
        <div className="absolute bottom-10 text-[8px] text-white/20 uppercase tracking-widest">
            By entering, you accept the void
        </div>
    </div>
  );

  if (layer === 'SECURITY') return (
    <div className="h-[100dvh] bg-black flex flex-col items-center justify-center p-6 space-y-8 relative z-50">
        <div className="text-4xl animate-pulse">🧿</div>
        <h1 className="font-header text-gold tracking-[10px] text-sm">GATEWAY ACCESS</h1>
        <div className="w-full max-w-[200px] space-y-4">
            <input 
                type="password" 
                placeholder="••••••" 
                autoFocus
                maxLength={6}
                onChange={(e) => { 
                    if (e.target.value === '010304') {
                        safeStorage.set('oracle_unlocked', 'true');
                        setLayer('MAIN'); 
                    }
                }} 
                className="bg-transparent border-b border-gold/40 text-center py-4 outline-none text-gold tracking-[15px] text-2xl w-full focus:border-gold transition-all" 
            />
            <p className="text-[7px] text-white/20 text-center uppercase tracking-widest">Enter the 6-digit access code</p>
        </div>
        <div className="flex flex-col items-center gap-4">
            <button onClick={() => setLayer('NAME')} className="text-[8px] text-white/20 uppercase tracking-widest hover:text-white/40">Change Identity</button>
            <button 
                onClick={() => {
                    if(confirm("Reset all session data?")) {
                        localStorage.clear();
                        window.location.reload();
                    }
                }} 
                className="text-[8px] text-red-500/20 uppercase tracking-widest hover:text-red-500/40"
            >
                Reset Session
            </button>
        </div>
    </div>
  );

  if (layer === 'NAME') return (
    <div className="h-[100dvh] bg-black flex flex-col items-center justify-center p-6 space-y-8 overflow-y-auto relative z-50">
        <h1 className="font-header text-gold tracking-[5px] text-xl">SESUAIKAN IDENTITAS</h1>
        
        <div className="w-full max-w-[300px] space-y-6">
            <div className="space-y-2">
                <label className="text-[10px] text-white/40 uppercase tracking-widest">Nama Samaran</label>
                <input 
                    type="text" 
                    maxLength={12}
                    value={username}
                    placeholder="NAMA..." 
                    onChange={(e) => setUsername(e.target.value)} 
                    className="bg-transparent border-b border-white/20 py-2 outline-none w-full font-mystic text-2xl text-white text-center" 
                />
            </div>

            <div className="space-y-3">
                <label className="text-[10px] text-white/40 uppercase tracking-widest block text-center">Pilih Avatar</label>
                <div className="grid grid-cols-4 gap-3">
                    {['🔮', '🧿', '🕯️', '🌙', '☀️', '🌑', '🪐', '💀', '👽', '👻', '🤖', '👾', '🤡', '👹', '👺', '🐲'].map(a => (
                        <button 
                            key={a}
                            onClick={() => setAvatar(a)}
                            className={`text-2xl p-2 rounded-xl border transition-all ${avatar === a ? 'bg-gold/20 border-gold shadow-[0_0_15px_rgba(212,175,55,0.3)]' : 'border-white/5 hover:bg-white/5'}`}
                        >
                            {a}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                <label className="text-[10px] text-white/40 uppercase tracking-widest block text-center">Pilih Aura (Warna)</label>
                <div className="flex flex-wrap justify-center gap-3">
                    {['#D4AF37', '#DC2626', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#6366F1', '#14B8A6', '#84CC16'].map(c => (
                        <button 
                            key={c}
                            onClick={() => setUserColor(c)}
                            style={{ backgroundColor: c }}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${userColor === c ? 'border-white scale-125 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        />
                    ))}
                </div>
            </div>
        </div>

        <button 
            onClick={() => { 
                if (username.trim()) { 
                    safeStorage.set('oracle_user', username); 
                    safeStorage.set('oracle_avatar', avatar);
                    safeStorage.set('oracle_color', userColor);
                    safeStorage.set('oracle_unlocked', 'true');
                    setLayer('MAIN'); 
                } 
            }} 
            className="px-16 py-4 border border-gold text-gold font-header tracking-[5px] hover:bg-gold hover:text-black transition-all text-xs shadow-[0_0_20px_rgba(212,175,55,0.1)]"
        >
            MANIFEST
        </button>
    </div>
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-black text-white font-sans overflow-hidden relative selection:bg-gold/30">
        <div id="universe"></div>
        
        {/* Contact Drawer */}
        <div className={`absolute inset-y-0 left-0 w-64 bg-black/95 z-[70] border-r border-white/5 transition-transform duration-500 backdrop-blur-2xl ${showContacts ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-6 space-y-8">
                <div className="flex justify-between items-center">
                    <h2 className="font-header text-gold text-xs tracking-[3px]">ENTITIES</h2>
                    <button onClick={() => setShowContacts(false)} className="text-white/20 text-lg">✕</button>
                </div>
                
                <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-gold/5 border border-gold/20 flex items-center gap-3">
                        <span className="text-xl">{avatar}</span>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gold font-header tracking-widest uppercase">{username}</span>
                            <span className="text-[7px] text-white/40 uppercase">You (Manifested)</span>
                        </div>
                    </div>

                    <div className="h-px bg-white/5 my-4"></div>

                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {uniqueContacts.length === 0 ? (
                            <div className="text-[9px] text-white/20 uppercase tracking-widest text-center py-10 italic">No other entities found...</div>
                        ) : (
                            uniqueContacts.map((c: any) => (
                                <div key={c.id} className="p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 flex items-center gap-3 transition-all group">
                                    <span className="text-xl group-hover:scale-110 transition-transform">{c.avatar}</span>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-header tracking-widest uppercase" style={{ color: c.color }}>{c.name}</span>
                                        <span className="text-[7px] text-white/20 uppercase">Active in Void</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>

        <header className="p-4 border-b border-white/5 bg-black/80 backdrop-blur-md z-10 flex justify-between items-center relative">
            <div className="flex items-center gap-3">
                <button onClick={() => setShowContacts(true)} className="text-gold text-xl">☰</button>
                <div className="font-header text-gold text-[10px] tracking-widest">ORACLE v17.9</div>
            </div>

            {/* Centered Real-time Clock */}
            <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
                <div className="text-[10px] font-mono text-white/60 tracking-[2px] uppercase">
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
            </div>

            <div className="flex items-center gap-4">
                {notifPermission === 'default' && (
                    <button 
                        onClick={requestNotifPermission}
                        className="text-[8px] text-gold border border-gold/20 px-2 py-1 rounded-md animate-pulse uppercase tracking-widest"
                    >
                        Enable Notif
                    </button>
                )}
                <div className="relative">
                    <button onClick={() => setShowMenu(!showMenu)} className="text-white/40 hover:text-white text-xl px-2">⋮</button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                            <div className="absolute right-0 top-full mt-2 w-40 bg-zinc-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 animate-in zoom-in-95 origin-top-right">
                                <button 
                                    onClick={() => { setShowClearConfirm(true); setShowMenu(false); }}
                                    className="w-full text-left px-4 py-3 text-[10px] text-red-400 hover:bg-white/5 uppercase tracking-widest flex items-center gap-2"
                                >
                                    <span>🗑️</span> Clear Room
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>

        <div 
            ref={feedRef}
            className="flex-1 overflow-y-auto p-4 z-0 space-y-1 scroll-smooth pb-32"
            style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 20px)' }}
        >
            {messages.map(m => (
                <Bubble 
                    key={m.id} 
                    msg={m} 
                    isMe={m.nama === myIdentity} 
                    onReply={handleReply} 
                    onEdit={handleEdit} 
                    onViewOnce={handleViewOnce} 
                    onShare={handleShare}
                    currentAudioId={currentAudioId}
                    onPlayAudio={setCurrentAudioId}
                />
            ))}
            
            {Object.values(typingUsers).length > 0 && (
                <div className="flex flex-col gap-1 p-2 animate-pulse">
                    {Object.values(typingUsers).map((u: any) => (
                        <div key={u.name} className="flex items-center gap-2 text-[8px] font-header uppercase tracking-widest">
                            <span className="text-xs">{u.avatar}</span>
                            <span style={{ color: u.color }}>{u.name} is peering into the void...</span>
                        </div>
                    ))}
                </div>
            )}
        </div>


        {previewImage && (
            <div className="absolute inset-0 z-[60] bg-black/95 backdrop-blur-xl flex flex-col p-6 animate-fade-in">
                <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-0">
                    <div className="relative w-full max-w-[300px] aspect-square rounded-2xl overflow-hidden border border-gold/20 shadow-2xl shadow-gold/5">
                        <img 
                            src={previewImage.url} 
                            className="w-full h-full object-contain bg-zinc-900/50" 
                            alt="Preview" 
                        />
                    </div>
                    <div className="w-full max-w-[300px] space-y-4">
                        <textarea
                            value={imageCaption}
                            onChange={(e) => setImageCaption(e.target.value)}
                            placeholder="Add a mystic caption..."
                            className="w-full bg-transparent border-b border-gold/30 py-2 outline-none text-white font-mystic text-lg text-center resize-none"
                            rows={2}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
                    <button 
                        onClick={cancelImagePreview}
                        disabled={isUploading}
                        className="py-4 border border-white/10 text-white/40 font-header text-[10px] tracking-widest uppercase rounded-xl hover:bg-white/5"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmImageUpload}
                        disabled={isUploading}
                        className="py-4 bg-gold/10 border border-gold/40 text-gold font-header text-[10px] tracking-widest uppercase rounded-xl hover:bg-gold/20 disabled:opacity-50"
                    >
                        {isUploading ? 'Manifesting...' : 'Manifest'}
                    </button>
                </div>
            </div>
        )}

        {fateMode && (
            <div className="absolute inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 animate-fade-in">
                <div className="w-full max-w-[320px] bg-zinc-900 border border-gold/20 rounded-3xl p-8 space-y-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold/40 to-transparent"></div>
                    
                    <div className="text-center space-y-2">
                        <h3 className="font-header text-gold text-lg tracking-[5px] uppercase">Panggil Takdir</h3>
                        <p className="text-[8px] text-white/20 uppercase tracking-widest">Pilih intensitas energi</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <button onClick={()=>handleFate('LIGHT')} className="group relative py-5 bg-blue-500/5 border border-blue-500/20 rounded-2xl overflow-hidden transition-all hover:bg-blue-500/10 hover:border-blue-500/40 active:scale-95">
                            <div className="relative z-10 flex flex-col items-center gap-1">
                                <span className="text-blue-400 font-header text-xs tracking-[3px]">LIGHT</span>
                                <span className="text-[7px] text-blue-400/40 uppercase">Energi Lembut</span>
                            </div>
                        </button>
                        
                        <button onClick={()=>handleFate('DEEP')} className="group relative py-5 bg-purple-500/5 border border-purple-500/20 rounded-2xl overflow-hidden transition-all hover:bg-purple-500/10 hover:border-purple-500/40 active:scale-95">
                            <div className="relative z-10 flex flex-col items-center gap-1">
                                <span className="text-purple-400 font-header text-xs tracking-[3px]">DEEP</span>
                                <span className="text-[7px] text-purple-400/40 uppercase">Energi Dalam</span>
                            </div>
                        </button>
                        
                        <button 
                            disabled={!isAdult}
                            onClick={()=>handleFate('CHAOS')} 
                            className={`group relative py-5 bg-red-500/5 border border-red-500/20 rounded-2xl overflow-hidden transition-all hover:bg-red-500/10 hover:border-red-500/40 active:scale-95 ${!isAdult && 'opacity-20'}`}
                        >
                            <div className="relative z-10 flex flex-col items-center gap-1">
                                <span className="text-red-500 font-header text-xs tracking-[3px]">CHAOS</span>
                                <span className="text-[7px] text-red-500/40 uppercase">Energi Liar</span>
                            </div>
                        </button>
                    </div>

                    <button onClick={()=>setFateMode(false)} className="w-full text-white/20 text-[9px] uppercase tracking-[5px] pt-4 hover:text-white/40 transition-colors">Batal</button>
                </div>
            </div>
        )}

        {showClearConfirm && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in">
                <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-6 shadow-2xl">
                    <div className="space-y-2 text-center">
                        <div className="text-4xl mb-2">⚠️</div>
                        <h3 className="font-header text-gold text-lg tracking-widest">CONFIRM PURGE</h3>
                        <p className="text-xs text-white/60 leading-relaxed">
                            Are you sure you want to clear all messages? This action cannot be undone and will wipe the timeline for everyone.
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => setShowClearConfirm(false)}
                            className="py-3 rounded-xl border border-white/10 text-white/60 text-[10px] uppercase tracking-widest hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => { clearAllMessages(); setShowClearConfirm(false); }}
                            className="py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] uppercase tracking-widest hover:bg-red-500/20 transition-colors"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="p-2 pb-6 bg-black/95 border-t border-white/5 z-20 relative">
            {/* Reply Indicator */}
            {replyingTo && (
                <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/80 border-t border-white/10 mb-2 rounded-t-xl animate-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2">
                        <span className="text-gold text-xs">↩️</span>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-header text-gold tracking-widest uppercase">Replying to {(replyingTo.nama || "").split('|')[0]}</span>
                            <span className="text-[8px] text-white/40 truncate max-w-[200px] flex items-center gap-1">
                                {replyingTo.teks.startsWith('[IMG]') ? <><span className="text-[10px]">📷</span> Photo</> : 
                                 replyingTo.teks.startsWith('[VO]') ? <><span className="text-[10px]">👁️</span> Secret</> : 
                                 replyingTo.teks.startsWith('[VN]') ? <><span className="text-[10px]">🎤</span> Voice</> : 
                                 replyingTo.teks}
                            </span>
                        </div>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="text-white/40 hover:text-white text-xs">✕</button>
                </div>
            )}

            {/* Editing Indicator */}
            {editingMsg && (
                <div className="flex items-center justify-between px-4 py-2 bg-gold/10 border-t border-gold/20 mb-2 rounded-t-xl animate-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2">
                        <span className="text-gold text-xs">✏️</span>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-header text-gold tracking-widest uppercase">Editing Message</span>
                            <span className="text-[8px] text-white/40 truncate max-w-[200px]">{editingMsg.teks}</span>
                        </div>
                    </div>
                    <button onClick={() => { setEditingMsg(null); setInputText(''); }} className="text-white/40 hover:text-white text-xs">✕</button>
                </div>
            )}

            {/* Action Menu - Compact & Feature Rich */}
            {showActions && (
                <div className="absolute bottom-full left-2 right-2 mb-2 bg-zinc-900/98 border border-white/10 rounded-2xl p-3 grid grid-cols-5 gap-2 shadow-2xl backdrop-blur-3xl animate-in slide-in-from-bottom-2">
                    <button onClick={() => { fileInputRef.current?.click(); setShowActions(false); }} className="flex flex-col items-center gap-1.5 p-2 hover:bg-white/5 rounded-xl transition-all">
                        <span className="text-xl">📷</span>
                        <span className="text-[7px] font-header text-white/40 tracking-widest uppercase">Visual</span>
                    </button>
                    <button onClick={() => { setIsViewOnce(!isViewOnce); setShowActions(false); }} className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all border ${isViewOnce ? 'bg-red-500/20 border-red-500/40' : 'hover:bg-white/5 border-transparent'}`}>
                        <span className="text-xl">👁️</span>
                        <span className={`text-[7px] font-header tracking-widest uppercase ${isViewOnce ? 'text-red-400' : 'text-white/40'}`}>Secret</span>
                    </button>
                    <button onClick={() => { handleFate('LIGHT'); setShowActions(false); }} className="flex flex-col items-center gap-1.5 p-2 hover:bg-blue-500/10 rounded-xl transition-all border border-blue-500/10">
                        <span className="text-xl">💎</span>
                        <span className="text-[7px] font-header text-blue-400 tracking-widest uppercase">Light</span>
                    </button>
                    <button onClick={() => { handleFate('DEEP'); setShowActions(false); }} className="flex flex-col items-center gap-1.5 p-2 hover:bg-purple-500/10 rounded-xl transition-all border border-purple-500/10">
                        <span className="text-xl">🔮</span>
                        <span className="text-[7px] font-header text-purple-400 tracking-widest uppercase">Deep</span>
                    </button>
                    <button 
                        disabled={!isAdult}
                        onClick={() => { handleFate('CHAOS'); setShowActions(false); }} 
                        className={`flex flex-col items-center gap-1.5 p-2 hover:bg-red-500/10 rounded-xl transition-all border border-red-500/10 ${!isAdult && 'opacity-20'}`}
                    >
                        <span className="text-xl">🔥</span>
                        <span className="text-[7px] font-header text-red-500 tracking-widest uppercase">Chaos</span>
                    </button>
                </div>
            )}

            <div className="flex gap-2 items-center px-1">
                <button 
                    onClick={() => setShowActions(!showActions)}
                    className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${showActions ? 'bg-gold text-black rotate-45' : 'bg-white/5 text-white/40 hover:text-gold'} ${isInputFocused && !showActions ? 'animate-pulse border border-gold/50 text-gold shadow-[0_0_10px_rgba(212,175,55,0.2)]' : ''}`}
                >
                    <span className="text-xl">+</span>
                </button>
                
                <div className={`flex-1 bg-zinc-900/80 border ${isViewOnce ? 'border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-white/5'} rounded-full px-4 py-1.5 flex items-center gap-2 focus-within:border-gold/30 transition-all`}>
                    {isViewOnce && <span className="text-xs animate-pulse">👁️</span>}
                    <input 
                        type="text" 
                        value={inputText} 
                        onChange={handleInputChange} 
                        onFocus={() => setIsInputFocused(true)}
                        onBlur={() => setIsInputFocused(false)}
                        onKeyDown={(e)=>e.key==='Enter' && handleSendText()} 
                        placeholder={isRecording ? "Listening..." : "Whisper..."}
                        disabled={isRecording}
                        className="flex-1 bg-transparent py-1 outline-none text-white text-sm font-mystic placeholder:text-white/10" 
                    />
                    
                    {!inputText.trim() && !isRecording && (
                        <button 
                            onClick={startRecording}
                            className="w-8 h-8 flex items-center justify-center text-white/20 hover:text-red-500 transition-colors"
                        >
                            🎙️
                        </button>
                    )}
                </div>

                {(inputText.trim() || isRecording) && (
                    <button 
                        onClick={isRecording ? stopRecording : handleSendText} 
                        className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${isRecording ? 'bg-red-500 text-white' : 'bg-gold/10 text-gold hover:scale-105'}`}
                    >
                        {isRecording ? '■' : '➤'}
                    </button>
                )}
            </div>
        </div>
            
            <input 
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
            />

            {/* Secret Overlay */}
            {viewingSecret && (
                <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95" onClick={() => setViewingSecret(null)}>
                    {viewingSecret.startsWith('[IMG]') ? (
                        <img src={viewingSecret.replace('[IMG]', '').split('\n')[0]} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                    ) : (
                        <div className="bg-zinc-900 p-8 rounded-2xl border border-red-500/30 max-w-md w-full text-center space-y-4 shadow-[0_0_50px_rgba(220,38,38,0.2)]">
                            <div className="text-4xl animate-pulse">👁️</div>
                            <h3 className="text-red-400 font-header tracking-widest uppercase text-sm">Secret Glimpse</h3>
                            <p className="text-white/90 font-mystic text-lg leading-relaxed">{viewingSecret}</p>
                            <p className="text-[10px] text-white/30 uppercase tracking-widest mt-8">Tap anywhere to vanish forever</p>
                        </div>
                    )}
                </div>
            )}
    </div>
  );
}
