const XLSX = require('xlsx');

const HEADER_MAP = {
  'תאריך עסקה': 'date',
  'שם בית העסק': 'merchant',
  'קטגוריה': 'category',
  '4 ספרות אחרונות של כרטיס האשראי': 'card_last4',
  'סכום חיוב': 'amount',
  'מטבע חיוב': 'currency',
  'סכום עסקה מקורי': 'original_amount',
  'מטבע עסקה מקורי': 'original_currency',
  'תאריך חיוב': 'charge_date',
  'הערות': 'notes',
};

// Match both ASCII quotes and Hebrew gereshayim (״)
const SHEET_PATTERNS = [
  'עסקאות במועד החיוב',
  'עסקאות חו"ל ומט"ח',
  'עסקאות חו״ל ומט״ח', // with gereshayim
];

function detectMax(workbook) {
  return workbook.SheetNames.some(s => SHEET_PATTERNS.includes(s));
}

function parseMax(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false, cellDates: false });
  const transactions = [];

  const sheetsToProcess = workbook.SheetNames.filter(s => SHEET_PATTERNS.includes(s));

  for (const sheetName of sheetsToProcess) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

    let headerRowIndex = -1;
    let colMap = {};

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      const cells = row.map(c => normalizeCell(c));
      if (cells.includes('תאריך עסקה')) {
        headerRowIndex = i;
        cells.forEach((cell, idx) => {
          if (HEADER_MAP[cell]) colMap[HEADER_MAP[cell]] = idx;
        });
        break;
      }
    }

    if (headerRowIndex === -1) continue;

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;

      const rawDate = getCell(row, colMap.date);
      if (!rawDate) continue;

      // Skip summary / totals rows
      const nd = normalizeCell(rawDate);
      if (nd.startsWith('סך') || nd === '') continue;

      const date = normalizeMaxDate(rawDate);
      if (!date) continue;

      const amount = parseAmount(getCell(row, colMap.amount));
      const originalAmount = parseAmount(getCell(row, colMap.original_amount));
      if (amount === null && originalAmount === null) continue;

      transactions.push({
        date,
        merchant: getCell(row, colMap.merchant),
        amount: amount ?? originalAmount,
        currency: getCell(row, colMap.currency) || 'ILS',
        original_amount: originalAmount,
        original_currency: getCell(row, colMap.original_currency),
        category: null,
        card_last4: getCell(row, colMap.card_last4),
        source_company: 'max',
        notes: getCell(row, colMap.notes),
        month_key: date.slice(0, 7),
      });
    }
  }

  return transactions;
}

function normalizeCell(c) {
  return String(c ?? '').replace(/[‎‏‪-‮ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getCell(row, colIdx) {
  if (colIdx === undefined || colIdx === null) return null;
  const val = row[colIdx];
  if (val === null || val === undefined) return null;
  const str = String(val).trim().replace(/[‎‏‪-‮]/g, '');
  return str === '' ? null : str;
}

function parseAmount(val) {
  if (val === null || val === undefined) return null;
  const cleaned = String(val)
    .replace(/[‎‏‪-‮]/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .replace(/−/g, '-');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.abs(num);
}

// DD-MM-YYYY → YYYY-MM-DD  (primary Max format)
function normalizeMaxDate(val) {
  if (!val) return null;
  const str = String(val).trim().replace(/[‎‏]/g, '');

  const m1 = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;

  const m2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  return null;
}

module.exports = { parseMax, detectMax };
