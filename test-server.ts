import pkg from 'boardgame.io/dist/cjs/server.js';
const { Server, SocketIO } = pkg;
import { InitializeGame } from 'boardgame.io/internal';

const UnoGame = { name: 'uno', setup: () => ({ test: 1 }) };

const bgioServer = Server({
  games: [UnoGame],
});

async function start() {
  await bgioServer.db.connect();
  const matchID = 'my-custom-id';
  const initialState = InitializeGame({ game: UnoGame, numPlayers: 2 });
  await bgioServer.db.createMatch(matchID, {
    initialState,
    metadata: {
      gameName: 'uno',
      players: {
        '0': { id: 0, name: 'Alice', credentials: 'alice-secret' },
        '1': { id: 1, name: 'Bob', credentials: 'bob-secret' }
      },
      setupData: {},
      unlisted: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  });
  const match = await bgioServer.db.fetch(matchID, { metadata: true });
  console.log('Match fetched:', match.metadata.players);
  process.exit(0);
}
start();
