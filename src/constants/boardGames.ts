export const UNO_LIGHT_COLORS = ['Red', 'Green', 'Blue', 'Yellow'];
export const UNO_DARK_COLORS = ['Purple', 'Orange', 'Pink', 'Teal'];
export const UNO_LIGHT_VALUES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', '+1', 'Flip'];
export const UNO_DARK_VALUES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip Everyone', 'Reverse', '+5', 'Flip'];
export const UNO_LIGHT_SPECIAL_VALUES = ['Wild', 'Wild Draw 2'];
export const UNO_DARK_SPECIAL_VALUES = ['Wild', 'Wild Draw Color'];

export const drawUnoFlipCard = (side: 'Light' | 'Dark') => {
    const isSpecial = Math.random() < 0.15;
    const colors = side === 'Light' ? UNO_LIGHT_COLORS : UNO_DARK_COLORS;
    const values = side === 'Light' ? UNO_LIGHT_VALUES : UNO_DARK_VALUES;
    const specialValues = side === 'Light' ? UNO_LIGHT_SPECIAL_VALUES : UNO_DARK_SPECIAL_VALUES;
    
    if (isSpecial) {
        const special = specialValues[Math.floor(Math.random() * specialValues.length)];
        return { game: 'UNO_FLIP', side, color: 'Black', value: special };
    }
    
    const color = colors[Math.floor(Math.random() * colors.length)];
    const value = values[Math.floor(Math.random() * values.length)];
    return { game: 'UNO_FLIP', side, color, value };
};

