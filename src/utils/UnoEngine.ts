import { BaseGameEngine, Player, GameState, Card } from './GameEngine';

export interface UnoFlipSide {
    color: 'Red' | 'Yellow' | 'Green' | 'Blue' | 'Pink' | 'Teal' | 'Purple' | 'Orange' | 'Black';
    value: string;
}

export interface UnoCard extends Card {
    light: UnoFlipSide;
    dark: UnoFlipSide;
}

export interface UnoPlayer extends Player {
    hand: UnoCard[];
    hasCalledUno: boolean;
    name: string;
}

export interface UnoGameState extends GameState {
    deck: UnoCard[];
    discardPile: UnoCard[];
    players: UnoPlayer[];
    currentColor: 'Red' | 'Yellow' | 'Green' | 'Blue' | 'Pink' | 'Teal' | 'Purple' | 'Orange' | null;
    direction: 1 | -1;
    winner: string | null;
    isDarkSide: boolean;
    drawColorTarget: 'Pink' | 'Teal' | 'Purple' | 'Orange' | null;
    actionLog: string[];
}

export class UnoEngine extends BaseGameEngine {
    state: UnoGameState;

    constructor(playerIds: string[], playerNames: string[]) {
        super(playerIds);
        this.state = {
            ...this.state,
            deck: this.createUnoDeck(),
            discardPile: [],
            players: playerIds.map((id, index) => ({ id, name: playerNames[index] || `Player ${index+1}`, hand: [], score: 0, hasCalledUno: false })),
            currentColor: null,
            direction: 1,
            winner: null,
            status: 'waiting',
            isDarkSide: false,
            drawColorTarget: null,
            actionLog: []
        };
    }

    log(message: string) {
        this.state.actionLog.push(`[${new Date().toLocaleTimeString()}] ${message}`);
        if (this.state.actionLog.length > 50) {
            this.state.actionLog.shift();
        }
    }

    createDeck(): Card[] {
        return []; // Override in constructor
    }

    createUnoDeck(): UnoCard[] {
        const lightColors: ('Red' | 'Yellow' | 'Green' | 'Blue')[] = ['Red', 'Yellow', 'Green', 'Blue'];
        const lightValues = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', '+1', 'Flip'];
        const lightDeck: UnoFlipSide[] = [];

        for (const color of lightColors) {
            for (const value of lightValues) {
                lightDeck.push({ color, value });
                lightDeck.push({ color, value });
            }
        }
        for (let i = 0; i < 4; i++) {
            lightDeck.push({ color: 'Black', value: 'Wild' });
            lightDeck.push({ color: 'Black', value: 'Wild Draw 2' });
        }

        const darkColors: ('Pink' | 'Teal' | 'Purple' | 'Orange')[] = ['Pink', 'Teal', 'Purple', 'Orange'];
        const darkValues = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip Everyone', 'Reverse', '+5', 'Flip'];
        const darkDeck: UnoFlipSide[] = [];

        for (const color of darkColors) {
            for (const value of darkValues) {
                darkDeck.push({ color, value });
                darkDeck.push({ color, value });
            }
        }
        for (let i = 0; i < 4; i++) {
            darkDeck.push({ color: 'Black', value: 'Wild' });
            darkDeck.push({ color: 'Black', value: 'Wild Draw Color' });
        }

        // Shuffle both and zip
        const shuffledLight = this.shuffle(lightDeck) as UnoFlipSide[];
        const shuffledDark = this.shuffle(darkDeck) as UnoFlipSide[];

        const deck: UnoCard[] = [];
        for (let i = 0; i < shuffledLight.length; i++) {
            deck.push({
                suit: 'UNO',
                value: 'FLIP',
                light: shuffledLight[i],
                dark: shuffledDark[i]
            });
        }

        return deck;
    }

    start() {
        if (this.state.players.length < 2) return;
        this.state.status = 'playing';
        this.deal();
        
        // Flip first card
        let firstCard = this.state.deck.pop()!;
        while (firstCard.light.color === 'Black') {
            this.state.deck.unshift(firstCard);
            firstCard = this.state.deck.pop()!;
        }
        this.state.discardPile.push(firstCard);
        this.state.currentColor = firstCard.light.color;
        this.log(`Game started! First card is ${firstCard.light.color} ${firstCard.light.value}.`);
    }

    deal() {
        for (let i = 0; i < 7; i++) {
            for (const player of this.state.players) {
                player.hand.push(this.state.deck.pop()!);
            }
        }
        this.log(`Dealt 7 cards to each player.`);
    }

    drawCard(playerId: string) {
        if (this.state.status !== 'playing') return;
        const playerIndex = this.state.players.findIndex(p => p.id === playerId);
        if (playerIndex !== this.state.currentPlayerIndex) return;

        if (this.state.deck.length === 0) {
            this.reshuffleDiscardPile();
        }

        const card = this.state.deck.pop();
        if (card) {
            this.state.players[playerIndex].hand.push(card);
            this.state.players[playerIndex].hasCalledUno = false;
            this.log(`${this.state.players[playerIndex].name} drew a card.`);
        }
        
        this.nextTurn();
    }

