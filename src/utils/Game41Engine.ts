import { BaseGameEngine } from './GameEngine';
import { checkWin, calculateScore } from './game41';

export class Game41Engine extends BaseGameEngine {
    start(): void {
        this.deal();
        // Reveal one card to discard pile to start
        const firstCard = this.state.deck.pop();
        if (firstCard) {
            this.state.discardPile.push(firstCard);
        }
    }

    deal(): void {
        // 41 game specific deal logic: 4 cards per player
        for (let i = 0; i < 4; i++) {
            for (const player of this.state.players) {
                const card = this.state.deck.pop();
                if (card) player.hand.push(card);
            }
        }
        this.state.status = 'playing';
    }

    drawCard(playerId: string): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && this.state.deck.length > 0 && this.state.players[this.state.currentPlayerIndex].id === playerId && player.hand.length === 4) {
            const card = this.state.deck.pop();
            if (card) player.hand.push(card);
        }
    }

    drawFromDiscard(playerId: string): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && this.state.discardPile.length > 0 && this.state.players[this.state.currentPlayerIndex].id === playerId && player.hand.length === 4) {
            const card = this.state.discardPile.pop();
            if (card) player.hand.push(card);
        }
    }

    discardCard(playerId: string, cardIndex: number): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (player && player.hand[cardIndex] && this.state.players[this.state.currentPlayerIndex].id === playerId && player.hand.length === 5) {
            const card = player.hand.splice(cardIndex, 1)[0];
            this.state.discardPile.push(card);
            
            // Check win condition
            if (checkWin(player.hand)) {
                this.state.status = 'finished';
                player.score = calculateScore(player.hand);
                return;
            }

            // Move to next player
            this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
        }
    }
}
