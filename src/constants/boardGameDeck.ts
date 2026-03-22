export const UNO_CARD_SVG = (side: 'Light' | 'Dark', color: string, value: string) => {
  const isDark = side === 'Dark';
  const fillColor = color === 'Black' ? '#18181b' : color.toLowerCase();
  
  // Dark side colors mapping
  const darkColors: { [key: string]: string } = {
    'Purple': '#7e22ce',
    'Orange': '#f97316',
    'Pink': '#ec4899',
    'Teal': '#14b8a6',
    'Black': '#18181b'
  };

  const finalColor = isDark && darkColors[color] ? darkColors[color] : fillColor;
  
  const borderColor = isDark ? '#18181b' : 'white';
  const ellipseColor = isDark ? '#18181b' : 'white';
  const cornerTextColor = 'white';
  const centerTextColor = isDark ? (color === 'Black' ? 'white' : finalColor) : (color === 'Black' ? '#18181b' : finalColor);
  
  let longestWordLength = value.length;
  if (value.includes(' ')) {
    longestWordLength = Math.max(...value.split(' ').map(w => w.length));
  }

  let fontSize = '60';
  if (longestWordLength > 10) fontSize = '20';
  else if (longestWordLength > 5) fontSize = '30';
  else if (longestWordLength > 2) fontSize = '40';

  let cornerFontSize = '30';
  if (value.length > 10) cornerFontSize = '12';
  else if (value.length > 5) cornerFontSize = '16';
  else if (value.length > 2) cornerFontSize = '20';

  let centerTextSvg = '';
  if (value.includes(' ')) {
    const words = value.split(' ');
    if (words.length === 2) {
      centerTextSvg = `
        <text x="50%" y="130" font-family="Arial" font-size="${fontSize}" font-weight="bold" fill="${centerTextColor}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-15 100 150)">${words[0]}</text>
        <text x="50%" y="170" font-family="Arial" font-size="${fontSize}" font-weight="bold" fill="${centerTextColor}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-15 100 150)">${words[1]}</text>
      `;
    } else if (words.length === 3) {
      centerTextSvg = `
        <text x="50%" y="110" font-family="Arial" font-size="${fontSize}" font-weight="bold" fill="${centerTextColor}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-15 100 150)">${words[0]}</text>
        <text x="50%" y="150" font-family="Arial" font-size="${fontSize}" font-weight="bold" fill="${centerTextColor}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-15 100 150)">${words[1]}</text>
        <text x="50%" y="190" font-family="Arial" font-size="${fontSize}" font-weight="bold" fill="${centerTextColor}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-15 100 150)">${words[2]}</text>
      `;
    } else {
      centerTextSvg = `<text x="50%" y="150" font-family="Arial" font-size="${fontSize}" font-weight="bold" fill="${centerTextColor}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-15 100 150)">${value}</text>`;
    }
  } else {
    centerTextSvg = `<text x="50%" y="150" font-family="Arial" font-size="${fontSize}" font-weight="bold" fill="${centerTextColor}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-15 100 150)">${value}</text>`;
  }

  return `
<svg width="100%" height="100%" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="300" rx="20" fill="${isDark ? '#3f3f46' : finalColor}" />
  <rect x="10" y="10" width="180" height="280" rx="15" fill="${finalColor}" stroke="${borderColor}" stroke-width="5" />
  <ellipse cx="100" cy="150" rx="70" ry="100" fill="${ellipseColor}" transform="rotate(-15 100 150)" />
  ${centerTextSvg}
  <text x="25" y="45" font-family="Arial" font-size="${cornerFontSize}" font-weight="bold" fill="${cornerTextColor}">${value}</text>
  <text x="175" y="265" font-family="Arial" font-size="${cornerFontSize}" font-weight="bold" fill="${cornerTextColor}" text-anchor="end" transform="rotate(180 175 265)">${value}</text>
</svg>
`;
};

export const REMI_CARD_SVG = (suit: string, value: string) => {
    const color = (suit === '♥' || suit === '♦') ? 'red' : 'black';
    return `
<svg width="100%" height="100%" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="300" rx="10" fill="white" />
  <rect width="200" height="300" rx="10" fill="none" stroke="#ccc" stroke-width="2" />
  <text x="20" y="40" font-family="Arial" font-size="30" font-weight="bold" fill="${color}">${value}</text>
  <text x="20" y="70" font-family="Arial" font-size="30" fill="${color}">${suit}</text>
  <text x="100" y="150" font-family="Arial" font-size="80" fill="${color}" text-anchor="middle" dominant-baseline="middle">${suit}</text>
  <text x="180" y="270" font-family="Arial" font-size="30" font-weight="bold" fill="${color}" text-anchor="end" transform="rotate(180 180 270)">${value}</text>
  <text x="180" y="240" font-family="Arial" font-size="30" fill="${color}" text-anchor="end" transform="rotate(180 180 240)">${suit}</text>
</svg>
`;
};
