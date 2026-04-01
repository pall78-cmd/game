import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { Game41 } from '../game/Game41';
import { ReactRemiBoard } from './ReactRemiBoard';
import { LoadingScreen } from './LoadingScreen';

export const Game41Client = Client({
  game: Game41,
  board: ReactRemiBoard,
  multiplayer: SocketIO({ 
    server: import.meta.env.VITE_APP_URL || 'https://game-production-bb96.up.railway.app',
    socketOpts: { path: '/boardgameio/', transports: ['websocket'] } 
  }),
  debug: false,
  loading: LoadingScreen
});
