# Approved integrated pediatric research-preview release

Production base: 5bf4bf0. Integrated changes: 53cedb7 (timing, UTF-8 limits, session-bound MFA) and 619820f (research regimen comparison). Integration commits fd7d817 and a66e939 preserve both sets of test scripts. Conflicts were confined to test scripts/package commands and generated test evidence. Generated screenshots and results were refreshed using the combined fixture.

Validation: full npm test, production build and 131 synthetic HTTP/browser checks passed. This includes uncommon/fallback timezones, year bounds, UTF-8 limits, same-second MFA, stale-session denial, real synthetic TOTP verification, research acknowledgement, recommendation selection/application, preserved timestamps and delayed-response invalidation. Adult PK, adult calculator components/API and public navigation have no changes.

The approved additive migration creates nullable users.mfa_verified_session_token. Existing MFA-enabled sessions without bound proof must reverify at /mfa-verify or sign out/in. No credentials, roles or MFA secrets are changed by the migration. The app retains admin-only access and research-only restrictions. All original clinical/model and shortlist limitations remain.

## Rollback and release gates

Do not drop the new nullable column: old schema consumers tolerate it and removal would destroy proof unnecessarily. If regimen UI needs rollback, redeploy the fixes-only revision fd7d817 or forward-revert a66e939, preserving the timing, byte-limit and session-bound MFA protections. The fixes-only revision is equivalent to independently tested 53cedb7 on the production merge base. No rollback has been executed.

The previous live revision 5bf4bf0 contains known time/MFA/byte-limit defects and is not the preferred rollback target. Do not silently weaken authorization to restore access; an MFA sign-in failure requires diagnosis/reverification or a reviewed correction. Deployment requires successful integrated checks. After deployment, verify Render/live health commit, anonymous/invalid-session rejection, and an existing signed-in admin using synthetic inputs. Do not create credentials or access patient data. Signed-in production smoke tests depend on the owner's existing sign-in session.

Historical notes in PR48-FOLLOWUP.md and RESEARCH-REGIMENS.md describe separate branches before integration; this document supersedes their isolation/release-block statements for this combined release.
