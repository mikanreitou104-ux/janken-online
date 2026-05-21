const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const rooms = {};

io.on("connection", (socket) => {

    console.log("接続:", socket.id);

    // ルーム作成
    socket.on("createRoom", (data) => {

        const roomCode = data.roomCode;

        // 重複防止
        if (rooms[roomCode]) {
            socket.emit("errorMessage", "既に存在するルームです");
            return;
        }

        rooms[roomCode] = {
            players: [],
            roomSettings: {
                skillsEnabled:
                    data.roomSettings?.skillsEnabled ?? true
            }
        };

        socket.join(roomCode);

        rooms[roomCode].players.push({
            id: socket.id,
            name: data.playerName
        });

        socket.roomCode = roomCode;

        console.log("ルーム作成:", roomCode);

        // 作成完了
        io.to(roomCode).emit("roomCreated", {
            roomCode,
            players: rooms[roomCode].players,
            roomSettings: rooms[roomCode].roomSettings
        });
    });

    // ルーム参加
    socket.on("joinRoom", (data) => {

        const roomCode = data.roomCode;

        if (!rooms[roomCode]) {
            socket.emit(
                "errorMessage",
                "ルームが存在しません"
            );
            return;
        }

        socket.join(roomCode);

        rooms[roomCode].players.push({
            id: socket.id,
            name: data.playerName
        });

        socket.roomCode = roomCode;

        console.log("ルーム参加:", roomCode);

        // 全員同期
        io.to(roomCode).emit("roomJoined", {
            players: rooms[roomCode].players,
            roomSettings: rooms[roomCode].roomSettings
        });
    });

    // 設定変更
    socket.on("updateRoomSettings", (data) => {

        const roomCode = socket.roomCode;

        if (!rooms[roomCode]) return;

        // skillsEnabledのみ変更可能
        if (typeof data.skillsEnabled === "boolean") {

            rooms[roomCode].roomSettings.skillsEnabled =
                data.skillsEnabled;
        }

        console.log(
            "設定更新:",
            rooms[roomCode].roomSettings
        );

        // 全員へ同期
        io.to(roomCode).emit("roomSettingsUpdated", {
            roomSettings: rooms[roomCode].roomSettings,
            updatedBy: socket.id
        });
    });

    // ゲーム開始
    socket.on("startGame", () => {

        const roomCode = socket.roomCode;

        if (!rooms[roomCode]) return;

        io.to(roomCode).emit("gameStart", {
            players: rooms[roomCode].players,
            roomSettings: rooms[roomCode].roomSettings
        });

        console.log("ゲーム開始:", roomCode);
    });

    // スキル使用
    socket.on("useSkill", (data) => {

        const roomCode = socket.roomCode;

        if (!rooms[roomCode]) return;

        // サーバー側チェック
        if (
            !rooms[roomCode]
                .roomSettings
                .skillsEnabled
        ) {
            console.log(
                "スキル無効のため拒否"
            );

            socket.emit(
                "errorMessage",
                "現在スキルは禁止されています"
            );

            return;
        }

        io.to(roomCode).emit("skillUsed", {
            playerId: socket.id,
            skill: data.skill
        });
    });

    // 切断
    socket.on("disconnect", () => {

        const roomCode = socket.roomCode;

        if (roomCode && rooms[roomCode]) {

            rooms[roomCode].players =
                rooms[roomCode].players.filter(
                    p => p.id !== socket.id
                );

            io.to(roomCode).emit("playerLeft", {
                players: rooms[roomCode].players
            });

            // ルーム削除
            if (
                rooms[roomCode].players.length === 0
            ) {
                delete rooms[roomCode];

                console.log(
                    "ルーム削除:",
                    roomCode
                );
            }
        }

        console.log("切断:", socket.id);
    });
});

server.listen(3000, () => {
    console.log(
        "Server running on port 3000"
    );
});