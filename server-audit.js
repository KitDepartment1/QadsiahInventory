const express = require('express');
const cors = require('cors');
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// User store
const users = {
  'admin': 'Q4dsiah',
  'CreagRobertson': 'Qadsiah10',
  'Rabbi': 'Qadsiah1',
  'Sanula': 'Qadsiah2',
  'LouayBafaqier': 'Qadsiah3',
  'LukeMurphy': 'Qadsiah'
};

// In-memory sessions
const sessions = {};

// In-memory state with audit trail
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
  
  // Generate token
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

// Sync state with audit trail (protected)
app.post('/api/sync', verifyToken, (req, res) => {
  const { moves, thresh, logo, names, photos, folders } = req.body;
  const username = req.userId;
  
  // Track movements with user info
  if (moves !== undefined) {
    state.moves = moves.map(m => ({
      ...m,
      user: m.user || username  // Add username to each movement if not already there
    }));
  }
  
  if (thresh !== undefined) state.thresh = thresh;
  if (logo !== undefined) state.logo = logo;
  if (names !== undefined) state.names = names;
  if (photos !== undefined) state.photos = photos;
  if (folders !== undefined) state.folders = folders;
  
  state.version++;
  res.json({ ok: true, version: state.version });
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
  console.log(`Users: admin, CreagRobertson, Rabbi, Sanula, LouayBafaqier, LukeMurphy`);
});
