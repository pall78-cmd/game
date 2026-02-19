
import React, { useState, useEffect, useRef } from 'react';
import { supabase, sendMessage, clearAllMessages } from './services/supabase';
import { Message, Layer } from './types';
import { initDeck, drawCard, resetDeck, Intensity } from './utils/deck';
import Bubble from './components/Bubble';

export default function App() {
  const [isAdult, setIsAdult] = useState(() => localStorage.getItem('oracle_adult') === 'true');
  const [layer, setLayer] = useState<Layer>(() => localStorage.getItem('oracle_adult') ? 'SECURITY' : 'AGE');
  const [username, setUsername] = useState(() => localStorage.getItem('oracle_user') || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [fateMode, setFateMode] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef(initDeck());

  useEffect(() => {
    if (layer !== 'MAIN') return;
    const fetch = async () => {
        const { data } = await supabase.from('Pesan').select('*').order('id', { ascending: true });
        if (data) setMessages(data);
        setTimeout(() => feedRef.current?.scrollTo(0, feedRef.current.scrollHeight), 500);
    };
    fetch();
    const sub = supabase.channel('msgs').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Pesan' }, (p) => {
        setMessages(prev => [...prev, p.new as Message]);
        setTimeout(() => feedRef.current?.scrollTo(0, feedRef.current.scrollHeight), 100);
    }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [layer]);

  const handleFate = async (int: Intensity) => {
      setFateMode(false);
      const { content, newDeck } = drawCard(deckRef.current, int);
      deckRef.current = newDeck;
      await sendMessage("ORACLE", JSON.stringify({ content, invoker: username }));
  };

  if (layer === 'AGE') return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 text-center space-y-8">
        <h1 className="font-header text-gold text-2xl">VERIFIKASI USIA</h1>
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
            <button onClick={() => { setIsAdult(false); localStorage.setItem('oracle_adult', 'false'); setLayer('SECURITY'); }} className="p-4 border border-white/20 rounded-xl">DI BAWAH 18</button>
            <button onClick={() => { setIsAdult(true); localStorage.setItem('oracle_adult', 'true'); setLayer('SECURITY'); }} className="p-4 border border-gold/40 rounded-xl text-gold">18+ TAHUN</button>
        </div>
    </div>
  );

  if (layer === 'SECURITY') return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 space-y-6">
        <h1 className="font-header text-gold tracking-widest">GATEWAY</h1>
        <input type="password" placeholder="PASSWORD" onChange={(e) => e.target.value === '010304' && setLayer(username ? 'MAIN' : 'NAME')} className="bg-transparent border-b border-gold text-center py-2 outline-none text-gold tracking-widest" />
    </div>
  );

  if (layer === 'NAME') return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 space-y-6">
        <h1 className="font-header text-gold">IDENTITAS</h1>
        <input type="text" placeholder="NAMA..." onChange={(e) => setUsername(e.target.value)} className="bg-transparent border-b border-white text-center py-2 outline-none w-full max-w-xs" />
        <button onClick={() => { localStorage.setItem('oracle_user', username); setLayer('MAIN'); }} className="px-10 py-3 border border-gold text-gold font-header">MASUK</button>
    </div>
  );

  return (
    <div className="h-screen bg-void flex flex-col relative overflow-hidden">
        <div id="universe"></div>
        <header className="p-4 border-b border-white/5 bg-black/80 backdrop-blur-md z-10 flex justify-between items-center">
            <div className="font-header text-gold text-xs tracking-widest">ORACLE v17.9</div>
            <button onClick={() => { if(confirm("Hapus chat?")) clearAllMessages(); }} className="text-[10px] text-red-500">CLEAR</button>
        </header>
        <div ref={feedRef} className="flex-1 overflow-y-auto p-4 z-10">
            {/* Using a fragment to render Bubble and providing callbacks with correct signatures */}
            {messages.map(m => (
                <Bubble 
                    key={m.id} 
                    msg={m} 
                    isMe={m.nama === username} 
                    onReply={(msg: Message) => {}} 
                    onEdit={(msg: Message) => {}} 
                />
            ))}
        </div>
        {fateMode && (
            <div className="absolute inset-x-0 bottom-20 z-50 p-6 bg-black/95 border-t border-gold/20 animate-fade-in flex flex-col gap-4">
                <div className="font-header text-center text-gold text-[10px] tracking-widest mb-2">PILIH TAKDIR</div>
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={()=>handleFate('LIGHT')} className="py-4 border border-blue-500/30 text-blue-400 text-[10px] font-header">LIGHT</button>
                    <button onClick={()=>handleFate('DEEP')} className="py-4 border border-purple-500/30 text-purple-400 text-[10px] font-header">DEEP</button>
                    <button disabled={!isAdult} onClick={()=>handleFate('CHAOS')} className={`py-4 border border-red-500/30 text-red-500 text-[10px] font-header ${!isAdult && 'opacity-20'}`}>CHAOS</button>
                </div>
                <button onClick={()=>setFateMode(false)} className="text-white/20 text-[10px]">BATAL</button>
            </div>
        )}
        <div className="p-4 bg-black border-t border-white/5 z-20 space-y-3">
            <button onClick={()=>setFateMode(true)} className="w-full py-2 bg-gold/10 border border-gold/40 text-gold font-header text-[10px] tracking-widest uppercase">Panggil Takdir</button>
            <div className="flex gap-2">
                <input type="text" value={inputText} onChange={(e)=>setInputText(e.target.value)} onKeyDown={(e)=>e.key==='Enter' && (sendMessage(username, inputText), setInputText(''))} placeholder="Ketik pesan..." className="flex-1 bg-transparent border-b border-white/20 py-2 outline-none text-white text-sm" />
                <button onClick={()=>{sendMessage(username, inputText); setInputText('');}} className="text-gold">➤</button>
            </div>
        </div>
    </div>
  );
}
