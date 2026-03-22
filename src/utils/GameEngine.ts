export interface Card {
    suit: string;
    value: string;
}

export interface Player {
    id: string;
    hand: Card[];
    score: number;
}

export interface GameState {
    deck: Card[];
    discardPile: Card[];
    players: Player[];
    currentPlayerIndex: number;
    status: 'waiting' | 'playing' | 'finished';
}

export abstract class BaseGameEngine {
    state: GameState;

    constructor(playerIds: string[]) {
        this.state = {
            deck: this.createDeck(),
            discardPile: [],
            players: playerIds.map(id => ({ id, hand: [], score: 0 })),
            currentPlayerIndex: 0,
            status: 'waiting'
        };
    }

    createDeck(): Card[] {
        const suits = ['♥', '♦', '♣', '♠'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const deck: Card[] = [];
        for (const suit of suits) {
            for (const value of values) {
                deck.push({ suit, value });
            }
        }
        return this.shuffle(deck);
    }

    shuffle(deck: Card[]): Card[] {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    abstract deal(): void;
    abstract drawCard(playerId: string): void;
    abstract discardCard(playerId: string, cardIndex: number): void;
}
