import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, TrendingUp, X } from 'lucide-react';
import { StreakManager } from '../utils/StreakManager';
import { TebakKataStats } from './TebakKataStats';

interface GameLobby {
    id: string;
    host_id: string;
    host_name: string;
    game_type: string;
    status: string;
    current_players: number;
    max_players: number;
    settings: any;
    match_id: string | null;
    created_at: string;
}

interface LobbyProps {
    onJoinGame: (matchId: string, gameType: string) => void;
    onCreateGame: (gameType: string, numPlayers: number, settings: any, matchId: string) => void;
    currentAlias: string;
    deviceId: string;
}

export const Lobby: React.FC<LobbyProps> = ({ onJoinGame, onCreateGame, currentAlias, deviceId }) => {
    const [lobbies, setLobbies] = useState<GameLobby[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [streakCount, setStreakCount] = useState(() => {
        try {
            return StreakManager.load().streakCount;
        } catch (e) {
            return 0;
        }
    });

    // Check streak updates periodically or on focus
    useEffect(() => {
        const updateStreak = () => {
            try {
                setStreakCount(StreakManager.load().streakCount);
            } catch (e) {}
        };
        updateStreak();
        window.addEventListener('focus', updateStreak);
        return () => window.removeEventListener('focus', updateStreak);
    }, []);
    
    // Preferences Form
    const [gameType, setGameType] = useState('UNO');
    const [maxPlayers, setMaxPlayers] = useState(4);

    useEffect(() => {
        fetchLobbies();
        fetchPreferences();

        const channelName = 'game_lobbies_' + Math.random().toString(36).substring(7);
        const channel = supabase.channel(channelName);
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'game_lobbies' }, payload => {
            fetchLobbies();
        });
        channel.subscribe();

        // 5-second safety fallback polling for ultra-reliable multiplayer room listings
        const interval = setInterval(() => {
            fetchLobbies();
        }, 5000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, []);

    const cleanExpiredLobbies = async () => {
        try {
            // Hapus room lama yang berumur > 1 jam (60 menit) agar hemat storage Supabase
            const expirationTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            await supabase
                .from('game_lobbies')
                .delete()
                .lt('created_at', expirationTime);
        } catch (e) {
            console.error('Error auto-cleaning up lobbies:', e);
        }
    };

    const fetchLobbies = async () => {
        await cleanExpiredLobbies();
        // Show all waiting games plus finished games briefly (if needed)
        const { data, error } = await supabase
            .from('game_lobbies')
            .select('*')
            .eq('status', 'waiting')
            .order('created_at', { ascending: false });
        
        if (!error && data) {
            setLobbies(data);
        }
        setLoading(false);
    };

    const handleDeleteLobby = async (lobbyId: string) => {
        try {
            await supabase
                .from('game_lobbies')
                .delete()
                .eq('id', lobbyId);
            fetchLobbies();
        } catch (err) {
            console.error('Failed to delete lobby manually', err);
        }
    };

    const fetchPreferences = async () => {
        try {
            const { data, error } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('device_id', deviceId)
                .single();
            if (data && !error) {
                if (data.default_game_type) setGameType(data.default_game_type);
                if (data.settings?.maxPlayers) setMaxPlayers(data.settings.maxPlayers);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const savePreferences = async (type: string, players: number) => {
        try {
            await supabase
                .from('user_preferences')
                .upsert({
                    device_id: deviceId,
                    default_game_type: type,
                    settings: { maxPlayers: players },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'device_id' });
        } catch (e) {}
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        savePreferences(gameType, maxPlayers);
        
        const newMatchId = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        setShowCreateModal(false);

        // 1. Insert into supabase first and wait for DB registration to complete
        try {
            const isCryptoSafe = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';
            const { error: insertError } = await supabase.from('game_lobbies').insert({
                ...(isCryptoSafe ? { id: crypto.randomUUID() } : {}),
                host_id: deviceId,
                host_name: currentAlias || 'Anonymous',
                game_type: gameType,
                status: 'waiting',
                current_players: 1, // Initialize with 1 (the host)
                max_players: maxPlayers,
                settings: { maxPlayers },
                match_id: newMatchId
            });
            if (insertError) {
                console.error('Error inserting lobby to DB:', insertError);
            }
        } catch (err) {
            console.error('Failed to create lobby in supabase', err);
        }
        
        // 2. Launch the actual game engine board with the verified matchId
        onCreateGame(gameType, maxPlayers, {}, newMatchId);
    };

    const handleJoin = (lobby: GameLobby) => {
        // Here we just use the lobby's game type to join
        if (lobby.match_id) {
            // It has an internal match ID or it uses its own ID
            onJoinGame(lobby.match_id || lobby.id, lobby.game_type);
        } else {
            // Join with lobby.id
            onJoinGame(lobby.id, lobby.game_type);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-4 flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-900/80 p-4 rounded-2xl border border-gray-700/50 shadow-xl backdrop-blur-sm gap-4">
                <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Game Lobby</h2>
                    <p className="text-sm text-gray-400">Main bareng orang lain yuk!</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <motion.button 
                        onClick={() => setShowStatsModal(true)}
                        className="bg-zinc-800/80 hover:bg-zinc-800 border border-yellow-500/30 hover:border-yellow-500/60 py-2.5 px-4 rounded-xl text-xs font-mono font-bold text-yellow-400 cursor-pointer transition-all flex items-center gap-2 shadow-lg"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        animate={{ 
                            boxShadow: streakCount > 0 
                                ? ["0 0 4px rgba(234,179,8,0.15)", "0 0 12px rgba(234,179,8,0.35)", "0 0 4px rgba(234,179,8,0.15)"]
                                : "0 0 0px rgba(0,0,0,0)"
                        }}
                        transition={{ repeat: Infinity, duration: 3 }}
                    >
                        <span className="relative flex h-2 w-2">
                            {streakCount > 0 && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            )}
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        <Flame className={`w-4 h-4 ${streakCount > 0 ? "text-amber-500 animate-pulse" : "text-zinc-500"}`} />
                        <span>{streakCount} HARI STREAK</span>
                    </motion.button>

                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl font-bold transition-all shadow-lg hover:shadow-emerald-500/50 hover:-translate-y-1 text-sm text-white shrink-0"
                    >
                        + Buat Room
                    </button>
                </div>
            </div>

            <div className="bg-gray-900/60 p-4 sm:p-6 rounded-2xl border border-gray-700/50 shadow-xl backdrop-blur-sm min-h-[300px]">
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
                    </div>
                ) : lobbies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-60 text-gray-400">
                        <p className="text-lg">Yah, belum ada room yang dimainin :(</p>
                        <p className="text-sm mt-2">Coba buat room baru dengan klik tombol di atas.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {lobbies.map(lobby => (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={lobby.id} 
                                className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-purple-500 transition-colors group relative overflow-hidden"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-lg text-white">{lobby.game_type}</h3>
                                        <p className="text-sm text-gray-400">Host: {lobby.host_name}</p>
                                    </div>
                                    <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-1 rounded-md font-medium border border-indigo-500/30">
                                        {lobby.current_players}/{lobby.max_players} Players
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 mb-4 line-clamp-1">
                                    Room ID: {lobby.match_id || lobby.id}
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleJoin(lobby)}
                                        className="flex-1 py-2 bg-purple-600/80 hover:bg-purple-500 rounded-lg font-bold transition-all group-hover:shadow-lg group-hover:shadow-purple-500/30 text-white text-sm"
                                    >
                                        Gabung ke Room
                                    </button>
                                    {lobby.host_id === deviceId && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteLobby(lobby.id);
                                            }}
                                            className="px-3 py-2 bg-red-600/20 hover:bg-red-600 hover:text-white text-red-400 border border-red-500/30 rounded-xl font-bold transition-all text-xs"
                                            title="Hapus Room"
                                        >
                                            Hapus
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[600] p-4">
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-gray-900 border border-gray-700 p-6 rounded-2xl w-full max-w-md shadow-2xl"
                    >
                        <h3 className="text-xl font-bold mb-4 text-white">Buat Game Baru</h3>
                        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Game Type</label>
                                <select 
                                    value={gameType} 
                                    onChange={(e) => {
                                        const newType = e.target.value;
                                        setGameType(newType);
                                        if (newType === 'UNO' && maxPlayers < 2) {
                                            setMaxPlayers(2);
                                        }
                                    }}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                >
                                    <option value="UNO">UNO</option>
                                    <option value="TEBAKKATA">Tebak Kata</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Pemain Maksimal ({maxPlayers})</label>
                                <input 
                                    type="range" 
                                    min={gameType === 'UNO' ? "2" : "1"} max="10" 
                                    value={maxPlayers} 
                                    onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                                    className="w-full accent-purple-500" 
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>{gameType === 'UNO' ? "2" : "1"}</span>
                                    <span>10</span>
                                </div>
                            </div>
                            
                            <div className="flex gap-3 mt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-colors shadow-lg shadow-purple-500/20"
                                >
                                    Buat Game
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* STATS & WEEKLY ANALYTICS MODAL OVERLAY */}
            <AnimatePresence>
                {showStatsModal && (
                    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[1000] p-4 overflow-y-auto no-scrollbar">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-zinc-950 border border-white/10 p-5 sm:p-7 rounded-3xl w-full max-w-4xl shadow-2xl relative"
                        >
                            <button 
                                onClick={() => setShowStatsModal(false)}
                                className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            
                            <TebakKataStats 
                                username={currentAlias || 'Pengembara'} 
                                onClose={() => setShowStatsModal(false)}
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
