import React, { useState, useEffect, useRef } from 'react';
import { supabase, sendMessage, clearAllMessages } from './services/supabase.ts';
import { Message, Layer } from './types.ts';
import { initDeck, drawCard, Intensity } from './utils/deck.ts';
import Bubble from './components/Bubble.tsx';

/**
 * Helper to safely access localStorage to prevent crashes in restricted environments.
 */
const safeStorage = {
  get: (key: string) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set: (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }
};

export default function App() {
  const [isAdult, setIsAdult] = useState(() => safeStorage.get('oracle_adult') === 'true');
  const [layer, setLayer] = useState<Layer>(() => safeStorage.get('oracle_adult') !== null ? 'SECURITY' : 'AGE');
  const [username, setUsername] = useState(() => safeStorage.get('oracle_user') || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [fateMode, setFateMode] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef(initDeck());

  // Registration for Service Worker with Origin Check
  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isProduction = window.location.hostname.includes('github.io');
    
    // Only register Service Worker if on production or localhost, and protocol is correct
    if ('serviceWorker' in navigator && (isProduction || isLocalhost || window.location.protocol === 'https:')) {
      // Avoid registering in AI Studio preview environments to prevent Origin Mismatch errors
      if (!window.location.hostname.includes('usercontent.goog') && !window.location.hostname.includes('ai.studio')) {
        navigator.serviceWorker.register('./sw.js')
          .then(() => console.log('Oracle: Service Worker Active'))
          .catch(err => {
             // Silently fail to avoid console noise in restricted frames
             console.debug('Service Worker Registration Skipped/Failed', err);
          });
      }
    }
  }, []);

  useEffect(() => {
    if (layer !== 'MAIN') return;

    const fetchMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('Pesan')
                .select('*')
                .order('id', { ascending: true });
            
            if (error) throw error;
            if (data) setMessages(data);
            
            setTimeout(() => {
                if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
            }, 500);
        } catch (err) {
            console.error("Supabase connection error:", err);
        }
    };

    fetchMessages();

    const sub = supabase.channel('msgs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Pesan' }, (p) => {
            const newMsg = p.new as Message;
            setMessages(prev => [...prev, newMsg]);
            
            // Push Notification trigger via Service Worker postMessage
            if (document.hidden && newMsg.nama !== username && 'serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                    reg.active?.postMessage({
                        type: 'SHOW_NOTIFICATION',
                        payload: {
                            sender: newMsg.nama,
                            body: newMsg.teks.startsWith('[IMG]') ? 'Sent an image' : newMsg.teks
                        }
                    });
                }).catch(() => {});
            }

            setTimeout(() => {
                if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
            }, 100);
        })
        .subscribe();

    return () => { 
        supabase.removeChannel(sub); 
    };
  }, [layer, username]);

  const handleFate = async (int: Intensity) => {
      setFateMode(false);
      const { content, newDeck } = drawCard(deckRef.current, int);
      deckRef.current = newDeck;
      try {
          await sendMessage("ORACLE", JSON.stringify({ content, invoker: username }));
      } catch (err) {
          console.error("Fate send error:", err);
      }
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    try {
        await sendMessage(username, text);
    } catch (err) {
        console.error("Send error:", err);
        setInputText(text);
    }
  };

  if (layer === 'AGE') return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 text-center space-y-8 animate-fade-in">
        <h1 className="font-header text-gold text-2xl tracking-widest">VERIFIKASI USIA</h1>
        <p className="font-mystic text-white/60 italic">Berapa lama jiwamu telah berkelana?</p>
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <button onClick={() => { setIsAdult(false); safeStorage.set('oracle_adult', 'false'); setLayer('SECURITY'); }} className="p-4 border border-white/20 rounded-xl hover:bg-white/5 active:scale-95 transition-all">DI BAWAH 18</button>
            <button onClick={() => { setIsAdult(true); safeStorage.set('oracle_adult', 'true'); setLayer('SECURITY'); }} className="p-4 border border-gold/40 rounded-xl text-gold hover:bg-gold/5 active:scale-95 transition-all">18+ TAHUN</button>
        </div>
    </div>
  );

  if (layer === 'SECURITY') return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 space-y-6 animate-fade-in">
        <h1 className="font-header text-gold tracking-[10px]">GATEWAY</h1>
        <input 
            type="password" 
            placeholder="KODE AKSES" 
            autoFocus
            onChange={(e) => {
                if (e.target.value === '010304') {
                    setLayer(username ? 'MAIN' : 'NAME');
                }
            }} 
            className="bg-transparent border-b border-gold text-center py-4 outline-none text-gold tracking-[15px] text-xl placeholder:tracking-normal placeholder:text-gold/20" 
        />
    </div>
  );

  if (layer === 'NAME') return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 space-y-10 animate-fade-in">
        <h1 className="font-header text-gold tracking-[5px]">SIAPA NAMAMU?</h1>
        <input 
            type="text" 
            maxLength={12}
            placeholder="NAMA JIWA..." 
            onChange={(e) => setUsername(e.target.value)} 
            className="bg-transparent border-b border-white text-center py-2 outline-none w-full max-w-xs font-mystic text-2xl" 
        />
        <button 
            onClick={() => { 
                if (username.trim()) {
                    safeStorage.set('oracle_user', username); 
                    setLayer('MAIN'); 
                }
            }} 
            className="px-12 py-4 border border-gold text-gold font-header tracking-widest hover:bg-gold hover:text-black transition-all"
        >
            MANIFESTASI
        </button>
    </div>
  );

  return (
    <div className="h-screen bg-void flex flex-col relative overflow-hidden animate-fade-in">
        <div id="universe"></div>
        <header className="p-4 border-b border-white/5 bg-black/80 backdrop-blur-md z-10 flex justify-between items-center">
            <div className="font-header text-gold text-xs tracking-widest">ORACLE v17.9</div>
            <button onClick={() => { if(confirm("Hapus semua pesan untuk semua orang?")) clearAllMessages(); }} className="text-[10px] text-red-500/50 hover:text-red-500 uppercase tracking-tighter">Clear Room</button>
        </header>

        <div ref={feedRef} className="flex-1 overflow-y-auto p-4 z-10 space-y-1 scroll-smooth">
            {messages.length === 0 && (
                <div className="h-full flex items-center justify-center text-white/10 font-header text-[10px] tracking-[5px]">KOSONG</div>
            )}
            {messages.map(m => (
                <Bubble 
                    key={m.id} 
                    msg={m} 
                    isMe={m.nama === username} 
                    onReply={() => {}} 
                    onEdit={() => {}} 
                />
            ))}
        </div>

        {fateMode && (
            <div className="absolute inset-x-0 bottom-24 z-50 p-6 bg-black/95 border-t border-gold/20 animate-fade-in flex flex-col gap-4 rounded-t-3xl backdrop-blur-xl shadow-2xl">
                <div className="font-header text-center text-gold text-[10px] tracking-[4px] mb-2 opacity-60">PILIH JALUR TAKDIR</div>
                <div className="grid grid-cols-3 gap-3">
                    <button onClick={()=>handleFate('LIGHT')} className="py-5 border border-blue-500/30 bg-blue-500/5 text-blue-400 text-[10px] font-header tracking-widest rounded-xl hover:bg-blue-500/10">LIGHT</button>
                    <button onClick={()=>handleFate('DEEP')} className="py-5 border border-purple-500/30 bg-purple-500/5 text-purple-400 text-[10px] font-header tracking-widest rounded-xl hover:bg-purple-500/10">DEEP</button>
                    <button disabled={!isAdult} onClick={()=>handleFate('CHAOS')} className={`py-5 border border-red-500/30 bg-red-500/5 text-red-500 text-[10px] font-header tracking-widest rounded-xl ${!isAdult ? 'opacity-10 grayscale cursor-not-allowed' : 'hover:bg-red-500/10'}`}>CHAOS</button>
                </div>
                <button onClick={()=>setFateMode(false)} className="text-white/20 text-[10px] mt-2 uppercase tracking-widest">Tutup</button>
            </div>
        )}

        <div className="p-4 pb-8 bg-black/90 border-t border-white/5 z-20 space-y-4 backdrop-blur-md">
            <button 
                onClick={()=>setFateMode(true)} 
                className="w-full py-3 bg-gold/5 border border-gold/40 text-gold font-header text-[10px] tracking-[6px] uppercase active:scale-95 transition-all shadow-[0_0_15px_rgba(212,175,55,0.1)] rounded-lg"
            >
                Panggil Takdir
            </button>
            <div className="flex gap-3 items-center px-1">
                <input 
                    type="text" 
                    value={inputText} 
                    onChange={(e)=>setInputText(e.target.value)} 
                    onKeyDown={(e)=>e.key==='Enter' && handleSendText()} 
                    placeholder="Bisikkan sesuatu..." 
                    className="flex-1 bg-transparent border-b border-white/10 py-2 outline-none text-white text-sm font-mystic placeholder:italic placeholder:opacity-30 focus:border-gold/50 transition-colors" 
                />
                <button onClick={handleSendText} className="text-gold p-2 active:scale-75 transition-transform">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
            </div>
        </div>
    </div>
  );
}