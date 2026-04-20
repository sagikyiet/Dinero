const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM card_owners').all());
});

router.patch('/', (req, res) => {
  const db = getDb();
  const { credit_card_name, bank, owner } = req.body;

  if (!credit_card_name || !bank || !owner) {
    return res.status(400).json({ error: 'חסרים שדות חובה' });
  }

  db.prepare(`
    INSERT INTO card_owners (credit_card_name, bank, owner)
    VALUES (?, ?, ?)
    ON CONFLICT(credit_card_name, bank) DO UPDATE SET owner = excluded.owner
  `).run(credit_card_name, bank, owner);

  res.json({ success: true });
});

module.exports = router;
