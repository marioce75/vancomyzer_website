import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Render persistent disk at /data; fallback to local ./data for development
const DATA_DIR = fs.existsSync("/data") ? "/data" : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "users.db");

// ---------------------------------------------------------------------------
// Lazy singleton — avoids "database is locked" during Next.js build
// ---------------------------------------------------------------------------

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");

  // Initialize schema
  _db.exec(`
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
      last_login TEXT,
      session_token TEXT
    );
  `);

  // Add columns if upgrading from older schema
  try { _db.exec("ALTER TABLE users ADD COLUMN session_token TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN reset_token TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN reset_token_expires TEXT"); } catch { /* exists */ }

  // SOC 2 columns: MFA + account lockout
  try { _db.exec("ALTER TABLE users ADD COLUMN mfa_secret TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN mfa_verified_at TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN locked_until TEXT"); } catch { /* exists */ }

  // Security audit log (append-only)
  _db.exec(`
    CREATE TABLE IF NOT EXISTS security_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      details TEXT DEFAULT '{}',
      severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'error', 'critical'))
    );
    CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp ON security_audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_security_audit_action ON security_audit_log(action);
  `);

  return _db;
}

// Default export for direct db access (e.g., db.prepare(...))
export default new Proxy({} as Database.Database, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

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
  // SOC 2 fields
  mfa_secret: string | null;
  mfa_enabled: number;
  mfa_verified_at: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
}

export function findUserByLogin(usernameOrEmail: string): UserRow | undefined {
  return getDb().prepare(
    "SELECT * FROM users WHERE username = ? OR email = ?"
  ).get(usernameOrEmail, usernameOrEmail) as UserRow | undefined;
}

export function findUserById(id: number): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function findUserByUsername(username: string): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
}

export function findUserByEmail(email: string): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

export function updateLastLogin(id: number, sessionToken?: string) {
  if (sessionToken) {
    getDb().prepare("UPDATE users SET last_login = datetime('now'), session_token = ? WHERE id = ?").run(sessionToken, id);
  } else {
    getDb().prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(id);
  }
}

export function getSessionToken(id: number): string | null {
  const row = getDb().prepare("SELECT session_token FROM users WHERE id = ?").get(id) as { session_token: string | null } | undefined;
  return row?.session_token ?? null;
}

export function clearSessionToken(id: number) {
  getDb().prepare("UPDATE users SET session_token = NULL WHERE id = ?").run(id);
}

export function setFirstLoginAcknowledged(id: number) {
  getDb().prepare("UPDATE users SET first_login_acknowledged = 1 WHERE id = ?").run(id);
}

export function setResetToken(id: number, token: string, expiresAt: string) {
  getDb().prepare("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?").run(token, expiresAt, id);
}

export function findUserByResetToken(token: string): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > datetime('now')").get(token) as UserRow | undefined;
}

export function clearResetToken(id: number) {
  getDb().prepare("UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?").run(id);
}

export function updatePassword(id: number, passwordHash: string) {
  getDb().prepare("UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?").run(passwordHash, id);
}

export function approveUser(id: number, approvedBy: string) {
  getDb().prepare("UPDATE users SET status = 'active', approved_at = datetime('now'), approved_by = ? WHERE id = ?").run(approvedBy, id);
}

export function disableUser(id: number) {
  getDb().prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(id);
}

export function listPendingUsers(): UserRow[] {
  return getDb().prepare("SELECT * FROM users WHERE status = 'pending' ORDER BY created_at DESC").all() as UserRow[];
}

export function listActiveUsers(): UserRow[] {
  return getDb().prepare("SELECT * FROM users WHERE status = 'active' ORDER BY last_login DESC").all() as UserRow[];
}

export function listAllUsers(): UserRow[] {
  return getDb().prepare("SELECT * FROM users ORDER BY created_at DESC").all() as UserRow[];
}

// ---------------------------------------------------------------------------
// Account Lockout (SOC 2 A2)
// ---------------------------------------------------------------------------

export function incrementFailedLogins(id: number): number {
  getDb().prepare("UPDATE users SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1 WHERE id = ?").run(id);
  const row = getDb().prepare("SELECT failed_login_attempts FROM users WHERE id = ?").get(id) as { failed_login_attempts: number } | undefined;
  return row?.failed_login_attempts ?? 0;
}

export function resetFailedLogins(id: number) {
  getDb().prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?").run(id);
}

export function lockAccount(id: number, minutes: number) {
  const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  getDb().prepare("UPDATE users SET locked_until = ? WHERE id = ?").run(until, id);
}

export function isAccountLocked(id: number): boolean {
  const row = getDb().prepare("SELECT locked_until FROM users WHERE id = ?").get(id) as { locked_until: string | null } | undefined;
  if (!row?.locked_until) return false;
  return new Date(row.locked_until) > new Date();
}

export function unlockAccount(id: number) {
  getDb().prepare("UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// MFA (SOC 2 A1)
// ---------------------------------------------------------------------------

export function setMfaSecret(id: number, secret: string) {
  getDb().prepare("UPDATE users SET mfa_secret = ? WHERE id = ?").run(secret, id);
}

export function enableMfa(id: number) {
  getDb().prepare("UPDATE users SET mfa_enabled = 1, mfa_verified_at = datetime('now') WHERE id = ?").run(id);
}

export function disableMfa(id: number) {
  getDb().prepare("UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, mfa_verified_at = NULL WHERE id = ?").run(id);
}

export function setMfaVerifiedAt(id: number) {
  getDb().prepare("UPDATE users SET mfa_verified_at = datetime('now') WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Security Audit Log (SOC 2 A4) — append-only
// ---------------------------------------------------------------------------

export function logSecurityEvent(event: {
  user_id?: number | null;
  username?: string | null;
  action: string;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: string;
  severity?: "info" | "warn" | "error" | "critical";
}) {
  getDb().prepare(`INSERT INTO security_audit_log (user_id, username, action, ip_address, user_agent, details, severity)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    event.user_id ?? null,
    event.username ?? null,
    event.action,
    event.ip_address ?? null,
    event.user_agent ?? null,
    event.details ?? "{}",
    event.severity ?? "info"
  );
}

export interface SecurityAuditRow {
  id: number;
  timestamp: string;
  user_id: number | null;
  username: string | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  details: string;
  severity: string;
}

export function getSecurityEvents(limit = 200): SecurityAuditRow[] {
  return getDb().prepare("SELECT * FROM security_audit_log ORDER BY timestamp DESC LIMIT ?").all(limit) as SecurityAuditRow[];
}

export function getSecuritySummary() {
  const total = (getDb().prepare("SELECT COUNT(*) as cnt FROM security_audit_log").get() as { cnt: number }).cnt;
  const failedLogins24h = (getDb().prepare(
    "SELECT COUNT(*) as cnt FROM security_audit_log WHERE action = 'LOGIN_FAILED' AND timestamp > datetime('now', '-1 day')"
  ).get() as { cnt: number }).cnt;
  const lockedAccounts = (getDb().prepare(
    "SELECT COUNT(*) as cnt FROM users WHERE locked_until IS NOT NULL AND locked_until > datetime('now')"
  ).get() as { cnt: number }).cnt;
  const lastEvent = getDb().prepare("SELECT * FROM security_audit_log ORDER BY timestamp DESC LIMIT 1").get() as SecurityAuditRow | undefined;

  return { total, failedLogins24h, lockedAccounts, lastEvent };
}
