import { Client } from 'boardgame.io/client';
import { Local } from 'boardgame.io/multiplayer';
import { UnoGame } from '../src/game/UnoGame';
import { TebakKataGame } from '../src/game/TebakKataGame';

async function testTebakKata() {
    console.log('--- Testing TebakKata Game ---');
    const client0 = Client({
        game: TebakKataGame,
        numPlayers: 2,
        playerID: '0',
        multiplayer: Local(),
    });

    const client1 = Client({
        game: TebakKataGame,
        numPlayers: 2,
        playerID: '1',
        multiplayer: Local(),
    });

    client0.start();
    client1.start();
    
    console.log("P0 Initial word length:", client0.getState()?.G.word.length);
    console.log("P0 word:", client0.getState()?.G.word);

    let state0 = client0.getState();
    console.log("Current player:", state0?.ctx.currentPlayer);

    client0.moves.guessLetter("A");
    state0 = client0.getState();
    console.log("P0 guessed A. Current player now:", state0?.ctx.currentPlayer);
    console.log("Guessed Letters:", state0?.G.guessedLetters);

    client0.stop();
    client1.stop();
    console.log('--- TebakKata Test Finished ---\n');
}

async function testUno() {
    console.log('--- Testing UNO ---');
    const client0 = Client({
        game: UnoGame,
        numPlayers: 2,
        playerID: '0',
        multiplayer: Local(),
    });
    const client1 = Client({
        game: UnoGame,
        numPlayers: 2,
        playerID: '1',
        multiplayer: Local(),
    });

    client0.start();
    client1.start();

    // Uno initial starts with startGame
    client0.moves.startGame();

    let state0 = client0.getState();
    console.log("P0 Hand:", state0?.G.players['0'].hand.length);
    console.log("P0 is current player according to UnoEngine?", state0?.G.currentPlayer === '0');
    console.log("Is P0 active?", state0?.ctx.activePlayers);
    
    if (state0?.G.currentPlayer === '0') {
         client0.moves.drawCard();
    } else {
         client1.moves.drawCard();
    }

    state0 = client0.getState();
    console.log("After draw -> P0 Hand:", state0?.G.players['0'].hand.length, "P1 Hand:", state0?.G.players['1'].hand.length);

    client0.stop();
    client1.stop();
    console.log('--- UNO Test Finished ---\n');
}

async function run() {
    await testTebakKata();
    await testUno();
}
run();
