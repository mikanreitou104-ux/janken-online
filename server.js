const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, "public")));

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

// =========================
// ルーム管理
// =========================
const rooms = {};

// =========================
// 共通関数
// =========================
function sanitizeRoomCode(code) {
    return String(code || "")
        .trim()
        .toUpperCase()
        .slice(0, 12);
}

function sanitizePlayerName(name) {
    return String(name || "Player")
        .trim()
        .slice(0, 20);
}

function emitRoomUpdate(roomCode) {

    if (!rooms[roomCode]) return;

    io.to(roomCode).emit("roomUpdated", {
        roomCode,
        players: rooms[roomCode].players,
        roomSettings: rooms[roomCode].roomSettings
    });
}

// =========================
// Socket接続
// =========================
io.on("connection", (socket) => {

    console.log("接続:", socket.id);

    // =========================
    // ルーム作成
    // =========================
    socket.on("createRoom", (data = {}) => {

        try {

            const roomCode =
                sanitizeRoomCode(data.roomCode);

            const playerName =
                sanitizePlayerName(data.playerName);

            if (!roomCode) {

                socket.emit(
                    "errorMessage",
                    "ルームコードが必要です"
                );

                return;
            }

            if (rooms[roomCode]) {

                socket.emit(
                    "errorMessage",
                    "既に存在するルームです"
                );

                return;
            }

            rooms[roomCode] = {
                hostId: socket.id,

                players: [],

                roomSettings: {
                    skillsEnabled:
                        data.roomSettings
                            ?.skillsEnabled ?? true
                }
            };

            socket.join(roomCode);

            socket.roomCode = roomCode;

            rooms[roomCode].players.push({
                id: socket.id,
                name: playerName
            });

            console.log(
                "ルーム作成:",
                roomCode
            );

            emitRoomUpdate(roomCode);

        } catch (err) {

            console.error(err);

            socket.emit(
                "errorMessage",
                "ルーム作成エラー"
            );
        }
    });

    // =========================
    // ルーム参加
    // =========================
    socket.on("joinRoom", (data = {}) => {

        try {

            const roomCode =
                sanitizeRoomCode(data.roomCode);

            const playerName =
                sanitizePlayerName(data.playerName);

            const room = rooms[roomCode];

            if (!room) {

                socket.emit(
                    "errorMessage",
                    "ルームが存在しません"
                );

                return;
            }

            // 同一参加防止
            const alreadyJoined =
                room.players.some(
                    p => p.id === socket.id
                );

            if (alreadyJoined) {
                return;
            }

            if (room.players.length >= 8) {

                socket.emit(
                    "errorMessage",
                    "ルームが満員です"
                );

                return;
            }

            socket.join(roomCode);

            socket.roomCode = roomCode;

            room.players.push({
                id: socket.id,
                name: playerName
            });

            console.log(
                "ルーム参加:",
                roomCode
            );

            emitRoomUpdate(roomCode);

        } catch (err) {

            console.error(err);

            socket.emit(
                "errorMessage",
                "参加エラー"
            );
        }
    });

    // =========================
    // 設定変更
    // =========================
    socket.on(
        "updateRoomSettings",
        (data = {}) => {

            try {

                const roomCode =
                    socket.roomCode;

                const room =
                    rooms[roomCode];

                if (!room) return;

                // ホストのみ変更可能
                if (
                    room.hostId !== socket.id
                ) {

                    socket.emit(
                        "errorMessage",
                        "ホストのみ変更できます"
                    );

                    return;
                }

                if (
                    typeof data.skillsEnabled
                    === "boolean"
                ) {

                    room.roomSettings
                        .skillsEnabled =
                        data.skillsEnabled;
                }

                console.log(
                    "設定更新:",
                    room.roomSettings
                );

                emitRoomUpdate(roomCode);

            } catch (err) {

                console.error(err);
            }
        }
    );

    // =========================
    // ゲーム開始
    // =========================
    socket.on("startGame", () => {

        try {

            const roomCode =
                socket.roomCode;

            const room =
                rooms[roomCode];

            if (!room) return;

            // ホストのみ
            if (
                room.hostId !== socket.id
            ) {

                socket.emit(
                    "errorMessage",
                    "ホストのみ開始できます"
                );

                return;
            }

            io.to(roomCode).emit(
                "gameStart",
                {
                    players:
                        room.players,

                    roomSettings:
                        room.roomSettings
                }
            );

            console.log(
                "ゲーム開始:",
                roomCode
            );

        } catch (err) {

            console.error(err);
        }
    });

    // =========================
    // スキル使用
    // =========================
    socket.on("useSkill", (data = {}) => {

        try {

            const roomCode =
                socket.roomCode;

            const room =
                rooms[roomCode];

            if (!room) return;

            if (
                !room.roomSettings
                    .skillsEnabled
            ) {

                socket.emit(
                    "errorMessage",
                    "現在スキルは禁止されています"
                );

                return;
            }

            io.to(roomCode).emit(
                "skillUsed",
                {
                    playerId: socket.id,
                    skill: data.skill
                }
            );

        } catch (err) {

            console.error(err);
        }
    });

    // =========================
    // 切断
    // =========================
    socket.on("disconnect", () => {

        try {

            const roomCode =
                socket.roomCode;

            const room =
                rooms[roomCode];

            if (!room) {

                console.log(
                    "切断:",
                    socket.id
                );

                return;
            }

            room.players =
                room.players.filter(
                    p => p.id !== socket.id
                );

            // ホスト移譲
            if (
                room.hostId === socket.id &&
                room.players.length > 0
            ) {

                room.hostId =
                    room.players[0].id;
            }

            emitRoomUpdate(roomCode);

            // 空なら削除
            if (
                room.players.length === 0
            ) {

                delete rooms[roomCode];

                console.log(
                    "ルーム削除:",
                    roomCode
                );
            }

            console.log(
                "切断:",
                socket.id
            );

        } catch (err) {

            console.error(err);
        }
    });
});

// =========================
// サーバー起動
// =========================
const PORT =
    process.env.PORT || 3000;

server.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );
});