const express = require('express');
const { categorizeMerchant, CATEGORIES } = require('../categorization');
const { getDb } = require('../db');

const router = express.Router();

router.post('/', async (req, res) => {
  const { merchantName } = req.body;

  console.log(`[categorize] received merchantName: "${merchantName}"`);

  if (!merchantName || typeof merchantName !== 'string' || !merchantName.trim()) {
    return res.status(400).json({ error: 'merchantName is required' });
  }

  try {
    const category = await categorizeMerchant(merchantName.trim());
    res.json({ category });
  } catch (err) {
    console.error('Categorization error:', err);
    res.status(500).json({ error: 'Failed to categorize merchant' });
  }
});

router.post('/override', (req, res) => {
  const { merchantName, category } = req.body;

  if (!merchantName || typeof merchantName !== 'string' || !merchantName.trim()) {
    return res.status(400).json({ error: 'merchantName is required' });
  }
  if (!category || !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  }

  try {
    const db = getDb();
    db.prepare(
      'INSERT OR REPLACE INTO merchant_categories (merchant_name, category) VALUES (?, ?)'
    ).run(merchantName.trim(), category);
    res.json({ category });
  } catch (err) {
    console.error('Category override error:', err);
    res.status(500).json({ error: 'Failed to save category override' });
  }
});

module.exports = router;
