const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db');
const { autoDetect } = require('../parsers/creditCardParsers');
const { deleteUploadedFile, getUploadPath, UPLOADS_DIR } = require('../fileStore');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Upload a credit card Excel – auto-detects company, accepts card_name + owner metadata
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'לא נבחר קובץ' });

    const parser = autoDetect(req.file.buffer);
    if (!parser) {
      return res.status(400).json({
        error: 'לא ניתן לזהות את חברת כרטיס האשראי. ודא שמדובר בקובץ ייצוא מישראכרט או מקס.',
      });
    }

    const transactions = parser.parse(req.file.buffer);
    if (transactions.length === 0) {
      return res.status(400).json({ error: 'לא נמצאו עסקאות בקובץ' });
    }

    const cardName = (req.body.card_name || '').trim();
    const owner    = req.body.owner || 'joint';
    const period   = (req.body.period || '').trim();

    const ext = path.extname(req.file.originalname) || '.xlsx';
    const savedName = `cc_${parser.company}_${Date.now()}${ext}`;
    const savedPath = path.join(UPLOADS_DIR, savedName);
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(savedPath, req.file.buffer);

    const db = getDb();
    const uploadResult = db.prepare(`
      INSERT INTO cc_uploads (filename, filepath, company, transaction_count, card_name, owner, period)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.file.originalname, savedName, parser.company, transactions.length, cardName, owner, period);
    const uploadId = uploadResult.lastInsertRowid;

    const insertTx = db.prepare(`
      INSERT INTO credit_card_transactions (
        upload_id, date, merchant, amount, currency,
        original_amount, original_currency, category,
        card_last4, source_company, notes, month_key, card_name, owner
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION');
    try {
      for (const tx of transactions) {
        insertTx.run(
          uploadId, tx.date, tx.merchant, tx.amount, tx.currency,
          tx.original_amount, tx.original_currency, tx.category,
          tx.card_last4, tx.source_company, tx.notes, tx.month_key,
          cardName, owner
        );
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      try { fs.unlinkSync(savedPath); } catch (_) {}
      throw e;
    }

    // Auto-apply saved tag rules (matched on merchant name ± 2 days)
    const rules = db.prepare('SELECT * FROM tag_rules').all();
    for (const rule of rules) {
      db.prepare(`
        UPDATE credit_card_transactions SET tag = ?
        WHERE upload_id = ? AND merchant = ?
        AND ABS(CAST(strftime('%d', date) AS INTEGER) - ?) <= 2
      `).run(rule.tag, uploadId, rule.description, rule.day_of_month);
    }

    res.json({
      success: true,
      uploadId,
      company: parser.company,
      companyLabel: parser.label,
      transactionCount: transactions.length,
    });
  } catch (err) {
    console.error('CC upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// List all CC uploads
router.get('/files', (_req, res) => {
  const db = getDb();
  res.json(db.prepare(
    'SELECT id, filename, filepath, company, transaction_count, card_name, owner, period, created_at FROM cc_uploads ORDER BY created_at DESC'
  ).all());
});

// Download original CC file
router.get('/files/:id/download', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT filename, filepath FROM cc_uploads WHERE id = ?').get(parseInt(req.params.id));
  if (!row?.filepath) return res.status(404).json({ error: 'קובץ לא נמצא' });
  const fullPath = getUploadPath(row.filepath);
  if (!fullPath) return res.status(404).json({ error: 'קובץ לא נמצא בדיסק' });
  res.download(fullPath, row.filename || row.filepath);
});

// Update card_name and owner for an upload, cascades to all its transactions
router.patch('/files/:id/meta', (req, res) => {
  const db = getDb();
  const uploadId = parseInt(req.params.id);
  const row = db.prepare('SELECT id FROM cc_uploads WHERE id = ?').get(uploadId);
  if (!row) return res.status(404).json({ error: 'קובץ לא נמצא' });

  const cardName = (req.body.card_name || '').trim();
  const owner    = req.body.owner || 'joint';
  const period   = (req.body.period || '').trim();

  db.prepare('UPDATE cc_uploads SET card_name = ?, owner = ?, period = ? WHERE id = ?').run(cardName, owner, period, uploadId);
  db.prepare('UPDATE credit_card_transactions SET card_name = ?, owner = ? WHERE upload_id = ?').run(cardName, owner, uploadId);

  res.json({ success: true });
});

// Replace the file of an existing CC upload — keeps metadata, re-parses transactions
router.post('/files/:id/replace', upload.single('file'), (req, res) => {
  try {
    const uploadId = parseInt(req.params.id);
    if (!req.file) return res.status(400).json({ error: 'לא נבחר קובץ' });

    const db = getDb();
    const existing = db.prepare('SELECT * FROM cc_uploads WHERE id = ?').get(uploadId);
    if (!existing) return res.status(404).json({ error: 'קובץ לא נמצא' });

    const parser = autoDetect(req.file.buffer);
    if (!parser) {
      return res.status(400).json({
        error: 'לא ניתן לזהות את חברת כרטיס האשראי. ודא שמדובר בקובץ ייצוא מישראכרט או מקס.',
      });
    }

    const transactions = parser.parse(req.file.buffer);
    if (transactions.length === 0) return res.status(400).json({ error: 'לא נמצאו עסקאות בקובץ' });

    const ext = path.extname(req.file.originalname) || '.xlsx';
    const savedName = `cc_${parser.company}_${Date.now()}${ext}`;
    const savedPath = path.join(UPLOADS_DIR, savedName);
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(savedPath, req.file.buffer);

    deleteUploadedFile(existing.filepath);

    db.prepare(
      'UPDATE cc_uploads SET filename = ?, filepath = ?, company = ?, transaction_count = ? WHERE id = ?'
    ).run(req.file.originalname, savedName, parser.company, transactions.length, uploadId);

    db.prepare('DELETE FROM credit_card_transactions WHERE upload_id = ?').run(uploadId);

    const insertTx = db.prepare(`
      INSERT INTO credit_card_transactions (
        upload_id, date, merchant, amount, currency,
        original_amount, original_currency, category,
        card_last4, source_company, notes, month_key, card_name, owner
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION');
    try {
      for (const tx of transactions) {
        insertTx.run(
          uploadId, tx.date, tx.merchant, tx.amount, tx.currency,
          tx.original_amount, tx.original_currency, tx.category,
          tx.card_last4, tx.source_company, tx.notes, tx.month_key,
          existing.card_name, existing.owner
        );
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      try { fs.unlinkSync(savedPath); } catch (_) {}
      throw e;
    }

    const rules = db.prepare('SELECT * FROM tag_rules').all();
    for (const rule of rules) {
      db.prepare(`
        UPDATE credit_card_transactions SET tag = ?
        WHERE upload_id = ? AND merchant = ?
        AND ABS(CAST(strftime('%d', date) AS INTEGER) - ?) <= 2
      `).run(rule.tag, uploadId, rule.description, rule.day_of_month);
    }

    res.json({ success: true, transactionCount: transactions.length });
  } catch (err) {
    console.error('CC replace error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a CC upload and all its transactions (via CASCADE)
router.delete('/files/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT filepath FROM cc_uploads WHERE id = ?').get(parseInt(req.params.id));
  if (!row) return res.status(404).json({ error: 'קובץ לא נמצא' });
  deleteUploadedFile(row.filepath);
  db.prepare('DELETE FROM cc_uploads WHERE id = ?').run(parseInt(req.params.id));
  res.json({ success: true });
});

// Set tag on a CC transaction, optionally saving a permanent rule
router.patch('/transactions/:id/tag', (req, res) => {
  const db = getDb();
  const txId = parseInt(req.params.id);
  const { tag, tag_note, permanent } = req.body;

  const tx = db.prepare('SELECT * FROM credit_card_transactions WHERE id = ?').get(txId);
  if (!tx) return res.status(404).json({ error: 'עסקה לא נמצאה' });

  db.prepare('UPDATE credit_card_transactions SET tag = ?, tag_note = ? WHERE id = ?').run(
    tag ?? null,
    tag ? (tag_note ?? '') : '',
    txId
  );

  if (permanent && tag && tx.merchant) {
    const dayOfMonth = parseInt(tx.date.slice(8, 10), 10);
    db.prepare(`
      INSERT INTO tag_rules (description, day_of_month, tag)
      VALUES (?, ?, ?)
      ON CONFLICT(description) DO UPDATE SET day_of_month = excluded.day_of_month, tag = excluded.tag
    `).run(tx.merchant, dayOfMonth, tag);

    db.prepare(`
      UPDATE credit_card_transactions SET tag = ?
      WHERE merchant = ?
      AND ABS(CAST(strftime('%d', date) AS INTEGER) - ?) <= 2
    `).run(tag, tx.merchant, dayOfMonth);

    db.prepare(`
      UPDATE transactions SET tag = ?
      WHERE description = ?
      AND ABS(CAST(strftime('%d', date) AS INTEGER) - ?) <= 2
    `).run(tag, tx.merchant, dayOfMonth);
  }

  res.json({ success: true });
});

// Get CC transactions with optional filters
router.get('/transactions', (req, res) => {
  const db = getDb();
  const { card_name, owner, category, month_key, from, to, search, upload_id } = req.query;

  const conditions = [];
  const params = [];

  if (upload_id) { conditions.push('upload_id = ?');   params.push(parseInt(upload_id)); }
  if (card_name) { conditions.push('card_name = ?');   params.push(card_name); }
  if (owner)     { conditions.push('owner = ?');        params.push(owner); }
  if (category)  { conditions.push('category = ?');     params.push(category); }
  if (month_key) { conditions.push('month_key = ?');    params.push(month_key); }
  if (from)      { conditions.push('date >= ?');        params.push(from); }
  if (to)        { conditions.push('date <= ?');        params.push(to); }
  if (search) {
    conditions.push('(merchant LIKE ? OR notes LIKE ? OR category LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const transactions = db.prepare(
    `SELECT * FROM credit_card_transactions ${where} ORDER BY date DESC, id DESC`
  ).all(...params);

  const cardNames  = db.prepare("SELECT DISTINCT card_name FROM credit_card_transactions WHERE card_name IS NOT NULL AND card_name != '' ORDER BY card_name").all().map(r => r.card_name);
  const owners     = db.prepare("SELECT DISTINCT owner FROM credit_card_transactions WHERE owner IS NOT NULL ORDER BY owner").all().map(r => r.owner);
  const categories = db.prepare("SELECT DISTINCT category FROM credit_card_transactions WHERE category IS NOT NULL AND category != '' ORDER BY category").all().map(r => r.category);
  const monthKeys  = db.prepare('SELECT DISTINCT month_key FROM credit_card_transactions ORDER BY month_key DESC').all().map(r => r.month_key);

  res.json({ transactions, cardNames, owners, categories, monthKeys });
});

module.exports = router;
