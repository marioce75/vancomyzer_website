# Vancomyzer™ Admin Runbook

**Audience:** Mario (system superadmin / owner) and any future co-admins.

This is the authoritative operational playbook for ongoing user management,
billing administration, and the research workflow. Update it as procedures
change.

---

## 1. Roles & access tiers — what each one means

There are TWO orthogonal axes for permissions:

### System role (`users.role`)

| Value | What it grants |
|---|---|
| `pharmacist` | Default. Calculator + per-user features (history if Pro, etc.) |
| `admin` | Everything `pharmacist` has, plus the entire `/admin/dashboard/*` console (User Management, Calculations audit, Security, Research, etc.) |

Set via the User Management UI (`/admin/dashboard/users` → PROMOTE / DEMOTE
button) or via the CLI (`scripts/manage-users.ts`).

### Subscription tier (`users.subscription_tier`)

Single source of truth: `src/lib/tiers.ts`.

| Tier | Audience | Self-serve? | Features |
|---|---|---|---|
| `free` | Students / individual clinicians | Yes (no billing) | Calculator, watermarked exports |
| `individual_pro` | Pharmacists / NPs / PAs | Yes (Stripe trial) | + unlimited calcs, history, custom institution name, no watermark |
| `department` | Hospital pharmacy departments | Sales | + 5–20 user seats, `/team` admin panel, audit feed, priority support |
| `hospital` | Health systems | Sales | + EMR/FHIR, SSO/SAML, SOC 2, BAA, custom branding, dedicated support |

### Per-seat institutional role (`users.institutional_role`)

Only meaningful for users bound to an institution (Department or Hospital
tier).

| Value | What it grants |
|---|---|
| `user` | Member of the institution; can use calculator and Pro features |
| `admin` | + can invite/remove/role-toggle teammates from `/team`, see audit feed for the institution |

This is **separate** from the system role above — you can be a `pharmacist`
with `institutional_role='admin'` (you manage your hospital's seats), or
`admin` system-wide with `institutional_role='user'` (rare).

---

## 2. Day-to-day user management

### Approving a new self-registered user

1. Sign in as a system admin.
2. Go to `/admin/dashboard/users`.
3. New users appear with status `pending`.
4. Click **APPROVE** on each row → status flips to `active` and the user
   receives an approval email via SMTP.
5. If the email send fails (SMTP misconfigured), use **RESEND EMAIL** later.

### Disabling a user (reversible)

1. `/admin/dashboard/users` → row → **DISABLE**.
2. Status flips to `disabled`. They can no longer sign in.
3. Use **REACTIVATE** later to restore access.

### Permanently deleting a user (irreversible)

1. `/admin/dashboard/users` → row → **DELETE**.
2. Confirms with a browser prompt. Logs `USER_DELETED` to
   `security_audit_log` (severity `critical`).
3. **Safeguards**: you cannot delete yourself or the last system superadmin
   — the API rejects with a 400 error.
4. Their `calculation_log` and `security_audit_log` entries persist — those
   are de-identified by design and remain useful for audit.

### Promoting / demoting system role

1. `/admin/dashboard/users` → row → **PROMOTE** (if pharmacist) or
   **DEMOTE** (if admin). Confirms with a browser prompt.
2. Logs `USER_ROLE_CHANGED` to `security_audit_log` (severity `warn`).
3. **Safeguard**: cannot demote the last system superadmin.

### Changing a user's tier manually

Use this when:
- A user paid for Department/Hospital out of band (sales-driven, no Stripe)
- You're testing tier-gated features
- A user's Stripe subscription got out of sync (rare; webhooks should keep
  it in sync automatically)

1. `/admin/dashboard/users` → row → **TIER**. Browser prompt shows current
   tier; type the new one (`free`, `individual_pro`, `department`, `hospital`).
2. Logs `USER_TIER_CHANGED` to `security_audit_log`.
3. Note: if the user has an active Stripe subscription, their next webhook
   event will overwrite this manual setting. For Stripe-managed users,
   change the tier via the Stripe Dashboard instead.

### Force a password reset

1. `/admin/dashboard/users` → row → **RESET PW**.
2. Generates a one-hour reset token. Send the token URL to the user (the
   reset email is queued automatically when SMTP is configured).
3. The user lands on `/reset-password?token=...` and sets a new password.

### Unlocking a locked account

After 5 failed login attempts, accounts auto-lock for 15 minutes (SOC 2
control A2). To unlock immediately:

1. `/admin/dashboard/users` → row shows **LOCKED** badge → **UNLOCK** button.
2. Logs `ACCOUNT_UNLOCKED`.

---

## 3. Adding a new admin from scratch

The recommended path is to register normally then promote — but for the
**very first** admin (or recovery), use the CLI.

### CLI: create + activate + promote in one go

