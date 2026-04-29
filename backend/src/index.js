const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const uploadRoutes = require('./routes/upload');
const transactionsRoutes = require('./routes/transactions');
const monthsRoutes = require('./routes/months');
const tagRulesRoutes = require('./routes/tagRules');
const cardOwnersRoutes = require('./routes/cardOwners');
const creditCardsRoutes = require('./routes/creditCards');
const categorizeRoutes = require('./routes/categorize');
const insightsRoutes = require('./routes/insights');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads dir exists (used by multer even with memoryStorage as a fallback)
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors({ origin: 'http://localhost:5173' }));

// Read JSON bodies as a raw buffer and decode explicitly as UTF-8.
// This prevents PowerShell and other clients from corrupting Hebrew/non-ASCII
// characters when the Content-Type charset header is missing or wrong.
app.use(express.raw({ type: 'application/json' }));
app.use((req, _res, next) => {
  if (Buffer.isBuffer(req.body)) {
    try {
      req.body = JSON.parse(req.body.toString('utf8'));
    } catch {
      req.body = {};
    }
  }
  next();
});

app.use('/api/upload', uploadRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/months', monthsRoutes);
app.use('/api/tag-rules', tagRulesRoutes);
app.use('/api/card-owners', cardOwnersRoutes);
app.use('/api/credit-cards', creditCardsRoutes);
app.use('/api/categorize', categorizeRoutes);
app.use('/api/insights', insightsRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', name: 'Dinero', version: '1.0.0' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Dinero backend running at http://localhost:${PORT}\n`);
});
