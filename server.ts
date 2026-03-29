import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createProxyMiddleware } from "http-proxy-middleware";
import pkg from "boardgame.io/dist/cjs/server.js";
const { Server: BgioServer, SocketIO: BgioSocketIO, Origins } = pkg;
import { UnoGame } from "./src/game/UnoGame";
import { Game41 } from "./src/game/Game41";

const app = express();
const customRoomMap = new Map<string, string>();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" },
    destroyUpgrade: false
});

const PORT = 3000;
const BGIO_PORT = 3001;

const bgioServer = BgioServer({
    games: [UnoGame, Game41],
    origins: [Origins.LOCALHOST, '*'],
    transport: new BgioSocketIO({
        socketOpts: { path: '/boardgameio/' }
    })
});

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://rruxlxoeelxjjjmhafkc.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJydXhseG9lZWx4ampqbWhhZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDU5OTMsImV4cCI6MjA4NTMyMTk5M30.oR2hl_BDD1P6Dmtos2So-aJ_eoFl1-Kwybt6mQnvq0Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function startServer() {
    // Start boardgame.io server
    await bgioServer.run({ port: BGIO_PORT });
    
    // Add logging to socket.io
    if (bgioServer.app.context.io && bgioServer.app.context.io.socket) {
        const io = bgioServer.app.context.io.socket;
        io.of('/uno').on('connection', (socket: any) => {
            console.log(`[bgioServer] /uno connected: ${socket.id}`);
        });
        io.of('/remi41').on('connection', (socket: any) => {
            console.log(`[bgioServer] /remi41 connected: ${socket.id}`);
        });
    }

    // Proxy boardgame.io API and WebSocket
    app.use(createProxyMiddleware({ pathFilter: '/games', target: `http://127.0.0.1:${BGIO_PORT}`, changeOrigin: true }));
    const wsProxy = createProxyMiddleware({ pathFilter: '/boardgameio', target: `http://127.0.0.1:${BGIO_PORT}`, ws: true, changeOrigin: true });
    app.use(wsProxy);
    httpServer.on('upgrade', (req, socket, head) => {
        if (req.url && req.url.startsWith('/boardgameio/')) {
            wsProxy.upgrade(req, socket, head);
        }
    });

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
        app.use(express.static(path.join(process.cwd(), "dist")));
        app.get("*all", (req, res) => {
            res.sendFile(path.join(process.cwd(), "dist", "index.html"));
        });
    }

    const savedGames = new Set<string>();

    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);

        const playerRooms = new Map<string, string>(); // socket.id -> gameId

        socket.on("createGame", async (data) => {
            const { gameId, gameType, playerName, numPlayers } = data;
            const bgioGameName = gameType === 'UNO' ? 'uno' : 'remi41';
            const playersCount = numPlayers || 4;
            try {
                console.log(`Creating game ${bgioGameName} with ID ${gameId} for ${playersCount} players`);
                // Create game via boardgame.io API
                const response = await fetch(`http://127.0.0.1:${BGIO_PORT}/games/${bgioGameName}/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        numPlayers: playersCount,
                        setupData: { playerNames: { '0': playerName || 'Player 1' } }
                    })
                });
                if (!response.ok) {
                    const text = await response.text();
                    console.error(`Create game failed: ${response.status} ${text}`);
                    throw new Error(`Create game failed: ${response.status} ${text}`);
                }
                const result = await response.json();
                console.log("Create game result:", result);
                const matchID = result.matchID;
                
                if (gameId) {
                    customRoomMap.set(gameId, matchID);
                }
                
                // Join the game
                const joinResponse = await fetch(`http://127.0.0.1:${BGIO_PORT}/games/${bgioGameName}/${matchID}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        playerID: '0',
                        playerName: playerName || 'Player 1'
                    })
                });
                const joinResult = await joinResponse.json();
                console.log("Join game result:", joinResult);
                
                socket.emit("gameCreated", { gameId: gameId || matchID, actualMatchId: matchID, playerID: '0', credentials: joinResult.playerCredentials, gameType });
                console.log(`User ${socket.id} created ${gameType} game ${matchID} (custom ID: ${gameId})`);
            } catch (error) {
                console.error("Error creating game:", error);
                socket.emit("gameError", "Failed to create game.");
            }
        });

        socket.on("joinGame", async (data) => {
            let { gameId, playerName } = data;
            const customGameId = gameId;
            let gameType = data.gameType;
            let bgioGameName = '';
            let matchData = null;
            
            // Resolve custom gameId if it exists
            if (customRoomMap.has(gameId)) {
                gameId = customRoomMap.get(gameId);
            }
            
            try {
                if (!gameType) {
                    // Try UNO first
                    let response = await fetch(`http://127.0.0.1:${BGIO_PORT}/games/uno/${gameId}`);
                    if (response.ok) {
                        gameType = 'UNO';
                        bgioGameName = 'uno';
                        matchData = await response.json();
                    } else {
                        // Try REMI41
                        response = await fetch(`http://127.0.0.1:${BGIO_PORT}/games/remi41/${gameId}`);
                        if (response.ok) {
                            gameType = 'REMI41';
                            bgioGameName = 'remi41';
                            matchData = await response.json();
                        }
                    }
                } else {
                    bgioGameName = gameType === 'UNO' ? 'uno' : 'remi41';
                    const response = await fetch(`http://127.0.0.1:${BGIO_PORT}/games/${bgioGameName}/${gameId}`);
                    if (response.ok) {
                        matchData = await response.json();
                    }
                }

                if (!matchData) {
                    socket.emit("gameError", "Game not found.");
                    return;
                }
                
                // Find first empty seat
                const players = matchData.players;
                let emptySeatID = null;
                for (const pID in players) {
                    if (!players[pID].name) {
                        emptySeatID = pID;
                        break;
                    }
                }

                if (emptySeatID === null) {
                    socket.emit("gameError", "Game is full.");
                    return;
                }
                
                const playerID = emptySeatID.toString();
                
                // Join the game
                const joinResponse = await fetch(`http://127.0.0.1:${BGIO_PORT}/games/${bgioGameName}/${gameId}/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        playerID,
                        playerName: playerName || `Player ${parseInt(playerID) + 1}`
                    })
                });
                
                if (!joinResponse.ok) {
                    socket.emit("gameError", "Failed to join game.");
                    return;
                }
                
                const joinResult = await joinResponse.json();
                
                socket.emit("gameJoined", { gameId: customGameId, actualMatchId: gameId, playerID, credentials: joinResult.playerCredentials, gameType });
                console.log(`User ${socket.id} joined game ${gameId} as player ${playerID}`);
            } catch (error) {
                console.error("Error joining game:", error);
                socket.emit("gameError", "Failed to join game.");
            }
        });

        socket.on("gameFinished", async (data) => {
            const { gameId, gameType, winner, players } = data;
            
            if (savedGames.has(gameId)) return;
            savedGames.add(gameId);
            
            const matchData = {
                game_type: gameType,
                winner_name: winner,
                players: players,
                created_at: new Date().toISOString()
            };
            
            try {
                const { error } = await supabase.from('match_history').insert([matchData]);
                if (error) {
                    console.error("Error saving match to Supabase:", error);
                } else {
                    console.log(`Match ${gameId} saved to Supabase successfully!`);
                }
            } catch (err) {
                console.error("Exception saving match to Supabase:", err);
            }
        });

        socket.on("leaveGame", async (data) => {
            if (!data) return;
            const { gameId, playerID, credentials, gameType } = data;
            console.log(`User ${socket.id} leaving game ${gameId}`);
            const bgioGameName = gameType === 'UNO' ? 'uno' : 'remi41';
            
            try {
                await fetch(`http://127.0.0.1:${BGIO_PORT}/games/${bgioGameName}/${gameId}/leave`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        playerID,
                        credentials
                    })
                });
            } catch (error) {
                console.error("Error leaving game:", error);
            }
        });

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });
    });

    httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
