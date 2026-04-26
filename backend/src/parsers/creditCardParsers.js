const XLSX = require('xlsx');
const { parseIsracard, detectIsracard } = require('./isracard');
const { parseMax, detectMax } = require('./max');

// Registry: add a new entry here to support a new credit card company.
// Each entry must implement detect(workbook) → bool and parse(buffer) → transaction[].
const PARSERS = [
  { company: 'isracard', label: 'ישראכרט', detect: detectIsracard, parse: parseIsracard },
  { company: 'max',      label: 'מקס',     detect: detectMax,      parse: parseMax      },
];

function autoDetect(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  for (const parser of PARSERS) {
    if (parser.detect(workbook)) return parser;
  }
  return null;
}

module.exports = { PARSERS, autoDetect };
