const fs = require('fs');

const files = ['src/components/SideA.tsx', 'src/components/SideB.tsx'];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Initial Load Messages
    content = content.replace(
        /let query = supabaseClient\.from\('Pesan'\)\.select\('\*'\)\.order\('id', \{ ascending: true \}\);[\s\S]*?const \{ data \} = await query;/g,
        `const data = await fetch('/api/messages').then(res => res.json());`
    );
    
    // Refresh query
    content = content.replace(
        /let query = supabaseClient\.from\('Pesan'\)\.select\('\*'\)\.order\('id', \{ ascending: true \}\);[\s\S]*?const \{ data, error \} = await query;[\s\S]*?if \(error\) throw error;[\s\S]*?setMessages\(data \|\| \[\]\);/g,
        `const data = await fetch('/api/messages').then(res => res.json());\nsetMessages(data || []);`
    );

    // 2. Mark as read
    content = content.replace(
        /supabaseClient\.from\('Pesan'\)\.update\(\{ is_read: true \}\)\.in\('id', idsToUpdate\)\.then\(\(\{ error \}\) => \{[\s\S]*?\}\);/g,
        `idsToUpdate.forEach(id => connManagerRef.current?.updateMessage({ id, is_read: true }));`
    );

    // 3. Edit Message
    content = content.replace(
        /await supabaseClient\.from\('Pesan'\)\.update\(\{ teks: finalTeks \}\)\.eq\('id', editingMsg\.id\);/g,
        `await connManagerRef.current?.updateMessage({ id: editingMsg.id, teks: finalTeks });`
    );

    // 4. Insert Messages (various places)
    content = content.replace(
        /await supabaseClient\.from\('Pesan'\)\.insert\(\[\{ nama: finalNama, teks: finalTeks \}\]\);/g,
        `await connManagerRef.current?.sendMessage(finalNama, finalTeks);`
    );

    // 5. Delete specific message
    content = content.replace(
        /supabaseClient\.from\('Pesan'\)\.delete\(\)\.eq\('id', msg\.id\)\.then\(\(\) => \{/g,
        `connManagerRef.current?.deleteMessages([msg.id]).then(() => {`
    );

    // 6. Delete all messages (Clear history)
    content = content.replace(
        /let deleteQuery = supabaseClient\.from\('Pesan'\)\.delete\(\)\.neq\('id', 0\);[\s\S]*?await deleteQuery;\n\s*setMessages\(\[\]\);/g,
        `await fetch('/api/clear-messages', { method: 'POST' });\n            setMessages([]);`
    );

    // 7. Download chat logs
    content = content.replace(
        /let selectQuery = supabaseClient\.from\('Pesan'\)\.select\('teks'\);[\s\S]*?const \{ data, error \} = await selectQuery;[\s\S]*?if \(error\) throw error;[\s\S]*?const texts = data\.map\(d => d\.teks\);/g,
        `const data = await fetch('/api/messages').then(res => res.json());\nconst texts = data.map((d: any) => d.teks);`
    );

    fs.writeFileSync(file, content, 'utf8');
}
