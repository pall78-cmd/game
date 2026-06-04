const fs = require('fs');

function fix(path, fromStr, toStr) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');
    content = content.split(fromStr).join(toStr);
    fs.writeFileSync(path, content, 'utf8');
}

fix('src/components/SideA.tsx', 'username={username}', '');
fix('src/components/SideB.tsx', 'null.emit', '// emit');
fix('src/components/SideB.tsx', 'null?.emit', '// emit');
fix('src/game/TebakKataGame.ts', 'G, ctx', 'G: any, ctx: any');
fix('src/main.tsx', "import App from './App.tsx';", "import App from './App';");

fs.writeFileSync('src/utils/UnoEngine.ts', fs.readFileSync('src/utils/UnoEngine.ts', 'utf8').replace(/winner\?: string \| null;/g, 'winner?: string | undefined;'), 'utf8');
