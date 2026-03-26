const { Server } = require('boardgame.io/server');
const server = Server({ games: [{ name: 'test', setup: () => ({}) }] });
console.log(Object.keys(server));
