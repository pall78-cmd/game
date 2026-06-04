const fs = require('fs');

const files = ['src/components/SideA.tsx', 'src/components/SideB.tsx', 'src/App.tsx'];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    // Remove triggerReconnect which doesn't exist
    content = content.replace(/connManagerRef\.current\?.triggerReconnect\(\);/g, `connManagerRef.current?.reconnectAction();`);

    // Replace channel typing
    content = content.replace(
        /connManagerRef\.current\.channel\.send\(\{\n\s*type: 'broadcast',\n\s*event: 'typing',\n\s*payload: \{ sender: ([^,]+), typing: ([^ ]+) \}\n\s*\}\);/g,
        `connManagerRef.current.sendTyping($1, $2);`
    );

    // Replace channel read
    content = content.replace(
        /connManagerRef\.current\.channel\.send\(\{\n\s*type: 'broadcast',\n\s*event: 'read',\n\s*payload: \{ sender: ([^ ]+) \}\n\s*\}\);/g,
        `connManagerRef.current.sendReadStatus($1);`
    );

    // Some simple type fixes for msg
    content = content.replace(/messagesToDelete\.forEach\(\(msg\) => \{/g, `messagesToDelete.forEach((msg: any) => {`);
    content = content.replace(/messagesToDelete\.forEach\(msg => \{/g, `messagesToDelete.forEach((msg: any) => {`);

    fs.writeFileSync(file, content, 'utf8');
}
