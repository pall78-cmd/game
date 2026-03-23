import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GameManager } from "./src/utils/GameManager";
import { Game41Engine } from "./src/utils/Game41Engine";
import { UnoEngine } from "./src/utils/UnoEngine";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" }
});

const gameManager = new GameManager();

const PORT = 3000;

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://rruxlxoeelxjjjmhafkc.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJydXhseG9lZWx4ampqbWhhZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDU5OTMsImV4cCI6MjA4NTMyMTk5M30.oR2hl_BDD1P6Dmtos2So-aJ_eoFl1-Kwybt6mQnvq0Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function startServer() {
    // API routes FIRST
    app.get("/api/health", (req, res) => {
        res.json({ status: "ok" });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static(path.join(__dirname, "dist")));
        app.get("*", (req, res) => {
            res.sendFile(path.join(__dirname, "dist", "index.html"));
        });
    }

    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);

        const playerRooms = new Map<string, string>(); // socket.id -> gameId

        socket.on("createGame", (data) => {
            const { gameId, gameType, playerName } = data;
            let engine;
            if (gameType === 'UNO') {
                engine = new UnoEngine([socket.id], [playerName || 'Player 1']);
            } else {
                engine = new Game41Engine([socket.id], [playerName || 'Player 1']);
            }
            gameManager.createRoom(gameId, engine);
            gameManager.joinRoom(gameId, socket.id);
            socket.join(gameId);
            playerRooms.set(socket.id, gameId);
            console.log(`User ${socket.id} created ${gameType} game ${gameId}`);
            io.to(gameId).emit("gameUpdate", { type: "STATE_UPDATE", state: engine.state });
        });

        socket.on("joinGame", (data) => {
            const { gameId, playerName } = data;
            const engine = gameManager.getEngine(gameId);
            if (engine && gameManager.joinRoom(gameId, socket.id)) {
                socket.join(gameId);
                playerRooms.set(socket.id, gameId);
                
                // Add player name to engine state if possible
                const playerIndex = engine.state.players.findIndex((p: any) => p.id === socket.id);
                if (playerIndex !== -1 && engine.state.players[playerIndex]) {
                    (engine.state.players[playerIndex] as any).name = playerName || `Player ${playerIndex + 1}`;
                }
                
                const playerExists = engine.state.players.some(p => p.id === socket.id);
                
                if (!playerExists) {
                    const isUno = 'currentColor' in engine.state;
                    if (isUno) {
                        const unoEngine = engine as any;
                        unoEngine.state.players.push({
                            id: socket.id,
                            name: playerName || `Player ${unoEngine.state.players.length + 1}`,
                            hand: [],
                            score: 0,
                            hasCalledUno: false
                        });
                        unoEngine.log(`${playerName || 'A player'} joined the game.`);
                    } else {
                        engine.state.players.push({
                            id: socket.id,
                            hand: [],
                            score: 0
                        });
                        (engine.state.players[engine.state.players.length - 1] as any).name = playerName || `Player ${engine.state.players.length}`;
                    }
                }
                
                console.log(`User ${socket.id} joined game ${gameId}`);
                io.to(gameId).emit("gameUpdate", { type: "STATE_UPDATE", state: engine.state });
            } else {
                socket.emit("gameError", "Game not found or room is full.");
            }
        });

        socket.on("gameAction", async (data) => {
            const { gameId, action, payload } = data;
            console.log(`[gameAction] action: ${action}, gameId: ${gameId}`);
            const engine = gameManager.getEngine(gameId);
            if (!engine) {
                console.log(`[gameAction] Engine not found for gameId: ${gameId}`);
                socket.emit("gameError", "Game not found. The server might have restarted. Please refresh the page and create a new game.");
                return;
            }
            
            const previousStatus = engine.state.status;
            const isUno = 'currentColor' in engine.state;
            console.log(`[gameAction] engine found. is UnoEngine: ${isUno}`);
                if (isUno) {
                    const unoEngine = engine as any;
                    if (action === 'start') {
                        console.log(`[gameAction] calling UnoEngine.start()`);
                        unoEngine.start();
                        console.log(`[gameAction] UnoEngine.start() finished. status: ${unoEngine.state.status}`);
                    } else if (action === 'draw') {
                        unoEngine.drawCard(socket.id);
                    } else if (action === 'play') {
                        unoEngine.playCard(socket.id, payload.cardIndex, payload.chosenColor);
                    } else if (action === 'callUno') {
                        unoEngine.callUno(socket.id);
                    }
                } else {
                    const game41Engine = engine as any;
                    if (action === 'start') {
                        game41Engine.start();
                    } else if (action === 'draw') {
                        game41Engine.drawCard(socket.id);
                    } else if (action === 'drawFromDiscard') {
                        game41Engine.drawFromDiscard(socket.id);
                    } else if (action === 'discard') {
                        game41Engine.discardCard(socket.id, payload.cardIndex);
                    }
                }
                
                if (previousStatus === 'playing' && engine.state.status === 'finished') {
                    // Game just finished, save to Supabase
                    const matchData = {
                        game_type: isUno ? 'UNO' : 'GAME41',
                        winner_name: engine.state.winner,
                        players: engine.state.players.map(p => (p as any).name || p.id),
                        created_at: new Date().toISOString()
                    };
                    
                    const { error } = await supabase.from('match_history').insert([matchData]);
                    if (error) {
                        console.error("Error saving match to Supabase:", error);
                    } else {
                        console.log("Match saved to Supabase successfully!");
                    }
                }

                io.to(gameId).emit("gameUpdate", { type: "STATE_UPDATE", state: engine.state });
        });

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
            const gameId = playerRooms.get(socket.id);
            if (gameId) {
                const engine = gameManager.getEngine(gameId);
                if (engine) {
                    const isUno = 'currentColor' in engine.state;
                    if (isUno) {
                        const player = engine.state.players.find(p => p.id === socket.id);
                        if (player) {
                            (engine as any).log(`${(player as any).name || player.id} disconnected.`);
                        }
                    }
                    // Remove player from engine state
                    engine.state.players = engine.state.players.filter(p => p.id !== socket.id);
                    
                    // If no players left, we could clean up the room, but let's just emit update for now
                    io.to(gameId).emit("gameUpdate", { type: "STATE_UPDATE", state: engine.state });
                }
                gameManager.leaveRoom(gameId, socket.id);
                playerRooms.delete(socket.id);
            }
        });
    });

    httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
