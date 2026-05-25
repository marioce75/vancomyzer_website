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

  // Stripe billing columns (Phase 4)
  try { _db.exec("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN stripe_price_id TEXT"); } catch { /* exists */ }
  try { _db.exec("CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id)"); } catch { /* exists */ }
  try { _db.exec("CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription ON users(stripe_subscription_id)"); } catch { /* exists */ }

  // Structured user categorization (added v2026.05) — collected at registration
  // for users dashboard segments/filters. Required for new signups; backfilled
  // for existing users via a next-login "complete your profile" prompt.
  //   country_code:      ISO 3166-1 alpha-2 (e.g. "US"), "OTHER" for long tail
  //   institution_type:  enum from src/lib/userCategorization.ts
  //   practice_setting:  enum from src/lib/userCategorization.ts
  try { _db.exec("ALTER TABLE users ADD COLUMN country_code TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN institution_type TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE users ADD COLUMN practice_setting TEXT"); } catch { /* exists */ }
  try { _db.exec("CREATE INDEX IF NOT EXISTS idx_users_country ON users(country_code)"); } catch { /* exists */ }
  try { _db.exec("CREATE INDEX IF NOT EXISTS idx_users_institution_type ON users(institution_type)"); } catch { /* exists */ }

  // Referral program (added v2026.05). Each user gets an 8-char base36 code
  // they share via /register?ref=<code>. When a referred user starts a paid
  // subscription, the Stripe webhook fires a credit equal to one month of
  // their plan to the referrer's customer balance (next invoice deduction).
  try { _db.exec("ALTER TABLE users ADD COLUMN referral_code TEXT"); } catch { /* exists */ }
  try { _db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL"); } catch { /* exists */ }
  _db.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_user_id INTEGER NOT NULL,
      referred_user_id INTEGER NOT NULL UNIQUE,
      referred_at TEXT NOT NULL DEFAULT (datetime('now')),
      converted_at TEXT,
      credit_applied_at TEXT,
      stripe_credit_amount_cents INTEGER,
      stripe_balance_transaction_id TEXT,
      FOREIGN KEY (referrer_user_id) REFERENCES users(id),
      FOREIGN KEY (referred_user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
    CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
    CREATE INDEX IF NOT EXISTS idx_referrals_converted ON referrals(converted_at);
  `);

  // Student / resident discount program (added v2026.05). Auto-verifies on
  // detected school-email domains; manual form + admin approval for residents
  // and students whose email doesn't match the pattern. When verified, the
  // billing checkout endpoint passes the configured Stripe coupon ID so the
  // discount appears as a line item in the hosted checkout session.
  _db.exec(`
    CREATE TABLE IF NOT EXISTS user_discounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('student', 'resident')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('auto_verified', 'pending', 'approved', 'denied')),
      application_data TEXT,
      verified_at TEXT,
      verified_by TEXT,
      denied_reason TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_discounts_status ON user_discounts(status);
  `);

  // Calculation history columns (Phase 6) — extend calculation_log
  // case_id: optional clinician-supplied tracking string (NO PHI; sanitized at write time)
  // tier_at_time: tier the user was on when the calc ran (audit trail)
  try { _db.exec("ALTER TABLE calculation_log ADD COLUMN case_id TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE calculation_log ADD COLUMN tier_at_time TEXT"); } catch { /* exists */ }

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
  // Self-serve Department-tier Stripe columns (added v2026.05).
  try { _db.exec("ALTER TABLE institutional_accounts ADD COLUMN stripe_customer_id TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE institutional_accounts ADD COLUMN stripe_subscription_id TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE institutional_accounts ADD COLUMN stripe_price_id TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE institutional_accounts ADD COLUMN subscription_status TEXT"); } catch { /* exists */ }
  try { _db.exec("CREATE INDEX IF NOT EXISTS idx_inst_stripe_customer ON institutional_accounts(stripe_customer_id)"); } catch { /* exists */ }
  try { _db.exec("CREATE INDEX IF NOT EXISTS idx_inst_stripe_subscription ON institutional_accounts(stripe_subscription_id)"); } catch { /* exists */ }

  // Self-serve BAA flow columns (added v2026.05).
  // baa_status was already ('not_requested', 'pending', 'active'). 'pending' now means
  // "customer uploaded signed PDF, awaiting Dōsys countersign". 'active' means fully executed.
  try { _db.exec("ALTER TABLE institutional_accounts ADD COLUMN baa_signer_name TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE institutional_accounts ADD COLUMN baa_signer_title TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE institutional_accounts ADD COLUMN baa_signer_email TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE institutional_accounts ADD COLUMN baa_signed_at TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE institutional_accounts ADD COLUMN baa_countersigned_at TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE institutional_accounts ADD COLUMN baa_document_path TEXT"); } catch { /* exists */ }
  try { _db.exec("ALTER TABLE institutional_accounts ADD COLUMN baa_template_version TEXT"); } catch { /* exists */ }

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

  // 90-day pilot trial tables
  _db.exec(`
    CREATE TABLE IF NOT EXISTS trials (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      phase TEXT NOT NULL DEFAULT 'PHASE_1',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      report_generated_at TEXT,
      report_url TEXT,
      converted_at TEXT,
      stripe_session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_trials_user ON trials(user_id);
    CREATE INDEX IF NOT EXISTS idx_trials_status ON trials(status);

    CREATE TABLE IF NOT EXISTS trial_cases (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      logged_at TEXT NOT NULL DEFAULT (datetime('now')),
      age_group TEXT NOT NULL DEFAULT 'unknown',
      weight_category TEXT NOT NULL,
      bmi REAL NOT NULL DEFAULT 0,
      obesity_model_used INTEGER NOT NULL DEFAULT 0,
      estimation_mode TEXT NOT NULL,
      indication_category TEXT,
      icu_patient INTEGER NOT NULL DEFAULT 0,
      target_auc_achieved INTEGER,
      calculated_auc REAL,
      auc_in_400_600 INTEGER,
      recommended_dose REAL,
      recommended_interval REAL,
      notes TEXT,
      FOREIGN KEY (trial_id) REFERENCES trials(id)
    );
    CREATE INDEX IF NOT EXISTS idx_trial_cases_trial ON trial_cases(trial_id);
    CREATE INDEX IF NOT EXISTS idx_trial_cases_user ON trial_cases(user_id);
  `);

  // Pilot applications — B2B hospital lead intake from dosys.health/pilot.
  // Distinct from `users` (account holders) and `institutional_accounts`
  // (billing entities); these are pre-account leads.
  _db.exec(`
    CREATE TABLE IF NOT EXISTS pilot_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_name TEXT NOT NULL,
      contact_title TEXT NOT NULL,
      hospital_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      bed_count INTEGER,
      current_monitoring TEXT,
      source TEXT NOT NULL DEFAULT 'dosys.health/pilot',
      submitted_at TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
      reviewed_at TEXT,
      reviewed_by INTEGER,
      review_notes TEXT,
      tenant_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (reviewed_by) REFERENCES users(id),
      FOREIGN KEY (tenant_id) REFERENCES institutional_accounts(id)
    );
    CREATE INDEX IF NOT EXISTS idx_pilot_apps_status ON pilot_applications(status);
    CREATE INDEX IF NOT EXISTS idx_pilot_apps_created ON pilot_applications(created_at);
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
  subscription_status: string;
  subscription_expiry: string | null;
  institutional_account_id: number | null;
  institutional_role: "user" | "admin";
  // Stripe billing fields (Phase 4)
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  // Structured categorization (collected at registration; backfilled on next login)
  country_code: string | null;
  institution_type: string | null;
  practice_setting: string | null;
  // Referral program — lazy-generated 8-char base36 code on first need
  referral_code: string | null;
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

/**
 * Set the structured categorization fields for an existing user (the
 * "complete your profile" prompt backfills these on next login for users
 * who signed up before these fields were required).
 */
export function setUserCategorization(
  id: number,
  fields: { country_code: string; institution_type: string; practice_setting: string },
): void {
  getDb()
    .prepare(
      `UPDATE users SET country_code = ?, institution_type = ?, practice_setting = ? WHERE id = ?`,
    )
    .run(fields.country_code, fields.institution_type, fields.practice_setting, id);
}

export function disableUser(id: number) {
  getDb().prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(id);
}

export function reactivateUser(id: number) {
  getDb().prepare("UPDATE users SET status = 'active' WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// Referral program
// ---------------------------------------------------------------------------

/**
 * Generate a random 8-character base36 referral code. Collisions are
 * extremely unlikely (36^8 ≈ 2.8 trillion) but we retry on the off chance.
 */
function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Return the user's referral code, generating + persisting it on first call.
 * Safe to call repeatedly — returns the same code after the first call.
 */
export function getOrCreateReferralCode(userId: number): string {
  const db = getDb();
  const existing = db.prepare("SELECT referral_code FROM users WHERE id = ?").get(userId) as { referral_code: string | null } | undefined;
  if (existing?.referral_code) return existing.referral_code;

  // Generate + persist with retry on collision
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode();
    try {
      db.prepare("UPDATE users SET referral_code = ? WHERE id = ?").run(code, userId);
      // Verify we got the value (uniqueness will reject duplicates)
      const verify = db.prepare("SELECT referral_code FROM users WHERE id = ?").get(userId) as { referral_code: string };
      return verify.referral_code;
    } catch {
      // Collision — retry
    }
  }
  throw new Error("Unable to generate unique referral code after 10 attempts");
}

export function findUserByReferralCode(code: string): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE referral_code = ?")
    .get(code.toUpperCase()) as UserRow | undefined;
}

export interface ReferralRow {
  id: number;
  referrer_user_id: number;
  referred_user_id: number;
  referred_at: string;
  converted_at: string | null;
  credit_applied_at: string | null;
  stripe_credit_amount_cents: number | null;
  stripe_balance_transaction_id: string | null;
}

/**
 * Record a new referral linking the referrer (by code) to a freshly-registered
 * referred user. Self-referrals (same user) and duplicate referrals are
 * silently no-op'd rather than thrown — they shouldn't crash registration.
 */
export function createReferral(referrerCode: string, referredUserId: number): ReferralRow | null {
  const db = getDb();
  const referrer = findUserByReferralCode(referrerCode);
  if (!referrer) return null;
  if (referrer.id === referredUserId) return null; // self-referral guard
  try {
    db.prepare(
      "INSERT INTO referrals (referrer_user_id, referred_user_id) VALUES (?, ?)",
    ).run(referrer.id, referredUserId);
    return db
      .prepare("SELECT * FROM referrals WHERE referred_user_id = ?")
      .get(referredUserId) as ReferralRow;
  } catch {
    return null; // unique constraint — already referred
  }
}

/**
 * Find the unconverted referral (if any) for a given referred user. Used by
 * the Stripe webhook when that user starts a paid subscription.
 */
export function findUnconvertedReferralForReferred(referredUserId: number): ReferralRow | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM referrals WHERE referred_user_id = ? AND converted_at IS NULL",
    )
    .get(referredUserId) as ReferralRow | undefined;
  return row ?? null;
}

