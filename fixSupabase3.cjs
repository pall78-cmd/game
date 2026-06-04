const fs = require('fs');

const files = ['src/components/SideA.tsx', 'src/components/SideB.tsx'];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // Nuke selectQuery block
    const selectQueryMatch = content.match(/let selectQuery = supabaseClient\.from\('Pesan'\)[\s\S]*?const texts = data\.map\(\(d: any\) => d\.teks\);/);
    if (selectQueryMatch) {
         content = content.replace(selectQueryMatch[0], `const data = await fetch('/api/messages').then(res => res.json());\n            const texts = data.map((d: any) => d.teks);`);
    }

    // Nuke deleteQuery block
    const deleteQueryMatch = content.match(/let deleteQuery = supabaseClient\.from\('Pesan'\)[\s\S]*?setMessages\(\[\]\);/);
    if (deleteQueryMatch) {
         content = content.replace(deleteQueryMatch[0], `await fetch('/api/clear-messages', { method: 'POST' });\n            setMessages([]);`);
    }

    fs.writeFileSync(file, content, 'utf8');
}
