import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';

// --- CONFIG & SERVICES ---
const SUPA_URL = 'https://rruxlxoeelxjjjmhafkc.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJydXhseG9lZWx4ampqbWhhZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDU5OTMsImV4cCI6MjA4NTMyMTk5M30.oR2hl_BDD1P6Dmtos2So-aJ_eoFl1-Kwybt6mQnvq0Q';
const supabase = createClient(SUPA_URL, SUPA_KEY);

const safeStorage = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { } }
};

// --- DECK LOGIC (Merged) ---
const LIGHT_TRUTHS = ["Siapa selebriti crush pertamamu?", "Makanan aneh yang kamu suka?", "Kapan terakhir ngompol?", "Kartun masa kecil favorit?", "Siapa yang paling typo?", "Hal konyol yang kamu cari di Google?", "Guru paling dibenci?", "Naksir pacar teman?", "Kebohongan terakhir?"];
const LIGHT_DARES = ["Kirim stiker teraneh.", "Ganti nama admin jadi 'Paduka Raja'.", "VN lagu nasional pakai 'O'.", "Foto lantai sekarang.", "Selfie ekspresi jelek.", "Ketik pakai hidung: 'Aku Oracle'.", "Screenshot wallpaper HP."];
const LIGHT_WILDCARDS = ["Tunjuk siapa saja buat jawab Truth.", "Pilih member buat VN nyanyi.", "Truth buat kamu atau Dare buat bawahmu.", "Semua kirim emoji buat kamu."];

const DEEP_TRUTHS = ["Kapan terakhir menangis?", "Penyesalan terbesar tahun ini?", "Siapa yang paling dirindukan?", "Insecure bagian fisik mana?", "Ketakutan masa depan?", "Pesan terakhir buat grup?"];
const DEEP_DARES = ["Chat mantan 'Aku kangen'.", "Ceritakan rahasia terdalam.", "VN terima kasih ke ortu.", "Tulis surat buat masa lalu.", "Foto masa kecil memalukan."];
const DEEP_WILDCARDS = ["Semua jawab: Apa arti bahagia?", "Cerita aib atau puji musuh.", "Ungkap rahasia atau jujur rasa.", "Puji 1 orang di grup."];

const CHAOS_TRUTHS = ["Fantasi terliar?", "Kapan terakhir turn on?", "Posisi favorit?", "Fetish teraneh?", "Warna pakaian dalam?", "Pernah kirim nudes?"];
const CHAOS_DARES = ["Foto leher View Once.", "VN kata-kata nakal.", "VN suara ciuman.", "Foto lidah ahegao.", "VN panggil Daddy/Mommy."];
const CHAOS_WILDCARDS = ["VN desah atau foto bibir.", "Cerita mimpi basah atau pap paha.", "Dominant atau Submissive?", "Turn on terbesar?"];

const createFreshDeck = () => ({
    light: { truths: [...LIGHT_TRUTHS], dares: [...LIGHT_DARES], wildcards: [...LIGHT_WILDCARDS] },
    deep: { truths: [...DEEP_TRUTHS], dares: [...DEEP_DARES], wildcards: [...DEEP_WILDCARDS] },
    chaos: { truths: [...CHAOS_TRUTHS], dares: [...CHAOS_DARES], wildcards: [...CHAOS_WILDCARDS] }
});

const initDeck = () => {
    const saved = localStorage.getItem('oracle_deck_v17_9');
    return saved ? JSON.parse(saved) : createFreshDeck();
};

const drawCard = (currentDeck, intensity) => {
    const key = intensity.toLowerCase();
    const roll = Math.random();
    let type;
    let prefix = "";

    if (roll < 0.15) { type = 'wildcards'; prefix = "WILD: "; }
    else if (roll < 0.57) { type = 'truths'; prefix = "TRUTH: "; }
    else { type = 'dares'; prefix = "DARE: "; }

    let pool = currentDeck[key][type];
    if (!pool || pool.length === 0) pool = createFreshDeck()[key][type];

    const idx = Math.floor(Math.random() * pool.length);
    let card = pool[idx];
    const newPool = [...pool]; newPool.splice(idx, 1);
    const newDeck = { ...currentDeck, [key]: { ...currentDeck[key], [type]: newPool } };
    localStorage.setItem('oracle_deck_v17_9', JSON.stringify(newDeck));
    return { content: prefix + card, newDeck };
};

