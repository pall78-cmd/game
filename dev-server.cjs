"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_http = require("http");
var import_socket = require("socket.io");
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_http_proxy_middleware = require("http-proxy-middleware");
var import_server = __toESM(require("boardgame.io/dist/cjs/server.js"), 1);

// src/utils/GameEngine.ts
var BaseGameEngine = class {
  state;
  constructor(playerIds) {
    this.state = {
      deck: this.createDeck(),
      discardPile: [],
      players: playerIds.map((id) => ({ id, hand: [], score: 0 })),
      currentPlayerIndex: 0,
      status: "waiting"
    };
  }
  createDeck() {
    const suits = ["\u2665", "\u2666", "\u2663", "\u2660"];
    const values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
    const deck = [];
    for (const suit of suits) {
      for (const value of values) {
        deck.push({ suit, value });
      }
    }
    return this.shuffle(deck);
  }
  shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
};

// src/utils/UnoEngine.ts
var UnoEngine = class extends BaseGameEngine {
  state;
  constructor(playerIds, playerNames) {
    super(playerIds);
    this.state = {
      ...this.state,
      deck: this.createUnoDeck(),
      discardPile: [],
      players: playerIds.map((id, index) => ({ id, name: playerNames[index] || `Player ${index + 1}`, hand: [], score: 0, hasCalledUno: false })),
      currentColor: null,
      direction: 1,
      winner: null,
      status: "waiting",
      isDarkSide: false,
      drawColorTarget: null,
      actionLog: []
    };
  }
  log(message) {
    this.state.actionLog.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] ${message}`);
    if (this.state.actionLog.length > 50) {
      this.state.actionLog.shift();
    }
  }
  createDeck() {
    return [];
  }
  createUnoDeck() {
    const lightColors = ["Red", "Yellow", "Green", "Blue"];
    const lightValues = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Skip", "Reverse", "+1", "Flip"];
    const lightDeck = [];
    for (const color of lightColors) {
      for (const value of lightValues) {
        lightDeck.push({ color, value });
        lightDeck.push({ color, value });
      }
    }
    for (let i = 0; i < 4; i++) {
      lightDeck.push({ color: "Black", value: "Wild" });
      lightDeck.push({ color: "Black", value: "Wild Draw 2" });
    }
    const darkColors = ["Pink", "Teal", "Purple", "Orange"];
    const darkValues = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Skip Everyone", "Reverse", "+5", "Flip"];
    const darkDeck = [];
    for (const color of darkColors) {
      for (const value of darkValues) {
        darkDeck.push({ color, value });
        darkDeck.push({ color, value });
      }
    }
    for (let i = 0; i < 4; i++) {
      darkDeck.push({ color: "Black", value: "Wild" });
      darkDeck.push({ color: "Black", value: "Wild Draw Color" });
    }
    const shuffledLight = this.shuffle(lightDeck);
    const shuffledDark = this.shuffle(darkDeck);
    const deck = [];
    for (let i = 0; i < shuffledLight.length; i++) {
      deck.push({
        suit: "UNO",
        value: "FLIP",
        light: shuffledLight[i],
        dark: shuffledDark[i]
      });
    }
    return deck;
  }
  start() {
    if (this.state.players.length < 1 || this.state.status !== "waiting") return;
    this.state.status = "playing";
    this.deal();
    let firstCard = this.state.deck.pop();
    while (firstCard.light.color === "Black") {
      this.state.deck.unshift(firstCard);
      firstCard = this.state.deck.pop();
    }
    this.state.discardPile.push(firstCard);
    this.state.currentColor = firstCard.light.color;
    this.log(`Game started! First card is ${firstCard.light.color} ${firstCard.light.value}.`);
  }
  deal() {
    for (let i = 0; i < 7; i++) {
      for (const player of this.state.players) {
        player.hand.push(this.state.deck.pop());
      }
    }
    this.log(`Dealt 7 cards to each player.`);
  }
  drawCard(playerId) {
    if (this.state.status !== "playing") return;
    const playerIndex = this.state.players.findIndex((p) => p.id === playerId);
    if (playerIndex !== this.state.currentPlayerIndex) return;
    if (this.state.deck.length === 0) {
      this.reshuffleDiscardPile();
    }
    const card = this.state.deck.pop();
    if (card) {
      this.state.players[playerIndex].hand.push(card);
      this.state.players[playerIndex].hasCalledUno = false;
      this.log(`${this.state.players[playerIndex].name} drew a card.`);
    }
    this.nextTurn();
  }
  playCard(playerId, cardIndex, chosenColor) {
    if (this.state.status !== "playing") return;
    const playerIndex = this.state.players.findIndex((p) => p.id === playerId);
    if (playerIndex !== this.state.currentPlayerIndex) return;
    const player = this.state.players[playerIndex];
    const card = player.hand[cardIndex];
    if (!card) return;
    const topCard = this.state.discardPile[this.state.discardPile.length - 1];
    if (this.isValidPlay(card, topCard)) {
      player.hand.splice(cardIndex, 1);
      this.state.discardPile.push(card);
      const side = this.state.isDarkSide ? card.dark : card.light;
      if (side.color === "Black") {
        this.state.currentColor = chosenColor || (this.state.isDarkSide ? "Pink" : "Red");
      } else {
        this.state.currentColor = side.color;
      }
      if (player.hand.length === 0) {
        this.state.status = "finished";
        this.state.winner = player.name;
        this.log(`${player.name} played their last card and won the game!`);
        return;
      }
      this.log(`${player.name} played ${side.color} ${side.value}.`);
      if (player.hand.length === 1 && !player.hasCalledUno) {
        const penalty = this.state.isDarkSide ? 5 : 2;
        this.log(`${player.name} forgot to call UNO! Penalty: draw ${penalty} cards.`);
        this.drawCardsForCurrentPlayer(penalty);
      }
      this.applyCardEffect(card);
    }
  }
  isValidPlay(card, topCard) {
    const side = this.state.isDarkSide ? card.dark : card.light;
    const topSide = this.state.isDarkSide ? topCard.dark : topCard.light;
    if (side.color === "Black") return true;
    if (side.color === this.state.currentColor) return true;
    if (side.value === topSide.value) return true;
    return false;
  }
  applyCardEffect(card) {
    const side = this.state.isDarkSide ? card.dark : card.light;
    if (side.value === "Reverse") {
      this.state.direction *= -1;
      this.log(`Direction reversed!`);
      if (this.state.players.length === 2) {
        this.nextTurn();
        this.nextTurn();
      } else {
        this.nextTurn();
      }
    } else if (side.value === "Skip") {
      this.nextTurn();
      this.log(`${this.state.players[this.state.currentPlayerIndex].name} was skipped!`);
      this.nextTurn();
    } else if (side.value === "Skip Everyone") {
      this.log(`Everyone was skipped!`);
    } else if (side.value === "+1") {
      this.nextTurn();
      this.log(`${this.state.players[this.state.currentPlayerIndex].name} must draw 1 card!`);
      this.drawCardsForCurrentPlayer(1);
      this.nextTurn();
    } else if (side.value === "+5") {
      this.nextTurn();
      this.log(`${this.state.players[this.state.currentPlayerIndex].name} must draw 5 cards!`);
      this.drawCardsForCurrentPlayer(5);
      this.nextTurn();
    } else if (side.value === "Wild Draw 2") {
      this.nextTurn();
      this.log(`${this.state.players[this.state.currentPlayerIndex].name} must draw 2 cards!`);
      this.drawCardsForCurrentPlayer(2);
      this.nextTurn();
    } else if (side.value === "Wild Draw Color") {
      this.nextTurn();
      this.log(`${this.state.players[this.state.currentPlayerIndex].name} must draw until they get ${this.state.currentColor}!`);
      const targetColor = this.state.currentColor;
      if (targetColor) {
        let drawnColor = null;
        let drawCount = 0;
        while (drawnColor !== targetColor && drawCount < 112) {
          if (this.state.deck.length === 0) {
            this.reshuffleDiscardPile();
          }
          const drawnCard = this.state.deck.pop();
          if (drawnCard) {
            this.state.players[this.state.currentPlayerIndex].hand.push(drawnCard);
            drawnColor = this.state.isDarkSide ? drawnCard.dark.color : drawnCard.light.color;
            drawCount++;
          } else {
            break;
          }
        }
        this.log(`${this.state.players[this.state.currentPlayerIndex].name} drew ${drawCount} cards.`);
      }
      this.state.players[this.state.currentPlayerIndex].hasCalledUno = false;
      this.nextTurn();
    } else if (side.value === "Flip") {
      this.state.isDarkSide = !this.state.isDarkSide;
      this.log(`FLIP! The deck is now on the ${this.state.isDarkSide ? "DARK" : "LIGHT"} side.`);
      const newTopSide = this.state.isDarkSide ? card.dark : card.light;
      this.state.currentColor = newTopSide.color === "Black" ? this.state.isDarkSide ? "Pink" : "Red" : newTopSide.color;
      this.nextTurn();
    } else {
      this.nextTurn();
    }
  }
  drawCardsForCurrentPlayer(count) {
    const player = this.state.players[this.state.currentPlayerIndex];
    for (let i = 0; i < count; i++) {
      if (this.state.deck.length === 0) this.reshuffleDiscardPile();
      const card = this.state.deck.pop();
      if (card) player.hand.push(card);
    }
    player.hasCalledUno = false;
  }
  nextTurn() {
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + this.state.direction + this.state.players.length) % this.state.players.length;
  }
  reshuffleDiscardPile() {
    if (this.state.discardPile.length <= 1) return;
    const topCard = this.state.discardPile.pop();
    this.state.deck = this.shuffle(this.state.discardPile);
    this.state.discardPile = [topCard];
    this.log(`Discard pile reshuffled into deck.`);
  }
  callUno(playerId) {
    const player = this.state.players.find((p) => p.id === playerId);
    if (player && (player.hand.length === 1 || player.hand.length === 2)) {
      player.hasCalledUno = true;
      this.log(`${player.name} called UNO!`);
    }
  }
  discardCard(playerId, cardIndex) {
  }
};

// src/game/UnoGame.ts
var UnoGame = {
  name: "uno",
  minPlayers: 2,
  maxPlayers: 7,
  setup: ({ ctx }, setupData) => {
    const playerNames = setupData?.playerNames || ctx.playOrder.map((id) => `Player ${id}`);
    const engine = new UnoEngine(ctx.playOrder, playerNames);
    return engine.state;
  },
  moves: {
    startGame: ({ G, playerID }) => {
      const engine = new UnoEngine([], []);
      engine.state = G;
      engine.start();
      return engine.state;
    },
    playCard: ({ G, playerID }, cardIndex, chosenColor) => {
      const engine = new UnoEngine([], []);
      engine.state = G;
      engine.playCard(playerID, cardIndex, chosenColor);
      return engine.state;
    },
    drawCard: ({ G, playerID }) => {
      const engine = new UnoEngine([], []);
      engine.state = G;
      engine.drawCard(playerID);
      return engine.state;
    },
    callUno: ({ G, playerID }) => {
      const engine = new UnoEngine([], []);
      engine.state = G;
      engine.callUno(playerID);
      return engine.state;
    }
  },
  turn: {
    activePlayers: { all: "play" }
    // Let UnoEngine handle turn validation
  },
  endIf: ({ G }) => {
    if (G.status === "finished") {
      return { winner: G.winner };
    }
  }
};

// src/game/TebakKataGame.ts
var WORDS = [
  "ORACLE",
  "HARMONY",
  "RAHASIA",
  "CAHAYA",
  "BINTANG",
  "PETUALANGAN",
  "KEBERANIAN",
  "PERSAHABATAN",
  "MISTERI",
  "LEGENDA"
];
var TebakKataGame = {
  name: "tebakkata",
  setup: (ctx) => {
    let initialWord = WORDS[0];
    if (ctx.random) {
      const shuffled = ctx.random.Shuffle(WORDS);
      initialWord = shuffled[0];
    } else {
      initialWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    }
    const scores = {};
    for (let i = 0; i < ctx.numPlayers; i++) {
      scores[i.toString()] = 0;
    }
    return {
      word: initialWord,
      guessedLetters: [],
      scores,
      winner: null
    };
  },
  moves: {
    guessLetter: (G, ctx, letter) => {
      const upperLetter = letter.toUpperCase();
      if (G.guessedLetters.includes(upperLetter)) {
        return;
      }
      G.guessedLetters.push(upperLetter);
      if (G.word.includes(upperLetter)) {
        const count = G.word.split("").filter((c) => c === upperLetter).length;
        G.scores[ctx.currentPlayer] += count * 10;
      }
      const isWon = G.word.split("").every((char) => G.guessedLetters.includes(char) || char === " ");
      if (isWon) {
        G.winner = ctx.currentPlayer;
        ctx.events?.endGame({ winner: ctx.currentPlayer, scores: G.scores });
      } else if (!G.word.includes(upperLetter)) {
        ctx.events?.endTurn();
      }
    }
  },
  turn: {
    minMoves: 1,
    maxMoves: 1
  },
  endIf: (G, ctx) => {
    if (G.winner !== null) {
      return { winner: G.winner };
    }
  }
};

// server.ts
var import_supabase_js = require("@supabase/supabase-js");
var { Server: BgioServer, SocketIO: BgioSocketIO, Origins } = import_server.default;
var app = (0, import_express.default)();
var customRoomMap = /* @__PURE__ */ new Map();
var httpServer = (0, import_http.createServer)(app);
var io = new import_socket.Server(httpServer, {
  cors: { origin: "*" },
  destroyUpgrade: false
});
var PORT = 3e3;
var BGIO_PORT = 3002;
var bgioServer = BgioServer({
  games: [UnoGame, TebakKataGame],
  origins: [Origins.LOCALHOST, "*"],
  transport: new BgioSocketIO({
    socketOpts: { path: "/boardgameio/" }
  })
});
var supabaseUrl = process.env.SUPABASE_URL || "https://rruxlxoeelxjjjmhafkc.supabase.co";
var supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJydXhseG9lZWx4ampqbWhhZmtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDU5OTMsImV4cCI6MjA4NTMyMTk5M30.oR2hl_BDD1P6Dmtos2So-aJ_eoFl1-Kwybt6mQnvq0Q";
var supabase = (0, import_supabase_js.createClient)(supabaseUrl, supabaseKey);
async function startServer() {
  await bgioServer.run({ port: BGIO_PORT });
  if (bgioServer.app.context.io && bgioServer.app.context.io.socket) {
    const io2 = bgioServer.app.context.io.socket;
    io2.of("/uno").on("connection", (socket) => {
      console.log(`[bgioServer] /uno connected: ${socket.id}`);
    });
    io2.of("/tebakkata").on("connection", (socket) => {
      console.log(`[bgioServer] /tebakkata connected: ${socket.id}`);
    });
  }
  app.use((0, import_http_proxy_middleware.createProxyMiddleware)({ pathFilter: "/games", target: `http://127.0.0.1:${BGIO_PORT}`, changeOrigin: true }));
  const wsProxy = (0, import_http_proxy_middleware.createProxyMiddleware)({ pathFilter: "/boardgameio", target: `http://127.0.0.1:${BGIO_PORT}`, ws: true, changeOrigin: true });
  app.use(wsProxy);
  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url && req.url.startsWith("/boardgameio/")) {
      wsProxy.upgrade(req, socket, head);
    }
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(import_express.default.static(import_path.default.join(process.cwd(), "dist")));
    app.get("*all", (req, res) => {
      res.sendFile(import_path.default.join(process.cwd(), "dist", "index.html"));
    });
  }
  const savedGames = /* @__PURE__ */ new Set();
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    const playerRooms = /* @__PURE__ */ new Map();
    socket.on("createGame", async (data) => {
      const { gameId, gameType, playerName, numPlayers } = data;
      const bgioGameName = gameType === "UNO" ? "uno" : "tebakkata";
      const playersCount = numPlayers || 4;
      try {
        console.log(`Creating game ${bgioGameName} with ID ${gameId} for ${playersCount} players`);
        const response = await fetch(`http://127.0.0.1:${BGIO_PORT}/games/${bgioGameName}/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            numPlayers: playersCount,
            setupData: { playerNames: { "0": playerName || "Player 1" } }
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
        const joinResponse = await fetch(`http://127.0.0.1:${BGIO_PORT}/games/${bgioGameName}/${matchID}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerID: "0",
            playerName: playerName || "Player 1"
          })
        });
        const joinResult = await joinResponse.json();
        console.log("Join game result:", joinResult);
        socket.emit("gameCreated", { gameId: gameId || matchID, actualMatchId: matchID, playerID: "0", credentials: joinResult.playerCredentials, gameType });
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
      let bgioGameName = "";
      let matchData = null;
      if (customRoomMap.has(gameId)) {
        gameId = customRoomMap.get(gameId);
      }
      try {
        if (!gameType) {
          let response = await fetch(`http://127.0.0.1:${BGIO_PORT}/games/uno/${gameId}`);
          if (response.ok) {
            gameType = "UNO";
            bgioGameName = "uno";
            matchData = await response.json();
          } else {
            response = await fetch(`http://127.0.0.1:${BGIO_PORT}/games/tebakkata/${gameId}`);
            if (response.ok) {
              gameType = "TEBAKKATA";
              bgioGameName = "tebakkata";
              matchData = await response.json();
            }
          }
        } else {
          bgioGameName = gameType === "UNO" ? "uno" : "tebakkata";
          const response = await fetch(`http://127.0.0.1:${BGIO_PORT}/games/${bgioGameName}/${gameId}`);
          if (response.ok) {
            matchData = await response.json();
          }
        }
        if (!matchData) {
          socket.emit("gameError", "Game not found.");
          return;
        }
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
        const joinResponse = await fetch(`http://127.0.0.1:${BGIO_PORT}/games/${bgioGameName}/${gameId}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        players,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      try {
        const { error } = await supabase.from("match_history").insert([matchData]);
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
      const bgioGameName = gameType === "UNO" ? "uno" : "tebakkata";
      try {
        await fetch(`http://127.0.0.1:${BGIO_PORT}/games/${bgioGameName}/${gameId}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
