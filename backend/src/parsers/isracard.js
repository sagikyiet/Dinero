const XLSX = require('xlsx');

const HEADER_MAP = {
  'תאריך רכישה': 'date',
  'שם בית עסק': 'merchant',
  'סכום עסקה': 'original_amount',
  'מטבע עסקה': 'original_currency',
  'סכום חיוב': 'amount',
  'מטבע חיוב': 'currency',
  "מס' שובר": 'voucher',
  'פירוט נוסף': 'notes',
};

function detectIsracard(workbook) {
  return workbook.SheetNames.some(s => normalizeCell(s) === 'פירוט עסקאות');
}

function parseIsracard(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false, cellDates: false });
  const sheetName = workbook.SheetNames.find(s => normalizeCell(s) === 'פירוט עסקאות');
  if (!sheetName) throw new Error('לא נמצא גיליון "פירוט עסקאות" בקובץ ישראכרט');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

  let headerRowIndex = -1;
  let colMap = {};

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const cells = row.map(c => normalizeCell(c));
    if (cells.includes('תאריך רכישה')) {
      headerRowIndex = i;
      cells.forEach((cell, idx) => {
        if (HEADER_MAP[cell]) colMap[HEADER_MAP[cell]] = idx;
      });
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('לא נמצאה שורת כותרות בקובץ ישראכרט. ודא שהקובץ מכיל עמודת "תאריך רכישה".');
  }

  const transactions = [];
  let currentCard4 = null;

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const rawDate = getCell(row, colMap.date);
    if (!rawDate) {
      // Detect card section header rows (contain a 4-digit card suffix)
      const rowText = row.map(c => String(c ?? '')).join(' ');
      const m = rowText.match(/(\d{4})\s*(?:\*|\s|$)/);
      if (m) currentCard4 = m[1];
      continue;
    }

    const date = normalizeIsracardDate(rawDate);
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
      card_last4: currentCard4,
      source_company: 'isracard',
      notes: getCell(row, colMap.notes),
      month_key: date.slice(0, 7),
    });
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

// DD.MM.YY → YYYY-MM-DD  (primary Isracard format)
function normalizeIsracardDate(val) {
  if (!val) return null;
  const str = String(val).trim().replace(/[‎‏]/g, '');

  const m1 = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (m1) return `20${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;

  const m2 = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const m3 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m3) return `${m3[3]}-${m3[2].padStart(2, '0')}-${m3[1].padStart(2, '0')}`;

  return null;
}

module.exports = { parseIsracard, detectIsracard };
