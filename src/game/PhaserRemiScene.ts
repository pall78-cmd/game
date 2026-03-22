import Phaser from 'phaser';
import { GameState, Card } from '../utils/GameEngine';
import { REMI_CARD_SVG } from '../constants/boardGameDeck';

export class PhaserRemiScene extends Phaser.Scene {
    private gameState: GameState | null = null;
    private socket: any;
    private gameId: string = '';
    private myPlayerId: string = '';

    private handGroup!: Phaser.GameObjects.Group;
    private discardPileSprite!: Phaser.GameObjects.Sprite;
    private deckSprite!: Phaser.GameObjects.Sprite;
    private turnText!: Phaser.GameObjects.Text;
    private opponentsGroup!: Phaser.GameObjects.Group;

    constructor() {
        super({ key: 'RemiScene' });
    }

    init(data: any) {
        this.socket = data.socket;
        this.gameId = data.gameId;
        this.myPlayerId = data.socket.id;
    }

    preload() {
        // Generate all possible card textures
        const suits = ['♥', '♦', '♣', '♠'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        
        suits.forEach(suit => {
            values.forEach(value => {
                const svg = REMI_CARD_SVG(suit, value);
                this.load.svg(`card_${suit}_${value}`, 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), { width: 100, height: 150 });
            });
        });

        const backSvg = `
            <svg width="100%" height="100%" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="300" rx="10" fill="#1e3a8a" />
                <rect x="10" y="10" width="180" height="280" rx="5" fill="none" stroke="white" stroke-width="2" />
                <circle cx="100" cy="150" r="40" fill="none" stroke="white" stroke-width="5" />
                <text x="100" y="150" font-family="Arial" font-size="30" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">REMI</text>
            </svg>
        `;
        this.load.svg('card_back', 'data:image/svg+xml;utf8,' + encodeURIComponent(backSvg), { width: 100, height: 150 });
    }

    create() {
        const { width, height } = this.scale;

        // Background
        this.cameras.main.setBackgroundColor('#064e3b'); // dark green

        // Groups
        this.handGroup = this.add.group();
        this.opponentsGroup = this.add.group();

        // Deck
        this.deckSprite = this.add.sprite(width / 2 - 80, height / 2, 'card_back')
            .setInteractive()
            .on('pointerdown', () => {
                if (this.isMyTurn()) {
                    this.socket.emit('gameAction', { gameId: this.gameId, action: 'draw' });
                }
            });

        // Discard Pile
        this.discardPileSprite = this.add.sprite(width / 2 + 80, height / 2, 'card_back')
            .setInteractive()
            .on('pointerdown', () => {
                if (this.isMyTurn() && this.gameState && this.gameState.discardPile.length > 0) {
                    this.socket.emit('gameAction', { gameId: this.gameId, action: 'drawFromDiscard' });
                }
            });
        this.discardPileSprite.setVisible(false);

        // Turn Text
        this.turnText = this.add.text(width / 2, height / 2 + 100, '', {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.scale.on('resize', this.handleResize, this);
    }

    handleResize(gameSize: Phaser.Structs.Size) {
        const { width, height } = gameSize;
        
        if (this.deckSprite) {
            this.deckSprite.setPosition(width / 2 - 80, height / 2);
        }
        if (this.discardPileSprite) {
            this.discardPileSprite.setPosition(width / 2 + 80, height / 2);
        }
        if (this.turnText) {
            this.turnText.setPosition(width / 2, height / 2 + 100);
        }
        
        if (this.gameState) {
            this.renderHand();
            this.renderOpponents();
        }
    }

    isMyTurn() {
        if (!this.gameState || this.gameState.status !== 'playing') return false;
        const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
        return currentPlayer && currentPlayer.id === this.myPlayerId;
    }

    handleGameStateUpdate(state: GameState) {
        this.gameState = state;

        if (state.status === 'waiting') {
            this.turnText.setText('Waiting to start...');
            this.discardPileSprite.setVisible(false);
            this.handGroup.clear(true, true);
            this.opponentsGroup.clear(true, true);
            return;
        }

        if (state.status === 'finished') {
            this.turnText.setText('Game Over!');
            return;
        }

        // Update Turn Text
        const isMyTurn = this.isMyTurn();
        this.turnText.setText(isMyTurn ? "Your Turn!" : "Opponent's Turn");
        this.turnText.setColor(isMyTurn ? '#4ade80' : '#ffffff');

        // Update Discard Pile
        if (state.discardPile.length > 0) {
            const topCard = state.discardPile[state.discardPile.length - 1];
            this.discardPileSprite.setTexture(`card_${topCard.suit}_${topCard.value}`);
            this.discardPileSprite.setVisible(true);
        } else {
            this.discardPileSprite.setVisible(false);
        }

        this.renderHand();
        this.renderOpponents();
    }

    renderHand() {
        if (!this.gameState) return;
        const myPlayer = this.gameState.players.find(p => p.id === this.myPlayerId);
        if (!myPlayer) return;

        this.handGroup.clear(true, true);

        const { width, height } = this.scale;
        const cardWidth = 100;
        const spacing = Math.min(60, (width - 100) / Math.max(1, myPlayer.hand.length));
        const startX = width / 2 - ((myPlayer.hand.length - 1) * spacing) / 2;
        const y = height - 100;

        myPlayer.hand.forEach((card, index) => {
            const sprite = this.add.sprite(startX + index * spacing, y, `card_${card.suit}_${card.value}`)
                .setInteractive()
                .on('pointerover', () => {
                    this.tweens.add({
                        targets: sprite,
                        y: y - 20,
                        duration: 100
                    });
                })
                .on('pointerout', () => {
                    this.tweens.add({
                        targets: sprite,
                        y: y,
                        duration: 100
                    });
                })
                .on('pointerdown', () => {
                    if (this.isMyTurn()) {
                        this.socket.emit('gameAction', { gameId: this.gameId, action: 'discard', payload: { cardIndex: index } });
                    }
                });
            
            this.handGroup.add(sprite);
        });
    }

    renderOpponents() {
        if (!this.gameState) return;
        this.opponentsGroup.clear(true, true);

        const opponents = this.gameState.players.filter(p => p.id !== this.myPlayerId);
        const { width } = this.scale;

        opponents.forEach((opponent, index) => {
            // Simple representation for now: just show number of cards at the top
            const x = width / 2 + (index - (opponents.length - 1) / 2) * 150;
            const y = 100;

            const text = this.add.text(x, y - 60, `Player ${index + 1}\nCards: ${opponent.hand.length}`, {
                fontSize: '16px',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
            
            this.opponentsGroup.add(text);

            // Draw card backs
            for (let i = 0; i < opponent.hand.length; i++) {
                const cardSprite = this.add.sprite(x - (opponent.hand.length * 10) / 2 + i * 10, y, 'card_back');
                cardSprite.setScale(0.5);
                this.opponentsGroup.add(cardSprite);
            }
        });
    }
}
