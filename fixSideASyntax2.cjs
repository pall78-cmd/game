const fs = require('fs');
let code = fs.readFileSync('src/components/SideA.tsx', 'utf8');
const match = code.match(/<\/AnimatePresence>\s*`;\s*};\s*/);
if (match) {
    code = code.substring(0, match.index + 18);
    code += `\n            {showLeaderboard && (\n                <Leaderboard onClose={() => setShowLeaderboard(false)} />\n            )}\n        </motion.div>\n    );\n}\n`;
    fs.writeFileSync('src/components/SideA.tsx', code, 'utf8');
    console.log("Fixed!");
} else {
    // maybe it's just duplicated? Let's check where the second `export default function SideA` is
    const parts = code.split('export default function SideA');
    if (parts.length > 2) {
        // we have duplicates
        console.log("Found duplicates");
    }
}
