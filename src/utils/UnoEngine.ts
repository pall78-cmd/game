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

export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    message: string;
    timestamp: string;
}

export interface UnoGameState extends GameState {
    deck: UnoCard[];
    discardPile: UnoCard[];
    players: UnoPlayer[];
    currentColor: 'Red' | 'Yellow' | 'Green' | 'Blue' | 'Pink' | 'Teal' | 'Purple' | 'Orange' | null;
    direction: 1 | -1;
    winner?: string | null;
    isDarkSide: boolean;
    drawColorTarget: 'Pink' | 'Teal' | 'Purple' | 'Orange' | null;
    actionLog: string[];
    pendingDrawCount: number;
    chatMessages: ChatMessage[];
}

export class UnoEngine extends BaseGameEngine {
    declare state: UnoGameState;

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
            actionLog: [],
            pendingDrawCount: 0,
            chatMessages: []
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
        for (let i = 0; i < 2; i++) {
            lightDeck.push({ color: 'Black', value: 'Wild Reverse' });
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
        for (let i = 0; i < 2; i++) {
            darkDeck.push({ color: 'Black', value: 'Wild Reverse' });
        }

        // Shuffle both and zip
        const shuffledLight = this.shuffle(lightDeck as unknown as Card[]) as unknown as UnoFlipSide[];
        const shuffledDark = this.shuffle(darkDeck as unknown as Card[]) as unknown as UnoFlipSide[];

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
        if (this.state.players.length < 1 || this.state.status !== 'waiting') return;
        this.state.status = 'playing';
        this.deal();
        
        // Randomize turn direction (1 = Clockwise / Right, -1 = Counterclockwise / Left)
        this.state.direction = Math.random() < 0.5 ? 1 : -1;
        
        // Randomize first player index
        this.state.currentPlayerIndex = Math.floor(Math.random() * this.state.players.length);
        
        // Flip first card
        let firstCard = this.state.deck.pop()!;
        while (firstCard.light.color === 'Black') {
            this.state.deck.unshift(firstCard);
            firstCard = this.state.deck.pop()!;
        }
        this.state.discardPile.push(firstCard);
        this.state.currentColor = firstCard.light.color;
        this.log(`Game started! First card is ${firstCard.light.color} ${firstCard.light.value}. Arah permainan: ${this.state.direction === 1 ? 'Kanan (Searah Jarum Jam)' : 'Kiri (Berlawanan Jarum Jam)'}. Pemain pertama: ${this.state.players[this.state.currentPlayerIndex].name}.`);
    }

    deal() {
        for (const player of this.state.players) {
            const needed = 7 - player.hand.length;
            for (let i = 0; i < needed; i++) {
                if (this.state.deck.length === 0) {
                    this.reshuffleDiscardPile();
                }
                const card = this.state.deck.pop();
                if (card) {
                    player.hand.push(card);
                }
            }
        }
        this.log(`Dealt cards to ensure each player has 7 cards.`);
    }

