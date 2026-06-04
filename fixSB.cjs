const fs = require('fs');
let sB = fs.readFileSync('src/components/SideB.tsx', 'utf8');
sB = sB.replace(/"TEBAKKATA"/g, '"TEBAK_KATA"');
sB = sB.replace(/=== 'TEBAKKATA'/g, "=== 'TEBAK_KATA'");
fs.writeFileSync('src/components/SideB.tsx', sB, 'utf8');

let sA = fs.readFileSync('src/components/SideA.tsx', 'utf8');
sA = sA.replace(/"TEBAKKATA"/g, '"TEBAK_KATA"');
sA = sA.replace(/=== 'TEBAKKATA'/g, "=== 'TEBAK_KATA'");
fs.writeFileSync('src/components/SideA.tsx', sA, 'utf8');
