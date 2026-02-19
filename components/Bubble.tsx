
import React, { useState, useRef } from 'react';
import { Message, FateCard } from '../types';

/**
 * Prop interface for the Bubble component to define expected types and 
 * facilitate React's internal prop handling.
 */
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

    return (
        <div className="flex items-center gap-3 min-w-[200px]">
            <button onClick={togglePlay} className="w-9 h-9 rounded-full bg-gold text-black flex items-center justify-center">
                {playing ? "||" : "▶"}
            </button>
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }}></div>
            </div>
            <audio ref={audioRef} src={url} onTimeUpdate={() => setProgress((audioRef.current!.currentTime / audioRef.current!.duration) * 100)} onEnded={() => setPlaying(false)} className="hidden" />
        </div>
    );
};

const FateCardDisplay: React.FC<{ raw: string }> = ({ raw }) => {
    try {
        const d: FateCard = JSON.parse(raw);
        const parts = d.content.split(":");
        const type = parts[0];
        const content = parts.slice(1).join(":").trim();
        return (
            <div className="p-4 rounded-xl border border-gold/40 bg-black/60 text-center space-y-2">
                <div className="text-[10px] font-header text-gold tracking-widest uppercase">{type}</div>
                <div className="font-mystic text-lg italic">"{content}"</div>
                <div className="text-[8px] opacity-40 uppercase tracking-tighter">By {d.invoker}</div>
            </div>
        );
    } catch { return null; }
};

/**
 * Bubble component represents a chat message bubble.
 * Uses React.FC to handle standard React props like 'key' and provide better type checking.
 */
const Bubble: React.FC<BubbleProps> = ({ msg, isMe, onReply, onEdit }) => {
    const isOracle = msg.nama === "ORACLE";
    const teks = msg.teks;
    
    return (
        <div className={`flex flex-col mb-4 ${isMe ? 'items-end' : 'items-start'}`}>
            <span className="text-[8px] font-header text-zinc-500 mb-1 px-2">{msg.nama}</span>
            <div className={`p-3 max-w-[85%] rounded-2xl border ${isMe ? 'bg-zinc-900 border-gold/30 rounded-br-none' : 'bg-zinc-800 border-white/5 rounded-bl-none'} shadow-xl`}>
                {isOracle ? <FateCardDisplay raw={teks} /> : (
                    teks.startsWith("[VN]") ? <AudioPlayer url={teks.replace("[VN]", "")} isMe={isMe} /> :
                    teks.startsWith("[IMG]") ? <img src={teks.replace("[IMG]", "")} className="rounded-lg max-h-60" alt="content" /> :
                    <p className="font-mystic text-[15px]">{teks}</p>
                )}
            </div>
        </div>
    );
};

export default Bubble;
