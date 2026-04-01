import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { UnoGame } from '../game/UnoGame';
import { ReactUnoBoard } from './ReactUnoBoard';
import { LoadingScreen } from './LoadingScreen';

export const UnoClient = Client({
  game: UnoGame,
  board: ReactUnoBoard,
  multiplayer: SocketIO({ 
    server: import.meta.env.VITE_APP_URL || 'https://game-production-bb96.up.railway.app',
    socketOpts: { path: '/boardgameio/', transports: ['websocket'] } 
  }),
  debug: false,
  loading: LoadingScreen
});
