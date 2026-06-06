import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import http from "http";
import { Server } from "socket.io";
import storage from "node-persist";
import multer from "multer";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
    const app = express();
    const server = http.createServer(app);
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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

    const TAROT_DECK = [
        { name: "The Fool (Sang Pengembara)", meaning: "Awal baru, spontanitas, petualangan tak terduga, kepolosan." },
        { name: "The Magician (Sang Penyihir)", meaning: "Kekuatan kehendak, manifestasi, kepiawaian, fokus tinggi." },
        { name: "The High Priestess (Pendeta Agung)", meaning: "Intuisi tinggi, rahasia batin, misteri, kesadaran spiritual." },
        { name: "The Empress (Sang Permaisuri)", meaning: "Kelimpahan, kesuburan, cinta kasih, keindahan alam semesta." },
        { name: "The Emperor (Sang Kaisar)", meaning: "Otoritas, perlindungan, figur kokoh, kestabilan emosi." },
        { name: "The Hierophant (Sang Penasihat)", meaning: "Kebijaksanaan tradisi, pembelajaran spiritual, bimbingan batin." },
        { name: "The Lovers (Dua Sejoli)", meaning: "Pilihan hati, harmoni hubungan, ketertarikan mendalam." },
        { name: "The Chariot (Kereta Perang)", meaning: "Kemenangan lewat tekad, disiplin, mengatasi rintangan." },
        { name: "Strength (Kekuatan Jiwa)", meaning: "Keberanian tenang, kesabaran, menjinakkan amarah, kekuatan batin." },
        { name: "The Hermit (Sang Pertapa)", meaning: "Refleksi diri, pencarian kebenaran batin, keheningan." },
        { name: "Wheel of Fortune (Roda Keberuntungan)", meaning: "Perubahan takdir, siklus kehidupan, keberuntungan mendadak." },
        { name: "Justice (Keadilan Semesta)", meaning: "Keputusan adil, kejujuran batin, konsekuensi tindakan." },
        { name: "The Hanged Man (Sang Tergantung)", meaning: "Sudut pandang baru, pengorbanan ikhlas, melepaskan kendali." },
        { name: "Death (Kematian & Regenerasi)", meaning: "Akhir yang perlu, transformasi total, melepaskan masa lalu." },
        { name: "Temperance (Keselarasan)", meaning: "Keseimbangan emosi, kesabaran, moderasi, kedamaian batin." },
        { name: "The Devil (Sang Penggoda)", meaning: "Keterikatan material, godaan ego, bayang-bayang batin." },
        { name: "The Tower (Menara Hancur)", meaning: "Goncangan mendadak, hancurnya ilusi, pencerahan radikal." },
        { name: "The Star (Bintang Harapan)", meaning: "Harapan baru, kesembuhan spiritual, kedamaian pikiran." },
        { name: "The Moon (Khayalan Malam)", meaning: "Ketakutan bawah sadar, ilusi, intuisi mimpi, kecemasan." },
        { name: "The Sun (Terang Semesta)", meaning: "Kegembiraan murni, kesuksesan, kejelasan jiwa, vitalitas." },
        { name: "Judgement (Kebangkitan)", meaning: "Panggilan jiwa, pengampunan, kebangkitan kedewasaan." },
        { name: "The World (Semesta Raya)", meaning: "Pencapaian sempurna, integrasi hidup, kedamaian mutlak." }
    ];

    let aiClient: any = null;
    function getGeminiClient() {
        if (!aiClient) {
            const key = process.env.GEMINI_API_KEY;
            if (!key) {
                throw new Error("GEMINI_API_KEY belum dikonfigurasi di panel Secrets.");
            }
            aiClient = new GoogleGenAI({
                apiKey: key,
                httpOptions: {
                    headers: {
                        'User-Agent': 'aistudio-build',
                    }
                }
            });
        }
        return aiClient;
    }

    app.post("/api/oracle-tarot", async (req, res) => {
        try {
            const { username, question, ritual, room } = req.body;
            if (!username) {
                return res.status(400).json({ error: "Username wajib diisi." });
            }

            const ritualName = ritual || "tarot";
            let prompt = "";
            let cardSelected = "";

            if (ritualName === "tarot") {
                const randomCard = TAROT_DECK[Math.floor(Math.random() * TAROT_DECK.length)];
                cardSelected = randomCard.name;
                prompt = `Ritual: Penarikan Kartu Tarot Takdir.
Kartu yang ditarik: ${randomCard.name} (maksud kartu: ${randomCard.meaning}).
Nama pemanggil: ${username}.
Pertanyaan/Misteri yang diajukan pemanggil: "${question || 'Mengharap petunjuk takdir'}".
Ruang dimensi chat: Room ${room || 'A'}.

Tolong buat teks ramalan mistis yang menjelaskan arti penarikan kartu ${randomCard.name} ini untuk dirinya. Hubungkan dengan pertanyaannya secara magis, puitis, puitis dan beri wejangan kosmik bijak singkat (maksimal 3-4 kalimat).`;
            } else if (ritualName === "star") {
                prompt = `Ritual: Pembacaan Rasi Bintang Harmoni.
Nama pemanggil: ${username}.
Misteri batin: "${question || 'Petunjuk arah jalan kehidupan'}".
Ruang dimensi chat: Room ${room || 'A'}.

Tolong buat ramalan astrologi mistis berdasarkan konstelasi bintang magis acak yang Anda ciptakan (misal: Rasi Bintang Phoenix, Rasi Serpens, dsb.) relevan dengan pertanyaan atau jalannya kehidupan mereka. Buat teks puitis, puitis dan puitis (maksimal 3-4 kalimat).`;
            } else if (ritualName === "chat") {
                prompt = `Interaksi Langsung: Pemanggil ${username} bertanya langsung kepada-mu dalam ruang dimensi chat Room ${room || 'A'}.
Pertanyaan/Pernyataan batin: "${question || 'Menyapa keheningan takdir'}"

Tolong berikan balasan langsung secara mistis, bijaksana, puitis, dan penuh metafora kosmos. Bimbing mereka atau jawab keresahan mereka (maksimal 3 kalimat).`;
            } else {
                prompt = `Ritual: Bisikan Semesta Sunyi.
Nama pemanggil: ${username}.
Keresahan batin: "${question || 'Ketenangan jiwa dan takdir'}".
Ruang dimensi chat: Room ${room || 'A'}.

Tolong sampaikan bisikan takdir semesta sunyi yang sangat puitis, puitis dan membawa kedamaian atau pencerahan magis terhadap batin mereka. (maksimal 3-4 kalimat).`;
            }

            const client = getGeminiClient();
            const response = await client.models.generateContent({
                model: "gemini-3.5-flash",
                contents: prompt,
                config: {
                    systemInstruction: `Anda adalah ORACLE HARMONI, entitas mistis takdir penjaga gerbang dimensi waktu dan ruang chat Oracle.
Tugas Anda adalah meramal nasib pemanggil dengan bahasa Indonesia yang sangat mistis, puitis, penuh kiasan kosmik, tetapi tetap memberikan nasihat bijaksana yang relevan.
Gunakan gaya bahasa mistis puitis klasik yang anggun.
Selalu sapa pemanggil menggunakan nama alias mereka dengan rasa hormat kosmik.
Gaya penulisan:
- Gunakan metafora alam, rasi bintang, waktu, dan dimensi takdir.
- Jawab secara ringkas namun mendalam (maksimal 3-4 kalimat) agar pas dengan kartu takdir di UI.
- Hindari bahasa terlalu modern atau slang.`,
                    temperature: 1.0,
                },
            });

            const prophecyResult = response.text || "Bisikan takdir teredam oleh badai kosmik...";
            
            // Format output so client-side message parsing converts it nicely to Fate Card Display format:
            // "TYPE_NAME: Content text"
            let finalCardType = "ORACLE PROBING";
            let cleanProphecy = prophecyResult.trim();

            if (ritualName === "tarot") {
                finalCardType = `TAROT: ${cardSelected.toUpperCase()}`;
            } else if (ritualName === "star") {
                finalCardType = "COSMIC ASTROLOGY";
            } else if (ritualName === "chat") {
                finalCardType = "ORACLE HARMONI SPEAKS";
            } else {
                finalCardType = "UNIVERSE WHISPERS";
            }

            const formattedContent = `${finalCardType}: ${cleanProphecy}`;

            res.json({
                prophecy: formattedContent,
                cardSelected: cardSelected || null
            });
        } catch (err: any) {
            console.error("Error generating Oracle Tarot response:", err);
            res.status(500).json({ error: err.message || "Ramalan terganggu oleh badai kosmik." });
        }
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

    server.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();
