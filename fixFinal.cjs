const fs = require('fs');
let code = fs.readFileSync('src/utils/UnoEngine.ts', 'utf8');

// UnoEngine.ts null
code = code.replace(/winner\?: string \| undefined;/g, 'winner?: string | null;');
code = code.replace(/winner\?: string;/g, 'winner?: string | null;');
code = code.replace('this.state.winner = null;', '// this.state.winner = null;');

fs.writeFileSync('src/utils/UnoEngine.ts', code, 'utf8');

// App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace('handleDrawFate(\'chaos\', true)', '(handleDrawFate as any)(\'chaos\', true)');
fs.writeFileSync('src/App.tsx', app, 'utf8');

// SideA.tsx
let sideA = fs.readFileSync('src/components/SideA.tsx', 'utf8');
sideA = sideA.replace('handleDrawFate(\'chaos\', true)', '(handleDrawFate as any)(\'chaos\', true)');
sideA = sideA.replace('handleDrawFate(cat)', '(handleDrawFate as any)(cat)');
fs.writeFileSync('src/components/SideA.tsx', sideA, 'utf8');

// SideB.tsx
let sideB = fs.readFileSync('src/components/SideB.tsx', 'utf8');
sideB = sideB.replace('null?.emit(\"leaveGame\"', 'null');
sideB = sideB.replace('null.emit(\"gameFinished\"', 'null');
fs.writeFileSync('src/components/SideB.tsx', sideB, 'utf8');

// ReactUnoBoard.tsx
let u = fs.readFileSync('src/components/ReactUnoBoard.tsx', 'utf8');
u = u.replace("targetColor === ('Black' as unknown)", "targetColor === 'Black' as any");
fs.writeFileSync('src/components/ReactUnoBoard.tsx', u, 'utf8');

// main.tsx
let m = fs.readFileSync('src/main.tsx', 'utf8');
m = m.replace("import App from './App.tsx';", "import App from './App';");
fs.writeFileSync('src/main.tsx', m, 'utf8');

// src/game/TebakKataGame.ts (imports Game from boardgame.io/core which has no exported Game in ts but actually we are doing `import type { Game } from 'boardgame.io';`)
let tbk = fs.readFileSync('src/game/TebakKataGame.ts', 'utf8');
tbk = tbk.replace("import { Game } from 'boardgame.io/core';", "import type { Game } from 'boardgame.io';");
tbk = tbk.replace("(G, ctx", "(G: any, ctx: any");
fs.writeFileSync('src/game/TebakKataGame.ts', tbk, 'utf8');

