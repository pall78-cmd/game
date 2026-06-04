import { UnoGame } from '../src/game/UnoGame';

async function testUnoGameDirect() {
    console.log("Testing UnoGame Directly");
    let G: any = UnoGame.setup({ ctx: { playOrder: ['0', '1', '2'], numPlayers: 3, random: { Shuffle: (a: any) => a } } as any }, { playerNames: { '0': 'A', '1': 'B', '2': 'C' } } as any);
    
    // Start game
    G = UnoGame.moves!.startGame({ G, playerID: '0', ctx: { turn: 1 } as any });
    console.log("Game started. Status: ", G.status);
    console.log("CP Index:", G.currentPlayerIndex);
    console.log("Deck size:", G.deck.length);
    console.log("Top card:", G.discardPile[G.discardPile.length - 1]);

    // Fast-forward simulation
    for(let step = 0; step < 50; step++) {
        if (G.status === 'finished') {
            console.log("FINISH at step", step);
            break;
        }
        let cp = G.currentPlayerIndex;
        let hand = G.players[cp].hand;
        let played = false;
        
        // Dynamic import to match Node ESM
        const { UnoEngine } = await import('../src/utils/UnoEngine');
        let engine = new UnoEngine(['0','1','2'], ['A','B','C']);
        engine.state = G;
        let topCard = engine.state.discardPile[engine.state.discardPile.length - 1];

        for (let i = 0; i < hand.length; i++) {
            if (engine.isValidPlay(hand[i], topCard)) {
                G = UnoGame.moves!.playCard({ G, playerID: G.players[cp].id, ctx: { turn: 1} as any }, i, 'Red');
                played = true;
                break;
            }
        }
        if (!played) {
            G = UnoGame.moves!.drawCard({ G, playerID: G.players[cp].id, ctx: { turn: 1} as any });
        }
    }
}

async function run() {
    try {
        console.log('Testing Uno Game Creation on Server via REST API...');
        const res = await fetch(`http://localhost:3000/games/uno/create`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({numPlayers: 2})
        });
        
        if (!res.ok) {
            console.error("Failed to create UNO:", await res.text());
        } else {
            const data = await res.json();
            console.log("Game created. MatchID:", data.matchID);
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();
