export interface Card {
    suit: string;
    value: string;
}

export const getCardValue = (value: string): number => {
    if (value === 'A') return 11;
    if (['K', 'Q', 'J'].includes(value)) return 10;
    return parseInt(value, 10);
};

export const calculateScore = (cards: Card[]): number => {
    // 41 game requires 4 cards of the same suit
    const firstSuit = cards[0]?.suit;
    if (!firstSuit || cards.some(c => c.suit !== firstSuit)) return 0;
    
    return cards.reduce((sum, card) => sum + getCardValue(card.value), 0);
};

export const checkWin = (cards: Card[]): boolean => {
    return cards.length === 4 && calculateScore(cards) === 41;
};
