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

// GET /api/events/summary — events that have at least one linked transaction
router.get('/summary', (req, res) => {
  const db = getDb();
  const events = db.prepare(`
    SELECT
      e.id, e.name, e.description, e.created_at,
      COALESCE(SUM(tx.amount), 0) AS total_amount,
      COUNT(*) AS transaction_count,
      MIN(tx.date) AS earliest_date,
      MAX(tx.date) AS last_updated
    FROM events e
    JOIN (
      SELECT event_id, COALESCE(credit, 0) - COALESCE(debit, 0) AS amount, date
      FROM transactions
      WHERE event_id IS NOT NULL
      UNION ALL
      SELECT event_id, -amount AS amount, date
      FROM credit_card_transactions
      WHERE event_id IS NOT NULL
    ) tx ON tx.event_id = e.id
    GROUP BY e.id, e.name, e.description, e.created_at
    ORDER BY last_updated DESC
  `).all();
  res.json(events);
});

// GET /api/events/:id/transactions — all bank + CC transactions for an event
router.get('/:id/transactions', (req, res) => {
  const db = getDb();
  const eventId = parseInt(req.params.id);
  const txs = db.prepare(`
    SELECT id, date, description, debit, credit, tag, period_id, 'bank' AS type,
      CASE bank
        WHEN 'leumi'    THEN 'בנק לאומי'
        WHEN 'hapoalim' THEN 'בנק הפועלים'
        ELSE bank
      END AS bank
    FROM transactions
    WHERE event_id = ?
    UNION ALL
    SELECT id, date, merchant AS description, amount AS debit, NULL AS credit,
           tag, period_id, 'cc' AS type,
           COALESCE(NULLIF(card_name, ''), source_company) AS bank
    FROM credit_card_transactions
    WHERE event_id = ?
    ORDER BY date DESC
  `).all(eventId, eventId);
  res.json(txs);
});

// PATCH /api/events/:id — rename an event
router.patch('/:id', (req, res) => {
  const db = getDb();
  const eventId = parseInt(req.params.id);
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'שם האירוע נדרש' });
  db.prepare('UPDATE events SET name = ? WHERE id = ?').run(name.trim(), eventId);
  const updated = db.prepare('SELECT id, name, description, created_at FROM events WHERE id = ?').get(eventId);
  if (!updated) return res.status(404).json({ error: 'אירוע לא נמצא' });
  res.json(updated);
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
