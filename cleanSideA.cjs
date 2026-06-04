const fs = require('fs');
let code = fs.readFileSync('src/components/SideA.tsx', 'utf8');

// remove game states
code = code.replace(/const \[gameState, setGameState\] = useState<any>\(null\);\n?/g, '');
code = code.replace(/const \[gameId, setGameId\] = useState\(''\);\n?/g, '');
code = code.replace(/const \[showUnoBoard, setShowUnoBoard\] = useState\(false\);\n?/g, '');
code = code.replace(/const \[showTebakKataBoard, setShowTebakKataBoard\] = useState\(false\);\n?/g, '');

// remove Multiplayer Game UI
const mbStart = code.indexOf('<div className="p-4 bg-zinc-900 text-white rounded-xl mb-4 border border-white/10">');
if (mbStart !== -1) {
    const nextSection = code.indexOf('<!-- SISTEM & MAINTENANCE -->', mbStart) > -1 
        ? code.indexOf('<!-- SISTEM & MAINTENANCE -->', mbStart) 
        : code.indexOf('{/* SISTEM & MAINTENANCE */}', mbStart);
    if (nextSection !== -1) {
        code = code.substring(0, mbStart) + code.substring(nextSection);
    }
}

// remove Uno Board from UI
const unoBoardStart = code.indexOf('{showUnoBoard && (');
if (unoBoardStart !== -1) {
    const unoBoardEnd = code.indexOf(')}', code.indexOf('</SupabaseMultiplayerWrapper>', unoBoardStart)) + 2;
    code = code.substring(0, unoBoardStart) + code.substring(unoBoardEnd);
}

// remove SupabaseMultiplayerWrapper import
code = code.replace(/import \{ SupabaseMultiplayerWrapper \} from '\.\/SupabaseMultiplayerWrapper';\n?/g, '');

fs.writeFileSync('src/components/SideA.tsx', code, 'utf8');
