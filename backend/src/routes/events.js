const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// GET /api/events
router.get('/', (req, res) => {
  const db = getDb();
  const events = db.prepare('SELECT id, name, description, created_at FROM events ORDER BY created_at DESC').all();
  res.json(events);
});

// POST /api/events
router.post('/', (req, res) => {
  const db = getDb();
  const { name, description = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const existing = db.prepare('SELECT id, name, description, created_at FROM events WHERE name = ?').get(name);
  if (existing) return res.json(existing);

  const result = db.prepare('INSERT INTO events (name, description) VALUES (?, ?)').run(name, description);
  const created = db.prepare('SELECT id, name, description, created_at FROM events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// DELETE /api/events/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const eventId = parseInt(req.params.id);

  db.prepare('UPDATE transactions SET event_id = NULL WHERE event_id = ?').run(eventId);
  db.prepare('UPDATE credit_card_transactions SET event_id = NULL WHERE event_id = ?').run(eventId);
  db.prepare('DELETE FROM events WHERE id = ?').run(eventId);

  res.json({ success: true });
});

module.exports = router;
