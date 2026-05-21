const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// =========================
// publicフォルダを公開
// =========================
app.use(express.static(path.join(__dirname, "public")));

// =========================
// Socket.IO
// =========================
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
// Socket接続
// =========================
io.on("connection", (socket) => {

    console.log("接続:", socket.id);

    // =========================
    // ルーム作成
    // =========================
    socket.on("createRoom", (data) => {

        try {

            const roomCode =
                String(data.roomCode || "").trim();

            const playerName =
                String(data.playerName || "Player")
                    .trim()
                    .slice(0, 20);

            // バリデーション
            if (!roomCode) {

                socket.emit(
                    "errorMessage",
                    "ルームコードが必要です"
                );

                return;
            }

            // 重複防止
            if (rooms[roomCode]) {

                socket.emit(
                    "errorMessage",
                    "既に存在するルームです"
                );

                return;
            }

            // ルーム作成
            rooms[roomCode] = {

                players: [],

                roomSettings: {
                    skillsEnabled:
                        data.roomSettings
                            ?.skillsEnabled ?? true
                }
            };

            socket.join(roomCode);

            rooms[roomCode].players.push({
                id: socket.id,
                name: playerName
            });

            socket.roomCode = roomCode;

            console.log(
                "ルーム作成:",
                roomCode
            );

            io.to(roomCode).emit(
                "roomCreated",
                {
                    roomCode,
                    players:
                        rooms[roomCode].players,
                    roomSettings:
                        rooms[roomCode]
                            .roomSettings
                }
            );

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
    socket.on("joinRoom", (data) => {

        try {

            const roomCode =
                String(data.roomCode || "").trim();

            const playerName =
                String(data.playerName || "Player")
                    .trim()
                    .slice(0, 20);

            if (!rooms[roomCode]) {

                socket.emit(
                    "errorMessage",
                    "ルームが存在しません"
                );

                return;
            }

            // 人数制限
            if (
                rooms[roomCode]
                    .players.length >= 8
            ) {

                socket.emit(
                    "errorMessage",
                    "ルームが満員です"
                );

                return;
            }

            socket.join(roomCode);

            rooms[roomCode].players.push({
                id: socket.id,
                name: playerName
            });

            socket.roomCode = roomCode;

            console.log(
                "ルーム参加:",
                roomCode
            );

            io.to(roomCode).emit(
                "roomJoined",
                {
                    players:
                        rooms[roomCode].players,
                    roomSettings:
                        rooms[roomCode]
                            .roomSettings
                }
            );

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
        (data) => {

            try {

                const roomCode =
                    socket.roomCode;

                if (!rooms[roomCode]) return;

                // スキルON/OFF
                if (
                    typeof data.skillsEnabled
                    === "boolean"
                ) {

                    rooms[roomCode]
                        .roomSettings
                        .skillsEnabled =
                        data.skillsEnabled;
                }

                console.log(
                    "設定更新:",
                    rooms[roomCode]
                        .roomSettings
                );

                io.to(roomCode).emit(
                    "roomSettingsUpdated",
                    {
                        roomSettings:
                            rooms[roomCode]
                                .roomSettings,

                        updatedBy:
                            socket.id
                    }
                );

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

            if (!rooms[roomCode]) return;

            io.to(roomCode).emit(
                "gameStart",
                {
                    players:
                        rooms[roomCode]
                            .players,

                    roomSettings:
                        rooms[roomCode]
                            .roomSettings
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
    socket.on("useSkill", (data) => {

        try {

            const roomCode =
                socket.roomCode;

            if (!rooms[roomCode]) return;

            // スキル禁止
            if (
                !rooms[roomCode]
                    .roomSettings
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

            if (
                roomCode &&
                rooms[roomCode]
            ) {

                rooms[roomCode].players =
                    rooms[
                        roomCode
                    ].players.filter(
                        p =>
                            p.id !==
                            socket.id
                    );

                io.to(roomCode).emit(
                    "playerLeft",
                    {
                        players:
                            rooms[
                                roomCode
                            ].players
                    }
                );

                // 空なら削除
                if (
                    rooms[roomCode]
                        .players.length === 0
                ) {

                    delete rooms[roomCode];

                    console.log(
                        "ルーム削除:",
                        roomCode
                    );
                }
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