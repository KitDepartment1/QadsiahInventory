const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(cors());

// MongoDB connection string (from environment or hardcoded)
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://lukejmurphy95_db_user:iIE6ZWZatYaJKWxi@cluster0.tdijzxo.mongodb.net/?appName=Cluster0';

// Connect to MongoDB
mongoose.connect(MONGO_URI, { dbName: 'qadsiah_inventory' })
  .then(() => console.log('✓ Connected to MongoDB'))
  .catch(err => console.error('✗ MongoDB connection error:', err));

// User store with roles
const users = {
  'admin': { password: 'Q4dsiah', role: 'manager' },
  'CreagRobertson': { password: 'Qadsiah10', role: 'staff' },
  'Rabbi': { password: 'Qadsiah1', role: 'staff' },
  'Sanula': { password: 'Qadsiah2', role: 'staff' },
  'LouayBafaqier': { password: 'Qadsiah3', role: 'staff' },
  'LukeMurphy': { password: 'Qadsiah', role: 'manager' }
};

// In-memory sessions (loaded on startup)
let sessions = {};

// MongoDB Schemas
const stateSchema = new mongoose.Schema({
  _id: String,
  moves: Array,
  thresh: Number,
  logo: String,
  crest: String,
  names: Object,
  photos: Object,
  folders: Object,
  order: Array,
  version: Number,
  updatedAt: { type: Date, default: Date.now }
});

const sessionSchema = new mongoose.Schema({
  token: { type: String, unique: true },
  username: String,
  role: String,
  createdAt: { type: Date, default: Date.now, expires: 604800 } // 7 days TTL
});

const State = mongoose.model('State', stateSchema);
const Session = mongoose.model('Session', sessionSchema);

// Load sessions from MongoDB on startup
async function loadSessions() {
  try {
    const dbSessions = await Session.find({});
    sessions = {};
    for (const sess of dbSessions) {
      sessions[sess.token] = { username: sess.username, role: sess.role };
    }
    console.log(`✓ Loaded ${Object.keys(sessions).length} sessions from MongoDB`);
  } catch (e) {
    console.error('Error loading sessions:', e);
    sessions = {};
  }
}

// Save session to MongoDB
async function saveSession(token, username, role) {
  try {
    await Session.updateOne(
      { token },
      { token, username, role, createdAt: new Date() },
      { upsert: true }
    );
  } catch (e) {
    console.error('Error saving session:', e);
  }
}

// Delete session from MongoDB
async function deleteSession(token) {
  try {
    await Session.deleteOne({ token });
  } catch (e) {
    console.error('Error deleting session:', e);
  }
}

// Load state from MongoDB
async function loadState() {
  try {
    let state = await State.findById('inventory-state');
    if (!state) {
      // Create default state if doesn't exist
      state = new State({
        _id: 'inventory-state',
        moves: [],
        thresh: 25,
        logo: null,
        crest: null,
        names: {},
        photos: {},
        folders: {},
        order: [],
        version: 0
      });
      await state.save();
    }
    return state;
  } catch (e) {
    console.error('Error loading state:', e);
    return null;
  }
}

// Save state to MongoDB
async function saveState(stateData) {
  try {
    await State.updateOne(
      { _id: 'inventory-state' },
      { ...stateData, updatedAt: new Date() },
      { upsert: true }
    );
  } catch (e) {
    console.error('Error saving state:', e);
  }
}

// In-memory state cache
let state = null;

// Initialize
loadSessions();
loadState().then(s => { state = s ? s.toObject() : null; });

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
  
  // Store in memory and database
  sessions[token] = { username, role: user.role };
  saveSession(token, username, user.role);
  
  res.json({ ok: true, token, username, role: user.role });
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    delete sessions[token];
    deleteSession(token);
  }
  res.json({ ok: true });
});

// Get state (protected)
app.get('/api/state', verifyToken, (req, res) => {
  if (!state) {
    return res.status(500).json({ error: 'State not loaded' });
  }
  res.json(state);
});

