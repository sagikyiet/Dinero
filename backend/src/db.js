// Uses the built-in node:sqlite module (available since Node.js v22.5.0)
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'dinero.db');

let _db;

function getDb() {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec('PRAGMA journal_mode = WAL');
    _db.exec('PRAGMA foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS months (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      savings REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(year, month)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
      bank TEXT NOT NULL,
      date TEXT NOT NULL,
      value_date TEXT,
      description TEXT,
      reference TEXT,
      debit REAL,
      credit REAL,
      balance REAL,
      note TEXT,
      is_special INTEGER DEFAULT 0,
      special_note TEXT DEFAULT '',
      is_credit_card INTEGER DEFAULT 0,
      credit_card_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS card_owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credit_card_name TEXT NOT NULL,
      bank TEXT NOT NULL,
      owner TEXT NOT NULL DEFAULT 'joint',
      UNIQUE(credit_card_name, bank)
    );

    CREATE TABLE IF NOT EXISTS tag_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL UNIQUE,
      day_of_month INTEGER NOT NULL,
      tag TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_month_id ON transactions(month_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_months_year_month ON months(year, month);
  `);

  // Migrations for existing databases
  try { db.exec(`ALTER TABLE transactions ADD COLUMN tag TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE months ADD COLUMN leumi_filename TEXT DEFAULT ''`); } catch (_) {}
  try { db.exec(`ALTER TABLE months ADD COLUMN hapoalim_filename TEXT DEFAULT ''`); } catch (_) {}
  try { db.exec(`ALTER TABLE months ADD COLUMN leumi_filepath TEXT DEFAULT ''`); } catch (_) {}
  try { db.exec(`ALTER TABLE months ADD COLUMN hapoalim_filepath TEXT DEFAULT ''`); } catch (_) {}
}

module.exports = { getDb };
