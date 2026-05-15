import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { TebakKataGame } from '../game/TebakKataGame';
import { ReactTebakKataBoard } from './ReactTebakKataBoard';
import { LoadingScreen } from './LoadingScreen';

export const TebakKataClient = Client({
  game: TebakKataGame,
  board: ReactTebakKataBoard,
  multiplayer: SocketIO({ 
    server: import.meta.env.VITE_APP_URL || 'https://game-production-bb96.up.railway.app',
    socketOpts: { path: '/boardgameio/', transports: ['websocket'] } 
  }),
  debug: false,
  loading: LoadingScreen
});
