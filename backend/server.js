const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Cidades/estações disponíveis
const STATIONS = {
  'curitiba': 'Curitiba - Início da BR-277',
  'campo_largo': 'Campo Largo - Km 30',
  'fazenda_rio_grande': 'Fazenda Rio Grande - Km 15',
  'morretes': 'Morretes - Km 70',
  'paranagua': 'Paranaguá - Porto'
};

// Armazenar mensagens recentes por sala
const messageHistory = new Map();

io.on('connection', (socket) => {
  console.log('Novo motorista conectado:', socket.id);
  
  socket.on('join-station', (stationId) => {
    socket.leaveAll();
    socket.join(stationId);
    socket.currentStation = stationId;
    
    console.log(`Motorista ${socket.id} entrou em ${stationId}`);
    
    const history = messageHistory.get(stationId) || [];
    socket.emit('station-history', history);
    
    socket.to(stationId).emit('user-joined', {
      id: socket.id,
      station: STATIONS[stationId],
      timestamp: new Date()
    });
  });
  
  socket.on('audio-message', (data) => {
    const { audioBlob, duration, stationId } = data;
    
    if (!socket.currentStation || socket.currentStation !== stationId) {
      socket.emit('error', 'Você não está em nenhuma estação');
      return;
    }
    
    const message = {
      id: Date.now(),
      senderId: socket.id,
      audioBlob,
      duration,
      stationId,
      timestamp: new Date(),
      countdown: 20
    };
    
    if (!messageHistory.has(stationId)) {
      messageHistory.set(stationId, []);
    }
    const history = messageHistory.get(stationId);
    history.push(message);
    if (history.length > 50) history.shift();
    
    io.to(stationId).emit('new-audio', message);
    
    io.to(stationId).emit('notification', {
      type: 'new-message',
      station: STATIONS[stationId],
      duration
    });
  });
  
  socket.on('disconnect', () => {
    if (socket.currentStation) {
      socket.to(socket.currentStation).emit('user-left', socket.id);
    }
    console.log('Motorista desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎤 Servidor de áudio rodando na porta ${PORT}`);
  console.log('📡 Estações disponíveis:', Object.keys(STATIONS));
});
