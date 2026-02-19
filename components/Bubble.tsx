import React, { useState, useRef } from 'react';
import { Message, FateCard } from '../types.ts';

interface BubbleProps {
    msg: Message;
    isMe: boolean;
    onReply: (m: Message) => void;
    onEdit: (m: Message) => void;
}

const AudioPlayer: React.FC<{ url: string, isMe: boolean }> = ({ url, isMe }) => {
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    const togglePlay = () => {
        if (!audioRef.current) return;
        playing ? audioRef.current.pause() : audioRef.current.play();
        setPlaying(!playing);
    };

    const updateProgress = () => {
        if (audioRef.current && audioRef.current.duration) {
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        }
    };

    return (
        <div className="flex items-center gap-3 min-w-[200px] py-1">
            <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-gold/20 border border-gold/40 text-gold flex items-center justify-center active:scale-90 transition-transform">
                {playing ? (
                    <span className="text-[8px] font-bold">||</span>
                ) : (
                    <span className="ml-0.5">▶</span>
                )}
            </button>
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }}></div>
            </div>
            <audio 
                ref={audioRef} 
                src={url} 
                onTimeUpdate={updateProgress} 
                onEnded={() => setPlaying(false)} 
                className="hidden" 
            />
        </div>
    );
};

const FateCardDisplay: React.FC<{ raw: string }> = ({ raw }) => {
    try {
        const d: FateCard = JSON.parse(raw);
        const parts = d.content.split(":");
        const type = parts[0] || "FATE";
        const content = parts.slice(1).join(":").trim() || d.content;
        
        return (
            <div className="p-5 rounded-2xl border border-gold/40 bg-gradient-to-br from-black to-zinc-900 text-center space-y-4 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gold/30"></div>
                <div className="text-[9px] font-header text-gold tracking-[5px] uppercase opacity-60">{type}</div>
                <div className="font-mystic text-lg italic text-white/90 leading-relaxed px-2">"{content}"</div>
                <div className="pt-2 border-t border-white/5 flex items-center justify-center gap-2">
                   <div className="w-1 h-1 rounded-full bg-gold/50"></div>
                   <div className="text-[7px] opacity-40 uppercase tracking-widest font-header">Invoked by {d.invoker}</div>
                   <div className="w-1 h-1 rounded-full bg-gold/50"></div>
                </div>
            </div>
        );
    } catch { 
        return <div className="p-3 text-red-500 border border-red-500/20 rounded-lg text-xs italic">Takdir yang Terdistorsi</div>; 
    }
};

const Bubble: React.FC<BubbleProps> = ({ msg, isMe, onReply, onEdit }) => {
    const isOracle = msg.nama === "ORACLE";
    const teks = msg.teks;
    
    return (
        <div className={`flex flex-col mb-4 animate-fade-in ${isMe ? 'items-end' : 'items-start'}`}>
            {!isOracle && (
                <span className={`text-[7px] font-header uppercase tracking-[2px] mb-1 px-3 ${isMe ? 'text-gold/50' : 'text-white/30'}`}>
                    {msg.nama}
                </span>
            )}
            <div className={`p-3 max-w-[85%] rounded-2xl border transition-all ${
                isOracle ? 'w-full max-w-full bg-transparent border-none' : 
                isMe ? 'bg-zinc-900/60 border-gold/20 text-gold/90 rounded-br-none shadow-[0_4px_15px_rgba(0,0,0,0.3)]' : 
                'bg-zinc-800/40 border-white/5 text-white/80 rounded-bl-none'
            }`}>
                {isOracle ? (
                    <FateCardDisplay raw={teks} />
                ) : (
                    teks.startsWith("[VN]") ? (
                        <AudioPlayer url={teks.replace("[VN]", "")} isMe={isMe} />
                    ) : teks.startsWith("[IMG]") ? (
                        <img 
                            src={teks.replace("[IMG]", "")} 
                            className="rounded-lg max-h-64 object-contain border border-white/10" 
                            alt="Visual" 
                            loading="lazy"
                        />
                    ) : (
                        <p className="font-mystic text-[16px] leading-relaxed break-words whitespace-pre-wrap">
                            {teks}
                        </p>
                    )
                )}
            </div>
            <span className="text-[6px] opacity-20 mt-1 px-2 font-mono">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
    );
};

export default Bubble;