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

// test-server.ts
var import_server = __toESM(require("boardgame.io/dist/cjs/server.js"), 1);
var import_internal = require("boardgame.io/internal");
var { Server, SocketIO } = import_server.default;
var UnoGame = { name: "uno", setup: () => ({ test: 1 }) };
var bgioServer = Server({
  games: [UnoGame]
});
async function start() {
  await bgioServer.db.connect();
  const matchID = "my-custom-id";
  const initialState = (0, import_internal.InitializeGame)({ game: UnoGame, numPlayers: 2 });
  await bgioServer.db.createMatch(matchID, {
    initialState,
    metadata: {
      gameName: "uno",
      players: {
        "0": { id: 0, name: "Alice", credentials: "alice-secret" },
        "1": { id: 1, name: "Bob", credentials: "bob-secret" }
      },
      setupData: {},
      unlisted: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  });
  const match = await bgioServer.db.fetch(matchID, { metadata: true });
  console.log("Match fetched:", match.metadata.players);
  process.exit(0);
}
start();
