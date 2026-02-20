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
  const [layer, setLayer] = useState<Layer>(() => safeStorage.get('oracle_adult') !== null ? 'SECURITY' : 'AGE');
  const [username, setUsername] = useState(() => safeStorage.get('oracle_user') || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [fateMode, setFateMode] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef(initDeck());

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
            
            if (document.hidden && newMsg.nama !== username && 'serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                    reg.active?.postMessage({
                        type: 'SHOW_NOTIFICATION',
                        payload: { sender: newMsg.nama, body: newMsg.teks.startsWith('[IMG]') ? 'Sent an image' : newMsg.teks }
                    });
                }).catch(() => {});
            }

            setTimeout(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, 100);
        })
        .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [layer, username]);

  const handleFate = async (int: Intensity) => {
      setFateMode(false);
      // Fixed: drawCard is now correctly exported from deck.ts
      const { content, newDeck } = drawCard(deckRef.current, int);
      deckRef.current = newDeck;
      try {
          await sendMessage("ORACLE", JSON.stringify({ content, invoker: username }));
      } catch (err) {
          console.error("Oracle error:", err);
      }
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    try {
        await sendMessage(username, text);
    } catch (err) {
        console.error("Send failed:", err);
        setInputText(text);
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

  if (layer === 'AGE') return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 text-center space-y-8">
        <h1 className="font-header text-gold text-2xl tracking-widest">VERIFIKASI USIA</h1>
        <div className="grid grid-cols-2 gap-4 w-full max-sm:max-w-[280px]">
            <button onClick={() => { setIsAdult(false); safeStorage.set('oracle_adult', 'false'); setLayer('SECURITY'); }} className="p-4 border border-white/20 rounded-xl hover:bg-white/5 active:scale-95 transition-all text-xs">DI BAWAH 18</button>
            <button onClick={() => { setIsAdult(true); safeStorage.set('oracle_adult', 'true'); setLayer('SECURITY'); }} className="p-4 border border-gold/40 rounded-xl text-gold hover:bg-gold/5 active:scale-95 transition-all text-xs">18+ TAHUN</button>
        </div>
    </div>
  );

  if (layer === 'SECURITY') return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 space-y-6">
        <h1 className="font-header text-gold tracking-[10px]">GATEWAY</h1>
        <input 
            type="password" 
            placeholder="ACCESS CODE" 
            autoFocus
            onChange={(e) => { if (e.target.value === '010304') setLayer(username ? 'MAIN' : 'NAME'); }} 
            className="bg-transparent border-b border-gold text-center py-4 outline-none text-gold tracking-[10px] text-lg w-full max-w-[200px]" 
        />
    </div>
  );

  if (layer === 'NAME') return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 space-y-10">
        <h1 className="font-header text-gold tracking-[5px]">SIAPA NAMAMU?</h1>
        <input 
            type="text" 
            maxLength={12}
            placeholder="NAMA..." 
            onChange={(e) => setUsername(e.target.value)} 
            className="bg-transparent border-b border-white text-center py-2 outline-none w-full max-w-[250px] font-mystic text-xl" 
        />
        <button 
            onClick={() => { if (username.trim()) { safeStorage.set('oracle_user', username); setLayer('MAIN'); } }} 
            className="px-12 py-3 border border-gold text-gold font-header tracking-widest hover:bg-gold hover:text-black transition-all text-xs"
        >
            MANIFEST
        </button>
    </div>
  );

  return (
    <div className="h-screen bg-void flex flex-col relative overflow-hidden">
        <div id="universe"></div>
        <header className="p-4 border-b border-white/5 bg-black/80 backdrop-blur-md z-10 flex justify-between items-center">
            <div className="font-header text-gold text-[10px] tracking-widest">ORACLE v17.9</div>
            <button onClick={() => { if(confirm("Clear room?")) clearAllMessages(); }} className="text-[9px] text-red-500/40 uppercase">Clear</button>
        </header>

        <div ref={feedRef} className="flex-1 overflow-y-auto p-4 z-10 space-y-1 scroll-smooth">
            {messages.map(m => (
                <Bubble 
                    key={m.id} 
                    msg={m} 
                    isMe={m.nama === username} 
                    onReply={() => {}} 
                    onEdit={() => {}} 
                    onViewOnce={() => {}} 
                    onShare={handleShare}
                />
            ))}
        </div>

        {fateMode && (
            <div className="absolute inset-x-0 bottom-24 z-50 p-6 bg-black/95 border-t border-gold/20 flex flex-col gap-4 rounded-t-3xl backdrop-blur-xl">
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={()=>handleFate('LIGHT')} className="py-4 border border-blue-500/30 text-blue-400 text-[10px] font-header rounded-lg">LIGHT</button>
                    <button onClick={()=>handleFate('DEEP')} className="py-4 border border-purple-500/30 text-purple-400 text-[10px] font-header rounded-lg">DEEP</button>
                    <button disabled={!isAdult} onClick={()=>handleFate('CHAOS')} className={`py-4 border border-red-500/30 text-red-500 text-[10px] font-header rounded-lg ${!isAdult && 'opacity-10'}`}>CHAOS</button>
                </div>
                <button onClick={()=>setFateMode(false)} className="text-white/20 text-[9px] uppercase tracking-widest">Close</button>
            </div>
        )}

        <div className="p-4 pb-8 bg-black/90 border-t border-white/5 z-20 space-y-4">
            <button onClick={()=>setFateMode(true)} className="w-full py-3 bg-gold/5 border border-gold/40 text-gold font-header text-[9px] tracking-[5px] uppercase rounded-lg">Panggil Takdir</button>
            <div className="flex gap-3 items-center">
                <input 
                    type="text" 
                    value={inputText} 
                    onChange={(e)=>setInputText(e.target.value)} 
                    onKeyDown={(e)=>e.key==='Enter' && handleSendText()} 
                    placeholder="Type..." 
                    className="flex-1 bg-transparent border-b border-white/10 py-1 outline-none text-white text-sm font-mystic" 
                />
                <button onClick={handleSendText} className="text-gold">➤</button>
            </div>
        </div>
    </div>
  );
}
