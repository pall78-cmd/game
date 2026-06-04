const fs = require('fs');

const files = ['src/components/SideA.tsx', 'src/components/SideB.tsx'];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // 1. ConnectionManager instantiation
    content = content.replace(
        /new ConnectionManager\(supabaseClient, setConnStatus\)/g,
        `new ConnectionManager(setConnStatus)`
    );

    // 2. StorageManager instantiation
    content = content.replace(
        /new StorageManager\(supabaseClient\)/g,
        `new StorageManager()`
    );

    // 3. File deletions (Supabase storage remove)
    content = content.replace(
        /supabaseClient\.storage\.from\([^)]+\)\.remove\([^)]+\)\.catch\(console\.error\);/g,
        `// Remote file deletion skipped for local env`
    );
    content = content.replace(
        /await supabaseClient\.storage\.from\([^)]+\)\.remove\([^)]+\);/g,
        `// Removed storage call`
    );

    // 4. Download chat logs selectQuery
    content = content.replace(
        /let selectQuery = supabaseClient\.from\('Pesan'\)\.select\('teks'\);[\s\S]*?const \{ data, error \} = await selectQuery;[\s\S]*?if \(error\) throw error;[\s\S]*?const texts = data\.map\(\(d: any\) => d\.teks\);/g,
        `const data = await fetch('/api/messages').then(res => res.json());\n            const texts = data.map((d: any) => d.teks);`
    );

    // 5. Delete all messages (Clear history) deleteQuery
    content = content.replace(
        /let deleteQuery = supabaseClient\.from\('Pesan'\)\.delete\(\)\.neq\('id', 0\);[\s\S]*?await deleteQuery;\n\s*setMessages\(\[\]\);/g,
        `await fetch('/api/clear-messages', { method: 'POST' });\n            setMessages([]);`
    );

    fs.writeFileSync(file, content, 'utf8');
}
