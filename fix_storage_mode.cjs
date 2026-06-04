const fs = require('fs');

function fixStorageAndChaos(fileContent, roomStr) {
    // Replace the ViewOnce burn logic
    fileContent = fileContent.replace(
        /\/\/ Remote file deletion skipped for local env/g,
        `supabaseClient.storage.from(parsed.type === 'img' ? 'gambar' : 'voice note').remove([filePath]).catch(console.error);`
    );

    // Replace chaos fetch logic
    fileContent = fileContent.replace(
        /const messagesToDelete = await fetch\('\/api\/messages'\)\.then\(res => res\.json\(\)\);/g,
        `let selectQuery = supabaseClient.from('Pesan').select('teks');\n            if (currentRoomRef.current === 'B') {\n                selectQuery = selectQuery.like('nama', 'ROOM_B|%');\n            } else {\n                selectQuery = selectQuery.not('nama', 'like', 'ROOM_B|%');\n            }\n            const { data: messagesToDelete } = await selectQuery;`
    );

    // Replace chaos logic for Storage remove - need strict replace to not double replace
    fileContent = fileContent.replace(
        /const storageError = null; \/\/ Removed\n.*if \(storageError\) console\.error\("Gagal menghapus file gambar:", storageError\);/g,
        `const { error: storageError } = await supabaseClient.storage.from('gambar').remove(buktiFilesToRemove);\n                    if (storageError) console.error("Gagal menghapus file gambar:", storageError);`
    );

    fileContent = fileContent.replace(
        /const storageError = null; \/\/ Removed\n.*if \(storageError\) console\.error\("Gagal menghapus file voicenote:", storageError\);/g,
        `const { error: storageError } = await supabaseClient.storage.from('voice note').remove(vnFilesToRemove);\n                    if (storageError) console.error("Gagal menghapus file voicenote:", storageError);`
    );

    // Replace chaos DB delete call (Side B only deletes B, Side A deletes A)
    const deletePattern = /let deleteQuery = supabaseClient\.from\('Pesan'\)\.delete\(\)\.neq\('id', 0\);\s*await deleteQuery;/g;
    fileContent = fileContent.replace(
        deletePattern,
        `let deleteQuery = supabaseClient.from('Pesan').delete().neq('id', 0);\n            if (currentRoomRef.current === 'B') {\n                deleteQuery = deleteQuery.like('nama', 'ROOM_B|%');\n            } else {\n                deleteQuery = deleteQuery.not('nama', 'like', 'ROOM_B|%');\n            }\n            await deleteQuery;`
    );
    
    return fileContent;
}

['src/components/SideA.tsx', 'src/components/SideB.tsx', 'src/App.tsx'].forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    content = fixStorageAndChaos(content, file.includes('SideB') ? 'B' : 'A');
    fs.writeFileSync(file, content, 'utf8');
});
console.log("Storage and DB cleanup fixed.");