// --- COMPONENTS ---
const FateCardDisplay = ({ raw }) => {
    try {
        const d = JSON.parse(raw);
        const parts = d.content.split(":");
        const type = parts[0] || "FATE";
        const content = parts.slice(1).join(":").trim() || d.content;
        return (
            <div className="p-5 rounded-2xl border border-gold/40 bg-gradient-to-br from-black to-zinc-900 text-center space-y-4 shadow-2xl relative overflow-hidden">
                <div className="text-[9px] font-header text-gold tracking-[5px] uppercase opacity-60">{type}</div>
                <div className="font-mystic text-lg italic text-white/90 leading-relaxed px-2">"{content}"</div>
                <div className="pt-2 border-t border-white/5 flex items-center justify-center gap-2">
                   <div className="text-[7px] opacity-40 uppercase tracking-widest font-header">Invoked by {d.invoker}</div>
                </div>
            </div>
        );
    } catch { return <div className="p-3 text-red-500 italic">Takdir yang Terdistorsi</div>; }
};

const Bubble = ({ msg, isMe }) => {
    const isOracle = msg.nama === "ORACLE";
    return (
        <div className={`flex flex-col mb-4 animate-fade-in ${isMe ? 'items-end' : 'items-start'}`}>
            {!isOracle && <span className={`text-[7px] font-header uppercase tracking-[2px] mb-1 px-3 ${isMe ? 'text-gold/50' : 'text-white/30'}`}>{msg.nama}</span>}
            <div className={`p-3 max-w-[85%] rounded-2xl border transition-all ${
                isOracle ? 'w-full max-w-full bg-transparent border-none' : 
                isMe ? 'bg-zinc-900/60 border-gold/20 text-gold/90 rounded-br-none' : 
                'bg-zinc-800/40 border-white/5 text-white/80 rounded-bl-none'
            }`}>
                {isOracle ? <FateCardDisplay raw={msg.teks} /> : <p className="font-mystic text-[16px] leading-relaxed break-words">{msg.teks}</p>}
            </div>
        </div>
    );
};

