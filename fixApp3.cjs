const fs = require('fs');
const files = ['src/components/SideA.tsx', 'src/components/SideB.tsx', 'src/App.tsx'];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/connManagerRef\.current\.channel/g, `connManagerRef.current.socket`);
    fs.writeFileSync(file, content, 'utf8');
}
