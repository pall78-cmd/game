import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Socket } from 'socket.io-client';
import Phaser from 'phaser';
import { PhaserUnoScene } from '../game/PhaserUnoScene';
import { UnoGameState } from '../utils/UnoEngine';

interface UnoBoardProps {
    socket: Socket;
    gameId: string;
    username: string;
    onLeave: () => void;
}

export const UnoBoard: React.FC<UnoBoardProps> = ({ socket, gameId, username, onLeave }) => {
    const [gameState, setGameState] = useState<UnoGameState | null>(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [pendingWildCardIndex, setPendingWildCardIndex] = useState<number | null>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,
            width: window.innerWidth,
            height: window.innerHeight,
            parent: containerRef.current,
            backgroundColor: '#18181b',
            scene: [PhaserUnoScene],
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH
            }
        };

        const game = new Phaser.Game(config);
        gameRef.current = game;

        game.scene.start('UnoScene', {
            socket,
            gameId,
            onShowColorPicker: () => setShowColorPicker(true),
            onSetPendingWildCardIndex: (index: number) => setPendingWildCardIndex(index)
        });

        return () => {
            game.destroy(true);
            gameRef.current = null;
        };
    }, [socket, gameId]);

    useEffect(() => {
        const handleGameUpdate = (data: any) => {
            if (data.type === 'STATE_UPDATE') {
                setGameState(data.state);
                if (gameRef.current) {
                    const scene = gameRef.current.scene.getScene('UnoScene') as PhaserUnoScene;
                    if (scene && scene.handleGameStateUpdate) {
                        scene.handleGameStateUpdate(data.state);
                    }
                }
            }
        };

        socket.on('gameUpdate', handleGameUpdate);

        return () => {
            socket.off('gameUpdate', handleGameUpdate);
        };
    }, [socket]);

    const handleStartGame = () => {
        socket.emit('gameAction', { gameId, action: 'start' });
    };

    const handleColorChosen = (color: string) => {
        if (pendingWildCardIndex !== null) {
            socket.emit('gameAction', { gameId, action: 'play', payload: { cardIndex: pendingWildCardIndex, chosenColor: color } });
            setPendingWildCardIndex(null);
            setShowColorPicker(false);
        }
    };

    if (!gameState) {
        return <div className="p-8 text-center text-white">Loading game state...</div>;
    }

    return (
        <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col font-sans overflow-hidden">
            {/* Header Overlay */}
            <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-black/50 border-b border-white/10 pointer-events-auto">
                <div className="flex items-center gap-4">
                    <button onClick={onLeave} className="text-white/70 hover:text-white transition-colors">
                        ← Leave Game
                    </button>
                    <h1 className="text-xl font-bold text-white tracking-widest">UNO FLIP (Phaser)</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${socket.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-white/50 text-sm">{gameState.players.length} Players</span>
                    </div>
                </div>
            </div>

            {/* Phaser Game Container */}
            <div ref={containerRef} className="w-full h-full absolute inset-0 z-0" />

            {/* Waiting Room Overlay */}
            {gameState.status === 'waiting' && (
                <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center backdrop-blur-sm pointer-events-auto">
                    <div className="bg-zinc-900 p-8 rounded-2xl border border-white/10 max-w-md w-full text-center">
                        <h2 className="text-2xl font-bold text-white mb-6">Waiting Room</h2>
                        <div className="space-y-2 mb-8 text-left">
                            {gameState.players.map((p, i) => (
                                <div key={p.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                                        {p.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-white">{p.name} {p.id === socket.id ? '(You)' : ''}</span>
                                </div>
                            ))}
                        </div>
                        {gameState.players.length >= 2 ? (
                            <button
                                onClick={handleStartGame}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors"
                            >
                                Start Game
                            </button>
                        ) : (
                            <div className="text-white/50">Waiting for more players...</div>
                        )}
                    </div>
                </div>
            )}

            {/* Action Log Overlay */}
            {gameState.status === 'playing' && gameState.actionLog && (
                <div className="absolute bottom-4 left-4 w-72 h-48 bg-black/60 border border-white/20 rounded-lg p-3 overflow-y-auto pointer-events-auto flex flex-col z-10">
                    <div className="space-y-1 mt-auto">
                        {gameState.actionLog.map((log, i) => (
                            <div key={i} className="text-white/80 text-xs font-mono">{log}</div>
                        ))}
                        <div ref={(el) => { el?.scrollIntoView({ behavior: 'smooth' }) }} />
                    </div>
                </div>
            )}

            {/* Color Picker Modal Overlay */}
            <AnimatePresence>
                {showColorPicker && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
                    >
                        <motion.div 
                            initial={{ scale: 0.8, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.8, y: 50 }}
                            className="bg-zinc-900 p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center gap-6"
                        >
                            <h2 className="text-2xl font-bold text-white uppercase tracking-widest">Choose Color</h2>
                            <div className="grid grid-cols-2 gap-4">
                                {(gameState.isDarkSide ? ['Pink', 'Teal', 'Purple', 'Orange'] : ['Red', 'Blue', 'Green', 'Yellow']).map(color => {
                                    const darkColors: { [key: string]: string } = {
                                        'Purple': '#7e22ce',
                                        'Orange': '#f97316',
                                        'Pink': '#ec4899',
                                        'Teal': '#14b8a6'
                                    };
                                    const bgColor = gameState.isDarkSide ? darkColors[color] : color.toLowerCase();
                                    return (
                                        <button
                                            key={color}
                                            onClick={() => handleColorChosen(color)}
                                            className={`w-24 h-24 rounded-2xl shadow-lg transition-transform hover:scale-110 active:scale-95 flex items-center justify-center`}
                                            style={{ backgroundColor: bgColor }}
                                        >
                                            <div className="w-16 h-16 rounded-full border-4 border-white/30"></div>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Winner Overlay */}
            {gameState.status === 'finished' && (
                <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto">
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", bounce: 0.5 }}
                        className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-500 mb-8 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]"
                    >
                        {gameState.winner} WINS!
                    </motion.div>
                    <button
                        onClick={onLeave}
                        className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all hover:scale-105"
                    >
                        Back to Lobby
                    </button>
                </div>
            )}
        </div>
    );
};
