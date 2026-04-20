const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const rules = db.prepare('SELECT * FROM tag_rules ORDER BY created_at DESC').all();
  res.json(rules);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM tag_rules WHERE id = ?').run(parseInt(req.params.id));
  res.json({ success: true });
});

module.exports = router;
