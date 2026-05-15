import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { TebakKataGame } from '../game/TebakKataGame';
import { ReactTebakKataBoard } from './ReactTebakKataBoard';
import { LoadingScreen } from './LoadingScreen';

export const TebakKataClient = Client({
  game: TebakKataGame,
  board: ReactTebakKataBoard,
  multiplayer: SocketIO({ 
    server: window.location.origin,
    socketOpts: { path: '/boardgameio/', transports: ['websocket'] } 
  }),
  debug: false,
  loading: LoadingScreen
});
