const fs = require('fs');

const files = ['src/components/SideA.tsx', 'src/components/SideB.tsx'];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    content = content.replace(
        /let selectQuery = supabaseClient\.from\('Pesan'\)[\s\S]*?const \{ data: messagesToDelete \} = await selectQuery;/g,
        `const messagesToDelete = await fetch('/api/messages').then(res => res.json());`
    );

    fs.writeFileSync(file, content, 'utf8');
}
