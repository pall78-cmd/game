import Phaser from 'phaser';
import { UnoGameState, UnoCard } from '../utils/UnoEngine';
import { UNO_CARD_SVG } from '../constants/boardGameDeck';

export class PhaserUnoScene extends Phaser.Scene {
    private gameState: UnoGameState | null = null;
    private socket: any;
    private gameId: string = '';
    private myPlayerId: string = '';

    private handGroup!: Phaser.GameObjects.Group;
    private discardPileSprite!: Phaser.GameObjects.Sprite;
    private deckSprite!: Phaser.GameObjects.Sprite;
    private turnText!: Phaser.GameObjects.Text;
    private opponentsGroup!: Phaser.GameObjects.Group;
    private callUnoButton!: Phaser.GameObjects.Container;
    private currentColorCircle!: Phaser.GameObjects.Graphics;

    private onShowColorPicker!: () => void;
    private onSetPendingWildCardIndex!: (index: number) => void;

    constructor() {
        super({ key: 'UnoScene' });
    }

    init(data: any) {
        this.socket = data.socket;
        this.gameId = data.gameId;
        this.myPlayerId = data.socket.id;
        this.onShowColorPicker = data.onShowColorPicker;
        this.onSetPendingWildCardIndex = data.onSetPendingWildCardIndex;
        if (data.initialGameState) {
            this.gameState = data.initialGameState;
        }
    }

    preload() {
        // Generate all possible card textures
        const lightColors = ['Red', 'Yellow', 'Green', 'Blue'];
        const lightValues = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', '+1', 'Flip'];
        
        lightColors.forEach(color => {
            lightValues.forEach(value => {
                const svg = UNO_CARD_SVG('Light', color, value);
                this.load.svg(`card_${color}_${value}_light`, 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), { width: 100, height: 150 });
            });
        });
        this.load.svg(`card_Black_Wild_light`, 'data:image/svg+xml;utf8,' + encodeURIComponent(UNO_CARD_SVG('Light', 'Black', 'Wild')), { width: 100, height: 150 });
        this.load.svg(`card_Black_Wild Draw 2_light`, 'data:image/svg+xml;utf8,' + encodeURIComponent(UNO_CARD_SVG('Light', 'Black', 'Wild Draw 2')), { width: 100, height: 150 });

        const darkColors = ['Pink', 'Teal', 'Purple', 'Orange'];
        const darkValues = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip Everyone', 'Reverse', '+5', 'Flip'];
        
        darkColors.forEach(color => {
            darkValues.forEach(value => {
                const svg = UNO_CARD_SVG('Dark', color, value);
                this.load.svg(`card_${color}_${value}_dark`, 'data:image/svg+xml;utf8,' + encodeURIComponent(svg), { width: 100, height: 150 });
            });
        });
        this.load.svg(`card_Black_Wild_dark`, 'data:image/svg+xml;utf8,' + encodeURIComponent(UNO_CARD_SVG('Dark', 'Black', 'Wild')), { width: 100, height: 150 });
        this.load.svg(`card_Black_Wild Draw Color_dark`, 'data:image/svg+xml;utf8,' + encodeURIComponent(UNO_CARD_SVG('Dark', 'Black', 'Wild Draw Color')), { width: 100, height: 150 });

        const backLightSvg = UNO_CARD_SVG('Light', 'Black', 'UNO');
        this.load.svg('card_back_light', 'data:image/svg+xml;utf8,' + encodeURIComponent(backLightSvg), { width: 100, height: 150 });
        
