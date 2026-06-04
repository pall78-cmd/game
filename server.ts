import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import http from "http";
import { Server } from "socket.io";
import storage from "node-persist";
import multer from "multer";
import fs from "fs";

async function startServer() {
    const app = express();
    const server = http.createServer(app);
    const PORT = process.env.PORT || 3000;

    await storage.init({ dir: '.data' });

    // Multer setup for uploads
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const storageEngine = multer.diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname) || '';
            cb(null, file.fieldname + '-' + uniqueSuffix + ext);
        }
    });
    const upload = multer({ storage: storageEngine });

    app.use(express.json({ limit: '50mb' }));

    // API routes FIRST
    app.get("/api/health", (req, res) => {
        res.json({ status: "ok" });
    });

    app.post("/api/upload", upload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        // Return relative URL that the dev server can proxy or serve
        res.json({ url: `/uploads/${req.file.filename}` });
    });

    app.get("/api/messages", async (req, res) => {
        const messages = await storage.getItem('messages') || [];
        res.json(messages);
    });

    app.post("/api/clear-messages", async (req, res) => {
        await storage.setItem('messages', []);
        res.json({ status: "cleared" });
    });

    // Websocket
    const io = new Server(server, { cors: { origin: '*' } });
    const games: any = {};

    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);

        socket.on("chatMessage", async (msg) => {
            const messages = await storage.getItem('messages') || [];
            const newMsg = { ...msg, id: Date.now() };
            messages.push(newMsg);
            if (messages.length > 500) messages.shift();
            await storage.setItem('messages', messages);
            io.emit("chatMessage", newMsg);
        });

        socket.on("deleteMessages", async (ids) => {
            let messages = await storage.getItem('messages') || [];
            messages = messages.filter((m: any) => !ids.includes(m.id));
            await storage.setItem('messages', messages);
            io.emit("messagesDeleted", ids);
        });

        socket.on("updateMessage", async (updatedMsg) => {
            let messages = await storage.getItem('messages') || [];
            messages = messages.map((m: any) => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m);
            await storage.setItem('messages', messages);
            io.emit("messageUpdated", updatedMsg);
        });

        socket.on("typing", (data) => {
            io.emit("typing", data);
        });

        socket.on("read", (data) => {
            io.emit("read", data);
        });

        // Game socket events
        socket.on("joinGame", ({ gameId, playerName }) => {
            socket.join(gameId);
            if (!games[gameId]) {
                games[gameId] = { id: gameId, players: [], state: null };
            }
            if (!games[gameId].players.find((p: any) => p.name === playerName)) {
                games[gameId].players.push({ id: socket.id, name: playerName });
            }
            io.to(gameId).emit("gameState", games[gameId]);
        });

        socket.on("gameAction", ({ gameId, action, payload }) => {
            io.to(gameId).emit("gameAction", { action, payload, sender: socket.id });
        });

        socket.on("syncGameState", ({ gameId, state }) => {
            if (games[gameId]) {
                games[gameId].state = state;
                io.to(gameId).emit("gameState", games[gameId]);
            }
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        
        // Serve uploads folder locally
        app.use('/uploads', express.static(uploadDir));
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.use('/uploads', express.static(uploadDir));
        app.get('*all', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    server.listen(PORT as number, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();
