const fs = require('fs');
['src/components/SideA.tsx', 'src/components/SideB.tsx', 'src/App.tsx'].forEach(file => {
    if (!fs.existsSync(file)) return;
    let c = fs.readFileSync(file, 'utf8');
    c = c.replace(/if \(parsed\.type === 'img'\) \{\s*const url = parsed\.content;\s*const urlParts = url\.split\('\/gambar\/'\);\s*if \(urlParts\.length > 1\) \{\s*const filePath = urlParts\[1\]\.split\('\?'\)\[0\];\s*supabaseClient\.storage\.from\(parsed\.type === 'img' \? 'gambar' : 'voice note'\)\.remove\(\[filePath\]\)\.catch\(console\.error\);\s*\}\s*\} else if \(parsed\.type === 'vn'\) \{\s*const url = parsed\.content;\s*const urlParts = url\.includes\('\/voice%20note\/'\)\s*\?\s*url\.split\('\/voice%20note\/'\)\s*:\s*url\.split\('\/voice_note\/'\);\s*if \(urlParts\.length > 1\) \{\s*const filePath = urlParts\[1\]\.split\('\?'\)\[0\];\s*supabaseClient\.storage\.from\(parsed\.type === 'img' \? 'gambar' : 'voice note'\)\.remove\(\[filePath\]\)\.catch\(console\.error\);\s*\}\s*\}/g,
    `if (parsed.type === 'img') {
                    const url = parsed.content;
                    const urlParts = url.split('/gambar/');
                    if (urlParts.length > 1) {
                        const filePath = urlParts[1].split('?')[0];
                        supabaseClient.storage.from('gambar').remove([filePath]).catch(console.error);
                    }
                } else if (parsed.type === 'vn') {
                    const url = parsed.content;
                    const urlParts = url.includes('/voice%20note/') 
                        ? url.split('/voice%20note/') 
                        : url.split('/voice_note/');
                    if (urlParts.length > 1) {
                        const filePath = urlParts[1].split('?')[0];
                        supabaseClient.storage.from('voice note').remove([filePath]).catch(console.error);
                    }
                }`);
    fs.writeFileSync(file, c, 'utf8');
});
