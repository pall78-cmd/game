const fs = require('fs');

const files = ['src/components/SideA.tsx', 'src/components/SideB.tsx', 'src/App.tsx'];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    // 1. ConnectionManager instantiation
    content = content.replace(/new ConnectionManager\(supabaseClient, setConnStatus\)/g, `new ConnectionManager(setConnStatus)`);

    // 2. StorageManager instantiation
    content = content.replace(/new StorageManager\(supabaseClient\)/g, `new StorageManager()`);

    // 3. triggerReconnect
    content = content.replace(/connManagerRef\.current\.triggerReconnect\(\)/g, `connManagerRef.current.reconnectAction()`);

    // 4. subscribe -> initRealtime
    content = content.replace(/connManagerRef\.current\.subscribe\('chat_room'/g, `connManagerRef.current.initRealtime('chat_room'`);

    // 5. channel.send({ ... typing ... })
    content = content.replace(/connManagerRef\.current\.channel\.send\(\{\s*type: 'broadcast',\s*event: 'typing',\s*payload: \{\s*user: ([^,\} \n]+)(?:,\s*typing:\s*([^ \} \n]+))?[ \t]*\}\s*\}\)/g, 
    (match, p1, p2) => {
        return `connManagerRef.current.sendTyping(${p1}, ${p2 || 'true'})`;
    });

    // 6. channel.send({ ... read ... })
    content = content.replace(/connManagerRef\.current\.channel\.send\(\{\s*type: 'broadcast',\s*event: 'read',\s*payload: \{\s*user: ([^ \} \n]+)[ \t]*\}\s*\}\)/g, 
    `connManagerRef.current.sendReadStatus($1)`);

    fs.writeFileSync(file, content, 'utf8');
}
