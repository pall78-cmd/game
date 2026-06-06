import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UnoGameState, UnoCard } from '../utils/UnoEngine';
import { UNO_CARD_SVG } from '../constants/boardGameDeck';
import { 
    MessageSquare, 
    Settings, 
    Volume2, 
    VolumeX, 
    Music, 
    Send, 
    Play, 
    Pause, 
    Sparkles, 
    AlertCircle, 
    HelpCircle, 
    X,
    Users,
    Check,
    Radio,
    ShieldAlert,
    Zap,
    BookOpen,
    MoreVertical,
    Copy,
    LogOut
} from 'lucide-react';
import { bgmManager, AVAILABLE_BGMS } from '../utils/bgmManager';

interface UnoBoardProps {
    G: UnoGameState;
    ctx: any;
    moves: any;
    playerID: string | null;
    matchID: string;
    displayGameId?: string;
    username?: string;
    onLeave?: () => void;
    onGameEnd?: (winner: string, players: string[]) => void;
}

export const ReactUnoBoard: React.FC<UnoBoardProps> = ({ G, ctx, moves, playerID, matchID, displayGameId, username, onLeave, onGameEnd }) => {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [pendingWildCardIndex, setPendingWildCardIndex] = useState<number | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [copied, setCopied] = useState(false);
    
    const displayId = displayGameId || matchID;
    const handleCopyId = () => {
        navigator.clipboard.writeText(displayId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    // Chat & Active log states
    const [chatTab, setChatTab] = useState<'chat' | 'log'>('chat');
    const [chatInput, setChatInput] = useState('');
    const [unreadChat, setUnreadChat] = useState(0);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const lastChatCountRef = useRef(0);

    // Local BGM manager bindings
    const [isPlayingBgm, setIsPlayingBgm] = useState(bgmManager.isPlaying);
    const [bgmTrackIdx, setBgmTrackIdx] = useState(bgmManager.getTrackIndex());
    const [bgmVolume, setBgmVolume] = useState(0.3);

    const isDark = G.isDarkSide;
    const sideStr = isDark ? 'Dark' : 'Light';

    // Synchronize BGM Local states
    useEffect(() => {
        setIsPlayingBgm(bgmManager.isPlaying);
        setBgmTrackIdx(bgmManager.getTrackIndex());
    }, [showSettings]);

    // Handle game end trigger
    useEffect(() => {
        if (G && G.status === 'finished' && G.winner) {
            const playerNames = G.players.map(p => p.name || p.id);
            onGameEnd?.(G.winner, playerNames);
        }
    }, [G?.status, G?.winner]);

    // Auto-scroll chat and track unread count
    const chatMsgCount = G?.chatMessages?.length || 0;
    useEffect(() => {
        if (chatMsgCount > lastChatCountRef.current) {
            if (!showChat) {
                setUnreadChat(prev => prev + (chatMsgCount - lastChatCountRef.current));
            }
            lastChatCountRef.current = chatMsgCount;
            // Scroll to bottom
            setTimeout(() => {
                chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 80);
        }
    }, [chatMsgCount, showChat]);

    // Auto-scroll log as well
    const logCount = G?.actionLog?.length || 0;
    useEffect(() => {
        setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 80);
    }, [logCount]);

    const handleDrawCard = () => {
        if (G.status !== 'playing') return;
        const myIndex = G.players.findIndex(p => p.id === playerID);
        if (myIndex === G.currentPlayerIndex) {
            moves.drawCard();
        }
    };

    const handlePlayCard = (index: number) => {
        if (G.status !== 'playing') return;
        const myIndex = G.players.findIndex(p => p.id === playerID);
        if (myIndex !== G.currentPlayerIndex) return;

        const me = G.players[myIndex];
        const card = me.hand[index];
        const sideData = G.isDarkSide ? card.dark : card.light;
        
        // Treat checking Wild Draw 2, Wild Draw Color, Wild, or Wild Reverse as color pick triggers
        if (sideData.color === 'Black' || sideData.value.includes('Wild')) {
            setPendingWildCardIndex(index);
            setShowColorPicker(true);
        } else {
            moves.playCard(index);
        }
    };

    const handleCallUno = () => {
        moves.callUno();
    };

    const handleColorChosen = (color: string) => {
        if (pendingWildCardIndex !== null) {
            moves.playCard(pendingWildCardIndex, color);
            setPendingWildCardIndex(null);
            setShowColorPicker(false);
        }
    };

    // Chat submittal
    const sendChat = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim()) return;
        moves.sendChatMessage(chatInput);
        setChatInput('');
    };

    // BGM change handlers
    const changeBgmTrack = (idx: number) => {
        bgmManager.setTrack(idx);
        setBgmTrackIdx(idx);
        setIsPlayingBgm(true);
    };

    const toggleBgmPlay = () => {
        if (bgmManager.isPlaying) {
            bgmManager.audio.pause();
            bgmManager.isPlaying = false;
            setIsPlayingBgm(false);
        } else {
            bgmManager.play();
            bgmManager.isPlaying = true;
            setIsPlayingBgm(true);
        }
    };

    const handleVolumeChange = (v: number) => {
        bgmManager.setVolume(v);
        setBgmVolume(v);
    };

    if (!G) {
        return <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center text-white">Loading game state...</div>;
    }

    const myPlayer = G.players.find(p => p.id === playerID);
    const isMyTurn = G.players[G.currentPlayerIndex]?.id === playerID;
    const opponents = G.players.filter(p => p.id !== playerID);

    // Color definitions for vibrant glows
    const colorClasses: {[key: string]: { border: string, bg: string, text: string, shadow: string }} = {
        'Red': { border: 'border-red-500', bg: 'bg-red-500/20', text: 'text-red-400', shadow: 'shadow-red-500/50' },
        'Yellow': { border: 'border-yellow-400', bg: 'bg-yellow-400/20', text: 'text-yellow-400', shadow: 'shadow-yellow-400/50' },
        'Green': { border: 'border-green-500', bg: 'bg-green-500/20', text: 'text-green-400', shadow: 'shadow-green-500/50' },
        'Blue': { border: 'border-blue-500', bg: 'bg-blue-500/20', text: 'text-blue-400', shadow: 'shadow-blue-500/50' },
        'Pink': { border: 'border-pink-500', bg: 'bg-pink-500/20', text: 'text-pink-400', shadow: 'shadow-pink-500/50' },
        'Teal': { border: 'border-teal-400', bg: 'bg-teal-400/20', text: 'text-teal-400', shadow: 'shadow-teal-400/50' },
        'Purple': { border: 'border-purple-500', bg: 'bg-purple-500/20', text: 'text-purple-400', shadow: 'shadow-purple-500/50' },
        'Orange': { border: 'border-orange-500', bg: 'bg-orange-500/20', text: 'text-orange-400', shadow: 'shadow-orange-500/50' },
        'Black': { border: 'border-zinc-700', bg: 'bg-zinc-800/50', text: 'text-zinc-300', shadow: 'shadow-zinc-700/50' }
    };

    const currentGlow = colorClasses[G.currentColor || 'Black'] || colorClasses['Black'];

    return (
        <div className="fixed inset-0 bg-zinc-950 z-[1000] flex flex-col font-sans overflow-hidden text-white select-none">
            {/* Outside-click dismiss backdrop for the options menu */}
            {showMenu && (
                <div 
                    className="fixed inset-0 z-45 bg-black/5" 
                    onClick={() => setShowMenu(false)} 
                />
            )}

            {/* Header Block */}
            <div className="flex-shrink-0 flex justify-between items-center px-3 sm:px-4 py-2 sm:py-3 bg-zinc-900/90 border-b border-white/5 backdrop-blur-md z-50 shadow-lg relative">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1 sm:gap-1.5">
                            <span className="text-[8px] sm:text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase font-black tracking-widest leading-none">
                                {sideStr}
                            </span>
                            <h1 className="text-xs sm:text-sm font-black tracking-widest text-indigo-300 uppercase">UNO FLIP</h1>
                        </div>
                    </div>
                </div>
                
                {/* Header Actions - 3 Dots Collapse Dropdown */}
                <div className="flex items-center gap-2 relative z-50">
                    <button 
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-1.5 sm:p-2 bg-gradient-to-b from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 text-white/90 active:scale-95 rounded-xl border border-white/10 relative transition-all duration-150 flex items-center justify-center shadow-lg"
                        title="Opsi Menu"
                    >
                        <MoreVertical className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-white/90" />
                        {unreadChat > 0 && (
                            <span className="absolute -top-1 -right-1 bg-green-500 text-black text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center animate-pulse shadow-md border border-zinc-950">
                                {unreadChat}
                            </span>
                        )}
                    </button>

                    <AnimatePresence>
                        {showMenu && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 top-full mt-2 w-56 bg-zinc-900/98 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden z-55 p-1.5 flex flex-col gap-1"
                            >
                                {/* Game Room Code badge & Copy */}
                                <div className="p-2 border-b border-white/5 flex flex-col gap-1 text-left">
                                    <span className="text-[8px] text-white/40 uppercase tracking-widest font-black leading-none">KODE RUANG GAME</span>
                                    <button 
                                        onClick={handleCopyId}
                                        className="flex items-center justify-between gap-1.5 w-full p-1.5 rounded-lg bg-black/40 border border-white/5 hover:bg-black/60 transition-all text-left group"
                                        title="Klik untuk salin ID Kamar"
                                    >
                                        <span className="text-xs text-yellow-400 font-mono font-black tracking-wider truncate mr-1">{displayId}</span>
                                        {copied ? (
                                            <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                        ) : (
                                            <Copy className="w-3.5 h-3.5 text-white/40 group-hover:text-white/80 transition-colors shrink-0" />
                                        )}
                                    </button>
                                    {copied && <span className="text-[8px] text-green-450 font-bold self-end animate-pulse">Berhasil disalin!</span>}
                                </div>

                                {/* Chat toggle option */}
                                <button 
                                    onClick={() => {
                                        setShowChat(!showChat);
                                        setUnreadChat(0);
                                        setShowMenu(false);
                                    }}
                                    className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all ${
                                        showChat
                                            ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/10'
                                            : 'hover:bg-white/5 text-white/80 hover:text-white'
                                    }`}
                                >
                                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                                    <span>Ruang Obrolan</span>
                                    {unreadChat > 0 && (
                                        <span className="ml-auto bg-green-500 text-black text-[9px] font-black h-4 px-1 rounded-full flex items-center justify-center animate-bounce min-w-[20px]">
                                            +{unreadChat}
                                        </span>
                                    )}
                                </button>

                                {/* BGM Settings toggle option */}
                                <button 
                                    onClick={() => {
                                        setShowSettings(true);
                                        setShowMenu(false);
                                    }}
                                    className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all ${
                                        showSettings
                                            ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/10'
                                            : 'hover:bg-white/5 text-white/80 hover:text-white'
                                    }`}
                                >
                                    <Settings className="w-4 h-4 text-purple-400" />
                                    <span>Lagu BGM & Suara</span>
                                </button>

                                {/* Leave Room option */}
                                {onLeave && (
                                    <button 
                                        onClick={() => {
                                            setShowMenu(false);
                                            onLeave();
                                        }}
                                        className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-left text-xs font-black transition-all hover:bg-red-500/10 text-red-400 hover:text-red-300 border border-transparent hover:border-red-500/20"
                                    >
                                        <LogOut className="w-4 h-4 text-red-500" />
                                        <span>Keluar Kamar</span>
                                    </button>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Game Interactive Workspace (Scales nicely) */}
            <div className="flex-1 relative z-10 flex flex-row justify-between p-3 overflow-hidden">
                
                {/* Mainboard */}
                <div className="flex-1 relative flex flex-col justify-between overflow-hidden p-2">
                    
                    {G.status === 'waiting' && (
                        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/90 backdrop-blur-sm">
                            <div className="bg-zinc-900/95 p-6 rounded-2xl border border-indigo-500/30 text-center max-w-sm w-full shadow-[0_20px_50px_rgba(99,102,241,0.15)] mx-4 animate-fade-in">
                                <Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-3 animate-pulse" />
                                <h2 className="text-xl font-black text-indigo-200">RUANG UNO FLIP</h2>
                                <p className="text-white/50 text-xs mt-1 mb-6 leading-relaxed">
                                    Bagikan ID game ini kepada kawan anda. Ketika semua sudah bergabung di lobi, klik tombol mulai dibawah!
                                </p>
                                <div className="bg-black/40 border border-white/5 p-3 rounded-xl mb-6">
                                    <span className="text-[11px] text-white/40 block uppercase tracking-wider font-bold">KODE KAMAR</span>
                                    <span className="text-lg text-yellow-400 font-mono font-black tracking-widest">{displayId}</span>
                                </div>
                                <button
                                    onClick={() => moves.startGame()}
                                    className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all duration-150 shadow-lg active:scale-95"
                                >
                                    Mulai Permainan Sekarang
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Opponents Badges Block (Compressed & Beautiful list) */}
                    <div className="w-full flex flex-wrap justify-center gap-2 px-2 py-1 z-10 select-none max-h-[25%] overflow-y-auto no-scrollbar">
                        {opponents.length === 0 ? (
                            <div className="text-xs text-white/30 italic">Belum ada lawan bergabung...</div>
                        ) : opponents.map((opp) => {
                            const isOppActive = G.players[G.currentPlayerIndex]?.id === opp.id;
                            const isOver1Card = opp.hand.length === 1;
                            const isViolatingUno = isOver1Card && !opp.hasCalledUno;

                            return (
                                <div 
                                    key={opp.id} 
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/70 border text-xs transition-all duration-300 ${
                                        isOppActive 
                                            ? 'border-yellow-400 bg-yellow-400/[0.04] shadow-[0_0_12px_rgba(250,204,21,0.15)]' 
                                            : 'border-white/5 bg-zinc-900/45'
                                    }`}
                                >
                                    {/* Opponent Identity Avatar */}
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                                        isOppActive ? 'bg-yellow-400 text-black' : 'bg-zinc-800 text-white/70'
                                    }`}>
                                        {opp.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1">
                                            <span className="font-bold max-w-[90px] break-all truncate leading-none text-white/90">{opp.name}</span>
                                            {isOppActive && <span className="text-[9px] bg-yellow-400/10 text-yellow-500 border border-yellow-400/20 px-1 py-0.2 rounded font-mono">Turn</span>}
                                        </div>
                                        <span className="text-[10px] text-white/40 mt-1 font-semibold">{opp.hand.length} kartu di tangan</span>
                                    </div>

                                    {/* Action penalty or safety labels */}
                                    {opp.hasCalledUno && opp.hand.length === 1 && (
                                        <span className="text-[9px] text-green-400 bg-green-400/10 border border-green-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">UNO SAFE</span>
                                    )}

                                    {/* PANIC TRIGGER: Catch uno opportunity if they forgot! */}
                                    {isViolatingUno && (
                                        <button 
                                            onClick={() => moves.catchUno(opp.id)}
                                            className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-[9px] font-black rounded-lg shadow-lg active:scale-95 flex items-center gap-0.5 animate-bounce border border-red-500"
                                            title="Tangkap lawan lupa teriak UNO!"
                                        >
                                            <Zap className="w-2.5 h-2.5 text-yellow-300" />
                                            TANGKAP!
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Stacking draw stack Warning alert Banner */}
                    {G.status === 'playing' && G.pendingDrawCount > 0 && (
                        <div className="w-full max-w-md mx-auto z-10 py-1">
                            <div className="bg-red-950/80 hover:bg-red-950/90 duration-200 border border-red-500/40 px-4 py-2 rounded-xl shadow-lg flex items-center gap-3 animate-pulse">
                                <ShieldAlert className="w-6 h-6 text-red-400 flex-shrink-0 animate-bounce" />
                                <div className="flex-1 text-left">
                                    <div className="text-2xs sm:text-xs text-red-300 font-bold uppercase tracking-wide">AKUMULASI PENALTI AKTIF</div>
                                    <div className="text-xs sm:text-sm text-white font-black">
                                        Pemain harus melempar kartu <strong className="text-yellow-400 font-black">Plus (+) / Wild Reverse</strong> atau <strong className="text-red-400">AMBIL PENALTI (+{G.pendingDrawCount} KARTU)!</strong>
                                    </div>
                                </div>
                                <div className="bg-red-600 text-white font-black px-3 py-1 rounded-lg text-lg sm:text-xl shadow shadow-red-900 border border-red-400">
                                    +{G.pendingDrawCount}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Dynamic Interactive Playboard Center Area (Highly scalable) */}
                    {G.status === 'playing' && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-2 sm:gap-4 py-0.5 sm:py-1 select-none my-auto">
                            
                            {/* Colorful Banner showing the explicit declared color */}
                            <div className="flex flex-col items-center gap-0.5 text-center px-3 sm:px-4 py-1 sm:py-2 bg-zinc-900/60 rounded-xl sm:rounded-2xl border border-white/5">
                                <span className="text-[9px] sm:text-[10px] text-white/40 uppercase font-black tracking-widest block">WARNA AKTIF SEKARANG</span>
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <div className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full border border-white/20 animate-pulse ${currentGlow.shadow} shadow-md`} style={{ backgroundColor: (G.currentColor || 'transparent').toLowerCase() }} />
                                    <span className={`text-xs sm:text-base font-black uppercase tracking-wider ${currentGlow.text}`}>
                                        {G.currentColor || 'Belum Ditentukan'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-4 sm:gap-14 scale-90 sm:scale-100">
                                
                                {/* Deck Card Pile (Touch clickable to draw/take stack penalty) */}
                                <div className="flex flex-col items-center gap-1 text-center font-bold">
                                    <div 
                                        className={`relative w-[68px] sm:w-[94px] h-[102px] sm:h-[141px] rounded-xl cursor-pointer transition-all duration-200 ${
                                            isMyTurn 
                                                ? 'hover:-translate-y-2 hover:scale-105 active:scale-95 shadow-[0_10px_20px_rgba(99,102,241,0.25)] border-2 border-indigo-400/[0.25]' 
                                                : 'opacity-40 cursor-not-allowed border border-white/5'
                                        }`}
                                        onClick={handleDrawCard}
                                        title={isMyTurn ? (G.pendingDrawCount > 0 ? `Terima penalti +${G.pendingDrawCount} kartu` : "Ambil Kartu") : "Menunggu giliran"}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-indigo-950 to-zinc-950 rounded-xl border-2 border-white/10 flex flex-col items-center justify-center shadow-2xl overflow-hidden">
                                            {/* Pattern lines on background */}
                                            <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
                                            <span className="text-white/20 font-black rotate-45 text-sm sm:text-lg tracking-wider drop-shadow scale-110">UNO</span>
                                            {G.pendingDrawCount > 0 && isMyTurn ? (
                                                <div className="absolute inset-x-1 bottom-1 sm:bottom-2.5 py-0.5 sm:py-1 bg-red-600/95 text-white rounded border border-red-450 flex flex-col items-center animate-pulse shadow">
                                                    <span className="text-[6px] sm:text-[8px] font-black uppercase leading-none tracking-tight">PENALTI</span>
                                                    <span className="text-[10px] sm:text-xs font-mono font-black">+{G.pendingDrawCount} K</span>
                                                </div>
                                            ) : (
                                                <span className="text-[8px] sm:text-[10px] text-indigo-300/40 font-mono mt-0.5 bg-black/30 px-1 py-0.2 rounded">
                                                    {G.deck.length} krt
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-[9px] sm:text-xs text-white/40 tracking-wider">Tumpukan Dek</span>
                                </div>

                                {/* Active top Discard Card Pile with vibrant live neon color rings! */}
                                <div className="flex flex-col items-center gap-1 text-center font-bold">
                                    <div className="relative w-[68px] sm:w-[94px] h-[102px] sm:h-[141px] flex items-center justify-center">
                                        
                                        {/* Colored Glow Aura corresponding to current color */}
                                        <div className={`absolute -inset-1.5 sm:-inset-2.5 rounded-2xl blur-[8px] sm:blur-[14px] opacity-45 sm:opacity-55 duration-500 animate-pulse ${currentGlow.bg}`} />
                                        
                                        {/* Main card representation */}
                                        {G.discardPile.length > 0 ? (
                                            <div 
                                                className={`w-full h-full shadow-2xl rounded-xl overflow-hidden border-2 duration-300 relative z-10 ${currentGlow.border}`}
                                                dangerouslySetInnerHTML={{ 
                                                    __html: (() => {
                                                        const topCard = G.discardPile[G.discardPile.length - 1];
                                                        const sideData = isDark ? topCard.dark : topCard.light;
                                                        const cardColor = sideData.color === 'Black' ? (G.currentColor || 'Black') : sideData.color;
                                                        return UNO_CARD_SVG(sideStr, cardColor, sideData.value);
                                                    })()
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full border-2 border-dashed border-white/15 rounded-xl flex items-center justify-center text-white/20 text-[9px]">Kosong</div>
                                        )}
                                    </div>
                                    <span className="text-[9px] sm:text-xs text-white/40 tracking-wider">Kartu Atas</span>
                                </div>

                                {/* Game direction widgets and volume widget */}
                                <div className="flex flex-col items-center gap-1 p-1.5 sm:p-2 bg-zinc-900/40 rounded-xl sm:rounded-2xl border border-white/5 shrink-0">
                                    <span className="text-[8px] sm:text-[9px] text-white/40 uppercase tracking-widest font-black leading-none mb-0.5">Arah</span>
                                    <div className="relative w-8 h-8 sm:w-11 sm:h-11 rounded-full border border-white/10 flex items-center justify-center bg-black/40 shadow-inner">
                                        <motion.div 
                                            animate={{ rotate: G.direction === 1 ? 360 : -360 }}
                                            transition={{ repeat: Infinity, ease: "linear", duration: 7 }}
                                            className="text-xs font-bold text-indigo-400"
                                        >
                                            {G.direction === 1 ? '↻' : '↺'}
                                        </motion.div>
                                    </div>
                                    <span className="text-[8px] sm:text-[9px] text-white/60 font-black mt-0.5 uppercase text-center tracking-tight">
                                        {G.direction === 1 ? 'Kanan' : 'Kiri'}
                                    </span>
                                </div>

                            </div>
                        </div>
                    )}

                    {/* Bottom controls panel (Active Player Hand + Reflex buttons) */}
                    {myPlayer && G.status === 'playing' && (
                        <div className="w-full flex flex-col items-center flex-shrink-0 z-20 bg-zinc-950/80 pb-2 pt-1 border-t border-white/5 rounded-2xl mt-auto">
                            
                            {/* Play status message row & self Reflex actions */}
                            <div className="flex items-center justify-between w-full max-w-lg px-4 py-1.5">
                                
                                {/* Bold and flashy status indicating who is playing */}
                                <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${isMyTurn ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-white/10 animate-pulse'}`} />
                                    <span className={`text-[11px] sm:text-xs font-extrabold tracking-wider uppercase ${isMyTurn ? 'text-green-400' : 'text-white/40'}`}>
                                        {isMyTurn ? '🔴 GILIRAN ANDA' : `MENUNGGU ${G.players[G.currentPlayerIndex]?.name?.toUpperCase()}`}
                                    </span>
                                </div>

                                {/* SELF UNO ACTIONS TRIGGER */}
                                <div className="flex items-center gap-2">
                                    {/* Play rule book tips */}
                                    <div className="text-[10px] text-white/30 hidden md:inline-flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded">
                                        <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                                        Hint: Lempar kartu sejenis/sewarna untuk play!
                                    </div>

                                    {/* Action button triggers */}
                                    {myPlayer.hand.length === 1 && (
                                        <div className="flex items-center gap-1.5">
                                            {myPlayer.hasCalledUno ? (
                                                <span className="flex items-center gap-1 bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] sm:text-xs px-3 py-1.5 rounded-full font-black uppercase tracking-widest shadow-md">
                                                    <Check className="w-3.5 h-3.5 text-green-400" />
                                                    SUDAH UNO
                                                </span>
                                            ) : (
                                                <button 
                                                    onClick={handleCallUno}
                                                    className="px-4 py-1.5 bg-gradient-to-r from-red-600 to-yellow-500 hover:from-red-500 hover:to-yellow-400 text-white text-[11px] sm:text-xs font-black rounded-full shadow-[0_0_15px_rgba(239,68,68,0.5)] active:scale-95 transition-all duration-150 animate-bounce"
                                                >
                                                    🔥 TERIAK UNO!
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Swipeable List of player cards (Very dense, non-overlapping, with high touch reaction) */}
                            <div className="w-full max-w-full overflow-x-auto no-scrollbar py-1 filter drop-shadow-[0_10px_15px_rgba(0,0,0,0.6)] select-none">
                                <div className="flex items-end justify-start sm:justify-center min-w-max pb-1.5 px-6 gap-1.5">
                                    
                                    {myPlayer.hand.map((card, i) => {
                                        const topCard = G.discardPile[G.discardPile.length - 1];
                                        const topSide = topCard ? (isDark ? topCard.dark : topCard.light) : null;
                                        const sideData = isDark ? card.dark : card.light;

                                        // Apply stacking restrictions if draw pile consists of active penalty count!
                                        const isPlayable = isMyTurn && (
                                            G.pendingDrawCount > 0 ? (
                                                // If there's an active penalty stack, we can only play card containing '+' or 'Draw' or 'Wild Reverse'
                                                (sideData.value.includes('+') || sideData.value.includes('Draw') || sideData.value === 'Wild Reverse') && 
                                                (sideData.color === 'Black' || sideData.color === G.currentColor || sideData.value === topSide?.value)
                                            ) : (
                                                // Standard legal play check
                                                sideData.color === 'Black' || 
                                                sideData.color === G.currentColor || 
                                                sideData.value === topSide?.value
                                            )
                                        );

                                        return (
                                            <div
                                                key={`${card.suit}-${card.value}-${i}`}
                                                className={`relative w-[54px] sm:w-[86px] h-[81px] sm:h-[129px] transition-all duration-200 origin-bottom transform ${
                                                    isPlayable 
                                                        ? 'cursor-pointer hover:-translate-y-6 hover:scale-115 hover:z-[50] active:scale-95 border-2 border-green-400 rounded-lg shadow-[0_0_15px_rgba(74,222,128,0.4)] ring-2 ring-green-400/20' 
                                                        : 'opacity-60 scale-95 hover:opacity-100 duration-200'
                                                }`}
                                                onClick={() => isPlayable && handlePlayCard(i)}
                                                title={isPlayable ? "Klik untuk mainkan kartu" : "Kartu tidak cocok"}
                                            >
                                                <div 
                                                    className="w-full h-full shadow-lg rounded-xl overflow-hidden pointer-events-none"
                                                    dangerouslySetInnerHTML={{ __html: UNO_CARD_SVG(sideStr, sideData.color, sideData.value) }}
                                                />
                                                {/* Play indicator badge */}
                                                {isPlayable && (
                                                    <div className="absolute top-1 right-1 h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-green-500 border border-white/60 flex items-center justify-center">
                                                        <Check className="w-2 sm:w-2.5 h-2 sm:h-2.5 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                </div>
                            </div>
                            
                            {/* Empty Hand prompt */}
                            {myPlayer.hand.length === 0 && (
                                <div className="text-sm text-yellow-400/80 italic p-2">Tidak memiliki kartu di tangan!</div>
                            )}

                        </div>
                    )}

                    {/* Winner layout */}
                    {G.status === 'finished' && (
                        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-50 backdrop-blur-md p-6">
                            <div className="max-w-xs text-center p-6 bg-zinc-900 border border-yellow-500/30 rounded-2xl shadow-2xl animate-bounce">
                                <Sparkles className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-spin duration-3000" />
                                <h1 className="text-3xl font-black text-yellow-400 tracking-wider">
                                    {G.winner === myPlayer?.name ? 'ANDA MENANG!' : 'PERMAINAN SELESAI'}
                                </h1>
                                <p className="text-white/60 text-xs mt-2 mb-6">
                                    Pemenang utama adalah <strong className="text-white font-bold">{G.winner}</strong>! Selamat!
                                </p>
                                {onLeave && (
                                    <button 
                                        onClick={onLeave}
                                        className="w-full py-3 bg-white text-zinc-950 font-black rounded-xl hover:bg-neutral-200 duration-150 shadow-xl"
                                    >
                                        Kembali ke Hub Utama
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                </div>

                {/* Right drawer slide-out - Chat Obrolan & Live logs pane */}
                <AnimatePresence>
                    {showChat && (
                        <motion.div 
                            initial={{ x: 300, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 300, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-zinc-900/98 backdrop-blur-xl border-l border-white/10 w-72 sm:w-80 shrink-0 flex flex-col z-40 shadow-2xl overflow-hidden rounded-l-2xl absolute sm:relative right-0 inset-y-0"
                        >
                            {/* Panel header */}
                            <div className="flex items-center justify-between p-3.5 border-b border-white/5 bg-black/20">
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-indigo-400 animate-pulse" />
                                    <span className="text-xs font-black tracking-widest uppercase">KOTAK INTERAKSI</span>
                                </div>
                                <button 
                                    onClick={() => setShowChat(false)}
                                    className="p-1 text-white/50 hover:text-white rounded-md hover:bg-white/5 duration-100"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Option Tabs (Chat vs Game log activity) */}
                            <div className="flex border-b border-white/5 text-2xs uppercase tracking-wider font-extrabold text-white">
                                <button 
                                    onClick={() => setChatTab('chat')}
                                    className={`flex-1 py-2.5 text-center transition-all border-b-2 ${chatTab === 'chat' ? 'border-indigo-400 text-indigo-300 bg-white/5' : 'border-transparent text-white/40 hover:text-white/70'}`}
                                >
                                    Obrolan ({chatMsgCount})
                                </button>
                                <button 
                                    onClick={() => setChatTab('log')}
                                    className={`flex-1 py-2.5 text-center transition-all border-b-2 ${chatTab === 'log' ? 'border-indigo-400 text-indigo-300 bg-white/5' : 'border-transparent text-white/40 hover:text-white/70'}`}
                                >
                                    Aktivitas ({logCount})
                                </button>
                            </div>

                            {/* Chat screen lists container */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar flex flex-col">
                                {chatTab === 'chat' ? (
                                    <>
                                        {(G.chatMessages || []).length === 0 ? (
                                            <div className="my-auto text-center text-white/20 text-xs italic flex flex-col gap-2 p-4">
                                                <MessageSquare className="w-8 h-8 text-white/10 mx-auto" />
                                                Belum ada obrolan. Buat pesan pertamamu dibawah!
                                            </div>
                                        ) : (
                                            (G.chatMessages || []).map((m) => {
                                                const isMine = m.senderId === playerID;
                                                return (
                                                    <div 
                                                        key={m.id} 
                                                        className={`flex flex-col max-w-[85%] text-xs shrink-0 ${isMine ? 'align-end ml-auto' : 'align-start mr-auto'}`}
                                                    >
                                                        <span className={`text-[10px] text-white/40 mb-0.5 ${isMine ? 'text-right' : 'text-left'}`}>
                                                            {isMine ? 'Anda' : m.senderName} • <span className="font-mono text-[9px]">{m.timestamp}</span>
                                                        </span>
                                                        <div className={`p-2.5 rounded-2xl leading-relaxed text-white break-words ${
                                                            isMine 
                                                                ? 'bg-indigo-600 rounded-tr-none shadow shadow-indigo-900 border border-indigo-500/10' 
                                                                : 'bg-zinc-800 rounded-tl-none border border-white/5'
                                                        }`}>
                                                            {m.message}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {(G.actionLog || []).length === 0 ? (
                                            <div className="my-auto text-center text-white/25 text-xs italic">
                                                Tidak ada aktivitas tercatat.
                                            </div>
                                        ) : (
                                            (G.actionLog || []).map((logLine, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className="font-mono text-[10px] text-zinc-300/80 leading-relaxed bg-black/20 p-2 rounded-lg border border-white/5"
                                                    style={{ borderLeftWidth: '3px', borderLeftColor: logLine.includes('Stack') || logLine.includes('penalty') ? '#f87171' : '#818cf8' }}
                                                >
                                                    {logLine}
                                                </div>
                                            ))
                                        )}
                                    </>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Chat Entry Submission Form at footer */}
                            {chatTab === 'chat' && (
                                <form onSubmit={sendChat} className="p-3 border-t border-white/5 bg-zinc-950 flex gap-2 items-center w-full">
                                    <input 
                                        type="text"
                                        placeholder="Ketik obrolan disini..."
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        className="flex-1 min-w-0 bg-zinc-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-white/30"
                                        maxLength={100}
                                    />
                                    <button 
                                        type="submit"
                                        className="w-8 h-8 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl duration-100 flex items-center justify-center active:scale-95 shrink-0"
                                        title="Kirim pesan"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                    </button>
                                </form>
                            )}

                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

            {/* COLOR SELECTION PICKER OVERLAY (VIBRANT NEON BENTO TILES) */}
            <AnimatePresence>
                {showColorPicker && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 flex items-center justify-center z-[1100] backdrop-blur-md"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 15 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 15 }}
                            className="bg-zinc-900 border border-indigo-500/20 p-6 rounded-3xl max-w-sm w-full shadow-2xl mx-4 text-center"
                        >
                            <Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-2 animate-bounce" />
                            <h3 className="text-lg font-black tracking-widest text-indigo-200 uppercase mb-1">DEKLARASI WARNA AKTIF</h3>
                            <p className="text-white/40 text-xs mb-6 font-semibold">Karena anda melempar kartu Wild, tentukan warna yang harus dimainkan selanjutnya!</p>
                            
                            <div className="grid grid-cols-2 gap-3.5 w-full">
                                {(isDark ? ['Pink', 'Teal', 'Purple', 'Orange'] : ['Red', 'Yellow', 'Green', 'Blue']).map(color => {
                                    // Custom style definitions
                                    const styles: {[k:string]: string} = {
                                        'Red': 'bg-red-600 hover:bg-red-500 hover:shadow-red-500/30 text-white',
                                        'Yellow': 'bg-yellow-500 hover:bg-yellow-400 hover:shadow-yellow-400/30 text-zinc-950',
                                        'Green': 'bg-green-600 hover:bg-green-500 hover:shadow-green-500/30 text-white',
                                        'Blue': 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/30 text-white',
                                        'Pink': 'bg-pink-600 hover:bg-pink-500 hover:shadow-pink-500/30 text-white',
                                        'Teal': 'bg-teal-600 hover:bg-teal-500 hover:shadow-teal-500/30 text-white',
                                        'Purple': 'bg-purple-600 hover:bg-purple-500 hover:shadow-purple-500/30 text-white',
                                        'Orange': 'bg-orange-600 hover:bg-orange-500 hover:shadow-orange-500/30 text-white'
                                    };
                                    return (
                                        <button
                                            key={color}
                                            onClick={() => handleColorChosen(color as any)}
                                            className={`aspect-[4/3] rounded-2xl shadow-lg font-black tracking-wide leading-none transition-all duration-150 transform hover:-translate-y-1 active:scale-95 flex flex-col items-center justify-center border-2 border-white/10 ${styles[color]}`}
                                        >
                                            <span className="text-xs uppercase bg-black/20 px-2.5 py-1 rounded-full">{color}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MUSIC BGM SETTINGS MODAL */}
            <AnimatePresence>
                {showSettings && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[1100] backdrop-blur-sm p-4">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-zinc-900 border border-white/5 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative"
                        >
                            <button 
                                onClick={() => setShowSettings(false)}
                                className="absolute top-4 right-4 text-white/50 hover:text-white p-1 hover:bg-white/5 rounded-md"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <div className="flex items-center gap-2 mb-4 text-indigo-400">
                                <Music className="w-5 h-5 animate-bounce" />
                                <h3 className="text-md font-black tracking-wider uppercase">PENGATUR BGM & SOUND</h3>
                            </div>

                            {/* Track Selector list */}
                            <div className="space-y-2 mb-6">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest block mb-1 text-left">PILIH AUDIO LAGU</span>
                                {AVAILABLE_BGMS.map((track, idx) => {
                                    const isCurrent = bgmTrackIdx === idx;
                                    return (
                                        <button
                                            key={track.id}
                                            onClick={() => changeBgmTrack(idx)}
                                            className={`w-full p-3 rounded-xl border text-xs flex items-center justify-between text-left transition-all ${
                                                isCurrent 
                                                    ? 'border-indigo-400 bg-indigo-500/10 text-indigo-300' 
                                                    : 'border-white/5 hover:bg-white/5 text-white/70'
                                            }`}
                                        >
                                            <div>
                                                <div className="font-bold">{track.name}</div>
                                                <div className="text-[10px] text-white/40 mt-0.5">MP3 Audio</div>
                                            </div>
                                            {isCurrent && isPlayingBgm && <div className="h-2 w-2 rounded-full bg-green-400 animate-ping" />}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Sound playback and mute buttons */}
                            <div className="flex items-center justify-between py-1 border-t border-b border-white/5 mb-6">
                                <span className="text-xs text-white/60 font-bold">Status BGM:</span>
                                <button 
                                    onClick={toggleBgmPlay}
                                    className={`px-4 py-2 rounded-xl text-2xs font-extrabold uppercase flex items-center gap-1.5 active:scale-95 duration-100 ${
                                        isPlayingBgm 
                                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' 
                                            : 'bg-green-500 text-black hover:bg-neutral-200'
                                    }`}
                                >
                                    {isPlayingBgm ? (
                                        <>
                                            <Pause className="w-3.5 h-3.5" /> Paused
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-3.5 h-3.5" /> Play Music
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Volume Slider controller */}
                            <div className="space-y-1.5 text-left mb-4">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-400 font-bold">Volume Suara</span>
                                    <span className="text-indigo-400 font-mono text-[10px] bg-indigo-500/10 px-1.5 py-0.5 rounded font-black">
                                        {Math.round(bgmVolume * 100)}%
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {bgmVolume === 0 ? <VolumeX className="w-4 h-4 text-white/30" /> : <Volume2 className="w-4 h-4 text-indigo-400" />}
                                    <input 
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={bgmVolume}
                                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                        className="flex-1 bg-zinc-800 accent-indigo-500 h-1.5 rounded-lg outline-none cursor-pointer"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
