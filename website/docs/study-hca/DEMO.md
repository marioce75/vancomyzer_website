# Owner-only study demo

Path: **`/admin/dashboard/study-demo`** (a "Study demo" entry appears in the admin sidebar for the owner only).

Fictional cases only. Research demo. Not for patient care. The demo shows five preloaded fictional cases (timeline, actual doses, draw time), runs the same `predictAtDraw` function as the offline package on the server, and offers a "Reveal fictional lab result" step after the prediction. There is no free-text patient entry, upload, save or export, and nothing is logged or stored.

## Access (enforced on the server)

The page and `GET`/`POST /api/admin/study-demo` serve content only when all of these hold; otherwise they return the site's standard 404 (signed-out visitors are sent to sign-in by the existing middleware, ordinary users to the calculator):

1. `STUDY_DEMO_ENABLED` is exactly `true`.
2. `STUDY_DEMO_OWNER_USER_ID` is set to the owner's numeric account ID (`users.id`).
3. The request carries a valid signed session for that same ID, and the account is, freshly from the database, an active system admin with the current single-session token, an unexpired session, admin activity within 60 minutes, and MFA verified for this session when MFA is enabled (the existing admin checks, reused unchanged).

Missing or malformed configuration denies everyone. No role is added and no existing permission changes. Responses are `Cache-Control: private, no-store` with `Vary: Cookie` and `noindex`.

## Turning it on (only with Mario's approval)

1. Find the owner ID: while signed in as the owner on vancomyzer.com, open `/api/auth/session`; the `user.id` value is the ID the gate compares. Alternatively, in a Render shell: `sqlite3 /data/users.db "select id, username, role, status from users where role='admin';"`.
2. In the Render service environment, set `STUDY_DEMO_OWNER_USER_ID=<that id>` and `STUDY_DEMO_ENABLED=true`. Until both are set, the merged code serves nothing.
3. Sign in as the owner and open `/admin/dashboard/study-demo`.

## Rollback

- Fastest (no deploy): set `STUDY_DEMO_ENABLED=false` (or delete it) in Render and restart. Every request then gets a 404 and the sidebar entry disappears.
- Code: revert the merge commit (`git revert -m 1 <merge sha>`) and redeploy. The demo adds files under `src/lib/studyDemo`, `src/lib/studyTimed`, `src/app/admin/dashboard/study-demo`, `src/app/api/admin/study-demo`, plus a small sidebar change in `src/app/admin/dashboard/layout.tsx`; no database schema, calculator or account code changes, so a revert needs no data migration.