export function markReferralConverted(referralId: number): void {
  getDb()
    .prepare("UPDATE referrals SET converted_at = datetime('now') WHERE id = ? AND converted_at IS NULL")
    .run(referralId);
}

export function markReferralCreditApplied(
  referralId: number,
  amountCents: number,
  stripeBalanceTransactionId: string,
): void {
  getDb()
    .prepare(
      `UPDATE referrals SET
        credit_applied_at = datetime('now'),
        stripe_credit_amount_cents = ?,
        stripe_balance_transaction_id = ?
       WHERE id = ?`,
    )
    .run(amountCents, stripeBalanceTransactionId, referralId);
}

export interface ReferralStats {
  total_referred: number;
  converted_count: number;
  pending_count: number;
  credits_applied: number;
  credits_total_cents: number;
}

// ---------------------------------------------------------------------------
// Student / resident discount program
// ---------------------------------------------------------------------------

export interface UserDiscountRow {
  id: number;
  user_id: number;
  discount_type: "student" | "resident";
  status: "auto_verified" | "pending" | "approved" | "denied";
  application_data: string | null; // JSON-encoded application details
  verified_at: string | null;
  verified_by: string | null;
  denied_reason: string | null;
  expires_at: string | null;
  created_at: string;
}

export function getUserDiscount(userId: number): UserDiscountRow | undefined {
  return getDb()
    .prepare("SELECT * FROM user_discounts WHERE user_id = ?")
    .get(userId) as UserDiscountRow | undefined;
}

export function getDiscountById(id: number): UserDiscountRow | undefined {
  return getDb()
    .prepare("SELECT * FROM user_discounts WHERE id = ?")
    .get(id) as UserDiscountRow | undefined;
}

