import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { isPaidTier as tierIsPaid, normalizeTier, type TierId } from "./tiers";

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

  // Subscription tier columns
  try { _db.exec("ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free'"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'active'"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN subscription_expiry TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN institutional_account_id INTEGER"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN institutional_role TEXT DEFAULT 'user'"); } catch { /* exists */ }

  // Institutional accounts table
  _db.exec(`
    CREATE TABLE IF NOT EXISTS institutional_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_name TEXT NOT NULL,
      billing_email TEXT NOT NULL,
      plan_tier TEXT NOT NULL DEFAULT 'department' CHECK (plan_tier IN ('department', 'hospital', 'enterprise')),
      seats_allocated INTEGER NOT NULL DEFAULT 20,
      seats_used INTEGER NOT NULL DEFAULT 0,
      subscription_start TEXT NOT NULL DEFAULT (datetime('now')),
      subscription_expiry TEXT,
      baa_status TEXT DEFAULT 'not_requested' CHECK (baa_status IN ('not_requested', 'pending', 'active')),
      baa_requested_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Calculation log (no patient identifiers)
  _db.exec(`
    CREATE TABLE IF NOT EXISTS calculation_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      institutional_account_id INTEGER,
      calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
      workflow_type TEXT NOT NULL,
      pk_model TEXT NOT NULL DEFAULT 'colin_2019',
      obesity_model_active INTEGER DEFAULT 0,
      bmi_above_40 INTEGER DEFAULT 0,
      dose_mg INTEGER,
      interval_hours INTEGER,
      auc24 REAL,
      peak REAL,
      trough REAL,
      auc_in_range INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_calc_log_user ON calculation_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_calc_log_inst ON calculation_log(institutional_account_id);
    CREATE INDEX IF NOT EXISTS idx_calc_log_date ON calculation_log(calculated_at);
  `);

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
  // Subscription fields
  subscription_tier: TierId;
  subscription_status: "active" | "expired" | "trial" | "cancelled";
  subscription_expiry: string | null;
  institutional_account_id: number | null;
  institutional_role: "user" | "admin";
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

// ---------------------------------------------------------------------------
// Subscription Tier Helpers
// ---------------------------------------------------------------------------

export function getUserTier(userId: number): TierId {
  const row = getDb().prepare("SELECT subscription_tier FROM users WHERE id = ?").get(userId) as { subscription_tier: string } | undefined;
  return normalizeTier(row?.subscription_tier);
}

export function isPaidTier(tier: string): boolean {
  return tierIsPaid(tier);
}

export function setUserTier(userId: number, tier: string, expiry?: string) {
  getDb().prepare("UPDATE users SET subscription_tier = ?, subscription_expiry = ? WHERE id = ?").run(tier, expiry ?? null, userId);
}

export function setUserInstitution(userId: number, institutionalAccountId: number, role: string = "user") {
  getDb().prepare("UPDATE users SET institutional_account_id = ?, institutional_role = ? WHERE id = ?").run(institutionalAccountId, role, userId);
}

// ---------------------------------------------------------------------------
// Institutional Accounts
// ---------------------------------------------------------------------------

export interface InstitutionalAccountRow {
  id: number;
  institution_name: string;
  billing_email: string;
  plan_tier: string;
  seats_allocated: number;
  seats_used: number;
  subscription_start: string;
  subscription_expiry: string | null;
  baa_status: string;
  baa_requested_at: string | null;
  created_at: string;
}

export function createInstitutionalAccount(account: Omit<InstitutionalAccountRow, "id" | "seats_used" | "created_at">): number {
  const result = getDb().prepare(`INSERT INTO institutional_accounts
    (institution_name, billing_email, plan_tier, seats_allocated, subscription_start, subscription_expiry, baa_status)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    account.institution_name, account.billing_email, account.plan_tier,
    account.seats_allocated, account.subscription_start, account.subscription_expiry,
    account.baa_status ?? "not_requested"
  );
  return Number(result.lastInsertRowid);
}

export function getInstitutionalAccount(id: number): InstitutionalAccountRow | undefined {
  return getDb().prepare("SELECT * FROM institutional_accounts WHERE id = ?").get(id) as InstitutionalAccountRow | undefined;
}

export function listInstitutionalAccounts(): InstitutionalAccountRow[] {
  return getDb().prepare("SELECT * FROM institutional_accounts ORDER BY created_at DESC").all() as InstitutionalAccountRow[];
}

export function updateBaaStatus(id: number, status: string) {
  getDb().prepare("UPDATE institutional_accounts SET baa_status = ?, baa_requested_at = CASE WHEN ? = 'pending' THEN datetime('now') ELSE baa_requested_at END WHERE id = ?").run(status, status, id);
}

export function getInstitutionUsers(institutionalAccountId: number): UserRow[] {
  return getDb().prepare("SELECT * FROM users WHERE institutional_account_id = ?").all(institutionalAccountId) as UserRow[];
}

export function recountSeats(institutionalAccountId: number) {
  const count = (getDb().prepare("SELECT COUNT(*) as cnt FROM users WHERE institutional_account_id = ?").get(institutionalAccountId) as { cnt: number }).cnt;
  getDb().prepare("UPDATE institutional_accounts SET seats_used = ? WHERE id = ?").run(count, institutionalAccountId);
}

// ---------------------------------------------------------------------------
// Calculation Log (no patient identifiers)
// ---------------------------------------------------------------------------

export interface CalcLogEntry {
  id: number;
  user_id: number;
  institutional_account_id: number | null;
  calculated_at: string;
  workflow_type: string;
  pk_model: string;
  obesity_model_active: number;
  bmi_above_40: number;
  dose_mg: number | null;
  interval_hours: number | null;
  auc24: number | null;
  peak: number | null;
  trough: number | null;
  auc_in_range: number;
}

export function logCalculationEntry(entry: Omit<CalcLogEntry, "id" | "calculated_at">) {
  getDb().prepare(`INSERT INTO calculation_log
    (user_id, institutional_account_id, workflow_type, pk_model, obesity_model_active,
     bmi_above_40, dose_mg, interval_hours, auc24, peak, trough, auc_in_range)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    entry.user_id, entry.institutional_account_id, entry.workflow_type,
    entry.pk_model, entry.obesity_model_active, entry.bmi_above_40,
    entry.dose_mg, entry.interval_hours, entry.auc24, entry.peak,
    entry.trough, entry.auc_in_range
  );
}

export function getCalcLog(filters?: {
  institutional_account_id?: number;
  user_id?: number;
  start_date?: string;
  end_date?: string;
  workflow_type?: string;
  pk_model?: string;
  limit?: number;
}): CalcLogEntry[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.institutional_account_id) {
    conditions.push("institutional_account_id = ?");
    params.push(filters.institutional_account_id);
  }
  if (filters?.user_id) {
    conditions.push("user_id = ?");
    params.push(filters.user_id);
  }
  if (filters?.start_date) {
    conditions.push("calculated_at >= ?");
    params.push(filters.start_date);
  }
  if (filters?.end_date) {
    conditions.push("calculated_at <= ?");
    params.push(filters.end_date);
  }
  if (filters?.workflow_type) {
    conditions.push("workflow_type = ?");
    params.push(filters.workflow_type);
  }
  if (filters?.pk_model) {
    conditions.push("pk_model = ?");
    params.push(filters.pk_model);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters?.limit ?? 500;
  params.push(limit);

  return getDb().prepare(`SELECT * FROM calculation_log ${where} ORDER BY calculated_at DESC LIMIT ?`).all(...params) as CalcLogEntry[];
}

export function getCalcLogSummary(institutionalAccountId: number) {
  const thisMonth = (getDb().prepare(
    "SELECT COUNT(*) as cnt FROM calculation_log WHERE institutional_account_id = ? AND calculated_at >= datetime('now', 'start of month')"
  ).get(institutionalAccountId) as { cnt: number }).cnt;

  const thisWeek = (getDb().prepare(
    "SELECT COUNT(*) as cnt FROM calculation_log WHERE institutional_account_id = ? AND calculated_at >= datetime('now', '-7 days')"
  ).get(institutionalAccountId) as { cnt: number }).cnt;

  const obesityPct = (getDb().prepare(
    "SELECT ROUND(AVG(obesity_model_active) * 100, 1) as pct FROM calculation_log WHERE institutional_account_id = ? AND calculated_at >= datetime('now', 'start of month')"
  ).get(institutionalAccountId) as { pct: number | null })?.pct ?? 0;

  const aucInRangePct = (getDb().prepare(
    "SELECT ROUND(AVG(auc_in_range) * 100, 1) as pct FROM calculation_log WHERE institutional_account_id = ? AND calculated_at >= datetime('now', 'start of month')"
  ).get(institutionalAccountId) as { pct: number | null })?.pct ?? 0;

  const uniqueUsers = (getDb().prepare(
    "SELECT COUNT(DISTINCT user_id) as cnt FROM calculation_log WHERE institutional_account_id = ? AND calculated_at >= datetime('now', 'start of month')"
  ).get(institutionalAccountId) as { cnt: number }).cnt;

  return { thisMonth, thisWeek, obesityPct, aucInRangePct, uniqueUsers };
}