    drawCard(playerId: string) {
        if (this.state.status !== 'playing') return;
        const playerIndex = this.state.players.findIndex(p => p.id === playerId);
        if (playerIndex !== this.state.currentPlayerIndex) return;

        // If there's a pending draw penalty, the player takes it when drawing
        if (this.state.pendingDrawCount > 0) {
            const currentPenalty = this.state.pendingDrawCount;
            this.state.pendingDrawCount = 0;
            this.log(`${this.state.players[playerIndex].name} took penalty and drew ${currentPenalty} cards!`);
            
            for (let i = 0; i < currentPenalty; i++) {
                if (this.state.deck.length === 0) this.reshuffleDiscardPile();
                const card = this.state.deck.pop();
                if (card) this.state.players[playerIndex].hand.push(card);
            }
            this.state.players[playerIndex].hasCalledUno = false;
            this.nextTurn();
            return;
        }

        // Standard draw card
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

            // Apply card effects (including stacking)
            this.applyCardEffect(card);
        }
    }

    isValidPlay(card: UnoCard, topCard: UnoCard): boolean {
        const side = this.state.isDarkSide ? card.dark : card.light;
        const topSide = this.state.isDarkSide ? topCard.dark : topCard.light;

        const isPlusCard = side.value.includes('+') || side.value.includes('Draw') || side.value === 'Wild Reverse';

        if (this.state.pendingDrawCount > 0) {
            // Stacking rule: You can ONLY play a draw-type card or a Wild Reverse card to counter the draw penalty
            if (!isPlusCard) return false;

            // Must still match valid wild color/regular colors
            if (side.color === 'Black') return true;
            if (side.color === this.state.currentColor) return true;
            if (side.value === topSide.value) return true;
            return false;
        }

        if (side.color === 'Black') return true;
        if (side.color === this.state.currentColor) return true;
        if (side.value === topSide.value) return true;
        return false;
    }

    applyCardEffect(card: UnoCard) {
        const side = this.state.isDarkSide ? card.dark : card.light;

        // Custom stack helper
        const getDrawValue = (val: string): number => {
            if (val === '+1') return 1;
            if (val === '+5') return 5;
            if (val === 'Wild Draw 2') return 2;
            return 0; // Wild Draw Color will be treated as special or 0 for stack
        };

        const drawAmount = getDrawValue(side.value);

        if (drawAmount > 0) {
            this.state.pendingDrawCount += drawAmount;
            this.log(`Draw Stacking! Under protection: +${this.state.pendingDrawCount} cards. Opponent must counter or draw!`);
            this.nextTurn();
            return;
        }

        if (side.value === 'Wild Reverse') {
            this.state.direction *= -1;
            this.log(`Wild Reverse! Game direction reversed.`);
            if (this.state.pendingDrawCount > 0) {
                this.log(`COUNTER ATTACK! Penalty of +${this.state.pendingDrawCount} cards reversed back to previous player!`);
            }
            this.nextTurn();
            return;
        }

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
        } else if (side.value === 'Wild Draw Color') {
            // Dark special Wild Card - forces draw until they get the chosen color
            this.nextTurn();
            this.log(`${this.state.players[this.state.currentPlayerIndex].name} must draw until they get ${this.state.currentColor}!`);
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
                        break; 
                    }
                }
                this.log(`${this.state.players[this.state.currentPlayerIndex].name} drew ${drawCount} cards.`);
            }
            this.state.players[this.state.currentPlayerIndex].hasCalledUno = false;
            this.nextTurn();
        } else if (side.value === 'Flip') {
            this.state.isDarkSide = !this.state.isDarkSide;
            this.log(`FLIP! The deck is now on the ${this.state.isDarkSide ? 'DARK' : 'LIGHT'} side.`);
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
        this.log(`🚨 BOT (Bandar) mengocok kembali sisa kartu buangan secara adil!`);
    }

    callUno(playerId: string) {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && player.hand.length === 1) {
            player.hasCalledUno = true;
            this.log(`${player.name} berteriak UNO!`);
        }
    }

    catchUno(catcherId: string, targetId: string) {
        const catcher = this.state.players.find(p => p.id === catcherId);
        const target = this.state.players.find(p => p.id === targetId);
        if (catcher && target && target.hand.length === 1 && !target.hasCalledUno) {
            this.log(`${catcher.name} caught ${target.name} for forgetting to call UNO! Penalty: +2 cards.`);
            for (let i = 0; i < 2; i++) {
                if (this.state.deck.length === 0) this.reshuffleDiscardPile();
                const card = this.state.deck.pop();
                if (card) target.hand.push(card);
            }
            target.hasCalledUno = false;
        }
    }

    sendChatMessage(senderId: string, senderName: string, message: string) {
        if (!message || message.trim() === '') return;
        const chatMsgs = this.state.chatMessages || [];
        const newMsg: ChatMessage = {
            id: Math.random().toString(36).substring(2, 9),
            senderId,
            senderName,
            message: message.trim(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        this.state.chatMessages = [...chatMsgs, newMsg].slice(-80); // limit to last 80 messages for sync lightweightness
    }

    discardCard(playerId: string, cardIndex: number): void {
        // Not used in standard UNO
    }
}
