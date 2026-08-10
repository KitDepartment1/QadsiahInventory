const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// User store with roles
const users = {
  'admin': { password: 'Q4dsiah', role: 'manager' },
  'CreagRobertson': { password: 'Qadsiah10', role: 'staff' },
  'Rabbi': { password: 'Qadsiah1', role: 'staff' },
  'Sanula': { password: 'Qadsiah2', role: 'staff' },
  'LouayBafaqier': { password: 'Qadsiah3', role: 'staff' },
  'LukeMurphy': { password: 'Qadsiah', role: 'manager' }
};

// File paths for persistent data
const STATE_FILE = path.join('/tmp', 'inventory-state.json');
const SESSIONS_FILE = path.join('/tmp', 'inventory-sessions.json');

// In-memory sessions (load from file on startup)
let sessions = {};

// Default state structure
const defaultState = {
  moves: [],
  thresh: 25,
  logo: null,
  names: {},
  photos: {},
  folders: {},
  order: [],
  version: 0
};

let state = defaultState;

// Load sessions from file
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
      sessions = JSON.parse(data);
    } else {
      sessions = {};
    }
  } catch (e) {
    console.error('Error loading sessions:', e);
    sessions = {};
  }
}

// Save sessions to file
function saveSessions() {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving sessions:', e);
  }
}

// Load state from file
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      state = JSON.parse(data);
    } else {
      state = { ...defaultState };
      saveState();
    }
  } catch (e) {
    console.error('Error loading state:', e);
    state = { ...defaultState };
  }
}

// Save state to file
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving state:', e);
  }
}

// Load on startup
loadSessions();
loadState();

// Middleware: verify token
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = sessions[token].username;
  req.userRole = sessions[token].role;
  next();
}

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const user = users[username];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Generate token
  const token = Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  
  // Store session and save to file
  sessions[token] = { username, role: user.role };
  saveSessions();
  
  res.json({ ok: true, token, username, role: user.role });
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    delete sessions[token];
    saveSessions();
  }
  res.json({ ok: true });
});

// Get state (protected)
app.get('/api/state', verifyToken, (req, res) => {
  res.json(state);
});

// Sync state with audit trail (protected)
app.post('/api/sync', verifyToken, (req, res) => {
  const { moves, thresh, logo, names, photos, folders, order } = req.body;
  const username = req.userId;

  // Track movements with user info
  if (moves !== undefined) {
    state.moves = moves.map(m => ({
      ...m,
      user: m.user || username
    }));
  }
  if (thresh !== undefined) state.thresh = thresh;
  if (logo !== undefined) state.logo = logo;
  if (names !== undefined) state.names = names;
  if (photos !== undefined) state.photos = photos;
  if (folders !== undefined) state.folders = folders;
  if (order !== undefined) state.order = order;
  
  state.version++;
  saveState(); // SAVE TO FILE after every sync
  res.json({ ok: true, version: state.version });
});

// Get audit log (protected)
app.get('/api/movements', verifyToken, (req, res) => {
  if (req.userRole !== 'manager') {
    return res.status(403).json({ error: 'Access denied' });
  }
  const audit = state.moves.map(m => ({
    time: m.t,
    user: m.user || 'unknown',
    action: m.d,
    quantity: m.q,
    item: m.id,
    issuedTo: m.w
  }));
  res.json({ audit });
});

// Get audit log (protected)
app.get('/api/audit', verifyToken, (req, res) => {
  const audit = state.moves.map(m => ({
    time: m.t,
    user: m.user || 'unknown',
    action: m.d,
    quantity: m.q,
    item: m.id,
    issuedTo: m.w
  }));
  res.json({ audit });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Qadsiah Kit Room backend running on port ${PORT}`);
  console.log(`Sessions loaded: ${Object.keys(sessions).length}`);
  console.log(`State version: ${state.version}`);
});
  console.log(`Qadsiah Kit Room backend running on port ${PORT}`);
  console.log(
