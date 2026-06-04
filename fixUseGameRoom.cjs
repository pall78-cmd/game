const fs = require('fs');

let content = fs.readFileSync('src/utils/useGameRoom.ts', 'utf8');

// Fix getState -> state
content = content.replace(/engineRef\.current\.getState\(\)/g, `engineRef.current.state`);

// Fix processAction
content = content.replace(/engineRef\.current\.processAction\(action as any, payload\);/g, `
                    const engine = engineRef.current as any;
                    if (typeof engine[action] === 'function') {
                        if (Array.isArray(payload)) {
                            engine[action](...payload);
                        } else {
                            engine[action](payload);
                        }
                    }
`);

fs.writeFileSync('src/utils/useGameRoom.ts', content, 'utf8');