        const backDarkSvg = UNO_CARD_SVG('Dark', 'Black', 'UNO');
        this.load.svg('card_back_dark', 'data:image/svg+xml;utf8,' + encodeURIComponent(backDarkSvg), { width: 100, height: 150 });
    }

    create() {
        const { width, height } = this.scale;

        // Background
        this.cameras.main.setBackgroundColor('#18181b'); // zinc-950

        // Groups
        this.handGroup = this.add.group();
        this.opponentsGroup = this.add.group();

        // Deck
        this.deckSprite = this.add.sprite(width / 2 - 80, height / 2, 'card_back_dark')
            .setInteractive()
            .on('pointerdown', () => {
                if (this.isMyTurn()) {
                    this.socket.emit('gameAction', { gameId: this.gameId, action: 'draw' });
                }
            });

        // Discard Pile
        this.discardPileSprite = this.add.sprite(width / 2 + 80, height / 2, 'card_back_dark');
        this.discardPileSprite.setVisible(false);

        // Current Color Indicator
        this.currentColorCircle = this.add.graphics();
        this.currentColorCircle.setPosition(width / 2 + 80, height / 2 - 100);
        this.currentColorCircle.setVisible(false);

        // Turn Text
        this.turnText = this.add.text(width / 2, height / 2 + 100, '', {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Call UNO Button
        const btnBg = this.add.rectangle(0, 0, 150, 50, 0xdc2626).setInteractive();
        const btnText = this.add.text(0, 0, 'CALL UNO!', { fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.callUnoButton = this.add.container(width - 100, height - 100, [btnBg, btnText]);
        this.callUnoButton.setSize(150, 50);
        this.callUnoButton.setInteractive(new Phaser.Geom.Rectangle(-75, -25, 150, 50), Phaser.Geom.Rectangle.Contains);
        this.callUnoButton.on('pointerdown', () => {
            this.socket.emit('gameAction', { gameId: this.gameId, action: 'callUno' });
        });
        this.callUnoButton.setVisible(false);

        // Listen for state updates from React
        this.events.on('updateGameState', this.handleGameStateUpdate, this);

        // Handle Resize
        this.scale.on('resize', this.handleResize, this);

        if (this.gameState) {
            this.handleGameStateUpdate(this.gameState);
        }
    }

    private handleResize(gameSize: Phaser.Structs.Size) {
        const { width, height } = gameSize;
        
        this.deckSprite.setPosition(width / 2 - 80, height / 2);
        this.discardPileSprite.setPosition(width / 2 + 80, height / 2);
        this.currentColorCircle.setPosition(width / 2 + 80, height / 2 - 100);
        this.turnText.setPosition(width / 2, height / 2 + 100);
        this.callUnoButton.setPosition(width - 100, height - 100);

        if (this.gameState) {
            this.handleGameStateUpdate(this.gameState); // Re-render hand and opponents
        }
    }

    private getCardTextureKey(card: UnoCard, isDarkSide: boolean): string {
        const side = isDarkSide ? card.dark : card.light;
        return `card_${side.color}_${side.value}_${isDarkSide ? 'dark' : 'light'}`;
    }

    private isMyTurn(): boolean {
        if (!this.gameState) return false;
        const myIndex = this.gameState.players.findIndex(p => p.id === this.myPlayerId);
        return this.gameState.currentPlayerIndex === myIndex;
    }

    private isPlayable(card: UnoCard): boolean {
        if (!this.gameState || !this.isMyTurn() || this.gameState.status !== 'playing') return false;
        const topCard = this.gameState.discardPile[this.gameState.discardPile.length - 1];
        if (!topCard) return true;

        const side = this.gameState.isDarkSide ? card.dark : card.light;
        const topSide = this.gameState.isDarkSide ? topCard.dark : topCard.light;

        if (side.color === 'Black') return true;
        if (side.color === this.gameState.currentColor) return true;
        if (side.value === topSide.value) return true;
        return false;
    }

    public handleGameStateUpdate(newState: UnoGameState) {
        this.gameState = newState;
        if (!this.turnText) return; // Ensure create() has finished

        const { width, height } = this.scale;

        if (newState.status !== 'playing') {
            this.turnText.setText(newState.status === 'waiting' ? 'Waiting to start...' : `Winner: ${newState.winner}`);
            this.handGroup.clear(true, true);
            this.discardPileSprite.setVisible(false);
            this.currentColorCircle.setVisible(false);
            this.callUnoButton.setVisible(false);
            return;
        }

        // Update Background based on side
        this.cameras.main.setBackgroundColor(newState.isDarkSide ? '#2d1b2e' : '#18181b'); // Darker purple for dark side

        // Update Turn Text
        if (this.isMyTurn()) {
            this.turnText.setText('YOUR TURN');
            this.turnText.setColor('#fbbf24');
        } else {
            const currentPlayer = newState.players[newState.currentPlayerIndex];
            this.turnText.setText(`Waiting for ${currentPlayer?.name || 'others'}...`);
            this.turnText.setColor('#ffffff');
        }

        // Update Deck Sprite
        let deckKey = newState.isDarkSide ? 'card_back_light' : 'card_back_dark';
        if (newState.deck.length > 0) {
            const topDeckCard = newState.deck[newState.deck.length - 1];
            deckKey = this.getCardTextureKey(topDeckCard, !newState.isDarkSide);
        }
        this.deckSprite.setTexture(deckKey);
        this.deckSprite.setDisplaySize(100, 150);

        // Update Discard Pile
        const topCard = newState.discardPile[newState.discardPile.length - 1];
        if (topCard) {
            const key = this.getCardTextureKey(topCard, newState.isDarkSide);
            this.discardPileSprite.setTexture(key);
            this.discardPileSprite.setDisplaySize(100, 150);
            this.discardPileSprite.setVisible(true);

            // Update Current Color Indicator
            const colorMap: { [key: string]: number } = {
                'Red': 0xef4444, 'Blue': 0x3b82f6, 'Green': 0x22c55e, 'Yellow': 0xeab308,
                'Pink': 0xec4899, 'Teal': 0x14b8a6, 'Purple': 0x7e22ce, 'Orange': 0xf97316,
                'Black': 0x18181b
            };
            const colorHex = colorMap[newState.currentColor || 'Black'] || 0xffffff;
            this.currentColorCircle.clear();
            this.currentColorCircle.fillStyle(colorHex, 1);
            this.currentColorCircle.fillCircle(0, 0, 20);
            this.currentColorCircle.lineStyle(2, 0xffffff, 1);
            this.currentColorCircle.strokeCircle(0, 0, 20);
            this.currentColorCircle.setVisible(true);
        } else {
            this.discardPileSprite.setVisible(false);
            this.currentColorCircle.setVisible(false);
        }

        // Update Hand
        this.handGroup.clear(true, true);
        const myPlayer = newState.players.find(p => p.id === this.myPlayerId);
        if (myPlayer) {
            const handSize = myPlayer.hand.length;
            const cardWidth = 100;
            const spacing = Math.min(60, (width - 100) / handSize);
            const startX = width / 2 - ((handSize - 1) * spacing) / 2;

            myPlayer.hand.forEach((card, index) => {
                const key = this.getCardTextureKey(card, newState.isDarkSide);
                const playable = this.isPlayable(card);
                
                const sprite = this.add.sprite(startX + index * spacing, height - 100, key)
                    .setDisplaySize(100, 150)
                    .setInteractive();

                if (!playable) {
                    sprite.setTint(0x888888);
                }

                sprite.on('pointerover', () => {
                    if (playable) {
                        this.tweens.add({
                            targets: sprite,
                            y: height - 130,
                            duration: 100
                        });
                        this.children.bringToTop(sprite);
                    }
                });

                sprite.on('pointerout', () => {
                    this.tweens.add({
                        targets: sprite,
                        y: height - 100,
                        duration: 100
                    });
                });

                sprite.on('pointerdown', () => {
                    if (playable) {
                        const side = newState.isDarkSide ? card.dark : card.light;
                        if (side.color === 'Black') {
                            this.onSetPendingWildCardIndex(index);
                            this.onShowColorPicker();
                        } else {
                            this.socket.emit('gameAction', { gameId: this.gameId, action: 'play', payload: { cardIndex: index } });
                        }
                    }
                });

                this.handGroup.add(sprite);
            });

            // Update Call UNO Button
            if ((handSize === 2 || handSize === 1) && this.isMyTurn() && !myPlayer.hasCalledUno) {
                this.callUnoButton.setVisible(true);
            } else {
                this.callUnoButton.setVisible(false);
            }
        }

        // Update Opponents
        this.opponentsGroup.clear(true, true);
        const opponents = newState.players.filter(p => p.id !== this.myPlayerId);
        opponents.forEach((opp, index) => {
            const x = width / 2 + (index - (opponents.length - 1) / 2) * 200;
            const y = 80;
            
            const text = this.add.text(x, y - 60, `${opp.name}\nCards: ${opp.hand.length}`, {
                fontSize: '16px',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);
            
            this.opponentsGroup.add(text);

            // Draw opponent's cards showing the opposite side
            const spacing = Math.min(20, 150 / Math.max(1, opp.hand.length));
            const startX = x - ((opp.hand.length - 1) * spacing) / 2;

            for (let i = 0; i < opp.hand.length; i++) {
                const card = opp.hand[i];
                const otherSideKey = this.getCardTextureKey(card, !newState.isDarkSide);
                const cardSprite = this.add.sprite(startX + i * spacing, y, otherSideKey);
                cardSprite.setDisplaySize(60, 90);
                this.opponentsGroup.add(cardSprite);
            }
        });
    }
}
