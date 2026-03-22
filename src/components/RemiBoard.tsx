import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import Phaser from 'phaser';
import { PhaserRemiScene } from '../game/PhaserRemiScene';
import { GameState } from '../utils/GameEngine';

interface RemiBoardProps {
    socket: Socket;
    gameId: string;
    username: string;
    onLeave: () => void;
}

export const RemiBoard: React.FC<RemiBoardProps> = ({ socket, gameId, username, onLeave }) => {
    const [gameState, setGameState] = useState<GameState | null>(null);
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
            scene: [PhaserRemiScene],
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH
            }
        };

        const game = new Phaser.Game(config);
        gameRef.current = game;

        game.scene.start('RemiScene', {
            socket,
            gameId
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
                    const scene = gameRef.current.scene.getScene('RemiScene') as PhaserRemiScene;
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
                    <h1 className="text-xl font-bold text-white tracking-widest">REMI 41</h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-white/70">Room: <span className="text-white font-mono">{gameId}</span></div>
                    {gameState.status === 'waiting' && (
                        <button 
                            onClick={handleStartGame}
                            className="px-4 py-2 bg-gold text-black font-bold rounded hover:bg-yellow-500 transition-colors"
                        >
                            Start Game
                        </button>
                    )}
                </div>
            </div>

            {/* Phaser Game Container */}
            <div ref={containerRef} className="flex-1 w-full h-full" />
        </div>
    );
};
