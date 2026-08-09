const express = require('express');
const cors = require('cors');
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Simple in-memory user store (easily moved to database later)
const users = {
  'admin': 'Q4dsiah' // username: password (change this to whatever you want)
};

// In-memory sessions
const sessions = {};

// In-memory state
let state = {
  moves: [],
  thresh: 25,
  logo: null,
  names: {},
  photos: {},
  folders: {},
  version: 0
};

// Middleware: verify token
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = sessions[token];
  next();
}

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  if (users[username] !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Generate simple token (in production, use JWT)
  const token = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15);
  sessions[token] = username;
  
  res.json({ ok: true, token, username });
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) delete sessions[token];
  res.json({ ok: true });
});

// Get state (protected)
app.get('/api/state', verifyToken, (req, res) => {
  res.json(state);
});

// Sync state (protected)
app.post('/api/sync', verifyToken, (req, res) => {
  const { moves, thresh, logo, names, photos, folders } = req.body;
  
  if (moves !== undefined) state.moves = moves;
  if (thresh !== undefined) state.thresh = thresh;
  if (logo !== undefined) state.logo = logo;
  if (names !== undefined) state.names = names;
  if (photos !== undefined) state.photos = photos;
  if (folders !== undefined) state.folders = folders;
  
  state.version++;
  res.json({ ok: true, version: state.version });
});

// Health check (no auth needed for quick status check)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Qadsiah Kit Room backend running on port ${PORT}`);
  console.log(`Default login: admin / Q4dsiah`);
});
