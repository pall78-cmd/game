const fs = require('fs');

// UnoEngine
let code = fs.readFileSync('src/utils/UnoEngine.ts', 'utf8');
code = code.replace(/winner\?: string;/g, 'winner?: string | null;');
code = code.replace(/as any\[\]/g, 'as unknown as any[]');
fs.writeFileSync('src/utils/UnoEngine.ts', code, 'utf8');

// ReactUnoBoard
let u = fs.readFileSync('src/components/ReactUnoBoard.tsx', 'utf8');
u = u.replace(/(targetColor === 'Black') as any/g, "($1 as any)");
u = u.replace(/targetColor === 'Black' as any/g, "(targetColor as any) === 'Black'");
fs.writeFileSync('src/components/ReactUnoBoard.tsx', u, 'utf8');

// TebakKataGame
let tbk = fs.readFileSync('src/game/TebakKataGame.ts', 'utf8');
tbk = tbk.replace("import type { Game } from 'boardgame.io';", "import type { Game } from 'boardgame.io';\n// @ts-ignore");
tbk = tbk.replace("(G: any, ctx: any \=\> {", "(G: any, ctx: any) \=\> {");
tbk = tbk.replace(/(G: any, ctx) =>/g, "(G: any, ctx: any) =>");
fs.writeFileSync('src/game/TebakKataGame.ts', tbk, 'utf8');
