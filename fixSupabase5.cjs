const fs = require('fs');

for (const file of ['src/components/SideA.tsx', 'src/components/SideB.tsx']) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/const \{ error: storageError \} = \/\/ Removed storage call/g, 'const storageError = null; // Removed');
    fs.writeFileSync(file, content, 'utf8');
}
