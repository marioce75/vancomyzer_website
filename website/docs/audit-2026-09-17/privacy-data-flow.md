# Clinical-data flow audit and draft privacy/BAA language (facts first)

## Facts established from the code (branch audit/engine-remediation)

| Flow | What | Where | Retention |
|---|---|---|---|
| Browser memory / storage | Inputs + last result (incl. `result_snapshot`) in `sessionStorage` (`vancomyzer_calculator_state`, 8 h TTL); settings, disclaimer acceptance, graph zoom, detail tab in local/session storage | `CalculatorWorkspace.tsx` | tab lifetime / 8 h |
| API payload | age, weight, height, sex, SCr, RRT flag, regimen, levels (value + collection timestamp + hours), optional case_id, intent | `POST /api/calculate` over HTTPS | transient |
| Calculation audit log | JSON to **stdout** (`[VANCOMYZER AUDIT]`) + in-memory ring buffer: mode, duration, status, **user_email**, inputs (age, weight, SCr, regimen, level count), outputs (AUC, peak, trough, recommended dose), PK parameters | `src/lib/auditLog.ts`, route.ts | stdout: host log retention (Render) — **not controlled by the app**; buffer: process lifetime |
| Fit diagnostics | `security_audit_log` row `BAYESIAN_FIT_DIAGNOSTIC` (prior/posterior CL,V1, shifts, residuals) with user id/username | `src/lib/db.ts` (SQLite `data/users.db`) | **indefinite** (no purge found) |
| Calculation history | `calculation_log` row for history-tier users on explicit calculations, with case_id (identifier-pattern refused) | `persistCalculation`, `calculationHistory.ts` | 90 days (`purgeOldCalculationsIfNeeded`) |
| Auth / magic links | NextAuth session cookies; magic-link tokens; MFA secrets | `authOptions.ts`, `magicLink.ts`, `mfa.ts` | per implementation |
| Backups | SQLite file on host disk | Render persistent disk | host policy |
| Exports | PDF/note generated **client-side** from the response; nothing sent to a server | `generateReport.ts` | user device |
| Error reports / analytics | cookie-free analytics events (no clinical values); no error-reporting SaaS found | `Analytics.tsx`, `analytics.ts` | provider |
| Subprocessors | hosting (Render), email (nodemailer/SMTP), Stripe, analytics provider | env config | — |

Derived clinical values (age + weight + SCr + timestamps of level draws) are
**not automatically de-identified**: with an account they are linked to a
named user, and collection timestamps are exact date-times.

## Claims that the facts do not support (as of 17 Sep 2026)
1. dosys.health/legal/baa: "processed in-session on the client side and is not
   persisted to any Dōsys server, database, or log" — **false** (server-side
   calculation; three server-side records above).
2. vancomyzer.com/privacy "HIPAA Notice": "no PHI is transmitted or stored
   through this tool" — states a policy (do not enter PHI), not a fact; level
   collection date-times and age are entered and stored. "does not function as
   a business associate" conflicts with offering a BAA to Department plans.
3. Any "client-side only", "no PHI", "HIPAA compliant", "no BAA required"
   wording — not substantiated.

## Draft language (for counsel; not published)
**Privacy — How calculator information is handled (replace HIPAA Notice):**
"Calculations run on our servers. The clinical values you enter (age, weight,
height, sex, serum creatinine, dialysis status, the regimen, and each measured
level with its collection time) are sent over HTTPS and are recorded, together
with the results and the model version, in server logs for safety monitoring
and quality improvement. If you are signed in, those records are linked to your
account. Fit diagnostics (estimated clearance and volume, prediction errors)
are stored in a database indefinitely [retention to be set — see §Minimisation].
We do not ask for names, medical record numbers or dates of birth, and case
labels that look like identifiers are refused, but the values you enter can be
health information about an identifiable person in combination with other
data you hold. Institutions that require a Business Associate Agreement should
not use the open-access calculator with patient data until one is executed."

**BAA page:** delete the "client-side / not persisted" paragraph; describe the
flows above; state that a BAA is required before entering data that is PHI in
the institution's hands; keep the 60-day breach-notification clause only if
operationally supported.

## Minimisation, retention and access controls to implement (proposed)
- Stop logging `user_email` in the stdout audit line; log a hashed user id.
- Drop level collection timestamps from all server logs (keep hours-since-dose).
- Retention: purge `security_audit_log` fit-diagnostic rows and `calculation_log`
  after a fixed period (e.g. 24 months, if that is the policy) via a cron;
  document the chosen period on /privacy.
- Restrict admin access to logs; record admin reads in the security log.
- Data-export/deletion path for account holders.
None of these were implemented in this pass (policy decisions first).
