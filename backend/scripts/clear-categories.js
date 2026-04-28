const { getDb } = require('../src/db');

const db = getDb();
const result = db.prepare('DELETE FROM merchant_categories').run();
console.log(`Deleted ${result.changes} row(s) from merchant_categories.`);
