const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

const MONTH_NAMES_SHORT = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];

const VALID_CATEGORIES = new Set([
  'groceries','home','fuel','car','medical','entertainment','clothing',
  'subscriptions','cats','insurance','fees','electronics','grooming',
  'vacation','gifts','sports','other',
]);

// GET /api/insights/period-summary
// Returns per-period totals from bank transactions only.
// הוצאות includes is_credit_card=1 rows (same source as dashboard סה"כ כרטיסים).
// חיסכון = sum of debits tagged 'savings' (not the months.savings column).
router.get('/period-summary', (req, res) => {
  const db = getDb();

  try {
    const rows = db.prepare(`
      SELECT
        m.year, m.month,
        COALESCE(SUM(CASE WHEN t.credit > 0 THEN t.credit ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN t.debit  > 0 THEN t.debit  ELSE 0 END), 0) AS expenses,
        COALESCE(SUM(CASE WHEN t.tag = 'savings' AND t.debit > 0 THEN t.debit ELSE 0 END), 0) AS savings
      FROM months m
      LEFT JOIN transactions t ON t.month_id = m.id
      GROUP BY m.id
      ORDER BY m.year ASC, m.month ASC
    `).all();

    const periods = rows.map(m => ({
      label:   `${MONTH_NAMES_SHORT[m.month - 1]} ${m.year}`,
      הכנסות: Math.round(m.income),
      הוצאות: Math.round(m.expenses),
      מאזן:   Math.round(m.income - m.expenses),
      חיסכון: Math.round(m.savings),
    }));

    res.json(periods);
  } catch (err) {
    console.error('Period summary error:', err);
    res.status(500).json({ error: 'Failed to compute period summary' });
  }
});

// GET /api/insights/category-breakdown?period=current|all|YYYY-MM&owner=both|sagi|maya
router.get('/category-breakdown', (req, res) => {
  const db = getDb();
  const { period = 'current', owner = 'both' } = req.query;

  try {
    let resolvedPeriod = period;

    if (period === 'current') {
      const latest = db.prepare(
        `SELECT printf('%04d-%02d', year, month) AS p FROM months ORDER BY year DESC, month DESC LIMIT 1`
      ).get();
      if (!latest) return res.json({ data: [], period: null });
      resolvedPeriod = latest.p;
    }

    let bankRows, ccRows;

    if (resolvedPeriod === 'all') {
      bankRows = db.prepare(`
        SELECT COALESCE(mc.category, 'other') AS category,
               COALESCE(SUM(t.debit), 0) AS amount
        FROM transactions t
        LEFT JOIN merchant_categories mc ON mc.merchant_name = t.description
        WHERE t.debit > 0 AND t.is_credit_card = 0 AND (t.tag IS NULL OR t.tag = '')
        GROUP BY category
      `).all();

      if (owner !== 'both') {
        ccRows = db.prepare(`
          SELECT COALESCE(mc.category, 'other') AS category,
                 COALESCE(SUM(cct.amount), 0) AS amount
          FROM credit_card_transactions cct
          LEFT JOIN merchant_categories mc ON mc.merchant_name = cct.merchant
          WHERE cct.owner = ? AND (cct.tag IS NULL OR cct.tag = '')
          GROUP BY COALESCE(mc.category, 'other')
        `).all(owner);
      } else {
        ccRows = db.prepare(`
          SELECT COALESCE(mc.category, 'other') AS category,
                 COALESCE(SUM(cct.amount), 0) AS amount
          FROM credit_card_transactions cct
          LEFT JOIN merchant_categories mc ON mc.merchant_name = cct.merchant
          WHERE (cct.tag IS NULL OR cct.tag = '')
          GROUP BY COALESCE(mc.category, 'other')
        `).all();
      }
    } else {
      const [y, m] = resolvedPeriod.split('-').map(Number);
      const monthRow = db.prepare('SELECT id FROM months WHERE year = ? AND month = ?').get(y, m);
      const monthId = monthRow ? monthRow.id : -1;

      bankRows = db.prepare(`
        SELECT COALESCE(mc.category, 'other') AS category,
               COALESCE(SUM(t.debit), 0) AS amount
        FROM transactions t
        LEFT JOIN merchant_categories mc ON mc.merchant_name = t.description
        WHERE t.debit > 0 AND t.is_credit_card = 0 AND t.month_id = ? AND (t.tag IS NULL OR t.tag = '')
        GROUP BY COALESCE(mc.category, 'other')
      `).all(monthId);

      if (owner !== 'both') {
        ccRows = db.prepare(`
          SELECT COALESCE(mc.category, 'other') AS category,
                 COALESCE(SUM(cct.amount), 0) AS amount
          FROM credit_card_transactions cct
          LEFT JOIN merchant_categories mc ON mc.merchant_name = cct.merchant
          WHERE cct.period_id = ? AND cct.owner = ? AND (cct.tag IS NULL OR cct.tag = '')
          GROUP BY COALESCE(mc.category, 'other')
        `).all(monthId, owner);
      } else {
        ccRows = db.prepare(`
          SELECT COALESCE(mc.category, 'other') AS category,
                 COALESCE(SUM(cct.amount), 0) AS amount
          FROM credit_card_transactions cct
          LEFT JOIN merchant_categories mc ON mc.merchant_name = cct.merchant
          WHERE cct.period_id = ? AND (cct.tag IS NULL OR cct.tag = '')
          GROUP BY COALESCE(mc.category, 'other')
        `).all(monthId);
      }
    }

    const totals = {};
    for (const row of [...bankRows, ...ccRows]) {
      if (row.amount > 0) {
        totals[row.category] = (totals[row.category] || 0) + row.amount;
      }
    }

    const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
    const data = Object.entries(totals)
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount),
        percentage: grandTotal > 0 ? Math.round((amount / grandTotal) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    res.json({ data, period: resolvedPeriod });
  } catch (err) {
    console.error('Category breakdown error:', err);
    res.status(500).json({ error: 'Failed to compute category breakdown' });
  }
});

