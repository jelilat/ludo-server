import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for simplicity, restrict this in production
    methods: ["GET", "POST"],
  },
});

// Basic route for testing
app.get("/", (req, res) => {
  res.send("Hello from the Socket.io server");
});

const rooms = new Map();

// Socket.io logic
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("createRoom", ({ roomCode, playerName }) => {
    if (rooms.has(roomCode)) {
      socket.emit("roomError", "Room already exists");
    } else {
      const newPlayer = { id: socket.id, name: playerName, color: "red" };
      rooms.set(roomCode, {
        players: [newPlayer],
        gameState: { currentTurn: "red", diceValue: 0, winners: [] },
      });
      socket.join(roomCode);
      socket.emit("roomCreated", {
        roomCode,
        color: "red",
        players: [newPlayer],
      });
    }
  });

  socket.on("joinRoom", ({ roomCode, playerName, color }) => {
    const newPlayer = { id: socket.id, name: playerName, color };

    socket.join(roomCode);
    socket.emit("roomJoined", { roomCode, color });
    io.to(roomCode).emit("playerJoined", {
      newPlayer,
    });
  });

  socket.on("rollDice", ({ roomCode, value, turn }) => {
    io.to(roomCode).emit("diceRolled", { value, turn });
  });

  socket.on("updateGameState", ({ roomCode, players, turn, winners }) => {
    io.to(roomCode).emit("gameStateUpdated", { players, turn, winners });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
    for (const [roomCode, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(
        (p: { id: string }) => p.id === socket.id
      );
      if (playerIndex !== -1) {
        const removedPlayer = room.players.splice(playerIndex, 1)[0];
        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else {
          io.to(roomCode).emit("playerLeft", {
            removedPlayer,
            players: room.players,
          });
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
