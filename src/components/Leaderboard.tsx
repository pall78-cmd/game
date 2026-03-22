import React, { useEffect, useState } from 'react';
import { supabaseClient } from '../../supabase';

interface MatchRecord {
    id: string;
    game_type: string;
    winner_name: string;
    players: string[];
    created_at: string;
}

export const Leaderboard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [matches, setMatches] = useState<MatchRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMatches = async () => {
            const { data, error } = await supabaseClient
                .from('match_history')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Error fetching match history:', error);
            } else {
                setMatches(data || []);
            }
            setLoading(false);
        };

        fetchMatches();
    }, []);

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-zinc-950">
                    <h2 className="text-2xl font-bold text-white">Match History</h2>
                    <button 
                        onClick={onClose}
                        className="text-white/50 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="text-center text-white/50 py-8">Loading match history...</div>
                    ) : matches.length === 0 ? (
                        <div className="text-center text-white/50 py-8">
                            No matches played yet. Play a game to see it here!
                            <br />
                            <span className="text-xs mt-2 block">(Make sure you created the 'match_history' table in Supabase)</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {matches.map((match) => (
                                <div key={match.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${match.game_type === 'UNO' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                {match.game_type}
                                            </span>
                                            <span className="text-white/50 text-sm">
                                                {new Date(match.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="text-white">
                                            <span className="text-white/50">Winner: </span>
                                            <span className="font-bold text-emerald-400">{match.winner_name || 'Draw/Unknown'}</span>
                                        </div>
                                    </div>
                                    <div className="text-sm text-white/50">
                                        Players: {match.players?.join(', ') || 'Unknown'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
