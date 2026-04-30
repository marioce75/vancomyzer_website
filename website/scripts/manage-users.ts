#!/usr/bin/env tsx
/**
 * CLI tool for managing Vancomyzer users.
 *
 * Usage:
 *   npx tsx scripts/manage-users.ts add --username admin --name "Admin" --credentials "Admin" --email "admin@example.com" --password "Pass123!" --role admin
 *   npx tsx scripts/manage-users.ts list
 *   npx tsx scripts/manage-users.ts approve --username jsmith
 *   npx tsx scripts/manage-users.ts disable --username jsmith
 *   npx tsx scripts/manage-users.ts reset-password --username jsmith --password "NewPass123!"
 */

import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const DATA_DIR = fs.existsSync("/data") ? "/data" : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "users.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Ensure table exists
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

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length) {
      result[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return result;
}

const command = process.argv[2];
const opts = parseArgs(process.argv.slice(3));

async function main() {
  switch (command) {
    case "add": {
      const { username, name, email, password, credentials, role, institution } = opts;
      if (!username || !name || !email || !password || !credentials) {
        console.error("Required: --username --name --email --password --credentials");
        process.exit(1);
      }
      const hash = await bcrypt.hash(password, 12);
      const isAdmin = role === "admin";
      try {
        db.prepare(`
          INSERT INTO users (username, email, password_hash, full_name, credentials, institution, role, status,
                             agreed_disclaimer, agreed_terms, confirmed_hcp, confirmed_age, first_login_acknowledged)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 1, ?)
        `).run(username, email.toLowerCase(), hash, name, credentials, institution ?? null, role ?? "pharmacist", isAdmin ? "active" : "pending", isAdmin ? 1 : 0);
        console.log(`✓ User '${username}' created (${isAdmin ? "active admin" : "pending"}).`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`✗ Failed: ${msg}`);
      }
      break;
    }

    case "list": {
      const users = db.prepare("SELECT id, username, email, full_name, credentials, role, status, last_login FROM users ORDER BY id").all() as Array<Record<string, unknown>>;
      if (users.length === 0) { console.log("No users."); break; }
      console.log(`\n${"ID".padEnd(5)} ${"Username".padEnd(15)} ${"Name".padEnd(20)} ${"Role".padEnd(12)} ${"Status".padEnd(10)} Last Login`);
      console.log("-".repeat(90));
      for (const u of users) {
        console.log(`${String(u.id).padEnd(5)} ${String(u.username).padEnd(15)} ${String(u.full_name).padEnd(20)} ${String(u.role).padEnd(12)} ${String(u.status).padEnd(10)} ${u.last_login ?? "Never"}`);
      }
      console.log(`\nTotal: ${users.length} users`);
      break;
    }

    case "approve": {
      if (!opts.username) { console.error("Required: --username"); process.exit(1); }
      const result = db.prepare("UPDATE users SET status = 'active', approved_at = datetime('now'), approved_by = 'cli' WHERE username = ? AND status = 'pending'").run(opts.username);
      console.log(result.changes > 0 ? `✓ User '${opts.username}' approved.` : `✗ User '${opts.username}' not found or not pending.`);
      break;
    }

    case "disable": {
      if (!opts.username) { console.error("Required: --username"); process.exit(1); }
      const result = db.prepare("UPDATE users SET status = 'disabled' WHERE username = ?").run(opts.username);
      console.log(result.changes > 0 ? `✓ User '${opts.username}' disabled.` : `✗ User '${opts.username}' not found.`);
      break;
    }

    case "reset-password": {
      if (!opts.username || !opts.password) { console.error("Required: --username --password"); process.exit(1); }
      const hash = await bcrypt.hash(opts.password, 12);
      const result = db.prepare("UPDATE users SET password_hash = ? WHERE username = ?").run(hash, opts.username);
      console.log(result.changes > 0 ? `✓ Password reset for '${opts.username}'.` : `✗ User '${opts.username}' not found.`);
      break;
    }

    case "make-team": {
      // One-shot Department test setup:
      //   - Creates institutional_accounts row (or reuses existing by name)
      //   - Promotes the named user to that institution + admin role + tier
      // Usage:
      //   npx tsx scripts/manage-users.ts make-team \
      //     --username pharm \
      //     --institution "Test Hospital" \
      //     --seats 10 \
      //     --tier department
      const { username, institution, seats, tier } = opts;
      if (!username || !institution) {
        console.error("Required: --username --institution. Optional: --seats (default 10), --tier (default department)");
        process.exit(1);
      }

      // Ensure institutional_accounts table exists (if a fresh DB)
      db.exec(`
        CREATE TABLE IF NOT EXISTS institutional_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          institution_name TEXT NOT NULL,
          billing_email TEXT NOT NULL,
          plan_tier TEXT NOT NULL DEFAULT 'department' CHECK (plan_tier IN ('department', 'hospital', 'enterprise')),
          seats_allocated INTEGER NOT NULL DEFAULT 5,
          seats_used INTEGER NOT NULL DEFAULT 0,
          subscription_start TEXT NOT NULL DEFAULT (datetime('now')),
          subscription_expiry TEXT,
          baa_status TEXT DEFAULT 'not_requested' CHECK (baa_status IN ('not_requested', 'pending', 'active')),
          baa_requested_at TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Ensure subscription/institutional columns exist on users
      try { db.exec("ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free'"); } catch { /* exists */ }
      try { db.exec("ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'active'"); } catch { /* exists */ }
      try { db.exec("ALTER TABLE users ADD COLUMN institutional_account_id INTEGER"); } catch { /* exists */ }
      try { db.exec("ALTER TABLE users ADD COLUMN institutional_role TEXT DEFAULT 'user'"); } catch { /* exists */ }

      const user = db.prepare("SELECT id, email FROM users WHERE username = ?").get(username) as { id: number; email: string } | undefined;
      if (!user) { console.error(`✗ User '${username}' not found. Create them first with the 'add' command.`); process.exit(1); }

      const planTier = tier ?? "department";
      if (!["department", "hospital", "enterprise"].includes(planTier)) {
        console.error(`✗ tier must be 'department', 'hospital', or 'enterprise' (got '${planTier}')`);
        process.exit(1);
      }

      const seatsAllocated = Number(seats ?? 10);
      if (!Number.isInteger(seatsAllocated) || seatsAllocated < 1) {
        console.error(`✗ seats must be a positive integer (got '${seats}')`);
        process.exit(1);
      }

      let account = db.prepare("SELECT id FROM institutional_accounts WHERE institution_name = ?").get(institution) as { id: number } | undefined;
      if (!account) {
        const result = db.prepare(
          `INSERT INTO institutional_accounts (institution_name, billing_email, plan_tier, seats_allocated)
           VALUES (?, ?, ?, ?)`,
        ).run(institution, user.email, planTier, seatsAllocated);
        account = { id: Number(result.lastInsertRowid) };
        console.log(`✓ Created institutional account #${account.id} '${institution}' (${planTier}, ${seatsAllocated} seats).`);
      } else {
        db.prepare("UPDATE institutional_accounts SET plan_tier = ?, seats_allocated = ? WHERE id = ?").run(planTier, seatsAllocated, account.id);
        console.log(`✓ Updated existing institutional account #${account.id} '${institution}' (${planTier}, ${seatsAllocated} seats).`);
      }

      db.prepare("UPDATE users SET institutional_account_id = ?, institutional_role = 'admin', subscription_tier = ? WHERE id = ?")
        .run(account.id, planTier, user.id);

      // Recount seats
      const cnt = (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE institutional_account_id = ?").get(account.id) as { cnt: number }).cnt;
      db.prepare("UPDATE institutional_accounts SET seats_used = ? WHERE id = ?").run(cnt, account.id);

      console.log(`✓ User '${username}' bound to '${institution}' as institutional admin (tier: ${planTier}, ${cnt}/${seatsAllocated} seats used).`);
      console.log(`  Sign in as '${username}' and visit /team to see the admin panel.`);
      break;
    }

    default:
      console.log("Commands: add, list, approve, disable, reset-password, make-team");
      console.log("Example: npx tsx scripts/manage-users.ts add --username admin --name \"Admin\" --credentials \"Admin\" --email \"admin@example.com\" --password \"Pass123!\" --role admin");
      console.log("Example: npx tsx scripts/manage-users.ts make-team --username pharm --institution \"Test Hospital\" --seats 10 --tier department");
  }
}

main().then(() => db.close());