// --- MAIN APP ---
function App() {
  const [isAdult, setIsAdult] = useState(() => safeStorage.get('oracle_adult') === 'true');
  const [layer, setLayer] = useState(() => safeStorage.get('oracle_adult') !== null ? 'SECURITY' : 'AGE');
  const [username, setUsername] = useState(() => safeStorage.get('oracle_user') || '');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [fateMode, setFateMode] = useState(false);
  const feedRef = useRef(null);
  const deckRef = useRef(initDeck());

  useEffect(() => {
    if (layer !== 'MAIN') return;
    const fetchMessages = async () => {
        const { data } = await supabase.from('Pesan').select('*').order('id', { ascending: true });
        if (data) setMessages(data);
        setTimeout(() => feedRef.current?.scrollTo(0, feedRef.current.scrollHeight), 500);
    };
    fetchMessages();
    const sub = supabase.channel('msgs').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Pesan' }, (p) => {
        setMessages(prev => [...prev, p.new]);
        setTimeout(() => feedRef.current?.scrollTo(0, feedRef.current.scrollHeight), 100);
    }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [layer]);

  const handleFate = async (int) => {
      setFateMode(false);
      const { content, newDeck } = drawCard(deckRef.current, int);
      deckRef.current = newDeck;
      await supabase.from('Pesan').insert([{ nama: "ORACLE", teks: JSON.stringify({ content, invoker: username }) }]);
  };

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    const t = inputText; setInputText('');
    await supabase.from('Pesan').insert([{ nama: username, teks: t }]);
  };

  if (layer === 'AGE') return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 text-center space-y-8">
        <h1 className="font-header text-gold text-2xl tracking-widest">VERIFIKASI USIA</h1>
        <div className="grid grid-cols-2 gap-4 w-full max-w-[300px]">
            <button onClick={() => { setIsAdult(false); safeStorage.set('oracle_adult', 'false'); setLayer('SECURITY'); }} className="p-4 border border-white/20 rounded-xl text-xs">DI BAWAH 18</button>
            <button onClick={() => { setIsAdult(true); safeStorage.set('oracle_adult', 'true'); setLayer('SECURITY'); }} className="p-4 border border-gold/40 rounded-xl text-gold text-xs">18+ TAHUN</button>
        </div>
    </div>
  );

  if (layer === 'SECURITY') return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 space-y-6">
        <h1 className="font-header text-gold tracking-[10px]">GATEWAY</h1>
        <input type="password" placeholder="ACCESS CODE" autoFocus onChange={(e) => { if (e.target.value === '010304') setLayer(username ? 'MAIN' : 'NAME'); }} className="bg-transparent border-b border-gold text-center py-4 outline-none text-gold tracking-[10px] w-full max-w-[200px]" />
    </div>
  );

  if (layer === 'NAME') return (
    <div className="h-screen bg-black flex flex-col items-center justify-center p-6 space-y-10">
        <h1 className="font-header text-gold tracking-[5px]">SIAPA NAMAMU?</h1>
        <input type="text" maxLength={12} placeholder="NAMA..." onChange={(e) => setUsername(e.target.value)} className="bg-transparent border-b border-white text-center py-2 outline-none w-full max-w-[250px] font-mystic text-xl" />
        <button onClick={() => { if (username.trim()) { safeStorage.set('oracle_user', username); setLayer('MAIN'); } }} className="px-12 py-3 border border-gold text-gold font-header tracking-widest text-xs">MANIFEST</button>
    </div>
  );

  return (
    <div className="h-screen bg-void flex flex-col relative overflow-hidden">
        <div id="universe"></div>
        <header className="p-4 border-b border-white/5 bg-black/80 backdrop-blur-md z-10 flex justify-between items-center">
            <div className="font-header text-gold text-[10px] tracking-widest">ORACLE v17.9</div>
            <button onClick={async () => { if(confirm("Clear?")) await supabase.from('Pesan').delete().neq('id', 0); }} className="text-[9px] text-red-500/40 uppercase">Clear</button>
        </header>

        <div ref={feedRef} className="flex-1 overflow-y-auto p-4 z-10 space-y-1 scroll-smooth">
            {messages.map(m => <Bubble key={m.id} msg={m} isMe={m.nama === username} />)}
        </div>

        {fateMode && (
            <div className="absolute inset-x-0 bottom-24 z-50 p-6 bg-black/95 border-t border-gold/20 flex flex-col gap-4 rounded-t-3xl backdrop-blur-xl">
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={()=>handleFate('LIGHT')} className="py-4 border border-blue-500/30 text-blue-400 text-[10px] font-header rounded-lg">LIGHT</button>
                    <button onClick={()=>handleFate('DEEP')} className="py-4 border border-purple-500/30 text-purple-400 text-[10px] font-header rounded-lg">DEEP</button>
                    <button disabled={!isAdult} onClick={()=>handleFate('CHAOS')} className={`py-4 border border-red-500/30 text-red-500 text-[10px] font-header rounded-lg ${!isAdult && 'opacity-10'}`}>CHAOS</button>
                </div>
                <button onClick={()=>setFateMode(false)} className="text-white/20 text-[9px] uppercase">Close</button>
            </div>
        )}

        <div className="p-4 pb-8 bg-black/90 border-t border-white/5 z-20 space-y-4">
            <button onClick={()=>setFateMode(true)} className="w-full py-3 bg-gold/5 border border-gold/40 text-gold font-header text-[9px] tracking-[5px] uppercase rounded-lg">Panggil Takdir</button>
            <div className="flex gap-3 items-center">
                <input type="text" value={inputText} onChange={(e)=>setInputText(e.target.value)} onKeyDown={(e)=>e.key==='Enter' && handleSendText()} placeholder="Type..." className="flex-1 bg-transparent border-b border-white/10 py-1 outline-none text-white text-sm font-mystic" />
                <button onClick={handleSendText} className="text-gold">➤</button>
            </div>
        </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);