const fs = require('fs');

for (const file of ['src/components/SideA.tsx', 'src/components/SideB.tsx', 'src/utils/useGameRoom.ts']) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/import \{ supabaseClient \} from '\.\.\/\.\.\/supabase';\n?/g, '');
    fs.writeFileSync(file, content, 'utf8');
}
