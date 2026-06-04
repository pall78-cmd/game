const fs = require('fs');

let ge = fs.readFileSync('src/utils/GameEngine.ts', 'utf8');
ge = ge.replace(/winner\?: string;/g, 'winner?: string | null;');
fs.writeFileSync('src/utils/GameEngine.ts', ge, 'utf8');

let uno = fs.readFileSync('src/utils/UnoEngine.ts', 'utf8');
uno = uno.replace(/winner\?: string;/g, 'winner?: string | null;');
fs.writeFileSync('src/utils/UnoEngine.ts', uno, 'utf8');

let tbk = fs.readFileSync('src/game/TebakKataGame.ts', 'utf8');
tbk = tbk.replace("import type { Game } from 'boardgame.io';", "import type { Game } from 'boardgame.io';\n// @ts-ignore");
tbk = tbk.replace("(G: any, ctx: any \\=\\> {", "(G: any, ctx: any) \\=\> {");
tbk = tbk.replace(/(G: any, ctx) =>/g, "(G: any, ctx: any) =>");
fs.writeFileSync('src/game/TebakKataGame.ts', tbk, 'utf8');
