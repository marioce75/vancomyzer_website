import type Database from "better-sqlite3";
import { normalizeTier, type TierId } from "./tiers";

export interface ComplimentaryPro {
  active: boolean;
  expiresAt: string | null;
  reason: string;
}

export function prepareComplimentaryPro(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS complimentary_pro (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT, reason TEXT NOT NULL, granted_by INTEGER NOT NULL,
    granted_at TEXT NOT NULL, revoked_at TEXT
  )`);
}

export function readComplimentaryPro(db: Database.Database, userId: number, now = Date.now()): ComplimentaryPro {
  const row = db.prepare("SELECT expires_at, reason, revoked_at FROM complimentary_pro WHERE user_id = ?").get(userId) as
    { expires_at: string | null; reason: string; revoked_at: string | null } | undefined;
  return {
    active: !!row && !row.revoked_at && (!row.expires_at || Date.parse(row.expires_at) > now),
    expiresAt: row?.expires_at ?? null,
    reason: row?.reason ?? "",
  };
}

export function effectiveTier(billingTier: unknown, grant: ComplimentaryPro): TierId {
  const tier = normalizeTier(billingTier);
  return tier === "free" && grant.active ? "individual_pro" : tier;
}

export function writeComplimentaryPro(db: Database.Database, userId: number, adminId: number, reason: unknown, expiresAt: unknown, now = Date.now()) {
  if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 500) throw new Error("Enter a reason of 1–500 characters.");
  if (expiresAt !== null && (typeof expiresAt !== "string" || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now)) throw new Error("Choose a future expiration date, or leave it blank.");
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt).toISOString() : null;
  db.prepare(`INSERT INTO complimentary_pro (user_id, expires_at, reason, granted_by, granted_at, revoked_at)
    VALUES (?, ?, ?, ?, ?, NULL) ON CONFLICT(user_id) DO UPDATE SET expires_at=excluded.expires_at,
    reason=excluded.reason, granted_by=excluded.granted_by, granted_at=excluded.granted_at, revoked_at=NULL`)
    .run(userId, expiry, reason.trim(), adminId, new Date(now).toISOString());
}

export function revokeComplimentaryPro(db: Database.Database, userId: number) {
  db.prepare("UPDATE complimentary_pro SET revoked_at = ? WHERE user_id = ?").run(new Date().toISOString(), userId);
}
