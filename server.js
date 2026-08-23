// =============================================
//  Project-NETRI — Backend Foundation (Phase 1)
// =============================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { initializeDatabase } = require('./db');
const { initSocket } = require('./services/socket');

// -------------------------------------------
//  Configuration
// -------------------------------------------

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// -------------------------------------------
//  Database
// -------------------------------------------

const db = initializeDatabase();

// Ensure evidence uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'evidence');
fs.mkdirSync(uploadsDir, { recursive: true });

// -------------------------------------------
//  Express App
// -------------------------------------------

const app = express();

// Middleware — request parsing & CORS
app.use(cors());
app.use(express.json());

// Static files — serve the public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------
//  Routes
// -------------------------------------------

// Health / status endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Project-NETRI',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/device', require('./routes/devices'));

// Evidence routes — alert-scoped upload/list + standalone metadata/download
const { alertRouter: evidenceAlertRouter, standaloneRouter: evidenceStandaloneRouter } = require('./routes/evidence');
app.use('/api/alerts', evidenceAlertRouter);
app.use('/api/evidence', evidenceStandaloneRouter);

// TODO: Mount contact/recipient routes here
// app.use('/api/contacts', require('./routes/contacts'));

// -------------------------------------------
//  404 Handler (no route matched)
// -------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
});

// -------------------------------------------
//  Centralized Error Handler (Express 5)
//  — Express 5 automatically catches rejected
//    promises from async route handlers, so no
//    wrapper library is needed.
// -------------------------------------------

app.use((err, req, res, _next) => {
  const statusCode = err.status || 500;

  console.error(`[NETRI Error] ${statusCode} — ${err.message}`);
  if (NODE_ENV === 'development') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

// -------------------------------------------
//  HTTP Server (created from Express app so
//  Socket.IO can attach to it)
// -------------------------------------------

const server = http.createServer(app);

// -------------------------------------------
//  Socket.IO — real-time event layer
// -------------------------------------------

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Track connected clients
// Initialize the socket service so routes can emit events
initSocket(io);

// Track connected clients
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
  });
});

// -------------------------------------------
//  Start Server
// -------------------------------------------

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║        Project-NETRI Backend         ║');
  console.log('  ╠══════════════════════════════════════╣');
  console.log(`  ║  Server  : http://localhost:${PORT}     ║`);
  console.log(`  ║  Health  : /api/health               ║`);
  console.log(`  ║  Env     : ${NODE_ENV.padEnd(25)}║`);
  console.log('  ║  SocketIO: Ready                     ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});

// -------------------------------------------
//  Exports — useful for testing & future
//  modules that need access to app, server,
//  or the Socket.IO instance
// -------------------------------------------

module.exports = { app, server, io, db };
