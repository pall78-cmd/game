const fs = require('fs');

function cleanInvalidNewlines(path) {
    if (!fs.existsSync(path)) return;
    let text = fs.readFileSync(path, 'utf8');
    text = text.replace(/\\n\\n/g, '\n\n');
    fs.writeFileSync(path, text, 'utf8');
}

cleanInvalidNewlines('src/components/SideA.tsx');
cleanInvalidNewlines('src/components/SideB.tsx');
cleanInvalidNewlines('src/App.tsx');
