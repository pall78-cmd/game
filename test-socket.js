import { io } from 'socket.io-client';

const socket = io('http://127.0.0.1:3000', {
    reconnection: false
});

socket.on("connect", () => {
    console.log("Connected to server, emitting createGame");
    socket.emit("createGame", { gameId: "TESTID123", gameType: "UNO", playerName: "CLI", numPlayers: 4 });
});

socket.on("gameCreated", (data) => {
    console.log("gameCreated:", data);
    process.exit(0);
});

socket.on("gameError", (msg) => {
    console.log("gameError:", msg);
    process.exit(1);
});

socket.on("connect_error", (err) => {
    console.log("Connection error:", err.message);
    process.exit(1);
});

// timeout
setTimeout(() => {
    console.log("Timeout");
    process.exit(1);
}, 5000);
