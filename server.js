const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

io.on("connection", (socket) => {

console.log("接続:", socket.id);

// ===== ルーム参加 =====
socket.on("joinRoom", ({ roomCode, playerName, host }) => {

socket.join(roomCode);

if (!rooms[roomCode]) {
  rooms[roomCode] = {
    players: [],
    hands: {},
    elements: {},
    names: {}
  };
}

rooms[roomCode].players.push(socket.id);

rooms[roomCode].names[socket.id] = playerName;

io.to(roomCode).emit("roomJoined", {
  room: roomCode,
  players: rooms[roomCode].players.length
});

// 相手へ名前送信
socket.to(roomCode).emit("enemyName", {
  name: playerName
});

// 既にいる相手の名前を新規参加者へ送信
for (const id of rooms[roomCode].players) {

  if (id !== socket.id) {

    socket.emit("enemyName", {
      name: rooms[roomCode].names[id]
    });

  }
}

console.log(socket.id + " joined " + roomCode);

});

// ===== 対戦開始 =====
socket.on("startBattle", ({ roomCode }) => {


if (!rooms[roomCode]) return;

console.log("対戦開始:", roomCode);

io.to(roomCode).emit("battleStart");


});

// ===== 属性選択 =====
socket.on("selectElement", ({ roomCode, element }) => {


if (!rooms[roomCode]) return;

rooms[roomCode].elements[socket.id] = element;

socket.to(roomCode).emit("enemyElement", {
  element
});

console.log("属性受信", roomCode, element);


});

// ===== 手選択 =====
socket.on("selectHand", ({ roomCode, hand }) => {

if (!rooms[roomCode]) return;

rooms[roomCode].hands[socket.id] = hand;

socket.to(roomCode).emit("enemySelected", {
  hand
});

console.log("手受信", roomCode, hand);

});

// ===== 切断 =====
socket.on("disconnect", () => {

for (const roomCode in rooms) {

  rooms[roomCode].players =
    rooms[roomCode].players.filter(id => id !== socket.id);

  delete rooms[roomCode].hands[socket.id];
  delete rooms[roomCode].elements[socket.id];
  delete rooms[roomCode].names[socket.id];

  if (rooms[roomCode].players.length === 0) {
    delete rooms[roomCode];
  }
}

console.log("切断:", socket.id);

});

});

server.listen(3000, () => {
console.log("サーバー起動 http://localhost:3000");
});
