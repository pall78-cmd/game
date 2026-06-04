import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
    path: "/boardgameio/",
    transports: ["websocket"]
});

socket.on("connect", () => {
    console.log("Connected to BGIO proxy!");
    process.exit(0);
});

socket.on("connect_error", (err) => {
    console.error("Connection error:", err.message);
    process.exit(1);
});

setTimeout(() => {
    console.error("Timeout");
    process.exit(1);
}, 3000);
