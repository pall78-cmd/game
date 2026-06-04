const fs = require('fs');
let code = fs.readFileSync('src/game/TebakKataGame.ts', 'utf8');
code = code.replace('ctx: any: any', 'ctx: any');
fs.writeFileSync('src/game/TebakKataGame.ts', code, 'utf8');
