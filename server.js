const express = require('express');
const cors = require('cors');
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// In-memory storage (persists while server runs)
let state = {
  moves: [],
  thresh: 25,
  logo: null,
  names: {},
  photos: {},
  folders: {},
  version: 0
};

// Endpoints
app.get('/api/state', (req, res) => {
  res.json(state);
});

app.post('/api/sync', (req, res) => {
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Qadsiah Kit Room backend running on port ${PORT}`);
});
