export const UNO_COLORS = ['Red', 'Green', 'Blue', 'Yellow'];
export const UNO_VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', '+2'];
export const UNO_WILDS = ['Wild', 'Wild +4'];

export const REMI_SUITS = ['♠', '♥', '♦', '♣'];
export const REMI_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const drawUnoCard = () => {
    const isWild = Math.random() < 0.08;
    if (isWild) {
        const wild = UNO_WILDS[Math.floor(Math.random() * UNO_WILDS.length)];
        return { game: 'UNO', color: 'Black', value: wild };
    }
    const color = UNO_COLORS[Math.floor(Math.random() * UNO_COLORS.length)];
    const value = UNO_VALUES[Math.floor(Math.random() * UNO_VALUES.length)];
    return { game: 'UNO', color, value };
};

export const drawRemiCard = () => {
    const suit = REMI_SUITS[Math.floor(Math.random() * REMI_SUITS.length)];
    const value = REMI_VALUES[Math.floor(Math.random() * REMI_VALUES.length)];
    return { game: 'REMI', suit, value };
};
