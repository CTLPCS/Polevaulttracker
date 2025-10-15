const express = require('express');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const app = express();
const upload = multer({ dest: 'uploads/' });

const db = mysql.createPool({
  host: 'localhost',
  user: 'youruser',
  password: 'yourpass',
  database: 'yourdb'
});

// Upload video
app.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).send('No video uploaded');
  const { coachId, notes } = req.body;
  const videoPath = req.file.path;
  // Save metadata to MySQL
  await db.query(
    'INSERT INTO videos (coach_id, filename, notes) VALUES (?, ?, ?)',
    [coachId, videoPath, notes]
  );
  res.send({ success: true });
});

// List videos
app.get('/videos', async (req, res) => {
  const [rows] = await db.query('SELECT * FROM videos ORDER BY created_at DESC');
  res.json(rows);
});

// Serve video files (for demo, real apps use cloud storage)
app.get('/video/:filename', (req, res) => {
  res.sendFile(path.join(__dirname, 'uploads', req.params.filename));
});

app.listen(3000, () => console.log('API listening on port 3000'));