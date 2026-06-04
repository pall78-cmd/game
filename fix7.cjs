const fs = require('fs');
let t = fs.readFileSync('src/components/SideA.tsx', 'utf8');
t = t.replace('\\\\n', '\\n');
fs.writeFileSync('src/components/SideA.tsx', t, 'utf8');
