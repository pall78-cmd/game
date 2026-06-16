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
    status: 'waiting' | 'playing' | 'finished';
    currentPlayerIndex: number;
    players: string[];
}

export class TebakKataEngine {
    state: TebakKataState;

    constructor(players: string[]) {
        const item = WORDS_DATA[Math.floor(Math.random() * WORDS_DATA.length)];
        this.state = {
            word: item.word,
            topic: item.topic,
            clue: item.clue,
            guessedLetters: [],
            scores: {},
            winner: null,
            status: 'waiting',
            currentPlayerIndex: 0,
            players: players
        };
        for (const p of players) {
            this.state.scores[p] = 0;
        }
    }

    start() {
        if (this.state.players.length < 1) return;
        this.state.status = 'playing';
    }

    guessLetter(player: string, letter: string) {
        if (this.state.status !== 'playing') return;
        const playerIndex = this.state.players.indexOf(player);
        if (playerIndex !== this.state.currentPlayerIndex) return;

        const upperLetter = letter.toUpperCase();
        if (this.state.guessedLetters.includes(upperLetter)) {
            return;
        }
        
        this.state.guessedLetters.push(upperLetter);
        
        if (this.state.word.includes(upperLetter)) {
            const count = this.state.word.split('').filter(c => c === upperLetter).length;
            this.state.scores[player] += (count * 10);
        }
        
        const isWon = this.state.word.split('').every(char => this.state.guessedLetters.includes(char) || char === ' ');
        if (isWon) {
            this.state.winner = player;
            this.state.status = 'finished';
        } else if (!this.state.word.includes(upperLetter)) {
            this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
        }
    }
}
