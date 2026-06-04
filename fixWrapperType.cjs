const fs = require('fs');

const file = 'src/components/SupabaseMultiplayerWrapper.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/gameType: 'UNO' \| 'TEBAKKATA';/g, "gameType: 'UNO' | 'TEBAK_KATA';");
content = content.replace(/useGameRoom\(gameId, gameType, playerID, playerName\);/g, "useGameRoom(gameId, playerID, playerName, gameType);");
content = content.replace(/G=\{gameState\} /g, "G={gameState as any} ");

fs.writeFileSync(file, content, 'utf8');
