import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';

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
    
    // Preferences Form
    const [gameType, setGameType] = useState('UNO');
    const [maxPlayers, setMaxPlayers] = useState(4);

    useEffect(() => {
        fetchLobbies();
        fetchPreferences();

        const channel = supabase
            .channel('public:game_lobbies')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'game_lobbies' }, payload => {
                fetchLobbies();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchLobbies = async () => {
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
        
        // Let the actual server (through onCreateGame prop) create the boardgame match
        onCreateGame(gameType, maxPlayers, {}, newMatchId);
        
        // Insert into supabase
        try {
            await supabase.from('game_lobbies').insert({
                id: crypto.randomUUID ? crypto.randomUUID() : undefined, // let supabase generate id or supply matching
                host_id: deviceId,
                host_name: currentAlias || 'Anonymous',
                game_type: gameType,
                status: 'waiting',
                current_players: 1, // Will update when someone joins (could be tracked on server ideally, but we'll do what we can)
                max_players: maxPlayers,
                settings: { maxPlayers },
                match_id: newMatchId
            });
        } catch (err) {
            console.error('Failed to create lobby in supabase', err);
        }
        
        setShowCreateModal(false);
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
            <div className="flex justify-between items-center bg-gray-900/80 p-4 rounded-2xl border border-gray-700/50 shadow-xl backdrop-blur-sm">
                <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Game Lobby</h2>
                    <p className="text-sm text-gray-400">Main bareng orang lain yuk!</p>
                </div>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-xl font-bold transition-all shadow-lg hover:shadow-emerald-500/50 hover:-translate-y-1"
                >
                    + Buat Room
                </button>
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
                                <button 
                                    onClick={() => handleJoin(lobby)}
                                    className="w-full py-2 bg-purple-600/80 hover:bg-purple-500 rounded-lg font-bold transition-all group-hover:shadow-lg group-hover:shadow-purple-500/30"
                                >
                                    Gabung ke Room
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
                                    onChange={(e) => setGameType(e.target.value)}
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
                                    min="2" max="10" 
                                    value={maxPlayers} 
                                    onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                                    className="w-full accent-purple-500" 
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>2</span>
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
        </div>
    );
};
