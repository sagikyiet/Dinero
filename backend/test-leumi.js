const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = 'C:\\Users\\sagik\\OneDrive\\קריירה\\פרויקטים\\Dinero\\backend\\uploads\\leumi-debug.xlsx';

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

const buffer = fs.readFileSync(filePath);
const workbook = XLSX.read(buffer, { type: 'buffer', raw: false, cellDates: false });

console.log('Sheet names:', workbook.SheetNames);

const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });

console.log(`Total rows: ${rows.length}\n`);

// Print row 0 with full unicode inspection
const headerRow = rows[0] || [];
console.log('\n=== ROW 0 HEADER CELLS (unicode detail) ===');
headerRow.forEach((cell, i) => {
  const str = String(cell ?? '');
  const hex = Buffer.from(str, 'utf8').toString('hex');
  const codepoints = [...str].map(c => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}`).join(' ');
  console.log(`  col ${i}: ${JSON.stringify(str)}`);
  console.log(`         codepoints: ${codepoints}`);
  console.log(`         hex: ${hex}`);
});

console.log('\n=== ALL ROWS ===');
rows.forEach((row, i) => {
  const cells = (row || []).map(c => JSON.stringify(c));
  console.log(`Row ${i}: [${cells.join(', ')}]`);
});