    playCard(playerId: string, cardIndex: number, chosenColor?: 'Red' | 'Yellow' | 'Green' | 'Blue' | 'Pink' | 'Teal' | 'Purple' | 'Orange') {
        if (this.state.status !== 'playing') return;
        const playerIndex = this.state.players.findIndex(p => p.id === playerId);
        if (playerIndex !== this.state.currentPlayerIndex) return;

        const player = this.state.players[playerIndex];
        const card = player.hand[cardIndex];
        if (!card) return;
        
        const topCard = this.state.discardPile[this.state.discardPile.length - 1];

        if (this.isValidPlay(card, topCard)) {
            player.hand.splice(cardIndex, 1);
            this.state.discardPile.push(card);
            
            const side = this.state.isDarkSide ? card.dark : card.light;

            if (side.color === 'Black') {
                this.state.currentColor = chosenColor || (this.state.isDarkSide ? 'Pink' : 'Red');
            } else {
                this.state.currentColor = side.color;
            }

            if (player.hand.length === 0) {
                this.state.status = 'finished';
                this.state.winner = player.name;
                this.log(`${player.name} played their last card and won the game!`);
                return;
            }

            this.log(`${player.name} played ${side.color} ${side.value}.`);

            if (player.hand.length === 1 && !player.hasCalledUno) {
                // Penalty for not calling UNO
                const penalty = this.state.isDarkSide ? 5 : 2;
                this.log(`${player.name} forgot to call UNO! Penalty: draw ${penalty} cards.`);
                this.drawCardsForCurrentPlayer(penalty);
            }

            this.applyCardEffect(card);
        }
    }

    isValidPlay(card: UnoCard, topCard: UnoCard): boolean {
        const side = this.state.isDarkSide ? card.dark : card.light;
        const topSide = this.state.isDarkSide ? topCard.dark : topCard.light;

        if (side.color === 'Black') return true;
        if (side.color === this.state.currentColor) return true;
        if (side.value === topSide.value) return true;
        return false;
    }

    applyCardEffect(card: UnoCard) {
        const side = this.state.isDarkSide ? card.dark : card.light;

        if (side.value === 'Reverse') {
            this.state.direction *= -1;
            this.log(`Direction reversed!`);
            if (this.state.players.length === 2) {
                this.nextTurn();
                this.nextTurn(); // In 2-player, Reverse acts like Skip
            } else {
                this.nextTurn();
            }
        } else if (side.value === 'Skip') {
            this.nextTurn();
            this.log(`${this.state.players[this.state.currentPlayerIndex].name} was skipped!`);
            this.nextTurn();
        } else if (side.value === 'Skip Everyone') {
            this.log(`Everyone was skipped!`);
            // Skips everyone, so it's the current player's turn again
            // Do not call nextTurn()
        } else if (side.value === '+1') {
            this.nextTurn();
            this.log(`${this.state.players[this.state.currentPlayerIndex].name} must draw 1 card!`);
            this.drawCardsForCurrentPlayer(1);
            this.nextTurn();
        } else if (side.value === '+5') {
            this.nextTurn();
            this.log(`${this.state.players[this.state.currentPlayerIndex].name} must draw 5 cards!`);
            this.drawCardsForCurrentPlayer(5);
            this.nextTurn();
        } else if (side.value === 'Wild Draw 2') {
            this.nextTurn();
            this.log(`${this.state.players[this.state.currentPlayerIndex].name} must draw 2 cards!`);
            this.drawCardsForCurrentPlayer(2);
            this.nextTurn();
        } else if (side.value === 'Wild Draw Color') {
            this.nextTurn();
            this.log(`${this.state.players[this.state.currentPlayerIndex].name} must draw until they get ${this.state.currentColor}!`);
            // Draw until they get the chosen color
            const targetColor = this.state.currentColor;
            if (targetColor) {
                let drawnColor = null;
                let drawCount = 0;
                while (drawnColor !== targetColor && drawCount < 112) {
                    if (this.state.deck.length === 0) {
                        this.reshuffleDiscardPile();
                    }
                    const drawnCard = this.state.deck.pop();
                    if (drawnCard) {
                        this.state.players[this.state.currentPlayerIndex].hand.push(drawnCard);
                        drawnColor = this.state.isDarkSide ? drawnCard.dark.color : drawnCard.light.color;
                        drawCount++;
                    } else {
                        break; // Deck empty and discard pile empty
                    }
                }
                this.log(`${this.state.players[this.state.currentPlayerIndex].name} drew ${drawCount} cards.`);
            }
            this.state.players[this.state.currentPlayerIndex].hasCalledUno = false;
            this.nextTurn();
        } else if (side.value === 'Flip') {
            this.state.isDarkSide = !this.state.isDarkSide;
            this.log(`FLIP! The deck is now on the ${this.state.isDarkSide ? 'DARK' : 'LIGHT'} side.`);
            // Update current color to match the new side of the top card
            const newTopSide = this.state.isDarkSide ? card.dark : card.light;
            this.state.currentColor = newTopSide.color === 'Black' ? (this.state.isDarkSide ? 'Pink' : 'Red') : newTopSide.color;
            this.nextTurn();
        } else {
            this.nextTurn();
        }
    }

    drawCardsForCurrentPlayer(count: number) {
        const player = this.state.players[this.state.currentPlayerIndex];
        for (let i = 0; i < count; i++) {
            if (this.state.deck.length === 0) this.reshuffleDiscardPile();
            const card = this.state.deck.pop();
            if (card) player.hand.push(card);
        }
        player.hasCalledUno = false;
    }

    nextTurn() {
        this.state.currentPlayerIndex = (this.state.currentPlayerIndex + this.state.direction + this.state.players.length) % this.state.players.length;
    }

    reshuffleDiscardPile() {
        if (this.state.discardPile.length <= 1) return;
        const topCard = this.state.discardPile.pop()!;
        this.state.deck = this.shuffle(this.state.discardPile) as UnoCard[];
        this.state.discardPile = [topCard];
        this.log(`Discard pile reshuffled into deck.`);
    }

    callUno(playerId: string) {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && (player.hand.length === 1 || player.hand.length === 2)) {
            player.hasCalledUno = true;
            this.log(`${player.name} called UNO!`);
        }
    }

    discardCard(playerId: string, cardIndex: number): void {
        // Not used in standard UNO, but required by BaseGameEngine
    }
}

