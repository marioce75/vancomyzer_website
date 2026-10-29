# PR #48 follow-up — isolated candidate, not deployed

The four reviewed findings reproduce in production commit 5bf4bf0. This branch fixes them without changing adult clinical calculations, pediatric model equations, research warnings, eligibility restrictions or clinical-validation status.

## Changes

- Wall-clock parser and resolver independently refuse noninteger fields, invalid calendar dates and years outside 1900–2199 before Date.UTC. Year 0026 can no longer silently become 1926.
- The selected, validated runtime timezone is included in the selector options, including uncommon zones and browsers without Intl.supportedValuesOf. The UI's selected option and submitted offsets use the same state.
- Calculation and acknowledgement endpoints stream and count actual request bytes, cancel beyond 65,536 bytes, and decode UTF-8 incrementally. Authorization and acknowledgement still precede calculation-body reading. Invalid UTF-8/JSON is refused.
- Successful MFA stores proof bound to the exact signed-in session using a conditional database update. A changed/revoked session cannot acquire that proof. Both pediatric authorization and the pending-MFA session-refresh callback require matching proof; equal timestamps are allowed because session identity, rather than timestamp ordering, establishes freshness. Disabling MFA clears the proof.

## Release impact and limits

The MFA fix adds the nullable users.mfa_verified_session_token column and changes the shared MFA verification endpoint and session-refresh callback. It does not alter passwords, MFA secrets, role grants or adult clinical code. No migration or authentication change has been applied to production. On a future approved deployment, existing MFA-enabled sessions without bound proof must verify once at /mfa-verify (or sign out and sign in again). No existing timestamp-only proof is grandfathered in.

Existing already-verified JWTs are not globally revoked by this change; pediatric authorization always checks fresh database proof. The shared authentication behavior outside this fix has not received a complete security audit. Clinical research/model limitations remain unchanged.

## Verification

- Production build passed (existing lint warnings remain).
- 126 isolated HTTP/browser checks passed, including real MFA verification with synthetic TOTP, invalid code and stale-session refusal, same-second proof, session-refresh behavior, authorization and research acknowledgement.
- Browser tests verify Etc/GMT+5 and Europe/Paris without supportedValuesOf: selected visible zone equals state, submitted offsets are -05:00/+01:00, and year 0026 cannot yield a result. Existing DST gap/fold tests pass.
- 53 authorization/acknowledgement policy checks, 84 engine checks, 602 validation checks plus missing-time scenarios, 48 timezone checks in six process configurations, 381 independent reference checks, and 7 bounded-body test scenarios passed.
- Full application regression suite passed with exit status 0; output is recorded in /tmp/pediatric-fix-final-full-tests.log.

All fixtures use isolated synthetic accounts and data. No production data, credentials or patient records accessed. Not pushed or deployed; live changes require owner approval.