// GET /api/insights/category-trend?source=all|bank|cc|special|<category>
// Returns total expenses per period for the selected source filter.
// Non-category filters use bank transactions only.
// Category filters combine bank + CC so all spending is captured regardless of source.
router.get('/category-trend', (req, res) => {
  const db = getDb();
  const { source = 'all' } = req.query;

  try {
    const isCategory = VALID_CATEGORIES.has(source);

    if (isCategory) {
      // Category-specific: query both bank and CC transactions joined with merchant_categories
      const bankRows = db.prepare(`
        SELECT printf('%04d-%02d', m.year, m.month) AS period,
               COALESCE(SUM(t.debit), 0) AS total
        FROM transactions t
        JOIN months m ON t.month_id = m.id
        LEFT JOIN merchant_categories mc ON mc.merchant_name = t.description
        WHERE t.debit > 0 AND t.is_credit_card = 0 AND (t.tag IS NULL OR t.tag = '') AND COALESCE(mc.category, 'other') = ?
        GROUP BY period
      `).all(source);

      // Group by period_id (billing period set at upload time, not transaction date)
      const ccRows = db.prepare(`
        SELECT printf('%04d-%02d', m.year, m.month) AS period,
               COALESCE(SUM(cct.amount), 0) AS total
        FROM credit_card_transactions cct
        JOIN months m ON cct.period_id = m.id
        LEFT JOIN merchant_categories mc ON mc.merchant_name = cct.merchant
        WHERE (cct.tag IS NULL OR cct.tag = '') AND COALESCE(mc.category, 'other') = ?
        GROUP BY cct.period_id
      `).all(source);

      const periodMap = {};
      for (const row of [...bankRows, ...ccRows]) {
        if (row.total > 0) {
          periodMap[row.period] = (periodMap[row.period] || 0) + row.total;
        }
      }

      const periods = Object.keys(periodMap).sort().map(period => {
        const [y, m] = period.split('-');
        return {
          period,
          label: `${MONTH_NAMES_SHORT[parseInt(m) - 1]} ${y}`,
          total: Math.round(periodMap[period]),
        };
      });

      return res.json({ periods });
    }

    // 'special' = large_expense tag, found in both bank and CC transactions
    if (source === 'special') {
      const bankSpecial = db.prepare(`
        SELECT printf('%04d-%02d', m.year, m.month) AS period,
               COALESCE(SUM(t.debit), 0) AS total
        FROM transactions t
        JOIN months m ON t.month_id = m.id
        WHERE t.debit > 0 AND t.is_credit_card = 0 AND t.tag = 'large_expense'
        GROUP BY period
      `).all();

      const ccSpecial = db.prepare(`
        SELECT printf('%04d-%02d', m.year, m.month) AS period,
               COALESCE(SUM(cct.amount), 0) AS total
        FROM credit_card_transactions cct
        JOIN months m ON cct.period_id = m.id
        WHERE cct.tag = 'large_expense'
        GROUP BY cct.period_id
      `).all();

      const periodMap = {};
      for (const row of [...bankSpecial, ...ccSpecial]) {
        if (row.total > 0) periodMap[row.period] = (periodMap[row.period] || 0) + row.total;
      }
      const periods = Object.keys(periodMap).sort().map(period => {
        const [y, m] = period.split('-');
        return { period, label: `${MONTH_NAMES_SHORT[parseInt(m) - 1]} ${y}`, total: Math.round(periodMap[period]) };
      });
      return res.json({ periods });
    }

    // Non-category, non-special filters: bank transactions only, excluding tagged.
    // 'cc' source targets CC billing charges (is_credit_card=1).
    // All other sources target direct bank expenses (is_credit_card=0).
    const where = source === 'cc'
      ? "t.debit > 0 AND t.is_credit_card = 1 AND (t.tag IS NULL OR t.tag = '')"
      : "t.debit > 0 AND t.is_credit_card = 0 AND (t.tag IS NULL OR t.tag = '')";

    const rows = db.prepare(`
      SELECT printf('%04d-%02d', m.year, m.month) AS period,
             COALESCE(SUM(t.debit), 0) AS total
      FROM transactions t
      JOIN months m ON t.month_id = m.id
      WHERE ${where}
      GROUP BY period
      ORDER BY period ASC
    `).all();

    const periods = rows.map(r => {
      const [y, m] = r.period.split('-');
      return {
        period: r.period,
        label:  `${MONTH_NAMES_SHORT[parseInt(m) - 1]} ${y}`,
        total:  Math.round(r.total),
      };
    });

    res.json({ periods });
  } catch (err) {
    console.error('Category trend error:', err);
    res.status(500).json({ error: 'Failed to compute category trend' });
  }
});

