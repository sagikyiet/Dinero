const XLSX = require('xlsx');
const { detectCreditCard } = require('./detect');

const HEADER_MAP = {
  'תאריך': 'date',
  'תאריך ערך': 'value_date',
  'הפעולה': 'operation',
  'פרטים': 'description',
  'אסמכתא': 'reference',
  'חובה': 'debit',
  'זכות': 'credit',
  'יתרה בש"ח': 'balance',
  'היתרה בש"ח': 'balance',
  'לטובת': 'beneficiary',
  'עבור': 'for',
};

function parseHapoalim(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false, cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

  // Find the header row
  let headerRowIndex = -1;
  let colMap = {};

  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const cells = row.map(c => String(c ?? '').trim());
    if (cells.includes('חובה') && cells.includes('זכות')) {
      headerRowIndex = i;
      cells.forEach((cell, idx) => {
        if (HEADER_MAP[cell]) colMap[HEADER_MAP[cell]] = idx;
      });
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('לא נמצאה שורת כותרות בקובץ בנק הפועלים. ודא שהקובץ תקין ומכיל עמודות חובה וזכות.');
  }

  const transactions = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const date = normalizeDate(getCell(row, colMap.date));
    if (!date) continue;

    // Hapoalim uses 'פרטים' for details; fall back to 'operation'
    const details = getCell(row, colMap.description);
    const operation = getCell(row, colMap.operation);
    const beneficiary = getCell(row, colMap.beneficiary);
    const forField = getCell(row, colMap.for);

    // Build a combined description
    const descParts = [details, operation, beneficiary, forField].filter(Boolean);
    const description = descParts[0] ?? null; // Primary: פרטים
    const fullDescription = descParts.join(' | ') || null;

    const debit = parseAmount(getCell(row, colMap.debit));
    const credit = parseAmount(getCell(row, colMap.credit));

    if (debit === null && credit === null) continue;

    const creditCardName = detectCreditCard(fullDescription);

    transactions.push({
      bank: 'hapoalim',
      date,
      value_date: normalizeDate(getCell(row, colMap.value_date)),
      description: fullDescription || description,
      reference: getCell(row, colMap.reference),
      debit,
      credit,
      balance: parseAmount(getCell(row, colMap.balance)),
      note: null,
      is_credit_card: creditCardName ? 1 : 0,
      credit_card_name: creditCardName,
    });
  }

  return transactions;
}

function getCell(row, colIdx) {
  if (colIdx === undefined || colIdx === null) return null;
  const val = row[colIdx];
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  return str === '' ? null : str;
}

function parseAmount(val) {
  if (val === null || val === undefined) return null;
  const cleaned = String(val)
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .replace(/−/g, '-');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.abs(num);
}

function normalizeDate(val) {
  if (!val) return null;
  const str = String(val).trim().replace(/[\u200e\u200f]/g, '');

  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;

  const m2 = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  if (/^\d{4,6}$/.test(str)) {
    try {
      const XLSX = require('xlsx');
      const d = XLSX.SSF.parse_date_code(parseInt(str));
      if (d && d.y > 1900) {
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
    } catch (_) {}
  }

  return null;
}

module.exports = { parseHapoalim };
