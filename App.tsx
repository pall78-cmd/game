import React, { useState, useEffect, useRef } from 'react';
import { supabase, sendMessage, clearAllMessages } from './services/supabase.ts';
import { Message, Layer } from './types.ts';
import { initDeck, drawCard, Intensity } from './utils/deck.ts';
import Bubble from './components/Bubble.tsx';

const safeStorage = {
  get: (key: string) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set: (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch { /* silences error */ }
  }
};

export default function App() {
  const [isAdult, setIsAdult] = useState(() => safeStorage.get('oracle_adult') === 'true');
  const [layer, setLayer] = useState<Layer>(() => {
    const adult = safeStorage.get('oracle_adult');
    const user = safeStorage.get('oracle_user');
    if (adult === null) return 'AGE';
    if (user === null) return 'NAME';
    return 'SECURITY';
  });
  const [username, setUsername] = useState(() => safeStorage.get('oracle_user') || '');
  const [avatar, setAvatar] = useState(() => safeStorage.get('oracle_avatar') || '🔮');
  const [userColor, setUserColor] = useState(() => safeStorage.get('oracle_color') || '#D4AF37');
  
  const myIdentity = `${username}|${avatar}|${userColor}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string, avatar: string, color: string, timestamp: number }>>({});
  const [fateMode, setFateMode] = useState(false);
  const [lastFate, setLastFate] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ file: File, url: string } | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [knownEntities, setKnownEntities] = useState<Record<string, { id: string, name: string, avatar: string, color: string }>>(() => {
    const saved = safeStorage.get('oracle_entities');
    return saved ? JSON.parse(saved) : {};
  });
  const [isRecording, setIsRecording] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef(initDeck());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Registrasi Service Worker yang lebih aman
  useEffect(() => {
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
            
            if (newMsg.nama === "ORACLE") {
                setLastFate(newMsg.teks);
            }

            if (document.hidden && newMsg.nama !== username && 'serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                    reg.active?.postMessage({
                        type: 'SHOW_NOTIFICATION',
                        payload: { 
                            sender: newMsg.nama.split('|')[0], 
                            body: newMsg.teks.startsWith('[IMG]') ? 'Sent an image' : 
                                  newMsg.teks.startsWith('[VN]') ? 'Sent a voice note' : 
                                  newMsg.teks 
                        }
                    });
                }).catch(() => {});
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

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    try {
        await sendMessage(myIdentity, text);
    } catch (err) {
        console.error("Send failed:", err);
        setInputText(text);
    }
  };

  const lastTypingRef = useRef(0);
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
      const { uploadImage } = await import('./services/supabase.ts');
      const publicUrl = await uploadImage(previewImage.file);
      const messageText = imageCaption.trim() ? `[IMG]${publicUrl}\n${imageCaption}` : `[IMG]${publicUrl}`;
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
          const { uploadImage } = await import('./services/supabase.ts'); // Reuse upload logic
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
    const [name] = m.nama.split('|');
    setInputText(`@${name} `);
  };

  const uniqueContacts = Object.values(knownEntities);

  if (layer === 'AGE') return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 text-center space-y-12 overflow-hidden">
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
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 space-y-8">
        <div className="text-4xl animate-pulse">🧿</div>
        <h1 className="font-header text-gold tracking-[10px] text-sm">GATEWAY ACCESS</h1>
        <div className="w-full max-w-[200px] relative">
            <input 
                type="password" 
                placeholder="••••••" 
                autoFocus
                maxLength={6}
                onChange={(e) => { if (e.target.value === '010304') setLayer('MAIN'); }} 
                className="bg-transparent border-b border-gold/40 text-center py-4 outline-none text-gold tracking-[15px] text-2xl w-full focus:border-gold transition-all" 
            />
        </div>
        <button onClick={() => setLayer('NAME')} className="text-[8px] text-white/20 uppercase tracking-widest hover:text-white/40">Change Identity</button>
    </div>
  );

  if (layer === 'NAME') return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 space-y-8 overflow-y-auto">
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
                    {['🔮', '🧿', '🕯️', '🌙', '☀️', '🌑', '🪐', '💀'].map(a => (
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
                <div className="flex justify-center gap-3">
                    {['#D4AF37', '#DC2626', '#10B981', '#3B82F6', '#8B5CF6'].map(c => (
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
    <div className="h-screen bg-void flex flex-col relative overflow-hidden">
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

        <header className="p-4 border-b border-white/5 bg-black/80 backdrop-blur-md z-10 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <button onClick={() => setShowContacts(true)} className="text-gold text-xl">☰</button>
                <div className="font-header text-gold text-[10px] tracking-widest">ORACLE v17.9</div>
            </div>
            <button onClick={() => { if(confirm("Clear room?")) clearAllMessages(); }} className="text-[9px] text-red-500/40 uppercase">Clear</button>
        </header>

        <div ref={feedRef} className="flex-1 overflow-y-auto p-4 z-10 space-y-1 scroll-smooth pb-32">
            {messages.filter(m => m.nama !== "ORACLE").map(m => (
                <Bubble 
                    key={m.id} 
                    msg={m} 
                    isMe={m.nama === myIdentity} 
                    onReply={handleReply} 
                    onEdit={() => {}} 
                    onViewOnce={() => {}} 
                    onShare={handleShare}
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

        {/* Dedicated Fate Panel */}
        {lastFate && (
            <div className="absolute top-20 inset-x-4 z-40 animate-in slide-in-from-top-4">
                <div className="relative">
                    <button 
                        onClick={() => setLastFate(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-black border border-white/10 rounded-full flex items-center justify-center text-[10px] text-white/40 z-50"
                    >
                        ✕
                    </button>
                    <Bubble 
                        msg={{ id: 0, nama: "ORACLE", teks: lastFate, created_at: new Date().toISOString() }} 
                        isMe={false} 
                        onReply={() => {}} 
                        onEdit={() => {}} 
                        onViewOnce={() => {}} 
                        onShare={handleShare}
                    />
                </div>
            </div>
        )}

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

        <div className="p-2 pb-6 bg-black/95 border-t border-white/5 z-20 relative">
            {/* Action Menu - Compact & Feature Rich */}
            {showActions && (
                <div className="absolute bottom-full left-2 right-2 mb-2 bg-zinc-900/98 border border-white/10 rounded-2xl p-3 grid grid-cols-4 gap-2 shadow-2xl backdrop-blur-3xl animate-in slide-in-from-bottom-2">
                    <button onClick={() => { fileInputRef.current?.click(); setShowActions(false); }} className="flex flex-col items-center gap-1.5 p-2 hover:bg-white/5 rounded-xl transition-all">
                        <span className="text-xl">📷</span>
                        <span className="text-[7px] font-header text-white/40 tracking-widest uppercase">Visual</span>
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
                    className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${showActions ? 'bg-gold text-black rotate-45' : 'bg-white/5 text-white/40 hover:text-gold'}`}
                >
                    <span className="text-xl">+</span>
                </button>
                
                <div className="flex-1 bg-zinc-900/80 border border-white/5 rounded-full px-4 py-1.5 flex items-center gap-2 focus-within:border-gold/30 transition-all">
                    <input 
                        type="text" 
                        value={inputText} 
                        onChange={handleInputChange} 
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
    </div>
  );
}