```bash
cd /Users/vanclab/vancomyzer_website/website

npx tsx scripts/manage-users.ts add \
  --username drsmith \
  --name "Dr Smith" \
  --email drsmith@hospital.org \
  --password "TempPass123!" \
  --credentials "PharmD" \
  --role admin
```

The `--role admin` flag auto-activates the account. They can sign in
immediately at `/login` with `drsmith` / `TempPass123!` and then change
their password via `/reset-password`.

### Heads up — admin MFA enforcement

Admin accounts have MFA enabled by default in `authOptions.ts` (SOC 2
control A1). If MFA isn't set up for the admin yet, login redirects to
`/mfa-verify` with a 6-digit code prompt they don't yet have. Two options:

- **Set up MFA via the admin's own session**: `/admin/dashboard/security` has
  the QR code generator
- **Skip MFA for testing**: create with `--role pharmacist` then promote via
  the UI later (pharmacists don't have MFA enforcement)

---

## 4. Billing administration

### Routine

Stripe handles all subscription state. You typically won't touch tiers
manually — webhook events from `stripe listen` (dev) or Stripe's production
webhook (live) update `users.subscription_tier` automatically.

### When you DO need to intervene

| Situation | Action |
|---|---|
| User's Stripe subscription stuck in `past_due` | Look up customer in Stripe Dashboard → retry invoice or contact them |
| Manual tier override (sales deal, free comp) | Use **TIER** button on User Management page |
| Department/Hospital paid via invoice (no Stripe) | Use **TIER** button + create institutional account row via SQL |
| User got the wrong tier from a webhook race | Check `security_audit_log` for `SUBSCRIPTION_UPDATED` events; manually correct via TIER button |

### Setting up a Department/Hospital institution manually (for sales-driven tiers)

```bash
cd /Users/vanclab/vancomyzer_website/website

npx tsx scripts/manage-users.ts make-team \
  --username drsmith \
  --institution "Mercy General Hospital" \
  --seats 15 \
  --tier department
```

This creates the `institutional_accounts` row and binds the named user as
its admin. They can then visit `/team` to invite the rest of their staff.

For tier `hospital` instead of `department`, swap the value.

### Cancellations / refunds

Stripe Dashboard handles these. Local DB updates automatically when the
webhook fires.

---

## 5. Research workflow

The research module lives under `/research` (gated by `role === 'admin'`)
with API routes under `/api/research/*`. Source files: `src/app/research/*`,
`src/app/api/research/*`.

### Enrolling a research patient

1. Sign in as system admin.
2. Go to `/research`.
3. Click **Enter** (or navigate to `/research/enter`).
4. Fill in the de-identified patient parameters:
   - Demographics, dosing history, levels, nephrotoxin co-exposure, SCr trend,
     outcomes
5. Save. The patient gets a research ID (no MRN, no patient name).

**PHI rule**: research records are de-identified by design. Do not paste
patient names, MRNs, or any HIPAA identifiers into any field. The schema
has no field for them.

### Exporting research data

1. `/research` → **Export** button → CSV download.
2. The export includes only de-identified fields suitable for IRB analysis.
3. Logs `RESEARCH_EXPORT` to `security_audit_log`.

### Reviewing research progress on the dashboard

`/admin/dashboard/research` shows enrollment progress, eligibility breakdown
(BMI subgroups), and outcome counts. Polled from
`/api/admin/dashboard/overview`.

### Daily / weekly cadence (when research is live)

| Cadence | Task |
|---|---|
| Daily | Check `/admin/dashboard` for new research patients enrolled in last 24h |
| Weekly | Export CSV + back up to your IRB-approved storage |
| Monthly | Reconcile enrolled count against actual cases at participating sites |
| Quarterly | Review `/admin/dashboard/security` for anomalous access patterns |

---

## 6. Database operations (escape hatch)

When the UI doesn't expose what you need, you can query the SQLite database
directly. **Always back up first.**

### Backup

```bash
sqlite3 /Users/vanclab/vancomyzer_website/website/data/users.db ".backup /tmp/users-backup-$(date +%Y%m%d-%H%M%S).db"
```

In production (Render persistent disk), the path is `/data/users.db`.

### Inspect a user

```bash
sqlite3 /Users/vanclab/vancomyzer_website/website/data/users.db \
  "SELECT id, username, email, role, status, subscription_tier, institutional_account_id, institutional_role FROM users;"
```

### Inspect institutional accounts

```bash
sqlite3 /Users/vanclab/vancomyzer_website/website/data/users.db \
  "SELECT * FROM institutional_accounts;"
```

### Manual tier change

```bash
sqlite3 /Users/vanclab/vancomyzer_website/website/data/users.db \
  "UPDATE users SET subscription_tier = 'department' WHERE email = 'drsmith@hospital.org';"
```

### Manual hard delete

```bash
sqlite3 /Users/vanclab/vancomyzer_website/website/data/users.db \
  "DELETE FROM users WHERE id = 5;"
```

Prefer the UI **DELETE** button over raw SQL — the UI logs to
`security_audit_log` and runs the last-admin safeguard.

---

## 7. Security audit trail

Every user-mutation action logs to `security_audit_log` with severity
ranging from `info` to `critical`. View at `/admin/dashboard/security`.

Actions that get logged automatically:

| Action | Severity |
|---|---|
| `LOGIN_SUCCESS` / `LOGIN_FAILED` | info / warn |
| `ACCOUNT_LOCKED` | critical |
| `ACCOUNT_UNLOCKED` | info |
| `ACCOUNT_REACTIVATED` | info |
| `USER_DELETED` | critical |
| `USER_ROLE_CHANGED` | warn |
| `USER_TIER_CHANGED` | info |
| `MAGIC_LINK_REQUESTED` / `_SENT` / `_FAILED` | info / info / warn |
| `TEAM_MEMBER_INVITED` / `_REMOVED` / `_ROLE_CHANGED` / `_REBOUND` | info |
| `SUBSCRIPTION_UPDATED` / `_CANCELED` / `_PAYMENT_FAILED` | info / info / warn |
| `RESEARCH_EXPORT` | info |
| `SESSION_EXPIRED` | info |

Retention: log table grows monotonically. Periodically archive entries older
than 1 year to a cold-storage backup.

---

## 8. Quick troubleshooting

### "Dashboard says X total users but the list shows fewer"

Fixed in commit `(see git log)`. The User Management page now reads the
flat `data.users` array from `/api/admin` which includes every status. If
you still see a mismatch, hard-refresh the page (Cmd+Shift+R).

### "I deleted myself by accident"

You can't — the API has a self-protection guard. If somehow you did, use
the CLI:

```bash
cd /Users/vanclab/vancomyzer_website/website
npx tsx scripts/manage-users.ts add --username admin2 --name "Recovery Admin" \
  --email recovery@example.com --password "Recover123!" --credentials "Owner" --role admin
```

### "User can't sign in — locked"

Use the **UNLOCK** button in User Management, or:

```bash
sqlite3 .../users.db "UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE username = 'someone';"
```

### "Stripe webhook isn't updating the DB"

Three things to check, in order:
1. Is `stripe listen --forward-to localhost:3000/api/billing/webhook` running?
2. Does `STRIPE_WEBHOOK_SECRET` in `.env.local` match what `stripe listen`
   printed at startup?
3. Did you restart `npm run dev` after editing `.env.local`?

### "Magic-link sign-in returns 500 with NEXTAUTH_SECRET error"

Add a stable secret to `.env.local`:

```bash
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> /Users/vanclab/vancomyzer_website/website/.env.local
```

Restart the dev server.

---

## 9. Production deploy checklist

Before pushing to production:

- [ ] `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
      set to **live mode** values (not `sk_test_…` / `pk_test_…`)
- [ ] `STRIPE_PRICE_PRO_MONTHLY` and `STRIPE_PRICE_PRO_ANNUAL` point to
      live-mode prices (created in Stripe Dashboard)
- [ ] Webhook URL registered in Stripe Dashboard:
      `https://vancomyzer.com/api/billing/webhook` with the same events the
      dev `stripe listen` was forwarding
      (`customer.subscription.*`, `invoice.payment_failed`)
- [ ] `NEXTAUTH_URL` matches the production domain
      (`https://vancomyzer.com` or whatever you deploy)
- [ ] `NEXTAUTH_SECRET` is a strong random string, not the dev fallback
- [ ] `NEXT_PUBLIC_APP_URL` matches the production domain
- [ ] SMTP credentials valid in production env
- [ ] Database backup taken
- [ ] At least one system superadmin account exists and you can sign in
- [ ] dosys.health/legal/* documents are published

---

## 10. Useful commands cheat sheet

```bash
# Create + activate + promote new admin
npx tsx scripts/manage-users.ts add --username NAME --name "FULL" --email EMAIL --password PASS --credentials CREDS --role admin

# Activate a pending user (admins skip pending; pharmacists need this)
npx tsx scripts/manage-users.ts approve --username NAME

# Disable
npx tsx scripts/manage-users.ts disable --username NAME

# Reset password
npx tsx scripts/manage-users.ts reset-password --username NAME --password NEWPASS

# List all
npx tsx scripts/manage-users.ts list

# Set up a Department/Hospital institution + bind a user as admin
npx tsx scripts/manage-users.ts make-team --username NAME --institution "Hospital Name" --seats 10 --tier department
```

For ad-hoc DB queries, see Section 6 above.
