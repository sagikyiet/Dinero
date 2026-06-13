'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db');
const { generateDemoData } = require('../demo-data');

const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

function clearUploadsFolder() {
  if (!fs.existsSync(UPLOADS_DIR)) return;
  for (const file of fs.readdirSync(UPLOADS_DIR)) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, file)); } catch (_) {}
  }
}

function clearDbData(db) {
  db.exec('DELETE FROM credit_card_transactions');
  db.exec('DELETE FROM cc_uploads');
  db.exec('DELETE FROM transactions');
  db.exec('DELETE FROM months');
  db.exec('DELETE FROM merchant_categories');
  db.exec('DELETE FROM tag_rules');
  db.exec('DELETE FROM card_owners');
}

function setDemoMode(db, enabled, maleName = null, femaleName = null) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('demo_mode', enabled ? 'true' : 'false');
  if (maleName !== null) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('demo_male_name', maleName);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('demo_female_name', femaleName || '');
  }
}

router.post('/load', (req, res) => {
  try {
    const db = getDb();
    clearUploadsFolder();

    const data = generateDemoData();

    db.exec('BEGIN TRANSACTION');
    try {
      clearDbData(db);

      const insertCat = db.prepare('INSERT OR REPLACE INTO merchant_categories (merchant_name, category) VALUES (?, ?)');
      for (const [name, cat] of Object.entries(data.merchantCategories)) {
        insertCat.run(name, cat);
      }

      const insertMonth = db.prepare(`
        INSERT INTO months (year, month, savings, notes, leumi_filename, hapoalim_filename, leumi_filepath, hapoalim_filepath)
        VALUES (?, ?, 0, '', '', '', '', '')
      `);

      const insertTx = db.prepare(`
        INSERT INTO transactions (month_id, period_id, bank, date, value_date, description, reference,
          debit, credit, balance, note, is_special, is_credit_card, credit_card_name, tag, tag_note)
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, 0, ?, ?, ?, '')
      `);

      const insertUpload = db.prepare(`
        INSERT INTO cc_uploads (filename, filepath, company, transaction_count, card_name, owner, period)
        VALUES (?, '', ?, ?, ?, ?, ?)
      `);

      const insertCCTx = db.prepare(`
        INSERT INTO credit_card_transactions (
          upload_id, period_id, date, merchant, amount, currency,
          original_amount, original_currency, category, card_last4,
          source_company, notes, month_key, card_name, owner, tag, tag_note)
        VALUES (?, ?, ?, ?, ?, 'ILS', NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const period of data.periods) {
        const mr = insertMonth.run(period.year, period.month);
        const monthId = Number(mr.lastInsertRowid);

        for (const tx of period.leumiTransactions) {
          insertTx.run(
            monthId, monthId, 'leumi', tx.date, tx.date, tx.description,
            tx.debit ?? null, tx.credit ?? null, tx.balance ?? null,
            tx.is_credit_card ?? 0, tx.credit_card_name ?? null, tx.tag ?? null
          );
        }

        for (const tx of period.hapoalimTransactions) {
          insertTx.run(
            monthId, monthId, 'hapoalim', tx.date, tx.date, tx.description,
            tx.debit ?? null, tx.credit ?? null, tx.balance ?? null,
            tx.is_credit_card ?? 0, tx.credit_card_name ?? null, tx.tag ?? null
          );
        }

        for (const upload of period.ccUploads) {
          const ur = insertUpload.run(
            `demo_${upload.company}_${upload.card_last4}_${period.periodKey}.xlsx`,
            upload.company,
            upload.transactions.length,
            upload.card_name,
            upload.owner,
            upload.period
          );
          const uploadId = Number(ur.lastInsertRowid);

          for (const tx of upload.transactions) {
            insertCCTx.run(
              uploadId, monthId, tx.date, tx.merchant, tx.amount,
              tx.category, tx.card_last4, tx.source_company,
              tx.notes ?? null, tx.month_key, tx.card_name, tx.owner,
              tx.tag ?? null, tx.tag_note ?? ''
            );
          }
        }
      }

      setDemoMode(db, true, data.maleName, data.femaleName);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Demo load error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/clear', (req, res) => {
  try {
    const db = getDb();
    clearUploadsFolder();
    db.exec('BEGIN TRANSACTION');
    try {
      clearDbData(db);
      setDemoMode(db, false, '', '');
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Demo clear error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      "SELECT key, value FROM settings WHERE key IN ('demo_mode','demo_male_name','demo_female_name')"
    ).all();
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({
      demo_mode:        s.demo_mode === 'true',
      demo_male_name:   s.demo_male_name   || null,
      demo_female_name: s.demo_female_name || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
