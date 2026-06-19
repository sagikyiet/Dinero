const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// GET /api/transactions?month_id=&bank=&type=&search=&from=&to=
router.get('/', (req, res) => {
  const db = getDb();
  const { month_id, bank, type, search, from, to } = req.query;

  const conditions = [];
  const params = [];

  if (month_id) {
    conditions.push('t.month_id = ?');
    params.push(parseInt(month_id));
  }

  if (bank && bank !== 'all') {
    conditions.push('t.bank = ?');
    params.push(bank);
  }

  if (type === 'debit') {
    conditions.push('t.debit IS NOT NULL AND t.debit > 0');
  } else if (type === 'credit') {
    conditions.push('t.credit IS NOT NULL AND t.credit > 0');
  }

  if (search && search.trim()) {
    conditions.push('t.description LIKE ?');
    params.push(`%${search.trim()}%`);
  }

  if (from) {
    conditions.push('t.date >= ?');
    params.push(from);
  }

  if (to) {
    conditions.push('t.date <= ?');
    params.push(to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const transactions = db.prepare(`
    SELECT t.*, e.name AS event_name
    FROM transactions t
    LEFT JOIN events e ON e.id = t.event_id
    ${where}
    ORDER BY t.date DESC, t.id DESC
  `).all(...params);

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(t.debit), 0)  AS total_debit,
      COALESCE(SUM(t.credit), 0) AS total_credit,
      COUNT(*) AS count
    FROM transactions t
    ${where}
  `).get(...params);

  res.json({ transactions, totals });
});

// Set tag on a transaction, optionally saving a permanent rule
router.patch('/:id/tag', (req, res) => {
  const db = getDb();
  const txId = parseInt(req.params.id);
  const { tag, tag_note, permanent, event_id } = req.body; // tag may be null to clear

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);
  if (!tx) return res.status(404).json({ error: 'פעולה לא נמצאה' });

  const resolvedEventId = event_id !== undefined ? event_id : (tx.event_id ?? null);
  console.log('[PATCH tag bank] txId=%d tag=%s event_id_received=%s resolved=%s', txId, tag, event_id, resolvedEventId);
  db.prepare('UPDATE transactions SET tag = ?, tag_note = ?, event_id = ? WHERE id = ?').run(
    tag ?? null,
    tag ? (tag_note ?? '') : '',
    resolvedEventId,
    txId
  );

  if (permanent && tag && tx.description) {
    const dayOfMonth = parseInt(tx.date.slice(8, 10), 10); // YYYY-MM-DD
    const ruleAmount = tx.debit ?? tx.credit ?? null;
    db.prepare(`
      INSERT INTO tag_rules (description, day_of_month, tag, amount, event_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(description) DO UPDATE SET
        day_of_month = excluded.day_of_month,
        tag = excluded.tag,
        amount = excluded.amount,
        event_id = excluded.event_id
    `).run(tx.description, dayOfMonth, tag, ruleAmount, resolvedEventId);

    // Apply rule to all matching transactions across all months
    db.prepare(`
      UPDATE transactions SET tag = ?, event_id = ?
      WHERE description = ?
      AND ABS(CAST(strftime('%d', date) AS INTEGER) - ?) <= 2
      AND (? IS NULL OR ABS(COALESCE(debit, credit) - ?) <= ABS(?) * 0.1)
    `).run(tag, resolvedEventId, tx.description, dayOfMonth, ruleAmount, ruleAmount, ruleAmount);
  }

  res.json({ success: true });
});

// Apply the same tag + event to multiple transactions at once. Unlike the
// single-tag route, this never creates/updates tag_rules or cascades to
// other matching transactions — only the given ids are touched.
router.patch('/bulk-tag', (req, res) => {
  const db = getDb();
  const { ids, tag, event_id } = req.body; // tag may be null to clear

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'נדרשת רשימת פעולות לתיוג' });
  }
  const txIds = ids.map(id => parseInt(id)).filter(Number.isInteger);
  if (txIds.length === 0) {
    return res.status(400).json({ error: 'רשימת פעולות לא תקינה' });
  }

  const resolvedEventId = event_id ?? null;
  const placeholders = txIds.map(() => '?').join(',');

  const result = tag
    ? db.prepare(`UPDATE transactions SET tag = ?, event_id = ? WHERE id IN (${placeholders})`)
        .run(tag, resolvedEventId, ...txIds)
    : db.prepare(`UPDATE transactions SET tag = NULL, tag_note = '', event_id = ? WHERE id IN (${placeholders})`)
        .run(resolvedEventId, ...txIds);

  res.json({ success: true, updated: result.changes });
});

// Toggle special flag on a transaction
router.patch('/:id/special', (req, res) => {
  const db = getDb();
  const txId = parseInt(req.params.id);
  const { is_special, special_note } = req.body;

  const tx = db.prepare('SELECT id FROM transactions WHERE id = ?').get(txId);
  if (!tx) return res.status(404).json({ error: 'פעולה לא נמצאה' });

  db.prepare('UPDATE transactions SET is_special = ?, special_note = ? WHERE id = ?').run(
    is_special ? 1 : 0,
    special_note ?? '',
    txId
  );

  res.json({ success: true });
});

module.exports = router;
