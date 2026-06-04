const WORDS = [
    'ORACLE', 'HARMONY', 'RAHASIA', 'CAHAYA', 'BINTANG',
    'PETUALANGAN', 'KEBERANIAN', 'PERSAHABATAN', 'MISTERI', 'LEGENDA'
];

export interface TebakKataState {
    word: string;
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
        this.state = {
            word: WORDS[Math.floor(Math.random() * WORDS.length)],
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
