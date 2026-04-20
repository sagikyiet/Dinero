// Detect Israeli credit card company names in transaction descriptions
const CREDIT_CARD_PATTERNS = [
  { pattern: /מקס|max[\s-]?it/i, name: 'מקס' },
  { pattern: /מסטרקרד|mastercard/i, name: 'מסטרקרד' },
  { pattern: /ישראכרט|isracard/i, name: 'ישראכרט' },
  { pattern: /כ\.?א\.?ל\.?|^כאל\b/i, name: 'כאל' },
  { pattern: /לאומי[\s-]?קארד/i, name: 'לאומי קארד' },
  { pattern: /אמריקן[\s-]?אקספרס|american[\s-]?express/i, name: 'אמריקן אקספרס' },
  { pattern: /דיינרס|diners/i, name: "דיינרס" },
  { pattern: /ויזה\s*כאל|visa\s*cal/i, name: 'ויזה כאל' },
];

function detectCreditCard(description) {
  if (!description) return null;
  for (const { pattern, name } of CREDIT_CARD_PATTERNS) {
    if (pattern.test(description)) {
      return name;
    }
  }
  return null;
}

module.exports = { detectCreditCard };
