import React, { useEffect, useState } from 'react';
import { useGameRoom } from '../utils/useGameRoom';
import { ReactUnoBoard } from './ReactUnoBoard';
import { ReactTebakKataBoard } from './ReactTebakKataBoard';
import { LoadingScreen } from './LoadingScreen';

interface Props {
    gameId: string;
    gameType: 'UNO' | 'TEBAK_KATA';
    playerID: string;
    playerName: string;
    onLeave?: () => void;
    onGameEnd?: (winner: string, players: string[]) => void;
}

export const SupabaseMultiplayerWrapper: React.FC<Props> = ({ gameId, gameType, playerID, playerName, onLeave, onGameEnd }) => {
    const { gameState, isHost, sendAction, error, players } = useGameRoom(gameId, playerID, playerName, gameType);
    const [hasEnded, setHasEnded] = useState(false);

    useEffect(() => {
        if (gameState?.status === 'finished' && gameState.winner && !hasEnded) {
            setHasEnded(true);
            onGameEnd?.(gameState.winner, players.map(p => p.name));
        }
    }, [gameState?.status, gameState?.winner, hasEnded]);

    if (error) {
        return (
             <div className="fixed inset-0 bg-black text-red-500 flex items-center justify-center p-4">
                 Error: {error}
                 <button onClick={onLeave} className="ml-4 px-4 py-2 border rounded">Back</button>
             </div>
        );
    }

    if (!gameState) {
        return <LoadingScreen />;
    }

    // Adapt to boardgame.io interface expectations

    const createCtx = (state: any) => {
        return {
            currentPlayer: state.players ? state.players[state.currentPlayerIndex]?.id || state.players[state.currentPlayerIndex] : '0',
            gameover: state.status === 'finished' ? { winner: state.winner } : null,
            playOrder: state.players?.map?.((p: any) => p.id || p) || [],
            numPlayers: state.players?.length || 0,
            playOrderPos: state.currentPlayerIndex || 0,
            activePlayers: null,
            turn: 1,
            phase: 'play'
        } as any;
    };

    const ctx = createCtx(gameState);

    if (gameType === 'UNO') {
        const moves = {
            startGame: () => sendAction('start'),
            playCard: (index: number, chosenColor?: any) => sendAction('playCard', playerID, index, chosenColor),
            drawCard: () => sendAction('drawCard', playerID),
            callUno: () => sendAction('callUno', playerID),
            catchUno: (targetId: string) => sendAction('catchUno', playerID, targetId),
            sendChatMessage: (msg: string) => sendAction('sendChatMessage', playerID, playerName, msg)
        };

        return (
            <ReactUnoBoard 
                G={gameState as any} 
                ctx={ctx} 
                moves={moves} 
                playerID={playerID} 
                matchID={gameId} 
                displayGameId={gameId}
                username={playerName}
                onLeave={onLeave}
                onGameEnd={onGameEnd}
            />
        );
    } else {
        const moves = {
            guessLetter: (letter: string) => sendAction('guessLetter', playerID, letter)
        };

        return (
            <ReactTebakKataBoard {...({} as any)} 
                G={gameState as any} 
                ctx={ctx} 
                moves={moves} 
                playerID={playerID} 
                onLeave={onLeave}
                onGameEnd={onGameEnd}
            />
        );
    }
};
