import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Render persistent disk at /data; fallback to local ./data for development
const DATA_DIR = fs.existsSync("/data") ? "/data" : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "users.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    credentials TEXT NOT NULL,
    institution TEXT,
    role TEXT DEFAULT 'pharmacist',
    status TEXT DEFAULT 'pending',
    agreed_disclaimer INTEGER DEFAULT 0,
    agreed_terms INTEGER DEFAULT 0,
    confirmed_hcp INTEGER DEFAULT 0,
    confirmed_age INTEGER DEFAULT 0,
    disclaimer_version TEXT,
    terms_version TEXT,
    agreement_timestamp TEXT,
    agreement_ip TEXT,
    first_login_acknowledged INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    approved_at TEXT,
    approved_by TEXT,
    last_login TEXT
  );
`);

export default db;

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  credentials: string;
  institution: string | null;
  role: string;
  status: string;
  agreed_disclaimer: number;
  agreed_terms: number;
  confirmed_hcp: number;
  confirmed_age: number;
  disclaimer_version: string | null;
  terms_version: string | null;
  agreement_timestamp: string | null;
  agreement_ip: string | null;
  first_login_acknowledged: number;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  last_login: string | null;
}

export function findUserByLogin(usernameOrEmail: string): UserRow | undefined {
  return db.prepare(
    "SELECT * FROM users WHERE username = ? OR email = ?"
  ).get(usernameOrEmail, usernameOrEmail) as UserRow | undefined;
}

export function findUserById(id: number): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function findUserByUsername(username: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
}

export function findUserByEmail(email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

export function updateLastLogin(id: number) {
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(id);
}

export function setFirstLoginAcknowledged(id: number) {
  db.prepare("UPDATE users SET first_login_acknowledged = 1 WHERE id = ?").run(id);
}

export function approveUser(id: number, approvedBy: string) {
  db.prepare("UPDATE users SET status = 'active', approved_at = datetime('now'), approved_by = ? WHERE id = ?").run(approvedBy, id);
}

export function disableUser(id: number) {
  db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(id);
}

export function listPendingUsers(): UserRow[] {
  return db.prepare("SELECT * FROM users WHERE status = 'pending' ORDER BY created_at DESC").all() as UserRow[];
}

export function listActiveUsers(): UserRow[] {
  return db.prepare("SELECT * FROM users WHERE status = 'active' ORDER BY last_login DESC").all() as UserRow[];
}
