import { Socket } from 'socket.io';
import { BaseGameEngine } from './GameEngine';

export class GameManager {
    private rooms: Map<string, { engine: BaseGameEngine, players: Set<string> }> = new Map();

    constructor() {}

    createRoom(roomId: string, engine: BaseGameEngine) {
        this.rooms.set(roomId, { engine, players: new Set() });
    }

    joinRoom(roomId: string, playerId: string) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.players.add(playerId);
            return true;
        }
        return false;
    }

    leaveRoom(roomId: string, playerId: string) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.players.delete(playerId);
        }
    }

    getEngine(roomId: string): BaseGameEngine | undefined {
        return this.rooms.get(roomId)?.engine;
    }
}
