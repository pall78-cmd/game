const fs = require('fs');

const files = ['src/components/SideA.tsx', 'src/components/SideB.tsx', 'src/App.tsx'];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    // ConnectionManager instantiation fixes
    content = content.replace(/new ConnectionManager\(setConnStatus\)/g, 'new ConnectionManager(supabaseClient, setConnStatus)');
    content = content.replace(/new StorageManager\(\)/g, 'new StorageManager(supabaseClient)');
    content = content.replace(/connManagerRef\.current\.reconnectAction\(\)/g, 'connManagerRef.current.triggerReconnect()');

    // 2. Mark as read
    content = content.replace(
        /idsToUpdate\.forEach\(id => connManagerRef\.current\?\.updateMessage\(\{ id, is_read: true \}\)\);/g,
        `supabaseClient.from('Pesan').update({ is_read: true }).in('id', idsToUpdate).then(({ error }) => {});`
    );

    // 3. Edit Message
    content = content.replace(
        /await connManagerRef\.current\?\.updateMessage\(\{ id: editingMsg\.id, teks: finalTeks \}\);/g,
        `await supabaseClient.from('Pesan').update({ teks: finalTeks }).eq('id', editingMsg.id);`
    );

    // 4. Insert Messages
    content = content.replace(
        /await connManagerRef\.current\?\.sendMessage\(finalNama, finalTeks\);/g,
        `await supabaseClient.from('Pesan').insert([{ nama: finalNama, teks: finalTeks }]);`
    );

    // 5. Delete specific message
    content = content.replace(
        /connManagerRef\.current\?\.deleteMessages\(\[msg\.id\]\)\.then\(\(\) => \{/g,
        `supabaseClient.from('Pesan').delete().eq('id', msg.id).then(() => {`
    );

    // 6. Delete query fallback
    content = content.replace(
        /await fetch\('\/api\/clear-messages', \{ method: 'POST' \}\);/g,
        `let deleteQuery = supabaseClient.from('Pesan').delete().neq('id', 0);\nawait deleteQuery;`
    );

    // Also some initRealtime mapped back to subscribe
    content = content.replace(/connManagerRef\.current\?\.initRealtime\(/g, `connManagerRef.current?.subscribe(`);
    content = content.replace(/await connManagerRef\.current\.initRealtime\(/g, `await connManagerRef.current.subscribe(`);

    // fix conn manager param 
    content = content.replace(/new ConnectionManager\(supabaseClient, supabaseClient, setConnStatus\)/g, 'new ConnectionManager(supabaseClient, setConnStatus)');

    // replace channel sending stuff directly back to proper channel access
    content = content.replace(/connManagerRef\.current\.socket/g, 'connManagerRef.current.channel');
    content = content.replace(/connManagerRef\.current\.sendTyping\(([^,]+),\s*([^\)]+)\)/g, "connManagerRef.current.channel?.send({ type: 'broadcast', event: 'typing', payload: { user: $1, typing: $2 } })");
    content = content.replace(/connManagerRef\.current\.sendReadStatus\(([^)]+)\)/g, "connManagerRef.current.channel?.send({ type: 'broadcast', event: 'read', payload: { user: $1 } })");


    fs.writeFileSync(file, content, 'utf8');
}