// GET /api/insights/drill?filter=all|bank|cc|special|<category>&period=all|YYYY-MM&owner=both|sagi|maya
// Returns individual transactions that make up a chart bar/slice.
// filter=category  → bank + CC transactions for that category
// filter=all/bank/cc/special → bank transactions only (same rules as category-trend)
router.get('/drill', (req, res) => {
  const db = getDb();
  const { filter = 'all', period = 'all', owner = 'both' } = req.query;

  try {
    const isCategory = VALID_CATEGORIES.has(filter);

    // Resolve period string to months.id (null = all periods)
    let monthId = null;
    if (period !== 'all') {
      const [y, m] = period.split('-').map(Number);
      const row = db.prepare('SELECT id FROM months WHERE year = ? AND month = ?').get(y, m);
      monthId = row ? row.id : -1; // -1 yields no results if month not in DB
    }

    // --- Bank transactions ---
    // 'cc' filter = billing charges (is_credit_card=1); everything else = direct expenses (is_credit_card=0)
    let bankWhere;
    if (filter === 'cc')      bankWhere = "t.debit > 0 AND t.is_credit_card = 1 AND (t.tag IS NULL OR t.tag = '')";
    else if (filter === 'special') bankWhere = "t.debit > 0 AND t.is_credit_card = 0 AND t.tag = 'large_expense'";
    else                      bankWhere = "t.debit > 0 AND t.is_credit_card = 0 AND (t.tag IS NULL OR t.tag = '')";
    const bankParams = [];

    if (monthId !== null) { bankWhere += ' AND t.period_id = ?'; bankParams.push(monthId); }
    if (isCategory) {
      bankWhere += " AND COALESCE(mc.category,'other') = ?";
      bankParams.push(filter);
    }

    const bankRows = db.prepare(`
      SELECT t.id,
             'bank'            AS type,
             t.date,
             t.description     AS merchant,
             t.debit           AS amount,
             COALESCE(mc.category,'other') AS category
      FROM transactions t
      LEFT JOIN merchant_categories mc ON mc.merchant_name = t.description
      WHERE ${bankWhere}
      ORDER BY t.date DESC
    `).all(...bankParams);

    let results = [...bankRows];

    // --- CC transactions: category filters AND special filter ---
    if (isCategory || filter === 'special') {
      let ccWhere = filter === 'special'
        ? "cct.tag = 'large_expense'"
        : "(cct.tag IS NULL OR cct.tag = '') AND COALESCE(mc.category,'other') = ?";
      const ccParams = filter === 'special' ? [] : [filter];

      if (monthId !== null) { ccWhere += ' AND cct.period_id = ?'; ccParams.push(monthId); }
      if (filter !== 'special' && owner !== 'both') { ccWhere += ' AND cct.owner = ?'; ccParams.push(owner); }

      const ccRows = db.prepare(`
        SELECT cct.id,
               'cc'            AS type,
               cct.date,
               cct.merchant,
               cct.amount,
               COALESCE(mc.category,'other') AS category
        FROM credit_card_transactions cct
        LEFT JOIN merchant_categories mc ON mc.merchant_name = cct.merchant
        WHERE ${ccWhere}
        ORDER BY cct.date DESC
      `).all(...ccParams);

      results = [...results, ...ccRows];
    }

    // Merge and sort newest-first
    results.sort((a, b) => b.date.localeCompare(a.date));

    res.json(results);
  } catch (err) {
    console.error('Drill-down error:', err);
    res.status(500).json({ error: 'Failed to fetch drill-down transactions' });
  }
});

module.exports = router;
