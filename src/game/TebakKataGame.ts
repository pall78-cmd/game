import { INVALID_MOVE } from 'boardgame.io/core';

const WORDS_DATA = [
    { word: 'ORACLE', topic: 'Entitas Gaib', clue: 'Penjaga gerbang dimensi waktu yang membacakan ramalan batin.' },
    { word: 'HARMONY', topic: 'Keseimbangan', clue: 'Keselarasan batin dan alam semesta yang menyatukan perbedaan.' },
    { word: 'COSMOS', topic: 'Astronomi', clue: 'Ruang hampa tak terbatas tempat bersemayamnya jutaan bintang.' },
    { word: 'BINTANG', topic: 'Astral', clue: 'Benda langit pemancar cahaya harapan di kegelapan malam.' },
    { word: 'MISTERI', topic: 'Tak Terjelaskan', clue: 'Sesuatu yang masih tersembunyi dan menanti untuk dipecahkan.' },
    { word: 'LEGENDA', topic: 'Kisah Kuno', clue: 'Cerita rakyat zaman dahulu yang luhur dan abadi lintas masa.' },
    { word: 'SURYAKANTA', topic: 'Benda Pusaka', clue: 'Kaca pembesar magis atau lensa pemusat cahaya spiritual.' },
    { word: 'ASTROLOGI', topic: 'Ramalan Kuno', clue: 'Ilmu membaca peta rasi bintang dan hubungannya dengan nasib manusia.' },
    { word: 'PRACALITA', topic: 'Fenomena Alam', clue: 'Kemilau cahaya aurora atau bintang jatuh di langit malam.' },
    { word: 'KARTIKA', topic: 'Sastra Kuno', clue: 'Kata bahasa Sansekerta yang berarti bintang di langit tinggi.' },
    { word: 'SWARALOKA', topic: 'Dimensi Gaib', clue: 'Kediaman para dewa atau tempat suci penuh kedamaian surgawi.' },
    { word: 'TIRTA', topic: 'Elemen Alami', clue: 'Air suci penyejuk jiwa yang digunakan dalam berbagai ritual takdir.' },
    { word: 'NIRMALA', topic: 'Sifat Batin', clue: 'Kelemahlembutan, kesucian tanpa noda, atau batin yang bersih.' },
    { word: 'LINOBU', topic: 'Tradisi Mistis', clue: 'Tempat mediasi atau peraduan sunyi para pencari ramalan bintang.' },
    { word: 'SEMESTA', topic: 'Kosmologi', clue: 'Seluruh ruang, waktu, galaksi, dan isi magis di dalamnya.' },
    { word: 'PRANA', topic: 'Energi Hidup', clue: 'Aliran napas kosmik pembawa energi vital dalam raga.' },
    { word: 'LENTERA', topic: 'Alat Penerang', clue: 'Wadah api kecil yang menuntun pengembara di kegelapan malam.' },
    { word: 'RESONANSI', topic: 'Sinyal Getaran', clue: 'Getaran energi spiritual yang terpancar dari kedalaman jiwa.' }
];

export interface TebakKataState {
    word: string;
    topic: string;
    clue: string;
    guessedLetters: string[];
    scores: Record<string, number>;
    winner: string | null;
}

export const TebakKataGame: any = {
    name: 'tebakkata',
    
    setup: (ctx: any) => {
        let initialData = WORDS_DATA[0];
        if (ctx.random) {
            const shuffled = ctx.random.Shuffle(WORDS_DATA);
            initialData = shuffled[0];
        } else {
            initialData = WORDS_DATA[Math.floor(Math.random() * WORDS_DATA.length)];
        }

        const scores: Record<string, number> = {};
        for(let i = 0; i < ctx.numPlayers; i++) {
            scores[i.toString()] = 0;
        }

        return {
            word: initialData.word,
            topic: initialData.topic,
            clue: initialData.clue,
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
