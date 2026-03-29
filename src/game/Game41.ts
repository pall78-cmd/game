import { Game } from 'boardgame.io';
import { Game41Engine, Game41State } from '../utils/Game41Engine';

export const Game41: Game<Game41State> = {
  name: 'remi41',
  minPlayers: 2,
  maxPlayers: 7,
  setup: ({ ctx }, setupData) => {
    const playerNames = setupData?.playerNames || ctx.playOrder.map(id => `Player ${id}`);
    const engine = new Game41Engine(ctx.playOrder, playerNames);
    return engine.state;
  },
  moves: {
    startGame: ({ G, playerID }) => {
      const engine = new Game41Engine([], []);
      engine.state = G;
      engine.start();
      return engine.state;
    },
    drawCard: ({ G, playerID }) => {
      const engine = new Game41Engine([], []);
      engine.state = G;
      engine.drawCard(playerID);
      return engine.state;
    },
    drawFromDiscard: ({ G, playerID }) => {
      const engine = new Game41Engine([], []);
      engine.state = G;
      engine.drawFromDiscard(playerID);
      return engine.state;
    },
    discardCard: ({ G, playerID }, cardIndex: number) => {
      const engine = new Game41Engine([], []);
      engine.state = G;
      engine.discardCard(playerID, cardIndex);
      return engine.state;
    }
  },
  turn: {
    activePlayers: { all: 'play' }
  },
  endIf: ({ G }) => {
    if (G.status === 'finished') {
      return { winner: G.winner };
    }
  }
};
