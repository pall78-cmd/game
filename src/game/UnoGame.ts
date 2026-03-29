import { Game } from 'boardgame.io';
import { UnoEngine, UnoGameState } from '../utils/UnoEngine';

export const UnoGame: Game<UnoGameState> = {
  name: 'uno',
  minPlayers: 2,
  maxPlayers: 7,
  setup: ({ ctx }, setupData) => {
    const playerNames = setupData?.playerNames || ctx.playOrder.map(id => `Player ${id}`);
    const engine = new UnoEngine(ctx.playOrder, playerNames);
    return engine.state;
  },
  moves: {
    startGame: ({ G, playerID }) => {
      const engine = new UnoEngine([], []);
      engine.state = G;
      engine.start();
      return engine.state;
    },
    playCard: ({ G, playerID }, cardIndex: number, chosenColor?: any) => {
      const engine = new UnoEngine([], []);
      engine.state = G;
      engine.playCard(playerID, cardIndex, chosenColor);
      return engine.state;
    },
    drawCard: ({ G, playerID }) => {
      const engine = new UnoEngine([], []);
      engine.state = G;
      engine.drawCard(playerID);
      return engine.state;
    },
    callUno: ({ G, playerID }) => {
      const engine = new UnoEngine([], []);
      engine.state = G;
      engine.callUno(playerID);
      return engine.state;
    }
  },
  turn: {
    activePlayers: { all: 'play' } // Let UnoEngine handle turn validation
  },
  endIf: ({ G }) => {
    if (G.status === 'finished') {
      return { winner: G.winner };
    }
  }
};
