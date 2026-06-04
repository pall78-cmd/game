const fs = require('fs');
let code = fs.readFileSync('src/utils/UnoEngine.ts', 'utf8');

// UnoEngine.ts null
code = code.replace(/winner\?: string \| null \| undefined;/g, 'winner?: string;');
code = code.replace(/winner\?: string \| null;/g, 'winner?: string;');
code = code.replace(/winner\?: string \| undefined;/g, 'winner?: string;');
code = code.replace(/winner: string \| null;/g, 'winner?: string;');
code = code.replace(/as unknown as UnoFlipSide\[\]/g, 'as any[]');

fs.writeFileSync('src/utils/UnoEngine.ts', code, 'utf8');

let b = fs.readFileSync('src/components/SideB.tsx', 'utf8');
b = b.replace(/null\(\"leaveGame\"/g, '(() => {})(\"leaveGame\"');
b = b.replace(/null\(\"gameFinished\"/g, '(() => {})(\"gameFinished\"');
b = b.replace(/null\?.emit/g, '(null as any)?.emit');
fs.writeFileSync('src/components/SideB.tsx', b, 'utf8');

let m = fs.readFileSync('src/main.tsx', 'utf8');
m = m.replace(/App\.tsx/g, 'App');
fs.writeFileSync('src/main.tsx', m, 'utf8');

let u = fs.readFileSync('src/components/ReactUnoBoard.tsx', 'utf8');
u = u.replace(/"Black"/g, '"Black" as any');
fs.writeFileSync('src/components/ReactUnoBoard.tsx', u, 'utf8');

let tbk = fs.readFileSync('src/game/TebakKataGame.ts', 'utf8');
tbk = tbk.replace("import type { Game } from 'boardgame.io';\\ntype any = any;\\n// \\nimport { Game } from 'boardgame.io/core';", "import type { Game } from 'boardgame.io';");
tbk = tbk.replace("import { Game } from 'boardgame.io/core';", "import type { Game } from 'boardgame.io';");
tbk = tbk.replace('G: any, ctx: any', 'G: any, ctx: any');
tbk = tbk.replace('(G, ctx)', '(G: any, ctx: any)');
tbk = tbk.replace('(G, ctx =>', '(G: any, ctx: any =>');
tbk = tbk.replace(/ctx\)/g, 'ctx: any)');
fs.writeFileSync('src/game/TebakKataGame.ts', tbk, 'utf8');

