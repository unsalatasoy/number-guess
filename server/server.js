const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://number-guess-client.onrender.com', 'http://localhost:3000']
      : "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Store active rooms and their players
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', (roomId) => {
    rooms.set(roomId, {
      players: [socket.id],
      numbers: new Map(),
      currentTurn: socket.id,
      gameOver: false,
      winner: null
    });
    socket.join(roomId);
    io.to(roomId).emit('playerCount', rooms.get(roomId).players.length);
    socket.emit('yourTurn', true);
  });

  socket.on('joinRoom', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', 'Oda bulunamadı');
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('error', 'Oda dolu');
      return;
    }
    room.players.push(socket.id);
    socket.join(roomId);
    io.to(roomId).emit('playerCount', room.players.length);
    socket.emit('yourTurn', false);
  });

  socket.on('setNumber', ({ roomId, number }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.numbers.set(socket.id, number);
      if (room.numbers.size === 2) {
        io.to(roomId).emit('gameReady');
        // Set the first turn to the host
        const hostId = room.players[0];
        room.currentTurn = hostId;
        io.to(hostId).emit('yourTurn', true);
        io.to(room.players[1]).emit('yourTurn', false);
      }
    }
  });

  socket.on('makeGuess', ({ roomId, guess }) => {
    const room = rooms.get(roomId);
    if (room && !room.gameOver) {
      if (room.currentTurn !== socket.id) {
        socket.emit('error', 'Sıra sizde değil');
        return;
      }

      const opponentId = room.players.find(id => id !== socket.id);
      const opponentNumber = room.numbers.get(opponentId);
      
      if (opponentNumber) {
        const result = calculateScore(guess, opponentNumber);
        const isCorrect = result === '+1 +1 +1 +1';
        
        if (isCorrect) {
          room.gameOver = true;
          room.winner = socket.id;
          io.to(roomId).emit('gameOver', { winner: socket.id });
        } else {
          // Switch turns
          room.currentTurn = opponentId;
          io.to(opponentId).emit('yourTurn', true);
          socket.emit('yourTurn', false);
        }

        socket.emit('guessResult', {
          guess,
          result
        });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Clean up rooms when players disconnect
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.indexOf(socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        room.numbers.delete(socket.id);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('playerCount', room.players.length);
          io.to(roomId).emit('playerDisconnected', socket.id);
        }
      }
    });
  });
});

function calculateScore(guess, target) {
  let positiveCount = 0;
  let negativeCount = 0;
  
  // First check for exact matches (same number in same position)
  for (let i = 0; i < 4; i++) {
    if (guess[i] === target[i]) {
      positiveCount++;
    }
  }
  
  // Then check for numbers that exist in target but in different positions
  for (let i = 0; i < 4; i++) {
    if (guess[i] !== target[i] && target.includes(guess[i])) {
      negativeCount++;
    }
  }
  
  let score = '';
  if (positiveCount > 0) {
    score += `+${positiveCount} `;
  }
  if (negativeCount > 0) {
    score += `-${negativeCount}`;
  }
  
  // If no matches at all, return "0"
  if (positiveCount === 0 && negativeCount === 0) {
    return "0";
  }
  
  return score.trim();
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 