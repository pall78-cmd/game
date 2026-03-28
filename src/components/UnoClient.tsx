import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { UnoGame } from '../game/UnoGame';
import { ReactUnoBoard } from './ReactUnoBoard';
import { LoadingScreen } from './LoadingScreen';

export const UnoClient = Client({
  game: UnoGame,
  board: ReactUnoBoard,
  multiplayer: SocketIO({ socketOpts: { path: '/boardgameio/' } }),
  debug: false,
  loading: LoadingScreen
});