/** Create an auto-verified student discount (school-email detection at registration). */
export function createAutoVerifiedStudentDiscount(userId: number): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO user_discounts (user_id, discount_type, status, verified_at, verified_by)
         VALUES (?, 'student', 'auto_verified', datetime('now'), 'AUTO_EMAIL_DETECT')`,
      )
      .run(userId);
  } catch {
    /* user already has a discount row — no-op */
  }
}

export interface DiscountApplicationInput {
  discount_type: "student" | "resident";
  program_name: string;
  institution_name: string;
  supervisor_name: string;
  supervisor_email: string;
  expected_completion: string; // free-text, e.g. "June 2027"
  notes?: string;
}

/** Submit a manual application for a discount; status starts at 'pending'. */
export function submitDiscountApplication(userId: number, input: DiscountApplicationInput): UserDiscountRow {
  const db = getDb();
  // Replace any prior denied/expired application with the new one
  db.prepare("DELETE FROM user_discounts WHERE user_id = ? AND status = 'denied'").run(userId);
  db.prepare(
    `INSERT INTO user_discounts (user_id, discount_type, status, application_data)
     VALUES (?, ?, 'pending', ?)`,
  ).run(userId, input.discount_type, JSON.stringify(input));
  return getUserDiscount(userId)!;
}

export function approveDiscountApplication(id: number, verifiedBy: string, expiresAt?: string): void {
  if (expiresAt) {
    getDb()
      .prepare(
        `UPDATE user_discounts SET status = 'approved', verified_at = datetime('now'),
         verified_by = ?, expires_at = ?, denied_reason = NULL WHERE id = ?`,
      )
      .run(verifiedBy, expiresAt, id);
  } else {
    getDb()
      .prepare(
        `UPDATE user_discounts SET status = 'approved', verified_at = datetime('now'),
         verified_by = ?, denied_reason = NULL WHERE id = ?`,
      )
      .run(verifiedBy, id);
  }
}

export function denyDiscountApplication(id: number, verifiedBy: string, reason: string): void {
  getDb()
    .prepare(
      `UPDATE user_discounts SET status = 'denied', verified_at = datetime('now'),
       verified_by = ?, denied_reason = ? WHERE id = ?`,
    )
    .run(verifiedBy, reason, id);
}

export function listPendingDiscountApplications(): Array<UserDiscountRow & { username: string; email: string; full_name: string }> {
  return getDb()
    .prepare(
      `SELECT ud.*, u.username, u.email, u.full_name
       FROM user_discounts ud
       JOIN users u ON u.id = ud.user_id
       WHERE ud.status = 'pending'
       ORDER BY ud.created_at ASC`,
    )
    .all() as Array<UserDiscountRow & { username: string; email: string; full_name: string }>;
}

/** True when the user is eligible for a discount at checkout (auto-verified
 *  OR approved AND not expired). */
export function userHasActiveDiscount(userId: number): UserDiscountRow | null {
  const d = getUserDiscount(userId);
  if (!d) return null;
  if (d.status !== "auto_verified" && d.status !== "approved") return null;
  if (d.expires_at && new Date(d.expires_at) < new Date()) return null;
  return d;
}

export function getReferralStats(userId: number): ReferralStats {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT
        COUNT(*) as total_referred,
        SUM(CASE WHEN converted_at IS NOT NULL THEN 1 ELSE 0 END) as converted_count,
        SUM(CASE WHEN converted_at IS NULL THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN credit_applied_at IS NOT NULL THEN 1 ELSE 0 END) as credits_applied,
        COALESCE(SUM(stripe_credit_amount_cents), 0) as credits_total_cents
       FROM referrals WHERE referrer_user_id = ?`,
    )
    .get(userId) as {
      total_referred: number | null;
      converted_count: number | null;
      pending_count: number | null;
      credits_applied: number | null;
      credits_total_cents: number | null;
    };
  return {
    total_referred: row.total_referred ?? 0,
    converted_count: row.converted_count ?? 0,
    pending_count: row.pending_count ?? 0,
    credits_applied: row.credits_applied ?? 0,
    credits_total_cents: row.credits_total_cents ?? 0,
  };
}

/** Hard-delete a user. Use with care — irreversible. */
export function deleteUser(id: number) {
  getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
}

