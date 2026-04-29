const express = require('express');
const multer = require('multer');
const { parseLeumi } = require('../parsers/leumi');
const { parseHapoalim } = require('../parsers/hapoalim');
const { getDb } = require('../db');
const { saveUploadedFile, deleteUploadedFile, getUploadPath } = require('../fileStore');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// IMPORTANT: Static routes must come before /:id

// Get all months summary
router.get('/', (req, res) => {
  const db = getDb();
  const months = db.prepare(`
    SELECT
      m.id, m.year, m.month, m.savings, m.notes, m.created_at,
      COALESCE(m.leumi_filename, '') AS leumi_filename,
      COALESCE(m.hapoalim_filename, '') AS hapoalim_filename,
      COALESCE(m.leumi_filepath, '') AS leumi_filepath,
      COALESCE(m.hapoalim_filepath, '') AS hapoalim_filepath,
      COUNT(t.id) AS transaction_count,
      COALESCE(SUM(t.debit), 0) AS total_expenses,
      COALESCE(SUM(t.credit), 0) AS total_income,
      (SELECT COUNT(*) FROM transactions WHERE month_id = m.id AND bank = 'leumi') AS leumi_count,
      (SELECT COUNT(*) FROM transactions WHERE month_id = m.id AND bank = 'hapoalim') AS hapoalim_count
    FROM months m
    LEFT JOIN transactions t ON t.month_id = m.id
    GROUP BY m.id
    ORDER BY m.year DESC, m.month DESC
  `).all();
  res.json(months);
});

// History summary for chart (must be before /:id)
router.get('/history/all', (req, res) => {
  const db = getDb();
  const history = db.prepare(`
    SELECT
      m.id, m.year, m.month, m.savings,
      COALESCE(SUM(t.debit), 0) AS total_expenses,
      COALESCE(SUM(t.credit), 0) AS total_income,
      COALESCE(SUM(
        CASE WHEN t.tag = 'savings'
        THEN COALESCE(t.debit, 0) + COALESCE(t.credit, 0)
        ELSE 0 END
      ), 0) AS savings_tagged
    FROM months m
    LEFT JOIN transactions t ON t.month_id = m.id
    GROUP BY m.id
    ORDER BY m.year ASC, m.month ASC
  `).all();
  res.json(history);
});

// Download a bank file for a month (must be before /:id/dashboard)
router.get('/:id/files/:bank/download', (req, res) => {
  const db = getDb();
  const monthId = parseInt(req.params.id);
  const { bank } = req.params;
  if (!['leumi', 'hapoalim'].includes(bank)) {
    return res.status(400).json({ error: 'בנק לא תקין' });
  }

  const col = bank === 'leumi' ? 'leumi_filepath' : 'hapoalim_filepath';
  const nameCol = bank === 'leumi' ? 'leumi_filename' : 'hapoalim_filename';
  const row = db.prepare(`SELECT ${col} AS filepath, ${nameCol} AS filename FROM months WHERE id = ?`).get(monthId);

  if (!row?.filepath) return res.status(404).json({ error: 'קובץ לא נמצא' });

  const fullPath = getUploadPath(row.filepath);
  if (!fullPath) return res.status(404).json({ error: 'קובץ לא נמצא בדיסק' });

  res.download(fullPath, row.filename || row.filepath);
});

