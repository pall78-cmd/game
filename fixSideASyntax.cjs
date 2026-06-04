const fs = require('fs');
let code = fs.readFileSync('src/components/SideA.tsx', 'utf8');

// The file has ~3934 lines. The valid part ends around line 1988 where `</AnimatePresence>` is.
const parts = code.split('</AnimatePresence>');

// There are multiple `</AnimatePresence>`. We want the last valid one in the main structure, which is before the duplication started.
// Actually, let's just find `</AnimatePresence>` followed by `\n\n            \`;\n    };\n`. Because that's where the bad string started!
const badPartStart = code.indexOf('</AnimatePresence>\\n\\n            `;');
if (badPartStart !== -1) {
    code = code.substring(0, badPartStart + 18); // keep up to `</AnimatePresence>`
    code += `\n            {showLeaderboard && (\n                <Leaderboard onClose={() => setShowLeaderboard(false)} />\n            )}\n        </motion.div>\n    );\n}\n`;
    fs.writeFileSync('src/components/SideA.tsx', code, 'utf8');
} else {
    console.log("Could not find bad part start");
}
