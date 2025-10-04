require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// SerialPort setup (optional if Arduino is connected)
let SerialPort;
let ReadlineParser;
try {
  SerialPort = require('serialport').SerialPort || require('serialport');
  ReadlineParser = require('@serialport/parser-readline').ReadlineParser;
} catch (e) {
  console.warn('serialport not available, continuing without Arduino.');
}

const APP_PORT = process.env.PORT || 3000;
const SERIAL_PORT_PATH = process.env.SERIAL_PORT || null; // e.g., 'COM3' on Windows
const SERIAL_BAUD_RATE = Number(process.env.SERIAL_BAUD_RATE || 9600);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Static files
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// Data storage
const dataDir = path.join(__dirname, 'data');
const leaderboardFile = path.join(dataDir, 'leaderboard.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(leaderboardFile)) fs.writeFileSync(leaderboardFile, '[]', 'utf-8');

function readLeaderboard() {
  try {
    const raw = fs.readFileSync(leaderboardFile, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function writeLeaderboard(list) {
  fs.writeFileSync(leaderboardFile, JSON.stringify(list, null, 2), 'utf-8');
}

// API routes
app.get('/api/leaderboard', (req, res) => {
  const list = readLeaderboard()
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, 100);
  res.json(list);
});

app.post('/api/leaderboard', (req, res) => {
  const { name, timeMs } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Nome inválido' });
  }
  const numericTime = Number(timeMs);
  if (!Number.isFinite(numericTime) || numericTime < 0) {
    return res.status(400).json({ error: 'Tempo inválido' });
  }
  const list = readLeaderboard();
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: name.trim(),
    timeMs: Math.round(numericTime)
  };
  list.push(entry);
  writeLeaderboard(list);
  res.status(201).json(entry);
});

app.put('/api/leaderboard/:id', (req, res) => {
  const { id } = req.params;
  const { name, timeMs } = req.body || {};
  const list = readLeaderboard();
  const idx = list.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Registro não encontrado' });

  if (typeof name === 'string' && name.trim()) list[idx].name = name.trim();
  if (timeMs !== undefined) {
    const numericTime = Number(timeMs);
    if (!Number.isFinite(numericTime) || numericTime < 0) {
      return res.status(400).json({ error: 'Tempo inválido' });
    }
    list[idx].timeMs = Math.round(numericTime);
  }
  writeLeaderboard(list);
  res.json(list[idx]);
});

app.delete('/api/leaderboard/:id', (req, res) => {
  const { id } = req.params;
  const list = readLeaderboard();
  const idx = list.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Registro não encontrado' });
  const [removed] = list.splice(idx, 1);
  writeLeaderboard(list);
  res.json(removed);
});

// Test endpoint to simulate an interrupt (+5s) from the browser
app.post('/api/test-interrupt', (req, res) => {
  io.emit('interrupt', { at: Date.now(), source: 'test' });
  console.log('[Game] Penalidade: +5s (simulada via /api/test-interrupt)');
  res.json({ ok: true });
});

// Socket.IO
io.on('connection', socket => {
  // No-op; clients listen for 'interrupt' events
});

// Arduino Serial wiring
let serialPortInstance = null;
if (SerialPort && SERIAL_PORT_PATH) {
  try {
    serialPortInstance = new SerialPort({ path: SERIAL_PORT_PATH, baudRate: SERIAL_BAUD_RATE });
    const parser = new ReadlineParser({ delimiter: '\n' });
    serialPortInstance.pipe(parser);
    console.log(`Listening Arduino on ${SERIAL_PORT_PATH} @ ${SERIAL_BAUD_RATE}`);

    parser.on('data', line => {
      const msg = String(line).trim();
      console.log(`[Arduino] ${msg}`);
      const upper = msg.toUpperCase();
      const isInt = upper === 'INT' || upper === 'INTERRUPT';
      if (isInt) {
        io.emit('interrupt', { at: Date.now() });
        console.log('[Game] Penalidade: +5s (interrupt detectado)');
      } else if (upper.startsWith('STATE:')) {
        const state = msg.split(':')[1]?.trim();
        if (state) console.log(`[Sensor] Estado: ${state}`);
      }
    });

    serialPortInstance.on('error', err => {
      console.error('Serial error:', err.message);
    });
  } catch (err) {
    console.warn('Could not open serial port:', err.message);
  }
} else {
  console.warn('SERIAL_PORT not set. Set env SERIAL_PORT=COM3 to enable Arduino.');
}

server.listen(APP_PORT, () => {
  console.log(`Server listening on http://localhost:${APP_PORT}`);
});


