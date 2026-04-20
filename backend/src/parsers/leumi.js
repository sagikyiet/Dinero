const XLSX = require('xlsx');
const { detectCreditCard } = require('./detect');

// Map Hebrew column headers to field names
const HEADER_MAP = {
  'תאריך': 'date',
  'תאריך ערך': 'value_date',
  'תיאור': 'description',
  'אסמכתא': 'reference',
  'חובה': 'debit',
  'בחובה': 'debit',
  'זכות': 'credit',
  'בזכות': 'credit',
  'היתרה בש"ח': 'balance',
  'יתרה בש"ח': 'balance',
  'הערה': 'note',
};

function parseLeumi(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false, cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

  console.log('[leumi] total rows:', rows.length);
  console.log('[leumi] first 20 rows:');
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    const cells = (row || []).map(c => JSON.stringify(c));
    console.log(`  row ${i}: [${cells.join(', ')}]`);
  }

  // Find the header row by looking for תאריך
  let headerRowIndex = -1;
  let colMap = {}; // fieldName -> colIndex

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const cells = row.map(c => String(c ?? '').replace(/[\u00a0\s]+/g, ' ').trim());
    if (cells.includes('תאריך')) {
      headerRowIndex = i;
      cells.forEach((cell, idx) => {
        if (HEADER_MAP[cell]) colMap[HEADER_MAP[cell]] = idx;
      });
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('לא נמצאה שורת כותרות בקובץ בנק לאומי. ודא שהקובץ תקין ומכיל עמודת תאריך.');
  }

  console.log('[leumi] header row index:', headerRowIndex, '| colMap:', colMap);
  console.log('[leumi] total rows:', rows.length, '| data rows to scan:', rows.length - headerRowIndex - 1);

  const transactions = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const rawDate = getCell(row, colMap.date);
    const date = normalizeDate(rawDate);
    const description = getCell(row, colMap.description);
    const debit = parseAmount(getCell(row, colMap.debit));
    const credit = parseAmount(getCell(row, colMap.credit));

    console.log(`[leumi] row ${i}: rawDate=${JSON.stringify(rawDate)} date=${date} desc=${JSON.stringify(description)} debit=${debit} credit=${credit}`);

    if (!date) continue;

    // Skip rows with no financial data
    if (debit === null && credit === null) continue;

    const creditCardName = detectCreditCard(description);

    transactions.push({
      bank: 'leumi',
      date,
      value_date: normalizeDate(getCell(row, colMap.value_date)),
      description,
      reference: getCell(row, colMap.reference),
      debit,
      credit,
      balance: parseAmount(getCell(row, colMap.balance)),
      note: getCell(row, colMap.note),
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
  // Remove commas, RTL marks, spaces, and handle negative signs
  const cleaned = String(val)
    .replace(/[\u200e\u200f\u202a-\u202e]/g, '') // Remove bidi marks
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .replace(/−/g, '-'); // Unicode minus
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.abs(num); // Store as positive; debit/credit columns indicate direction
}

function normalizeDate(val) {
  if (!val) return null;
  const str = String(val).trim().replace(/[\u200e\u200f]/g, '');

  // DD/MM/YYYY
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;

  // M/D/YY (e.g. "4/7/26" from Leumi — treat YY as 20YY)
  const m1b = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m1b) {
    const year = `20${m1b[3]}`;
    return `${year}-${m1b[1].padStart(2, '0')}-${m1b[2].padStart(2, '0')}`;
  }

  // DD.MM.YYYY
  const m2 = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Excel serial date (integer string like "45000")
  if (/^\d{4,6}$/.test(str)) {
    try {
      const d = XLSX.SSF.parse_date_code(parseInt(str));
      if (d && d.y > 1900) {
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
    } catch (_) {}
  }

  return null;
}

module.exports = { parseLeumi };
