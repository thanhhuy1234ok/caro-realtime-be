const express = require('express');
const { checkWin } = require("./utils/checkWin");
const http = require("http");
require('dotenv').config();
const app = express();
const port = process.env.PORT || 3333;
const { Server } = require("socket.io");
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // cho phép tất cả domain (dev)
    },
});

const rooms = {}; // roomId: { board, players }

function generateRoomId(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Tạo phòng mới
    socket.on("createRoom", ({ username }, callback) => {
        let roomId;
        do {
            roomId = generateRoomId();
        } while (rooms[roomId]);

        rooms[roomId] = {
            board: Array(20).fill(null).map(() => Array(20).fill("")),
            players: [{ id: socket.id, username, symbol: "X" }],
            turn: "X",
        };

        socket.join(roomId);
        callback({ success: true, roomId });

        // Gửi symbol cho người tạo phòng
        io.to(socket.id).emit("assignSymbol", "X");
        io.to(roomId).emit("playerJoined", rooms[roomId].players);
    });

    // Vào phòng có sẵn
    // socket.on("joinRoom", ({ roomId, username }, callback) => {
    //     const room = rooms[roomId];
    //     if (!room) {
    //         return callback({ success: false, message: "Phòng không tồn tại." });
    //     }

    //     if (room.players.length >= 2) {
    //         return callback({ success: false, message: "Phòng đã đủ người." });
    //     }

    //     const symbol = "O";
    //     room.players.push({ id: socket.id, username, symbol });
    //     socket.join(roomId);

    //     callback({ success: true, roomId });

    //     // Gửi symbol cho người tham gia
    //     io.to(socket.id).emit("assignSymbol", symbol);
    //     io.to(roomId).emit("playerJoined", room.players);
    // });

    socket.on("joinRoom", ({ roomId, username }, callback) => {
        let room = rooms[roomId];

        if (!room) {
            room = {
                board: Array(20).fill(null).map(() => Array(20).fill("")),
                players: [],
                turn: "X",
            };
            rooms[roomId] = room;
        }

        if (room.players.length >= 2) {
            return callback({ success: false, message: "Phòng đã đủ người." });
        }

        const symbol = room.players.length === 0 ? "X" : "O";
        room.players.push({ id: socket.id, username, symbol });
        socket.join(roomId);

        callback({ success: true, roomId });
        io.to(socket.id).emit("assignSymbol", symbol);
        io.to(roomId).emit("playerJoined", room.players);
      });

    socket.on("getAvailableRooms", () => {
        const availableRooms = [];

        for (const [roomId, room] of Object.entries(rooms)) {
            if (room.players.length < 2) {
                availableRooms.push({
                    roomId,
                    players: room.players.map(p => p.username),
                });
            }
        }

        socket.emit("availableRooms", availableRooms);
      });

    // Đánh cờ
    socket.on("makeMove", ({ roomId, x, y, symbol }) => {
        const room = rooms[roomId];
        if (!room || room.board[y][x]) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.symbol !== room.turn) return; // Không đúng lượt

        room.board[y][x] = symbol;
        io.to(roomId).emit("moveMade", { x, y, symbol });

        if (checkWin(room.board, x, y, symbol)) {
            const winnerPlayer = room.players.find(p => p.symbol === symbol);
            io.to(roomId).emit("gameOver", {
                winner: symbol,
                username: winnerPlayer?.username || symbol
            });
        } else {
            // Đổi lượt
            room.turn = symbol === "X" ? "O" : "X";
        }
    });

    socket.on("restartGame", ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;

        room.board = Array(20).fill(null).map(() => Array(20).fill(""));
        room.turn = "X";

        io.to(roomId).emit("gameRestarted");
      });

    // Ngắt kết nối
    socket.on("disconnect", () => {
        console.log(`❌ Disconnected: ${socket.id}`);
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const leaver = room.players.find(p => p.id === socket.id);
            if (!leaver) continue;

            room.players = room.players.filter(p => p.id !== socket.id);

            if (room.players.length === 0) {
                delete rooms[roomId]; // Xoá phòng nếu không còn ai
            } else {
                const winner = room.players[0]; // người còn lại thắng
                io.to(roomId).emit("gameOver", {
                    winner: winner.symbol,
                    username: winner.username,
                    reason: "opponent_left"
                });
            }
        }
      });
});
  

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});