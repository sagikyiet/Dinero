const express = require('express');
const multer = require('multer');
const { parseLeumi } = require('../parsers/leumi');
const { parseHapoalim } = require('../parsers/hapoalim');
const { getDb } = require('../db');
const { saveUploadedFile, deleteUploadedFile } = require('../fileStore');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.post('/', upload.fields([
  { name: 'leumi', maxCount: 1 },
  { name: 'hapoalim', maxCount: 1 },
]), (req, res) => {
  try {
    const { year, month } = req.body;

    if (!year || !month) {
      return res.status(400).json({ error: 'שנה וחודש הם שדות חובה' });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'שנה או חודש לא תקינים' });
    }

    if (!req.files?.leumi && !req.files?.hapoalim) {
      return res.status(400).json({ error: 'יש להעלות לפחות קובץ אחד' });
    }

    const db = getDb();

    // Upsert the month record
    const existing = db.prepare('SELECT id FROM months WHERE year = ? AND month = ?').get(yearNum, monthNum);
    let monthId;

    if (existing) {
      monthId = existing.id;
      // Only delete the old file/transactions for a bank if a new file for that bank is in this request
      const old = db.prepare('SELECT leumi_filepath, hapoalim_filepath FROM months WHERE id = ?').get(monthId);
      if (old) {
        if (req.files?.leumi) deleteUploadedFile(old.leumi_filepath);
        if (req.files?.hapoalim) deleteUploadedFile(old.hapoalim_filepath);
      }
      if (req.files?.leumi) db.prepare('DELETE FROM transactions WHERE month_id = ? AND bank = ?').run(monthId, 'leumi');
      if (req.files?.hapoalim) db.prepare('DELETE FROM transactions WHERE month_id = ? AND bank = ?').run(monthId, 'hapoalim');
    } else {
      const result = db.prepare('INSERT INTO months (year, month) VALUES (?, ?)').run(yearNum, monthNum);
      monthId = result.lastInsertRowid;
    }

    const allTransactions = [];
    const errors = [];
    let leumiSavedName = '';
    let hapoalimSavedName = '';

    if (req.files?.leumi?.[0]) {
      try {
        leumiSavedName = saveUploadedFile(monthId, 'leumi', req.files.leumi[0]);
        const txs = parseLeumi(req.files.leumi[0].buffer);
        allTransactions.push(...txs);
      } catch (e) {
        errors.push(`בנק לאומי: ${e.message}`);
      }
    }

    if (req.files?.hapoalim?.[0]) {
      try {
        hapoalimSavedName = saveUploadedFile(monthId, 'hapoalim', req.files.hapoalim[0]);
        const txs = parseHapoalim(req.files.hapoalim[0].buffer);
        allTransactions.push(...txs);
      } catch (e) {
        errors.push(`בנק הפועלים: ${e.message}`);
      }
    }

    if (allTransactions.length === 0 && errors.length > 0) {
      // Roll back the month if no transactions were parsed
      if (!existing) db.prepare('DELETE FROM months WHERE id = ?').run(monthId);
      return res.status(400).json({ errors });
    }

    const insertTx = db.prepare(`
      INSERT INTO transactions (
        month_id, period_id, bank, date, value_date, description, reference,
        debit, credit, balance, note, is_credit_card, credit_card_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION');
    try {
      for (const tx of allTransactions) {
        insertTx.run(
          monthId, monthId, tx.bank, tx.date, tx.value_date, tx.description,
          tx.reference, tx.debit, tx.credit, tx.balance, tx.note,
          tx.is_credit_card, tx.credit_card_name
        );
      }
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    // Auto-apply saved tag rules to the newly inserted transactions
    const rules = db.prepare('SELECT * FROM tag_rules').all();
    for (const rule of rules) {
      db.prepare(`
        UPDATE transactions SET tag = ?, event_id = ?
        WHERE month_id = ? AND description = ?
        AND ABS(CAST(strftime('%d', date) AS INTEGER) - ?) <= 2
        AND (? IS NULL OR ABS(COALESCE(debit, credit) - ?) <= ABS(?) * 0.1)
      `).run(rule.tag, rule.event_id, monthId, rule.description, rule.day_of_month,
             rule.amount, rule.amount, rule.amount);
    }

    // Only update columns for banks actually present in this request
    const updateParts = [];
    const updateArgs = [];
    if (req.files?.leumi) {
      updateParts.push('leumi_filename = ?', 'leumi_filepath = ?');
      updateArgs.push(req.files.leumi[0]?.originalname || '', leumiSavedName);
    }
    if (req.files?.hapoalim) {
      updateParts.push('hapoalim_filename = ?', 'hapoalim_filepath = ?');
      updateArgs.push(req.files.hapoalim[0]?.originalname || '', hapoalimSavedName);
    }
    if (updateParts.length > 0) {
      db.prepare(`UPDATE months SET ${updateParts.join(', ')} WHERE id = ?`).run(...updateArgs, monthId);
    }

    res.json({
      success: true,
      monthId,
      year: yearNum,
      month: monthNum,
      transactionCount: allTransactions.length,
      errors,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
