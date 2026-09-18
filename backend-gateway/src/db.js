const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "app.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fullName TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  phoneNumber TEXT,
  role TEXT NOT NULL CHECK(role IN ('APPL','OFF','ADM')) DEFAULT 'APPL',
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicantId INTEGER NOT NULL REFERENCES users(id),
  loanAmount REAL NOT NULL,
  tenureMonths INTEGER NOT NULL,
  loanPurpose TEXT,
  age INTEGER,
  statedMonthlyIncome REAL,
  existingMonthlyDebt REAL,
  numDependents INTEGER DEFAULT 0,
  numOpenCreditLines INTEGER DEFAULT 5,
  numRealEstateLoans INTEGER DEFAULT 0,
  isTampered INTEGER,
  tamperConfidence REAL,
  anomaliesDetected TEXT,
  isMathConsistent INTEGER,
  openingBalance REAL,
  closingBalance REAL,
  averageMonthlyBalance REAL,
  verifiedMonthlyIncome REAL,
  calculatedDTI REAL,
  creditScore INTEGER,
  riskBand TEXT,
  recommendation TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','PROCESSING','UNDER_REVIEW','PRE_APPROVED','REJECTED')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicationId INTEGER NOT NULL REFERENCES applications(id),
  docType TEXT NOT NULL CHECK(docType IN ('BANK_STATEMENT','PAYSLIP','TAX_RETURN')),
  fileName TEXT NOT NULL,
  storageKey TEXT NOT NULL,
  mimeType TEXT,
  elaHeatmapBase64 TEXT,
  uploadedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ledger_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicationId INTEGER NOT NULL REFERENCES applications(id),
  documentId INTEGER REFERENCES documents(id),
  txnDate TEXT,
  description TEXT,
  credit REAL DEFAULT 0,
  debit REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  expectedBalance REAL DEFAULT 0,
  isMathDrift INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicationId INTEGER NOT NULL REFERENCES applications(id),
  reviewedBy INTEGER REFERENCES users(id),
  actionTaken TEXT NOT NULL,
  evidenceHash TEXT,
  notes TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

module.exports = db;
