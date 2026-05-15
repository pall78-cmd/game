import React, { useState } from 'react';
import { BoardProps } from 'boardgame.io/react';
import { TebakKataState } from '../game/TebakKataGame';
import { motion } from 'framer-motion';

export const ReactTebakKataBoard: React.FC<BoardProps<TebakKataState> & { onLeave?: () => void, onGameEnd?: (winner: string, players: string[]) => void }> = ({ G, ctx, moves, playerID, onLeave, onGameEnd }) => {
    const isPlayerTurn = playerID === ctx.currentPlayer;
    const [input, setInput] = useState('');

    React.useEffect(() => {
        if (ctx.gameover && onGameEnd) {
            onGameEnd(ctx.gameover.winner, Object.keys(G.scores));
        }
    }, [ctx.gameover, onGameEnd, G.scores]);

    const handleGuess = (letter: string) => {
        if (!isPlayerTurn) return;
        if (G.guessedLetters.includes(letter)) return;
        moves.guessLetter(letter);
    };

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    return (
        <div className="flex flex-col items-center justify-center p-4 bg-gray-900 min-h-full rounded-2xl w-full text-white">
            <div className="flex justify-between w-full mb-6 relative items-center">
                <h2 className="text-3xl font-bold text-purple-400 absolute left-1/2 -translate-x-1/2">Tebak Kata Oracle</h2>
                {onLeave && (
                    <button onClick={onLeave} className="ml-auto px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm z-10 transition-colors shadow-lg active:scale-95">
                        Keluar
                    </button>
                )}
            </div>
            
            <div className="flex space-x-4 mb-10 w-full overflow-x-auto justify-center">
                {Object.entries(G.scores).map(([pId, score]) => (
                    <div key={pId} className={`p-4 rounded-xl shadow-lg border-2 min-w-[120px] text-center ${pId === ctx.currentPlayer ? 'border-purple-500 bg-purple-900/30' : 'border-gray-700 bg-gray-800'}`}>
                        <div className="text-sm text-gray-400">P{parseInt(pId) + 1} {pId === playerID ? '(You)' : ''}</div>
                        <div className="text-2xl font-bold">{score} pts</div>
                    </div>
                ))}
            </div>

            <div className="flex space-x-2 mb-12">
                {G.word.split('').map((char, index) => {
                    const isRevealed = G.guessedLetters.includes(char) || char === ' ' || ctx.gameover;
                    return (
                        <div key={index} className={`w-12 h-16 flex items-center justify-center text-3xl font-bold rounded-lg ${char === ' ' ? 'bg-transparent' : 'bg-gray-800 border-b-4 border-purple-500'} transition-all`}>
                            {isRevealed ? <motion.span initial={{opacity: 0, scale: 0}} animate={{opacity: 1, scale: 1}}>{char}</motion.span> : ''}
                        </div>
                    );
                })}
            </div>

            {ctx.gameover ? (
                <div className="text-center mb-8 p-6 bg-green-900/50 rounded-xl border border-green-500">
                    <h3 className="text-2xl font-bold text-green-400">Game Over!</h3>
                    <p className="mt-2 text-lg">P{parseInt(ctx.gameover.winner) + 1} won the game!</p>
                </div>
            ) : (
                <div className="w-full max-w-2xl text-center">
                    <h3 className="text-xl mb-4">{isPlayerTurn ? 'Your Turn! Guess a letter.' : `Waiting for P${parseInt(ctx.currentPlayer) + 1}...`}</h3>
                    <div className="grid grid-cols-7 gap-2">
                        {alphabet.map(letter => {
                            const isGuessed = G.guessedLetters.includes(letter);
                            const isCorrect = isGuessed && G.word.includes(letter);
                            const isWrong = isGuessed && !G.word.includes(letter);
                            
                            let btnClass = "p-3 rounded-lg font-bold text-lg transition-all ";
                            if (isCorrect) btnClass += "bg-green-600 text-white opacity-50 cursor-not-allowed";
                            else if (isWrong) btnClass += "bg-red-900 text-gray-400 opacity-30 cursor-not-allowed";
                            else if (isPlayerTurn) btnClass += "bg-gray-700 hover:bg-purple-600 text-white cursor-pointer active:scale-95 shadow-md";
                            else btnClass += "bg-gray-800 text-gray-500 opacity-50 cursor-not-allowed";

                            return (
                                <button
                                    key={letter}
                                    disabled={!isPlayerTurn || isGuessed}
                                    className={btnClass}
                                    onClick={() => handleGuess(letter)}
                                >
                                    {letter}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