/** Change a user's system role between 'admin' and 'pharmacist'. */
export function setUserRole(id: number, role: "admin" | "pharmacist") {
  getDb().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
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
// User Management dashboard — server-side filter + pagination
// ---------------------------------------------------------------------------

export interface UserListFilter {
  search?: string;                  // matches full_name | email | username | institution
  status?: string;                  // active | pending | disabled
  subscription_tier?: string;       // free | individual_pro | department | hospital
  country_code?: string;            // ISO 3166-1 alpha-2
  institution_type?: string;        // enum from userCategorization.ts
  institutional_account_id?: number;
  mfa_enabled?: boolean;            // false → MFA off
  locked?: boolean;                 // true → locked_until > now
  inactive_days?: number;           // last_login older than N days
  sort?: "created_desc" | "created_asc" | "last_login_desc" | "name_asc" | "email_asc";
  page?: number;                    // 1-indexed
  page_size?: number;               // default 50, max 200
}

export interface PaginatedUsers {
  users: UserRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

function buildUserWhere(filter: UserListFilter): { sql: string; params: (string | number)[] } {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filter.search && filter.search.trim()) {
    const q = `%${filter.search.trim()}%`;
    clauses.push("(full_name LIKE ? OR email LIKE ? OR username LIKE ? OR institution LIKE ?)");
    params.push(q, q, q, q);
  }
  if (filter.status) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  if (filter.subscription_tier) {
    clauses.push("subscription_tier = ?");
    params.push(filter.subscription_tier);
  }
  if (filter.country_code) {
    clauses.push("country_code = ?");
    params.push(filter.country_code);
  }
  if (filter.institution_type) {
    clauses.push("institution_type = ?");
    params.push(filter.institution_type);
  }
  if (filter.institutional_account_id != null) {
    clauses.push("institutional_account_id = ?");
    params.push(filter.institutional_account_id);
  }
  if (filter.mfa_enabled === false) {
    clauses.push("(mfa_enabled IS NULL OR mfa_enabled = 0)");
  } else if (filter.mfa_enabled === true) {
    clauses.push("mfa_enabled = 1");
  }
  if (filter.locked === true) {
    clauses.push("locked_until IS NOT NULL AND locked_until > datetime('now')");
  }
  if (filter.inactive_days != null && filter.inactive_days > 0) {
    clauses.push(`(last_login IS NULL OR last_login < datetime('now', '-${filter.inactive_days} days'))`);
  }

  const sql = clauses.length > 0 ? " WHERE " + clauses.join(" AND ") : "";
  return { sql, params };
}

export function listUsersPaginated(filter: UserListFilter): PaginatedUsers {
  const where = buildUserWhere(filter);
  const orderBy =
    filter.sort === "created_asc" ? "created_at ASC" :
    filter.sort === "last_login_desc" ? "last_login DESC NULLS LAST" :
    filter.sort === "name_asc" ? "full_name COLLATE NOCASE ASC" :
    filter.sort === "email_asc" ? "email COLLATE NOCASE ASC" :
    "created_at DESC";

  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filter.page_size ?? 50));
  const offset = (page - 1) * pageSize;

  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM users${where.sql}`).get(...where.params) as { cnt: number }).cnt;
  const users = db
    .prepare(`SELECT * FROM users${where.sql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...where.params, pageSize, offset) as UserRow[];

  return {
    users,
    total,
    page,
    page_size: pageSize,
    total_pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export interface UserSegmentCounts {
  total: number;
  by_status: Array<{ key: string; count: number }>;
  by_tier: Array<{ key: string; count: number }>;
  by_country: Array<{ key: string; count: number }>;
  by_institution_type: Array<{ key: string; count: number }>;
  top_institutional_accounts: Array<{ id: number; institution_name: string; count: number }>;
  health: {
    inactive_90d: number;
    mfa_off: number;
    locked: number;
    profile_incomplete: number;
  };
  growth: {
    new_24h: number;
    new_7d: number;
    new_30d: number;
  };
}

export function getUserSegmentCounts(): UserSegmentCounts {
  const db = getDb();
  const groupRows = (sql: string): Array<{ key: string; count: number }> =>
    (db.prepare(sql).all() as Array<{ key: string | null; count: number }>)
      .map((r) => ({ key: r.key ?? "unknown", count: r.count }));

  return {
    total: (db.prepare("SELECT COUNT(*) as cnt FROM users").get() as { cnt: number }).cnt,
    by_status: groupRows("SELECT status as key, COUNT(*) as count FROM users GROUP BY status ORDER BY count DESC"),
    by_tier: groupRows("SELECT subscription_tier as key, COUNT(*) as count FROM users GROUP BY subscription_tier ORDER BY count DESC"),
    by_country: groupRows("SELECT country_code as key, COUNT(*) as count FROM users WHERE country_code IS NOT NULL GROUP BY country_code ORDER BY count DESC LIMIT 20"),
    by_institution_type: groupRows("SELECT institution_type as key, COUNT(*) as count FROM users WHERE institution_type IS NOT NULL GROUP BY institution_type ORDER BY count DESC"),
    top_institutional_accounts: (db.prepare(`
      SELECT ia.id, ia.institution_name, COUNT(u.id) as count
      FROM institutional_accounts ia
      LEFT JOIN users u ON u.institutional_account_id = ia.id
      GROUP BY ia.id, ia.institution_name
      ORDER BY count DESC
      LIMIT 10
    `).all() as Array<{ id: number; institution_name: string; count: number }>),
    health: {
      inactive_90d: (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE last_login IS NULL OR last_login < datetime('now', '-90 days')").get() as { cnt: number }).cnt,
      mfa_off: (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE mfa_enabled IS NULL OR mfa_enabled = 0").get() as { cnt: number }).cnt,
      locked: (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE locked_until IS NOT NULL AND locked_until > datetime('now')").get() as { cnt: number }).cnt,
      profile_incomplete: (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE country_code IS NULL OR institution_type IS NULL OR practice_setting IS NULL").get() as { cnt: number }).cnt,
    },
    growth: {
      new_24h: (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE created_at >= datetime('now', '-1 day')").get() as { cnt: number }).cnt,
      new_7d: (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE created_at >= datetime('now', '-7 days')").get() as { cnt: number }).cnt,
      new_30d: (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE created_at >= datetime('now', '-30 days')").get() as { cnt: number }).cnt,
    },
  };
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

// ---------------------------------------------------------------------------
// Stripe billing helpers (Phase 4)
// ---------------------------------------------------------------------------

export function setStripeCustomerId(userId: number, customerId: string) {
  getDb().prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(customerId, userId);
}

export function findUserByStripeCustomerId(customerId: string): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE stripe_customer_id = ?")
    .get(customerId) as UserRow | undefined;
}

export function findUserByStripeSubscriptionId(subscriptionId: string): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE stripe_subscription_id = ?")
    .get(subscriptionId) as UserRow | undefined;
}

export interface SubscriptionUpdate {
  tier: TierId;
  status: string;
  expiry: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
}

export function applySubscriptionUpdate(userId: number, update: SubscriptionUpdate) {
  getDb()
    .prepare(
      `UPDATE users
       SET subscription_tier = ?,
           subscription_status = ?,
           subscription_expiry = ?,
           stripe_subscription_id = ?,
           stripe_price_id = ?
       WHERE id = ?`,
    )
    .run(
      update.tier,
      update.status,
      update.expiry,
      update.stripeSubscriptionId,
      update.stripePriceId,
      userId,
    );
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
  // Self-serve Department Stripe linkage
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: string | null;
  // Self-serve BAA signing flow
  baa_signer_name: string | null;
  baa_signer_title: string | null;
  baa_signer_email: string | null;
  baa_signed_at: string | null;
  baa_countersigned_at: string | null;
  baa_document_path: string | null;
  baa_template_version: string | null;
}

export type CreateInstitutionalAccountInput =
  & Omit<InstitutionalAccountRow,
      "id" | "seats_used" | "created_at"
      | "stripe_customer_id" | "stripe_subscription_id" | "stripe_price_id" | "subscription_status"
      | "baa_signer_name" | "baa_signer_title" | "baa_signer_email"
      | "baa_signed_at" | "baa_countersigned_at" | "baa_document_path" | "baa_template_version">
  & Partial<Pick<InstitutionalAccountRow,
      "stripe_customer_id" | "stripe_subscription_id" | "stripe_price_id" | "subscription_status"
      | "baa_signer_name" | "baa_signer_title" | "baa_signer_email"
      | "baa_signed_at" | "baa_countersigned_at" | "baa_document_path" | "baa_template_version">>;

export function createInstitutionalAccount(account: CreateInstitutionalAccountInput): number {
  const result = getDb().prepare(`INSERT INTO institutional_accounts
    (institution_name, billing_email, plan_tier, seats_allocated, subscription_start, subscription_expiry, baa_status,
     stripe_customer_id, stripe_subscription_id, stripe_price_id, subscription_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    account.institution_name, account.billing_email, account.plan_tier,
    account.seats_allocated, account.subscription_start, account.subscription_expiry,
    account.baa_status ?? "not_requested",
    account.stripe_customer_id ?? null,
    account.stripe_subscription_id ?? null,
    account.stripe_price_id ?? null,
    account.subscription_status ?? null,
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

/**
 * Customer-side BAA submission: the institutional admin uploaded their
 * signed PDF. Records signer metadata and the file path on the Render
 * disk, sets status='pending'. Awaiting Dōsys countersign before
 * status flips to 'active'.
 */
export interface BaaSubmissionInput {
  signer_name: string;
  signer_title: string;
  signer_email: string;
  document_path: string;
  template_version: string;
}

export function recordBaaSubmission(id: number, input: BaaSubmissionInput): void {
  getDb()
    .prepare(
      `UPDATE institutional_accounts SET
        baa_status = 'pending',
        baa_requested_at = datetime('now'),
        baa_signed_at = datetime('now'),
        baa_signer_name = ?,
        baa_signer_title = ?,
        baa_signer_email = ?,
        baa_document_path = ?,
        baa_template_version = ?
       WHERE id = ?`,
    )
    .run(
      input.signer_name,
      input.signer_title,
      input.signer_email,
      input.document_path,
      input.template_version,
      id,
    );
}

/**
 * Superadmin countersign: Dōsys (Mario) marks the BAA fully executed.
 * Sets status='active' and stamps countersign timestamp. Optionally
 * replaces the document_path with the countersigned PDF.
 */
export function recordBaaCountersign(id: number, countersignedDocumentPath?: string): void {
  if (countersignedDocumentPath) {
    getDb()
      .prepare(
        `UPDATE institutional_accounts SET
          baa_status = 'active',
          baa_countersigned_at = datetime('now'),
          baa_document_path = ?
         WHERE id = ?`,
      )
      .run(countersignedDocumentPath, id);
  } else {
    getDb()
      .prepare(
        `UPDATE institutional_accounts SET
          baa_status = 'active',
          baa_countersigned_at = datetime('now')
         WHERE id = ?`,
      )
      .run(id);
  }
}

/** List all institutions with BAA in 'pending' state — fuels the superadmin queue. */
export function listPendingBaaInstitutions(): InstitutionalAccountRow[] {
  return getDb()
    .prepare("SELECT * FROM institutional_accounts WHERE baa_status = 'pending' ORDER BY baa_signed_at ASC")
    .all() as InstitutionalAccountRow[];
}

export function getInstitutionUsers(institutionalAccountId: number): UserRow[] {
  return getDb().prepare("SELECT * FROM users WHERE institutional_account_id = ?").all(institutionalAccountId) as UserRow[];
}

export function recountSeats(institutionalAccountId: number) {
  const count = (getDb().prepare("SELECT COUNT(*) as cnt FROM users WHERE institutional_account_id = ?").get(institutionalAccountId) as { cnt: number }).cnt;
  getDb().prepare("UPDATE institutional_accounts SET seats_used = ? WHERE id = ?").run(count, institutionalAccountId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-serve Department-tier Stripe helpers
// ─────────────────────────────────────────────────────────────────────────────

export function findInstitutionByStripeCustomerId(customerId: string): InstitutionalAccountRow | undefined {
  return getDb()
    .prepare("SELECT * FROM institutional_accounts WHERE stripe_customer_id = ?")
    .get(customerId) as InstitutionalAccountRow | undefined;
}

export function findInstitutionByStripeSubscriptionId(subscriptionId: string): InstitutionalAccountRow | undefined {
  return getDb()
    .prepare("SELECT * FROM institutional_accounts WHERE stripe_subscription_id = ?")
    .get(subscriptionId) as InstitutionalAccountRow | undefined;
}

export function setInstitutionStripeCustomer(id: number, customerId: string): void {
  getDb()
    .prepare("UPDATE institutional_accounts SET stripe_customer_id = ? WHERE id = ?")
    .run(customerId, id);
}

export interface InstitutionSubscriptionUpdate {
  status: string | null;
  expiry: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
}

export function applyInstitutionSubscriptionUpdate(
  id: number,
  update: InstitutionSubscriptionUpdate,
): void {
  getDb()
    .prepare(
      `UPDATE institutional_accounts
       SET subscription_status = ?,
           subscription_expiry = ?,
           stripe_subscription_id = ?,
           stripe_price_id = ?
       WHERE id = ?`,
    )
    .run(update.status, update.expiry, update.stripeSubscriptionId, update.stripePriceId, id);
}

export function setInstitutionSeatsAllocated(id: number, seats: number): void {
  getDb()
    .prepare("UPDATE institutional_accounts SET seats_allocated = ? WHERE id = ?")
    .run(seats, id);
}

// ---------------------------------------------------------------------------
// Team / Department admin helpers (Phase 7)
// ---------------------------------------------------------------------------

export interface TeamMemberRow {
  id: number;
  username: string;
  email: string;
  full_name: string;
  credentials: string;
  status: string;
  institutional_role: "user" | "admin";
  last_login: string | null;
  created_at: string;
}

/** Return a slim member view for the team panel — no password hashes, no PHI. */
export function listTeamMembers(institutionalAccountId: number): TeamMemberRow[] {
  return getDb()
    .prepare(
      `SELECT id, username, email, full_name, credentials, status,
              institutional_role, last_login, created_at
       FROM users
       WHERE institutional_account_id = ?
       ORDER BY institutional_role DESC, last_login DESC`,
    )
    .all(institutionalAccountId) as TeamMemberRow[];
}

/** Look up a single team member, scoped to the inviter's institution. */
export function findTeamMember(
  institutionalAccountId: number,
  userId: number,
): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE institutional_account_id = ? AND id = ?")
    .get(institutionalAccountId, userId) as UserRow | undefined;
}

/** Remove a member from the institution — they revert to free/no institution. */
export function removeFromInstitution(userId: number) {
  getDb()
    .prepare(
      `UPDATE users SET institutional_account_id = NULL,
                        institutional_role = 'user',
                        subscription_tier = 'free'
       WHERE id = ?`,
    )
    .run(userId);
}

export function setInstitutionalRole(userId: number, role: "user" | "admin") {
  getDb().prepare("UPDATE users SET institutional_role = ? WHERE id = ?").run(role, userId);
}

/**
 * Create a new institution-bound user from an admin invite. Status is
 * 'active' immediately so the magic-link sign-in works on first click.
 * Caller is responsible for seat-cap pre-check.
 */
export function createInvitedTeamMember(input: {
  email: string;
  full_name: string;
  credentials: string;
  password_hash: string;
  institutional_account_id: number;
  subscription_tier: TierId;
}): number {
  const username = input.email.split("@")[0].slice(0, 32) + "_" + String(Date.now()).slice(-6);
  const result = getDb()
    .prepare(
      `INSERT INTO users (
         username, email, password_hash, full_name, credentials,
         status, role, institutional_account_id, institutional_role,
         subscription_tier, agreed_disclaimer, agreed_terms,
         confirmed_hcp, confirmed_age
       ) VALUES (?, ?, ?, ?, ?, 'active', 'pharmacist', ?, 'user', ?, 1, 1, 1, 1)`,
    )
    .run(
      username,
      input.email.toLowerCase().trim(),
      input.password_hash,
      input.full_name,
      input.credentials,
      input.institutional_account_id,
      input.subscription_tier,
    );
  return Number(result.lastInsertRowid);
}

export interface AuditFeedRow {
  id: number;
  calculated_at: string;
  user_id: number;
  username: string | null;
  full_name: string | null;
  workflow_type: string;
  pk_model: string;
  dose_mg: number | null;
  interval_hours: number | null;
  auc24: number | null;
  peak: number | null;
  trough: number | null;
  auc_in_range: number;
  case_id: string | null;
}

/** Institution-scoped audit feed. Joins user info; never returns PHI. */
export function listInstitutionAuditFeed(
  institutionalAccountId: number,
  opts?: { limit?: number; offset?: number },
): AuditFeedRow[] {
  const limit = Math.max(1, Math.min(opts?.limit ?? 100, 500));
  const offset = Math.max(0, opts?.offset ?? 0);
  return getDb()
    .prepare(
      `SELECT cl.id, cl.calculated_at, cl.user_id, u.username, u.full_name,
              cl.workflow_type, cl.pk_model, cl.dose_mg, cl.interval_hours,
              cl.auc24, cl.peak, cl.trough, cl.auc_in_range, cl.case_id
       FROM calculation_log cl
       LEFT JOIN users u ON u.id = cl.user_id
       WHERE cl.institutional_account_id = ?
       ORDER BY cl.calculated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(institutionalAccountId, limit, offset) as AuditFeedRow[];
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
  case_id: string | null;
  tier_at_time: string | null;
}

export function logCalculationEntry(entry: Omit<CalcLogEntry, "id" | "calculated_at">) {
  getDb().prepare(`INSERT INTO calculation_log
    (user_id, institutional_account_id, workflow_type, pk_model, obesity_model_active,
     bmi_above_40, dose_mg, interval_hours, auc24, peak, trough, auc_in_range,
     case_id, tier_at_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    entry.user_id, entry.institutional_account_id, entry.workflow_type,
    entry.pk_model, entry.obesity_model_active, entry.bmi_above_40,
    entry.dose_mg, entry.interval_hours, entry.auc24, entry.peak,
    entry.trough, entry.auc_in_range,
    entry.case_id ?? null, entry.tier_at_time ?? null,
  );
}

/**
 * User-facing calculation history for the /settings/history page.
 * Returns rows for the requesting user only — never cross-user.
 */
export function listCalculationHistory(
  userId: number,
  opts?: { limit?: number; offset?: number; workflow_type?: string; case_id_search?: string },
): CalcLogEntry[] {
  const limit = Math.max(1, Math.min(opts?.limit ?? 50, 500));
  const offset = Math.max(0, opts?.offset ?? 0);
  const conditions: string[] = ["user_id = ?"];
  const params: unknown[] = [userId];

  if (opts?.workflow_type) {
    conditions.push("workflow_type = ?");
    params.push(opts.workflow_type);
  }
  if (opts?.case_id_search) {
    conditions.push("case_id LIKE ?");
    params.push(`%${opts.case_id_search}%`);
  }

  return getDb()
    .prepare(
      `SELECT * FROM calculation_log
       WHERE ${conditions.join(" AND ")}
       ORDER BY calculated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as CalcLogEntry[];
}

/** Total row count for pagination — same filters as listCalculationHistory. */
export function countCalculationHistory(
  userId: number,
  opts?: { workflow_type?: string; case_id_search?: string },
): number {
  const conditions: string[] = ["user_id = ?"];
  const params: unknown[] = [userId];

  if (opts?.workflow_type) {
    conditions.push("workflow_type = ?");
    params.push(opts.workflow_type);
  }
  if (opts?.case_id_search) {
    conditions.push("case_id LIKE ?");
    params.push(`%${opts.case_id_search}%`);
  }

  const row = getDb()
    .prepare(`SELECT COUNT(*) as n FROM calculation_log WHERE ${conditions.join(" AND ")}`)
    .get(...params) as { n: number };
  return row?.n ?? 0;
}

/**
 * 90-day retention enforcement. Lazy — runs at most once per process per
 * 24h window. Cheap idempotent DELETE; safe if multiple processes run it.
 */
let _lastPurgeAt = 0;
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function purgeOldCalculationsIfNeeded() {
  const now = Date.now();
  if (now - _lastPurgeAt < PURGE_INTERVAL_MS) return;
  _lastPurgeAt = now;
  try {
    getDb()
      .prepare("DELETE FROM calculation_log WHERE calculated_at < datetime('now', '-90 days')")
      .run();
  } catch (err) {
    console.warn("[calculation-history] purge failed:", err);
  }
}

/**
 * System-wide calculation feed for superadmin dashboards. Joins user
 * + institutional account names so the table can show readable labels
 * instead of raw IDs. Never returns PHI.
 */
export interface SuperadminCalcRow {
  id: number;
  calculated_at: string;
  user_id: number;
  username: string | null;
  user_email: string | null;
  full_name: string | null;
  institutional_account_id: number | null;
  institution_name: string | null;
  workflow_type: string;
  pk_model: string;
  obesity_model_active: number;
  dose_mg: number | null;
  interval_hours: number | null;
  auc24: number | null;
  peak: number | null;
  trough: number | null;
  auc_in_range: number;
  case_id: string | null;
  tier_at_time: string | null;
}

export function listSuperadminCalcFeed(filters?: {
  institutional_account_id?: number;
  user_email?: string;
  workflow_type?: string;
  pk_model?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}): SuperadminCalcRow[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.institutional_account_id) {
    conditions.push("cl.institutional_account_id = ?");
    params.push(filters.institutional_account_id);
  }
  if (filters?.user_email) {
    conditions.push("u.email LIKE ?");
    params.push(`%${filters.user_email.toLowerCase()}%`);
  }
  if (filters?.workflow_type) {
    conditions.push("cl.workflow_type = ?");
    params.push(filters.workflow_type);
  }
  if (filters?.pk_model) {
    conditions.push("cl.pk_model = ?");
    params.push(filters.pk_model);
  }
  if (filters?.start_date) {
    conditions.push("cl.calculated_at >= ?");
    params.push(filters.start_date);
  }
  if (filters?.end_date) {
    conditions.push("cl.calculated_at <= ?");
    params.push(filters.end_date);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(filters?.limit ?? 100, 1000));
  const offset = Math.max(0, filters?.offset ?? 0);

  return getDb()
    .prepare(
      `SELECT cl.id, cl.calculated_at, cl.user_id,
              u.username, u.email AS user_email, u.full_name,
              cl.institutional_account_id,
              ia.institution_name,
              cl.workflow_type, cl.pk_model, cl.obesity_model_active,
              cl.dose_mg, cl.interval_hours, cl.auc24, cl.peak, cl.trough,
              cl.auc_in_range, cl.case_id, cl.tier_at_time
       FROM calculation_log cl
       LEFT JOIN users u ON u.id = cl.user_id
       LEFT JOIN institutional_accounts ia ON ia.id = cl.institutional_account_id
       ${where}
       ORDER BY cl.calculated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as SuperadminCalcRow[];
}

export function countSuperadminCalcFeed(filters?: {
  institutional_account_id?: number;
  user_email?: string;
  workflow_type?: string;
  pk_model?: string;
  start_date?: string;
  end_date?: string;
}): number {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.institutional_account_id) {
    conditions.push("cl.institutional_account_id = ?");
    params.push(filters.institutional_account_id);
  }
  if (filters?.user_email) {
    conditions.push("u.email LIKE ?");
    params.push(`%${filters.user_email.toLowerCase()}%`);
  }
  if (filters?.workflow_type) {
    conditions.push("cl.workflow_type = ?");
    params.push(filters.workflow_type);
  }
  if (filters?.pk_model) {
    conditions.push("cl.pk_model = ?");
    params.push(filters.pk_model);
  }
  if (filters?.start_date) {
    conditions.push("cl.calculated_at >= ?");
    params.push(filters.start_date);
  }
  if (filters?.end_date) {
    conditions.push("cl.calculated_at <= ?");
    params.push(filters.end_date);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as n FROM calculation_log cl
       LEFT JOIN users u ON u.id = cl.user_id
       ${where}`,
    )
    .get(...params) as { n: number };
  return row?.n ?? 0;
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

// ---------------------------------------------------------------------------
// Trial system helpers
// ---------------------------------------------------------------------------

export interface TrialRow {
  id: string;
  user_id: number;
  started_at: string;
  expires_at: string;
  phase: string;
  status: string;
  report_generated_at: string | null;
  report_url: string | null;
  converted_at: string | null;
  stripe_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrialCaseRow {
  id: string;
  trial_id: string;
  user_id: number;
  logged_at: string;
  age_group: string;
  weight_category: string;
  bmi: number;
  obesity_model_used: number;
  estimation_mode: string;
  indication_category: string | null;
  icu_patient: number;
  target_auc_achieved: number | null;
  calculated_auc: number | null;
  auc_in_400_600: number | null;
  recommended_dose: number | null;
  recommended_interval: number | null;
  notes: string | null;
}

export function findTrialByUserId(userId: number): TrialRow | undefined {
  return getDb().prepare("SELECT * FROM trials WHERE user_id = ?").get(userId) as TrialRow | undefined;
}

export function findTrialById(id: string): TrialRow | undefined {
  return getDb().prepare("SELECT * FROM trials WHERE id = ?").get(id) as TrialRow | undefined;
}

export function createTrial(userId: number, startedAt: Date, expiresAt: Date): TrialRow {
  const id = crypto.randomUUID();
  getDb().prepare(
    `INSERT INTO trials (id, user_id, started_at, expires_at, phase, status)
     VALUES (?, ?, ?, ?, 'PHASE_1', 'ACTIVE')`
  ).run(id, userId, startedAt.toISOString(), expiresAt.toISOString());
  return getDb().prepare("SELECT * FROM trials WHERE id = ?").get(id) as TrialRow;
}

export function updateTrialPhase(userId: number, phase: string) {
  getDb().prepare(
    "UPDATE trials SET phase = ?, updated_at = datetime('now') WHERE user_id = ?"
  ).run(phase, userId);
}

export function updateTrialStatus(userId: number, status: string) {
  getDb().prepare(
    "UPDATE trials SET status = ?, updated_at = datetime('now') WHERE user_id = ?"
  ).run(status, userId);
}

export function updateTrialReport(userId: number, reportUrl: string) {
  getDb().prepare(
    "UPDATE trials SET report_url = ?, report_generated_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?"
  ).run(reportUrl, userId);
}

export function convertTrial(userId: number) {
  getDb().prepare(
    "UPDATE trials SET status = 'CONVERTED', converted_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?"
  ).run(userId);
}

export function listTrialCases(trialId: string): TrialCaseRow[] {
  return getDb().prepare("SELECT * FROM trial_cases WHERE trial_id = ? ORDER BY logged_at ASC").all(trialId) as TrialCaseRow[];
}

export function insertTrialCase(data: Omit<TrialCaseRow, 'id' | 'logged_at'>): void {
  const id = crypto.randomUUID();
  getDb().prepare(
    `INSERT INTO trial_cases (
      id, trial_id, user_id, age_group, weight_category, bmi, obesity_model_used,
      estimation_mode, indication_category, icu_patient, target_auc_achieved,
      calculated_auc, auc_in_400_600, recommended_dose, recommended_interval, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, data.trial_id, data.user_id, data.age_group, data.weight_category,
    data.bmi, data.obesity_model_used ? 1 : 0, data.estimation_mode,
    data.indication_category ?? null, data.icu_patient ? 1 : 0,
    data.target_auc_achieved ?? null, data.calculated_auc ?? null,
    data.auc_in_400_600 ?? null, data.recommended_dose ?? null,
    data.recommended_interval ?? null, data.notes ?? null
  );
}

export function listAllActiveTrials(): (TrialRow & { email: string | null; full_name: string | null })[] {
  return getDb().prepare(
    `SELECT t.*, u.email, u.full_name
     FROM trials t
     LEFT JOIN users u ON u.id = t.user_id
     WHERE t.status = 'ACTIVE'
     ORDER BY t.started_at DESC`
  ).all() as (TrialRow & { email: string | null; full_name: string | null })[];
}

export function listAllTrials(): (TrialRow & { email: string | null; full_name: string | null })[] {
  return getDb().prepare(
    `SELECT t.*, u.email, u.full_name
     FROM trials t
     LEFT JOIN users u ON u.id = t.user_id
     ORDER BY t.started_at DESC`
  ).all() as (TrialRow & { email: string | null; full_name: string | null })[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Pilot applications (B2B hospital lead intake from dosys.health/pilot)
// ─────────────────────────────────────────────────────────────────────────────

export type PilotApplicationStatus = "pending" | "approved" | "rejected" | "archived";

export interface PilotApplicationRow {
  id: number;
  contact_name: string;
  contact_title: string;
  hospital_name: string;
  email: string;
  phone: string | null;
  bed_count: number | null;
  current_monitoring: string | null;
  source: string;
  submitted_at: string;
  idempotency_key: string;
  status: PilotApplicationStatus;
  reviewed_at: string | null;
  reviewed_by: number | null;
  review_notes: string | null;
  tenant_id: number | null;
  created_at: string;
}

export interface CreatePilotApplicationInput {
  contact_name: string;
  contact_title: string;
  hospital_name: string;
  email: string;
  phone?: string | null;
  bed_count?: number | null;
  current_monitoring?: string | null;
  source: string;
  submitted_at: string;
  idempotency_key: string;
}

export function findPilotApplicationByIdempotencyKey(
  key: string,
): PilotApplicationRow | undefined {
  return getDb()
    .prepare("SELECT * FROM pilot_applications WHERE idempotency_key = ?")
    .get(key) as PilotApplicationRow | undefined;
}

export function createPilotApplication(input: CreatePilotApplicationInput): number {
  const result = getDb()
    .prepare(
      `INSERT INTO pilot_applications
        (contact_name, contact_title, hospital_name, email, phone, bed_count,
         current_monitoring, source, submitted_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.contact_name,
      input.contact_title,
      input.hospital_name,
      input.email,
      input.phone ?? null,
      input.bed_count ?? null,
      input.current_monitoring ?? null,
      input.source,
      input.submitted_at,
      input.idempotency_key,
    );
  return Number(result.lastInsertRowid);
}

export function getPilotApplicationById(id: number): PilotApplicationRow | undefined {
  return getDb()
    .prepare("SELECT * FROM pilot_applications WHERE id = ?")
    .get(id) as PilotApplicationRow | undefined;
}

export function listPilotApplications(filter?: {
  status?: PilotApplicationStatus;
}): PilotApplicationRow[] {
  if (filter?.status) {
    return getDb()
      .prepare(
        "SELECT * FROM pilot_applications WHERE status = ? ORDER BY created_at DESC",
      )
      .all(filter.status) as PilotApplicationRow[];
  }
  return getDb()
    .prepare("SELECT * FROM pilot_applications ORDER BY created_at DESC")
    .all() as PilotApplicationRow[];
}

export function updatePilotApplicationStatus(args: {
  id: number;
  status: PilotApplicationStatus;
  reviewed_by: number;
  review_notes?: string | null;
}): void {
  getDb()
    .prepare(
      `UPDATE pilot_applications
       SET status = ?, reviewed_at = datetime('now'), reviewed_by = ?, review_notes = ?
       WHERE id = ?`,
    )
    .run(args.status, args.reviewed_by, args.review_notes ?? null, args.id);
}

export function setPilotApplicationTenant(id: number, tenantId: number): void {
  getDb()
    .prepare("UPDATE pilot_applications SET tenant_id = ? WHERE id = ?")
    .run(tenantId, id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pilot provisioning helpers (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create the institution-admin user for a freshly-provisioned hospital pilot.
 * Mirrors createInvitedTeamMember but sets institutional_role='admin' so the
 * applicant can invite their own team. password_hash is a random unguessable
 * value — they sign in via magic link only.
 */
export function createPilotPrimaryUser(input: {
  email: string;
  full_name: string;
  credentials: string;
  password_hash: string;
  institutional_account_id: number;
}): number {
  const username = input.email.split("@")[0].slice(0, 32) + "_" + String(Date.now()).slice(-6);
  const result = getDb()
    .prepare(
      `INSERT INTO users (
         username, email, password_hash, full_name, credentials,
         status, role, institutional_account_id, institutional_role,
         subscription_tier, agreed_disclaimer, agreed_terms,
         confirmed_hcp, confirmed_age
       ) VALUES (?, ?, ?, ?, ?, 'active', 'pharmacist', ?, 'admin', 'hospital', 1, 1, 1, 1)`,
    )
    .run(
      username,
      input.email.toLowerCase().trim(),
      input.password_hash,
      input.full_name,
      input.credentials,
      input.institutional_account_id,
    );
  return Number(result.lastInsertRowid);
}

/** Set the expiry on an institutional_accounts row. Pass null to clear. */
export function setInstitutionExpiry(institutionalAccountId: number, expiry: string | null): void {
  getDb()
    .prepare("UPDATE institutional_accounts SET subscription_expiry = ? WHERE id = ?")
    .run(expiry, institutionalAccountId);
}

/** Disable every user linked to an institutional_account (revocation). */
export function disableInstitutionUsers(institutionalAccountId: number): number {
  const result = getDb()
    .prepare("UPDATE users SET status = 'disabled' WHERE institutional_account_id = ?")
    .run(institutionalAccountId);
  return result.changes;
}
