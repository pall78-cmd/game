import { UnoEngine } from '../src/utils/UnoEngine';
import { TebakKataGame } from '../src/game/TebakKataGame';

function testUnoEngine() {
    console.log("--- UNO Engine ---");
    const engine = new UnoEngine(['0', '1', '2'], ['Alice', 'Bob', 'Charlie']);
    engine.start();
    console.log("Started. CP Index:", engine.state.currentPlayerIndex, "Hand sizes:", engine.state.players[0].hand.length, engine.state.players[1].hand.length, engine.state.players[2].hand.length);
    console.log("Top card:", engine.state.discardPile[engine.state.discardPile.length -1]);
    
    // Play a valid card if possible
    let cpIndex = engine.state.currentPlayerIndex;
    let hand = engine.state.players[cpIndex].hand;
    let played = false;
    for (let i = 0; i < hand.length; i++) {
        const card = hand[i];
        if (engine.isValidPlay(card, engine.state.discardPile[engine.state.discardPile.length -1])) {
            engine.playCard(engine.state.players[cpIndex].id, i, 'Red');
            played = true;
            break;
        }
    }
    
    if (!played) {
        engine.drawCard(engine.state.players[cpIndex].id);
        console.log("Could not play. Drew card. Hand size:", engine.state.players[cpIndex].hand.length);
    } else {
        console.log("Played card. New CP Index:", engine.state.currentPlayerIndex);
    }
}

function testTebakKataEngine() {
    console.log("--- Tebak Kata ---");
    let G = TebakKataGame.setup({ numPlayers: 2, random: null as any, playOrder: ['0','1'], currentPlayer: '0' } as any);
    console.log("Initial word:", G.word);
    
    const ctx = {
        currentPlayer: '0',
        events: {
            endTurn: () => { ctx.currentPlayer = ctx.currentPlayer === '0' ? '1' : '0' },
            endGame: (res) => { console.log("Game Ended:", res) }
        }
    } as any;
    
    const guess = (letter) => {
        console.log(`Player ${ctx.currentPlayer} guesses ${letter}`);
        TebakKataGame.moves?.guessLetter(G, ctx, letter);
    };

    guess('A');
    console.log("Scores:", G.scores, "Guessed:", G.guessedLetters, "Next CP:", ctx.currentPlayer);
    guess('E');
    console.log("Scores:", G.scores, "Guessed:", G.guessedLetters, "Next CP:", ctx.currentPlayer);
}

try {
    testUnoEngine();
    testTebakKataEngine();
} catch(e) {
    console.error(e);
}