// Get dashboard data for a specific month
router.get('/:id/dashboard', (req, res) => {
  const db = getDb();
  const monthId = parseInt(req.params.id);

  const month = db.prepare('SELECT * FROM months WHERE id = ?').get(monthId);
  if (!month) return res.status(404).json({ error: 'חודש לא נמצא' });

  const summary = db.prepare(`
    SELECT
      COALESCE(SUM(debit), 0)  AS total_expenses,
      COALESCE(SUM(credit), 0) AS total_income,
      COUNT(*)                 AS transaction_count
    FROM transactions
    WHERE month_id = ?
  `).get(monthId);

  const monthKey = `${month.year}-${String(month.month).padStart(2, '0')}`;
  const creditCards = db.prepare(`
    SELECT card_name, COALESCE(owner, 'joint') AS owner, COALESCE(SUM(amount), 0) AS total
    FROM credit_card_transactions
    WHERE month_key = ? AND card_name IS NOT NULL AND card_name != ''
    GROUP BY card_name, owner
    ORDER BY total DESC
  `).all(monthKey);

  const bankCCTotal = db.prepare(`
    SELECT COALESCE(SUM(debit), 0) AS total
    FROM transactions
    WHERE month_id = ? AND is_credit_card = 1
  `).get(monthId).total;

  const ccFilesRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
    FROM credit_card_transactions
    WHERE month_key = ?
  `).get(monthKey);
  const ccFilesTotal = ccFilesRow.total;
  const ccFilesCount = ccFilesRow.cnt;

  const specialTransactions = db.prepare(`
    SELECT * FROM transactions
    WHERE month_id = ? AND is_special = 1
    ORDER BY date DESC
  `).all(monthId);

  // Tagged CC transactions for the same calendar month, normalized to match bank tx shape
  const EXPENSE_TAGS = new Set(['large_expense', 'routine_expense', 'savings']);
  const ccTagged = db.prepare(`
    SELECT * FROM credit_card_transactions
    WHERE month_key = ? AND tag IS NOT NULL AND tag != ''
    ORDER BY date DESC
  `).all(monthKey).map(tx => ({
    id: `cc_${tx.id}`,
    date: tx.date,
    description: tx.merchant || '',
    tag: tx.tag,
    tag_note: tx.tag_note || '',
    debit:  EXPENSE_TAGS.has(tx.tag) ? tx.amount : null,
    credit: !EXPENSE_TAGS.has(tx.tag) ? tx.amount : null,
  }));

  res.json({ month, summary, creditCards, specialTransactions, ccTagged, bankCCTotal, ccFilesTotal, ccFilesCount });
});

// Update savings / notes for a month
router.patch('/:id', (req, res) => {
  const db = getDb();
  const monthId = parseInt(req.params.id);
  const { savings, notes } = req.body;

  const month = db.prepare('SELECT * FROM months WHERE id = ?').get(monthId);
  if (!month) return res.status(404).json({ error: 'חודש לא נמצא' });

  db.prepare('UPDATE months SET savings = ?, notes = ? WHERE id = ?').run(
    savings !== undefined ? savings : month.savings,
    notes !== undefined ? notes : month.notes,
    monthId
  );

  res.json({ success: true });
});

// Delete a month and all its transactions (cascade)
router.delete('/:id', (req, res) => {
  const db = getDb();
  const monthId = parseInt(req.params.id);
  const row = db.prepare('SELECT leumi_filepath, hapoalim_filepath FROM months WHERE id = ?').get(monthId);
  if (row) {
    deleteUploadedFile(row.leumi_filepath);
    deleteUploadedFile(row.hapoalim_filepath);
  }
  db.prepare('DELETE FROM months WHERE id = ?').run(monthId);
  res.json({ success: true });
});

// Delete one bank's transactions from a month
router.delete('/:id/files/:bank', (req, res) => {
  const db = getDb();
  const monthId = parseInt(req.params.id);
  const { bank } = req.params;
  if (!['leumi', 'hapoalim'].includes(bank)) {
    return res.status(400).json({ error: 'בנק לא תקין' });
  }
  const col = bank === 'leumi' ? 'leumi_filepath' : 'hapoalim_filepath';
  const nameCol = bank === 'leumi' ? 'leumi_filename' : 'hapoalim_filename';
  const row = db.prepare(`SELECT ${col} AS filepath FROM months WHERE id = ?`).get(monthId);
  if (!row) return res.status(404).json({ error: 'חודש לא נמצא' });

  deleteUploadedFile(row.filepath);
  db.prepare('DELETE FROM transactions WHERE month_id = ? AND bank = ?').run(monthId, bank);
  db.prepare(`UPDATE months SET ${col} = '', ${nameCol} = '' WHERE id = ?`).run(monthId);

  res.json({ success: true });
});

// Replace one bank's file for a month
router.post('/:id/files/:bank', upload.single('file'), (req, res) => {
  try {
    const monthId = parseInt(req.params.id);
    const { bank } = req.params;
    if (!['leumi', 'hapoalim'].includes(bank)) {
      return res.status(400).json({ error: 'בנק לא תקין' });
    }
    if (!req.file) return res.status(400).json({ error: 'לא נבחר קובץ' });

    const db = getDb();
    const fpCol = bank === 'leumi' ? 'leumi_filepath' : 'hapoalim_filepath';
    const fnCol = bank === 'leumi' ? 'leumi_filename' : 'hapoalim_filename';
    const existing = db.prepare(`SELECT ${fpCol} AS filepath FROM months WHERE id = ?`).get(monthId);
    if (!existing) return res.status(404).json({ error: 'חודש לא נמצא' });

    deleteUploadedFile(existing.filepath);

    const transactions = bank === 'leumi'
      ? parseLeumi(req.file.buffer)
      : parseHapoalim(req.file.buffer);

    db.prepare('DELETE FROM transactions WHERE month_id = ? AND bank = ?').run(monthId, bank);

    const insertTx = db.prepare(`
      INSERT INTO transactions (
        month_id, period_id, bank, date, value_date, description, reference,
        debit, credit, balance, note, is_credit_card, credit_card_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION');
    try {
      for (const tx of transactions) {
        insertTx.run(monthId, monthId, tx.bank, tx.date, tx.value_date, tx.description,
          tx.reference, tx.debit, tx.credit, tx.balance, tx.note,
          tx.is_credit_card, tx.credit_card_name);
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    const rules = db.prepare('SELECT * FROM tag_rules').all();
    for (const rule of rules) {
      db.prepare(`
        UPDATE transactions SET tag = ?
        WHERE month_id = ? AND bank = ? AND description = ?
        AND ABS(CAST(strftime('%d', date) AS INTEGER) - ?) <= 2
      `).run(rule.tag, monthId, bank, rule.description, rule.day_of_month);
    }

    const savedName = saveUploadedFile(monthId, bank, req.file);
    db.prepare(`UPDATE months SET ${fpCol} = ?, ${fnCol} = ? WHERE id = ?`).run(
      savedName, req.file.originalname, monthId
    );

    res.json({ success: true, transactionCount: transactions.length });
  } catch (err) {
    console.error('Replace file error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
