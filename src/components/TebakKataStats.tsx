import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ResponsiveContainer, 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    Tooltip, 
    CartesianGrid 
} from 'recharts';
import { 
    Trophy, 
    Calendar, 
    Share2, 
    Download, 
    Bell, 
    Settings, 
    X, 
    Sparkles, 
    Clock, 
    Flame, 
    TrendingUp, 
    Activity 
} from 'lucide-react';
import { StreakManager, StreakState } from '../utils/StreakManager';

interface TebakKataStatsProps {
    username: string;
    onClose?: () => void;
}

export const TebakKataStats: React.FC<TebakKataStatsProps> = ({ username, onClose }) => {
    const [streakState, setStreakState] = useState<StreakState>(() => StreakManager.load());
    const [weeklyData, setWeeklyData] = useState(() => StreakManager.getWeeklyActivityData());
    const [reminderEnabled, setReminderEnabled] = useState(streakState.reminderEnabled);
    const [reminderTime, setReminderTime] = useState(streakState.reminderTime);
    
    // Popup state
    const [showMilestonePopup, setShowMilestonePopup] = useState(false);
    const [milestoneValue, setMilestoneValue] = useState(0);
    const [fateCardUrl, setFateCardUrl] = useState<string | null>(null);
    const [isGeneratingCard, setIsGeneratingCard] = useState(false);

    // Canvas ref for drawing the Fate Card
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        // Look for pending milestones on mount
        try {
            const raw = localStorage.getItem('tebak_kata_new_milestone_claim');
            if (raw) {
                const claim = JSON.parse(raw);
                if (claim.unlocked && Date.now() - claim.timestamp < 300000) { // Valid within 5 mins
                    setMilestoneValue(claim.streakCount);
                    setShowMilestonePopup(true);
                    // Clear the claim so it doesn't pop up again
                    localStorage.removeItem('tebak_kata_new_milestone_claim');
                }
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    const handleUpdateSettings = (enabled: boolean, time: string) => {
        setReminderEnabled(enabled);
        setReminderTime(time);
        const updated = StreakManager.updateSettings(enabled, time);
        setStreakState(updated);
    };

    // Generate and Download the Fate Card
    const generateFateCard = () => {
        setIsGeneratingCard(true);
        setTimeout(() => {
            try {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Canvas dimensions
                canvas.width = 400;
                canvas.height = 600;

                // Draw background (Mysterious dark celestial gradient)
                const grad = ctx.createLinearGradient(0, 0, 0, 600);
                grad.addColorStop(0, '#09090b'); // zinc-950
                grad.addColorStop(0.5, '#18181b'); // zinc-900
                grad.addColorStop(1, '#020202'); // black
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 400, 600);

                // Draw stars background
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                for (let i = 0; i < 60; i++) {
                    const x = Math.random() * 400;
                    const y = Math.random() * 600;
                    const size = Math.random() * 2;
                    ctx.fillRect(x, y, size, size);
                }

                // Draw mystical golden frames/borders
                ctx.strokeStyle = '#EAB308'; // gold / yellow-500
                ctx.lineWidth = 2;
                ctx.strokeRect(15, 15, 370, 570);

                ctx.strokeStyle = 'rgba(234, 179, 8, 0.3)';
                ctx.lineWidth = 1;
                ctx.strokeRect(22, 22, 356, 556);

                // Draw corners (Tarot card style elegant corner lines)
                const drawCorner = (x: number, y: number, xSign: number, ySign: number) => {
                    ctx.strokeStyle = '#EAB308';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(x + xSign * 30, y);
                    ctx.lineTo(x, y);
                    ctx.lineTo(x, y + ySign * 30);
                    ctx.stroke();
                };
                drawCorner(15, 15, 1, 1);
                drawCorner(385, 15, -1, 1);
                drawCorner(15, 585, 1, -1);
                drawCorner(385, 585, -1, -1);

                // Title Banner: "KARTU TAKDIR"
                ctx.fillStyle = 'rgba(234, 179, 8, 0.15)';
                ctx.fillRect(80, 50, 240, 40);
                ctx.strokeStyle = '#EAB308';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(80, 50, 240, 40);

                ctx.fillStyle = '#EAB308';
                ctx.font = 'bold 15px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('KARTU TAKDIR • DIVINASI', 200, 70);

                // Draw celestial crescent moon or star icon in the center
                ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(200, 200, 70, 0, Math.PI * 2);
                ctx.stroke();

                // Golden Glowing Flame for Streak
                ctx.shadowColor = '#F59E0B';
                ctx.shadowBlur = 15;
                ctx.fillStyle = '#F59E0B'; // Amber flame
                ctx.beginPath();
                // Flame outline path
                ctx.moveTo(200, 150);
                ctx.bezierCurveTo(170, 190, 175, 230, 200, 245);
                ctx.bezierCurveTo(225, 230, 230, 190, 200, 150);
                ctx.fill();
                ctx.shadowBlur = 0; // reset shadow

                // Outer circle moon accent
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 36px font-sans';
                ctx.fillText(`${milestoneValue || streakState.streakCount}`, 200, 310);

                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.font = '10px monospace';
                ctx.fillText('HARI STREAK TEBAK KATA', 200, 340);

                // Divider Line
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.beginPath();
                ctx.moveTo(80, 380);
                ctx.lineTo(320, 380);
                ctx.stroke();

                // User details
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 18px sans-serif';
                ctx.fillText(username.toUpperCase() || 'PENGEMBARA TAKDIR', 200, 420);

                ctx.fillStyle = 'rgba(234, 179, 8, 0.8)';
                ctx.font = 'italic 12px sans-serif';
                ctx.fillText('“Mencatatkan Rekor di Lembaran Bintang”', 200, 450);

                // Footer stats
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.font = '11px sans-serif';
                ctx.fillText(`Best Streak: ${streakState.bestStreak} Hari`, 200, 500);
                ctx.fillText(`Portal Divinasi • ${new Date().toLocaleDateString('id-ID')}`, 200, 525);

                // Convert to blob and trigger download
                const dataUrl = canvas.toDataURL('image/png');
                setFateCardUrl(dataUrl);

                // Download Link Action
                const link = document.createElement('a');
                link.download = `fate-card-${username || 'player'}-${milestoneValue || streakState.streakCount}-streak.png`;
                link.href = dataUrl;
                link.click();
                setIsGeneratingCard(false);
            } catch (err) {
                console.error("Gagal menggambar Kartu Takdir:", err);
                setIsGeneratingCard(false);
            }
        }, 800);
    };

    // Custom Tooltip component for Recharts
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-zinc-950/90 border border-gold/30 p-2.5 rounded-xl backdrop-blur-sm shadow-xl text-left">
                    <p className="text-[10px] text-zinc-500 font-mono tracking-tight">{payload[0].payload.dateStr}</p>
                    <p className="text-xs text-white font-bold flex items-center gap-1.5 mt-1">
                        Status: <span className={payload[0].value ? 'text-green-400 font-black' : 'text-zinc-500'}>
                            {payload[0].value ? '✓ Bermain' : '⊗ Absen'}
                        </span>
                    </p>
                    {payload[0].value > 0 && (
                        <p className="text-[10px] text-yellow-400 mt-0.5 font-sans">
                            Streak Berjalan: +{payload[0].payload.streak} Hari
                        </p>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="text-white w-full max-w-4xl mx-auto space-y-6">
            
            {/* STREAK HEADER & SUMMARY BANNER */}
            <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900/95 via-neutral-900/90 to-zinc-950 p-6 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-md">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                    
                    {/* Golden Flame Graphic Display */}
                    <div className="relative flex items-center justify-center shrink-0">
                        {/* Interactive floating particles around the fire */}
                        {Array.from({ length: 12 }).map((_, i) => (
                            <motion.div 
                                key={i}
                                className="absolute rounded-full bg-amber-500"
                                style={{
                                    width: Math.random() * 6 + 2,
                                    height: Math.random() * 6 + 2,
                                }}
                                animate={{
                                    y: [0, -60 - Math.random() * 40],
                                    x: [0, (Math.random() - 0.5) * 40],
                                    opacity: [0, 0.8, 0],
                                    scale: [1, 1.5, 0.5]
                                }}
                                transition={{
                                    repeat: Infinity,
                                    duration: 1.5 + Math.random() * 1.5,
                                    delay: Math.random() * 1.5
                                }}
                            />
                        ))}
                        
                        <motion.div 
                            className="w-24 h-24 rounded-full bg-zinc-950/80 border border-gold/20 flex flex-col items-center justify-center relative shadow-inner overflow-hidden"
                            animate={{
                                boxShadow: streakState.streakCount > 0 
                                    ? ["0 0 10px rgba(234,179,8,0.1)", "0 0 25px rgba(234,179,8,0.35)", "0 0 10px rgba(234,179,8,0.1)"]
                                    : "0 0 0px rgba(0,0,0,0)"
                            }}
                            transition={{ repeat: Infinity, duration: 4 }}
                        >
                            <Flame className={`w-10 h-10 ${streakState.streakCount > 0 ? 'text-amber-500' : 'text-zinc-600'} animate-bounce duration-1000`} />
                            <span className="text-2xl font-black font-sans leading-none mt-1">
                                {streakState.streakCount}
                            </span>
                            <span className="text-[8px] text-zinc-500 font-mono uppercase tracking-widest font-black">HARI STREAK</span>
                        </motion.div>
                    </div>

                    {/* Stats Summary Panel */}
                    <div className="flex-1 text-center md:text-left space-y-2">
                        <div className="flex items-center justify-center md:justify-start gap-1 text-yellow-400 font-bold text-xs uppercase tracking-widest">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Bintang Keberuntungan Aktif</span>
                        </div>
                        <h2 className="text-xl font-black text-white capitalize leading-tight">
                            Pondok Divinasi Takdir {username || 'Pengembara'}
                        </h2>
                        <p className="text-xs text-zinc-400 max-w-lg leading-relaxed">
                            Mainkan game Tebak Kata setiap hari untuk mencatat takaran ramalan Anda secara konsisten dan mengklaim Kartu Takdir legendaris.
                        </p>
                        
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
                            <div className="bg-white/[0.03] border border-white/5 py-1.5 px-3.5 rounded-xl font-mono text-[11px] text-zinc-300 flex items-center gap-1.5 shadow-md">
                                <Trophy className="w-3.5 h-3.5 text-gold" />
                                <span>Best Streak: <b className="text-white text-xs">{streakState.bestStreak}</b> Hari</span>
                            </div>
                            <div className="bg-white/[0.03] border border-white/5 py-1.5 px-3.5 rounded-xl font-mono text-[11px] text-zinc-300 flex items-center gap-1.5 shadow-md">
                                <Calendar className="w-3.5 h-3.5 text-gold" />
                                <span>Total Main: <b className="text-white text-xs">{streakState.allPlayedDates.length}</b> Hari</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* TWIN COLUMNS FOR STATS CHART & TIME REMINDER CONTROL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. CHART AREA (2 columns wide) */}
                <div className="lg:col-span-2 bg-zinc-900/60 p-4 sm:p-6 rounded-3xl border border-white/5 shadow-xl flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                            <h3 className="font-bold text-sm uppercase font-mono text-zinc-200 tracking-wider">Metrik Aktivitas Mingguan</h3>
                        </div>
                        <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/20 font-mono">
                            Keberadaan 7 Hari Terakhir
                        </span>
                    </div>

                    <div className="h-56 w-full text-xs font-mono select-none">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={weeklyData} margin={{ top: 10, right: 15, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                <XAxis 
                                    dataKey="label" 
                                    stroke="rgba(255,255,255,0.3)" 
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={10}
                                />
                                <YAxis 
                                    domain={[0, 1]} 
                                    ticks={[0, 1]} 
                                    stroke="rgba(255,255,255,0.3)" 
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => val === 1 ? "Main" : "Absen"}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(234,179,8,0.1)', strokeWidth: 1 }} />
                                <Line 
                                    type="monotone" 
                                    dataKey="played" 
                                    stroke="#EAB308" 
                                    strokeWidth={3} 
                                    dot={{ fill: '#EAB308', strokeWidth: 1, radius: 4 }}
                                    activeDot={{ r: 6, fill: '#FFFFFF', stroke: '#EAB308', strokeWidth: 2 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. REMINDER TIME SETTING AREA (1 column wide) */}
                <div className="bg-zinc-900/60 p-5 rounded-3xl border border-white/5 shadow-xl flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <Bell className="w-4 h-4 text-gold" />
                        <h3 className="font-bold text-sm uppercase font-mono text-zinc-200 tracking-wider">Pengingat Streak</h3>
                    </div>
                    
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                        Jangan biarkan streak berharga Anda hangus! Atur waktu notifikasi pengingat harian sistem di bawah ini.
                    </p>

                    <div className="mt-2 space-y-4 flex-1">
                        {/* TOGGLE REMINDER */}
                        <div className="flex items-center justify-between bg-black/20 p-2.5 rounded-2xl border border-white/5">
                            <span className="text-xs font-mono font-bold text-zinc-300">Aktifkan Alarm</span>
                            <button
                                onClick={() => handleUpdateSettings(!reminderEnabled, reminderTime)}
                                className={`w-11 h-6 rounded-full transition-all duration-350 relative ${
                                    reminderEnabled ? 'bg-gold' : 'bg-zinc-750'
                                }`}
                            >
                                <motion.div 
                                    className="w-5 h-5 bg-white rounded-full absolute top-0.5"
                                    animate={{ left: reminderEnabled ? '22px' : '2px' }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>

                        {/* TIME PICKER SELECT */}
                        <div className={reminderEnabled ? "space-y-1.5 opacity-100 transition-opacity" : "space-y-1.5 opacity-40 pointer-events-none transition-opacity"}>
                            <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-bold">Waktu Reminder</label>
                            <div className="relative">
                                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <select
                                    value={reminderTime}
                                    onChange={(e) => handleUpdateSettings(reminderEnabled, e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs bg-black/40 border border-white/10 outline-none text-white focus:border-gold/30 transition-colors cursor-pointer font-mono"
                                >
                                    <option value="08:00">08:00 Pagi</option>
                                    <option value="12:00">12:00 Siang</option>
                                    <option value="16:00">16:00 Sore</option>
                                    <option value="18:00">18:00 Petang</option>
                                    <option value="19:00">19:00 Malam</option>
                                    <option value="20:00">20:00 Malam</option>
                                    <option value="21:00">21:00 Malam</option>
                                    <option value="22:00">22:00 Malam</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setMilestoneValue(streakState.streakCount);
                            setShowMilestonePopup(true);
                        }}
                        className="w-full py-2.5 bg-gradient-to-r from-gold/10 to-amber-500/10 hover:from-gold/20 hover:to-amber-500/20 border border-gold/30 rounded-2xl text-xs font-mono font-bold text-gold duration-200 transition-all flex items-center justify-center gap-1.5"
                    >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Klaim Kartu Takdir</span>
                    </button>
                </div>

            </div>

            {/* CELESTIAL CANVAS FOR BACKGROUND GENERATOR (HIDDEN) */}
            <canvas ref={canvasRef} className="hidden" />

            {/* STREAK MILESTONE POPUP MODAL */}
            <AnimatePresence>
                {showMilestonePopup && (
                    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[9000] p-4 font-sans">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, rotateY: 15 }}
                            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-zinc-950 border border-gold/40 p-6 sm:p-8 rounded-3xl w-full max-w-md shadow-2xl relative text-center overflow-hidden"
                        >
                            {/* Celestial visual particles background */}
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.12)_0%,transparent_75%)] pointer-events-none" />
                            
                            {/* Floating Framer Motion Explosive Particles */}
                            {Array.from({ length: 16 }).map((_, idx) => {
                                const angle = (idx / 16) * Math.PI * 2;
                                const distance = 100 + Math.random() * 80;
                                const x = Math.cos(angle) * distance;
                                const y = Math.sin(angle) * distance;
                                return (
                                    <motion.div
                                        key={idx}
                                        className="absolute w-2 h-2 rounded-full bg-gold"
                                        initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
                                        animate={{ x, y, opacity: [1, 0.8, 0], scale: [0.5, 2, 0.2] }}
                                        transition={{ 
                                            repeat: Infinity,
                                            repeatDelay: Math.random() * 1.5,
                                            duration: 1.2 + Math.random() * 0.8,
                                            ease: "easeOut"
                                        }}
                                        style={{ top: "35%", left: "50%" }}
                                    />
                                );
                            })}
                            
                            {/* Close cross */}
                            <button 
                                onClick={() => setShowMilestonePopup(false)}
                                className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <motion.div 
                                className="relative z-10 space-y-4"
                                initial={{ y: 20 }}
                                animate={{ y: 0 }}
                            >
                                <div className="inline-flex p-3 bg-gold/15 rounded-full border border-gold/30">
                                    <Flame className="w-10 h-10 text-amber-500 animate-pulse" />
                                </div>
                                
                                <div className="space-y-1">
                                    <h3 className="text-[10px] font-black tracking-[4px] text-gold uppercase">Ramalan Legendaris</h3>
                                    <h4 className="text-2xl font-black text-white">REKOR STREAK TERCATAT!</h4>
                                </div>

                                <div className="bg-zinc-900 border border-white/5 p-4 rounded-2xl">
                                    <div className="text-4xl font-black text-gold font-mono mb-0.5">
                                        {milestoneValue || streakState.streakCount}
                                    </div>
                                    <div className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase">HARI BERMAIN CONSECUTIVE</div>
                                </div>

                                <p className="text-xs text-zinc-400 leading-relaxed px-2">
                                    Kerja keras Anda membuahkan hasil. Catatan bintang-bintang mencatat dedikasi bermain Anda tanpa putus. Bagikan pencapaian magis ini!
                                </p>

                                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                                    <button 
                                        onClick={() => setShowMilestonePopup(false)}
                                        className="flex-1 py-3 bg-zinc-900 border border-white/10 hover:bg-zinc-850 duration-150 rounded-2xl text-xs font-mono text-zinc-300 active:scale-95 transition-all"
                                    >
                                        Tutup
                                    </button>
                                    <button 
                                        disabled={isGeneratingCard}
                                        onClick={generateFateCard}
                                        className="flex-1 py-3 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 duration-150 rounded-2xl text-xs font-mono font-black text-black active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-gold/25"
                                    >
                                        {isGeneratingCard ? (
                                            <>
                                                <div className="border-2 border-zinc-950 border-t-transparent animate-spin rounded-full w-3.5 h-3.5" />
                                                <span>Mengukir...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Download className="w-3.5 h-3.5" />
                                                <span>Unduh Fate Card</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
};