// Sync state with audit trail (protected)
app.post('/api/sync', verifyToken, (req, res) => {
  if (!state) {
    return res.status(500).json({ error: 'State not loaded' });
  }

  const { moves, thresh, logo, crest, names, photos, folders, order } = req.body;
  const username = req.userId;

  // Update state
  if (moves !== undefined) {
    state.moves = moves.map(m => ({
      ...m,
      user: m.user || username
    }));
  }
  if (thresh !== undefined) state.thresh = thresh;
  if (logo !== undefined) state.logo = logo;
  if (crest !== undefined) state.crest = crest;
  if (names !== undefined) state.names = names;
  if (photos !== undefined) state.photos = photos;
  if (folders !== undefined) state.folders = folders;
  if (order !== undefined) state.order = order;
  
  state.version++;
  
  // Save to MongoDB
  saveState(state);
  
  res.json({ ok: true, version: state.version });
});

// Get audit log (protected)
app.get('/api/movements', verifyToken, (req, res) => {
  if (req.userRole !== 'manager') {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!state) {
    return res.status(500).json({ error: 'State not loaded' });
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
  if (!state) {
    return res.status(500).json({ error: 'State not loaded' });
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

// Create new item (managers only)
app.post('/api/create-item', verifyToken, (req, res) => {
  if (req.userRole !== 'manager') {
    return res.status(403).json({ error: 'Only managers can create items' });
  }
  
  if (!state) {
    return res.status(500).json({ error: 'State not loaded' });
  }
  
  const { name, code, price, folder, sizes, photo } = req.body;
  
  // Validate
  if (!name || !price || !folder || !sizes || sizes.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Generate unique key from name and code
  const baseKey = `${name.toLowerCase().replace(/\s+/g, '-')}~${code || 'custom'}`;
  const uniqueKey = baseKey;
  
  // Create new item object
  const newItem = {
    k: uniqueKey,
    n: name.toUpperCase(),
    c: code || '',
    p: parseFloat(price),
    g: folder,
    i: photo ? `photo-${uniqueKey}.png` : 'image-placeholder.png',
    s: sizes.map(([size, qty]) => [size, parseInt(qty)])
  };
  
  // Store in createdItems (new items array in state)
  if (!state.createdItems) state.createdItems = [];
  state.createdItems.push(newItem);
  
  // Save photo if provided
  if (photo) {
    state.photos = state.photos || {};
    state.photos[uniqueKey] = photo;
  }
  
  // Set folder override
  if (!state.folders) state.folders = {};
  state.folders[uniqueKey] = folder;
  
  state.version++;
  saveState(state);
  
  res.json({ ok: true, item: newItem, version: state.version });
});

app.post('/api/delete-item', verifyToken, (req, res) => {
  if (req.userRole !== 'manager') {
    return res.status(403).json({ error: 'Only managers can delete items' });
  }
  
  if (!state) {
    return res.status(500).json({ error: 'State not loaded' });
  }
  
  const { itemKey } = req.body;
  
  if (!itemKey) {
    return res.status(400).json({ error: 'Item key required' });
  }
  
  // Remove from createdItems if it exists there
  if (state.createdItems) {
    state.createdItems = state.createdItems.filter(item => item.k !== itemKey);
  }
  
  // Remove folder override
  if (state.folders) {
    delete state.folders[itemKey];
  }
  
  // Remove photo if exists
  if (state.photos) {
    delete state.photos[itemKey];
  }
  
  state.version++;
  saveState(state);
  
  // Log the deletion
  console.log(`✓ Item deleted: ${itemKey} by ${req.username}`);
  
  res.json({ ok: true, version: state.version });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dbConnected: mongoose.connection.readyState === 1 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Qadsiah Kit Room backend running on port ${PORT}`);
  console.log(`Users: admin, CreagRobertson, Rabbi, Sanula, LouayBafaqier, LukeMurphy`);
});
