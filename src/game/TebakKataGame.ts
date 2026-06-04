import { INVALID_MOVE } from 'boardgame.io/core';

const WORDS = [
    'ORACLE', 'HARMONY', 'RAHASIA', 'CAHAYA', 'BINTANG',
    'PETUALANGAN', 'KEBERANIAN', 'PERSAHABATAN', 'MISTERI', 'LEGENDA'
];

export interface TebakKataState {
    word: string;
    guessedLetters: string[];
    scores: Record<string, number>;
    winner: string | null;
}

export const TebakKataGame: any = {
    name: 'tebakkata',
    
    setup: (ctx: any) => {
        let initialWord = WORDS[0];
        if (ctx.random) {
            const shuffled = ctx.random.Shuffle(WORDS);
            initialWord = shuffled[0];
        } else {
            initialWord = WORDS[Math.floor(Math.random() * WORDS.length)];
        }

        const scores: Record<string, number> = {};
        for(let i = 0; i < ctx.numPlayers; i++) {
            scores[i.toString()] = 0;
        }

        return {
            word: initialWord,
            guessedLetters: [],
            scores,
            winner: null
        };
    },

    moves: {
        guessLetter: (G: any, ctx: any, letter: string) => {
            const upperLetter = letter.toUpperCase();
            if (G.guessedLetters.includes(upperLetter)) {
                return INVALID_MOVE;
            }
            
            G.guessedLetters.push(upperLetter);
            
            if (G.word.includes(upperLetter)) {
                // Correct guess! Calculate points: number of occurrences
                const count = G.word.split('').filter((c: any) => c === upperLetter).length;
                G.scores[ctx.currentPlayer] += (count * 10);
            }
            
            // Check win condition
            const isWon = G.word.split('').every((char: any) => G.guessedLetters.includes(char) || char === ' ');
            if (isWon) {
                G.winner = ctx.currentPlayer;
                ctx.events?.endGame({ winner: ctx.currentPlayer, scores: G.scores });
            } else if (!G.word.includes(upperLetter)) {
               ctx.events?.endTurn();
            }
        }
    },

    turn: {
        minMoves: 1,
    },
    
    endIf: (G: any, ctx: any) => {
        if (G.winner !== null) {
            return { winner: G.winner };
        }
    }
};
