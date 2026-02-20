import React, { useState, useRef } from 'react';
import { Message, FateCard } from '../types.ts';

interface BubbleProps {
    msg: Message;
    isMe: boolean;
    onReply: (m: Message) => void;
    onEdit: (m: Message) => void;
    onViewOnce: (m: Message) => void;
    onShare: (t: string) => void;
}

const AudioPlayer: React.FC<{ url: string }> = ({ url }) => {
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
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
        <div className="flex items-center gap-3 min-w-[200px] py-2 px-3 bg-black/20 rounded-xl">
            <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-gold/20 border border-gold/40 text-gold flex items-center justify-center active:scale-90 transition-transform shadow-lg">
                {playing ? (
                    <span className="text-[10px] font-bold">||</span>
                ) : (
                    <span className="ml-0.5 text-sm">▶</span>
                )}
            </button>
            <div className="flex-1 space-y-1">
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gold transition-all duration-100" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="flex justify-between text-[8px] opacity-40 font-mono uppercase tracking-tighter">
                   <span>{Math.floor(audioRef.current?.currentTime || 0)}s</span>
                   <span>{Math.floor(duration || 0)}s</span>
                </div>
            </div>
            <audio 
                ref={audioRef} 
                src={url} 
                onTimeUpdate={updateProgress} 
                onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                onEnded={() => setPlaying(false)} 
                className="hidden" 
            />
        </div>
    );
};

const FateCardDisplay: React.FC<{ raw: string, onShare: (t: string) => void }> = ({ raw, onShare }) => {
    try {
        const d: FateCard = JSON.parse(raw);
        const parts = d.content.split(":");
        const type = parts[0] || "FATE";
        const content = parts.slice(1).join(":").trim() || d.content;
        
        const isLight = type.includes("LIGHT");
        const isDeep = type.includes("DEEP");
        const isChaos = type.includes("CHAOS");

        let themeClass = "border-gold/40 shadow-gold/20";
        if (isLight) themeClass = "border-blue-500/50 shadow-blue-500/30 bg-blue-950/20";
        if (isDeep) themeClass = "border-purple-500/50 shadow-purple-500/30 bg-purple-950/20";
        if (isChaos) themeClass = "border-red-500/60 shadow-red-500/40 bg-red-950/20 animate-pulse";

        return (
            <div className={`p-5 rounded-2xl border ${themeClass} bg-gradient-to-br from-black to-zinc-900 text-center space-y-4 shadow-2xl relative overflow-hidden group transition-all duration-500`}>
                <div className={`absolute top-0 left-0 w-full h-1 ${isLight ? 'bg-blue-500' : isDeep ? 'bg-purple-500' : isChaos ? 'bg-red-500' : 'bg-gold'}/30`}></div>
                
                <div className="flex justify-between items-center px-1">
                    <div className={`text-[9px] font-header tracking-[5px] uppercase opacity-70 ${isLight ? 'text-blue-400' : isDeep ? 'text-purple-400' : isChaos ? 'text-red-400' : 'text-gold'}`}>{type}</div>
                    <button onClick={() => onShare(`${type}: ${content}`)} className="p-1.5 glass rounded-md hover:bg-white/10 transition-all opacity-40 group-hover:opacity-100">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                    </button>
                </div>

                <div className="font-mystic text-2xl italic text-white/95 leading-relaxed px-2 drop-shadow-md">"{content}"</div>
                
                <div className="pt-2 border-t border-white/5 flex items-center justify-center gap-2">
                   <div className={`w-1 h-1 rounded-full ${isLight ? 'bg-blue-500' : isDeep ? 'bg-purple-500' : isChaos ? 'bg-red-500' : 'bg-gold'}/50`}></div>
                   <div className="text-[7px] opacity-40 uppercase tracking-widest font-header">Invoked by {d.invoker}</div>
                   <div className={`w-1 h-1 rounded-full ${isLight ? 'bg-blue-500' : isDeep ? 'bg-purple-500' : isChaos ? 'bg-red-500' : 'bg-gold'}/50`}></div>
                </div>
            </div>
        );
    } catch { 
        return <div className="p-3 text-red-500 border border-red-500/20 rounded-lg text-xs italic">Takdir yang Terdistorsi</div>; 
    }
};

const Bubble: React.FC<BubbleProps> = ({ msg, isMe, onReply, onViewOnce, onShare }) => {
    const isOracle = msg.nama === "ORACLE";
    const isVO = msg.teks.startsWith("[VO]");
    const isVN = msg.teks.startsWith("[VN]");
    const isIMG = msg.teks.startsWith("[IMG]");
    
    return (
        <div className={`flex flex-col mb-4 animate-fade-in ${isMe ? 'items-end' : 'items-start'}`}>
            {!isOracle && (
                <span className={`text-[7px] font-header uppercase tracking-[2px] mb-1 px-3 ${isMe ? 'text-gold/50' : 'text-white/30'}`}>
                    {msg.nama}
                </span>
            )}
            <div 
                className={`p-3 max-w-[85%] rounded-2xl border transition-all ${
                    isOracle ? 'w-full max-w-full bg-transparent border-none' : 
                    isVO ? 'bg-red-950/20 border-red-500/30 text-red-400 cursor-pointer hover:bg-red-950/40' :
                    isMe ? 'bg-zinc-900/60 border-gold/20 text-gold/90 rounded-br-none shadow-xl' : 
                    'bg-zinc-800/40 border-white/5 text-white/80 rounded-bl-none'
                }`}
                onClick={() => isVO && onViewOnce(msg)}
            >
                {isOracle ? (
                    <FateCardDisplay raw={msg.teks} onShare={onShare} />
                ) : isVO ? (
                    <div className="flex items-center gap-3">
                        <span className="text-xl">👁️</span>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-header tracking-widest uppercase">Secret Glimpse</span>
                            <span className="text-[7px] opacity-40 uppercase">Tap to reveal</span>
                        </div>
                    </div>
                ) : isVN ? (
                    <AudioPlayer url={msg.teks.replace("[VN]", "")} />
                ) : isIMG ? (
                    <img 
                        src={msg.teks.replace("[IMG]", "")} 
                        className="rounded-lg max-h-64 object-contain border border-white/10" 
                        alt="Visual" 
                        loading="lazy"
                    />
                ) : (
                    <p className="font-mystic text-[17px] leading-relaxed break-words whitespace-pre-wrap">
                        {msg.teks.replace("[SHARED FATE] ", "")}
                    </p>
                )}
            </div>
            <span className="text-[6px] opacity-20 mt-1 px-2 font-mono uppercase tracking-widest">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>
    );
};

export default Bubble;