import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { Game41 } from '../game/Game41';
import { ReactRemiBoard } from './ReactRemiBoard';
import { LoadingScreen } from './LoadingScreen';

export const Game41Client = Client({
  game: Game41,
  board: ReactRemiBoard,
  multiplayer: SocketIO({ socketOpts: { path: '/boardgameio/' } }),
  debug: false,
  loading: LoadingScreen
});
