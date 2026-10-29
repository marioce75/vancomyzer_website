# Pediatric admin research preview — readiness, 2026-10-29 (revision 4)

Status: **functional research preview**, admin-only, per-session research acknowledgement required, not clinically validated, not for patient care, not deployed. The Colin 2019 model is implemented in full (covariates, η-coupled compartmental allometry, study effects, published Ω and Σ) on the supplementary-NONMEM parameterisation, which is held as a **research candidate pending the authors' clarification** of the article/supplement discrepancy (MODEL-RESOLUTION.md). The owner's message to the corresponding author is outstanding; no further contact is to be made from this work. Adult calculations are unchanged (no file under `src/lib/pk` was modified; `npm test` passes).

## Owner decisions applied in this revision

| # | Decision (2026-10-29) | Implementation |
|---|---|---|
| 1 | Supplementary formulation as a clearly labelled research candidate; discrepancy not described as resolved; no further author contact | `FORMULATION_STATUS = "candidate_pending_author_clarification"`, statement shown in the notice, every result's assumptions and limitations, status API; documents reworded |
| 2 | Correct the postmenstrual-age conversion; reconcile 365.25-day years with the article's PNA + 40/52 rule; independent boundary cases | `PMA_years = PNA_days/365.25 + GA_weeks/52` (reproduces PMA_R = 35 + 40/52 and the non-neonatal rule exactly; ≤ 0.33 days from the neonatal clinical convention); clinical PMA shown beside the model value; 19 independent Python boundary cases replayed by the reference test; AGE-CONVENTION.md |
| 3 | Refuse the dataset gap outright; document boundaries and evidence; no "validated by inclusion" claim | Open interval PMA (0.88, 2.58) y refused on `patient.postnatal_age` with the Oudin/van der Meer evidence and postnatal-day equivalents for the entered GA; `acknowledge_dataset_gap` removed from the contract and ignored if sent; DATASET-COVERAGE.md; limitation text in every result |
| 4 | Admin-only plus a per-session research acknowledgement, enforced server-side and in the interface | `POST /api/admin/pediatric/acknowledge` issues an HMAC-signed httpOnly cookie bound to user id, hashed login session token and statement version (12 h backstop); `POST /api/admin/pediatric` checks admin, then acknowledgement, then reads the body; the workspace hides the form until acknowledged and re-locks on `acknowledgement_required` |
| 5 | Investigate the 83.75 % / 82.92 % interval coverage | Cause: Laplace normal approximation (14–16 % too narrow, centred 4 % low); simulation, Ω, σ and interval definition verified calibrated via the exact posterior. Engine now uses importance sampling of the exact posterior: coverage 89.4 % / 89.8 %. INTERVAL-COVERAGE.md |
| 6 | Adult engine unchanged; no author message, credential, access, deployment, patient-data or clinical-use change | Confirmed by `git diff --stat` (nothing under `src/lib/pk`, `src/lib/db.ts`, `src/lib/authOptions.ts`, `src/middleware.ts`) |

## Revision 3: input-validation and timing defects (independent review of acb9984)

| Defect | Fix |
|---|---|
| `age.unit in AGE_DAYS` accepted inherited names (`toString`) and returned "ok" with null age/PMA/clearance | Units matched against fixed lists; every required number must be finite; a result containing any non-finite number or a missing required numeric field is discarded and returned as `invalid` |
| `2026-02-30` normalised to 2 March; `24:00` accepted | `parseStrictTimestamp`: field-by-field ISO 8601 check (real calendar days with the Gregorian leap rule, 00-23 h, 00-59 min/s, offset within ±14:00, year 1900-2199); offset mandatory, so local wall-clock ambiguity across daylight-saving changes cannot arise; the workspace shows the resolved UTC instant beside every date field |
| A level 48 h after the only dose was fitted while the forecast ran from hour 6 | Forecast semantics defined and reported in `timeline`: the window starts at the explicitly entered `regimen.next_dose_start`, required with a history, and must lie after every level; otherwise the request is refused with the two valid repairs (record the missing doses, or supply `next_dose_start`). Nothing is moved or inferred |
| A two-year-old at 0.4 kg passed | Documented impossibility limits (`IMPOSSIBLE_LIMITS`): ≥ 2 kg from 1 year, ≥ 5 kg from 5 years, ≥ 10 kg from 10 years, ≤ 8 kg in the first 28 days, ≤ 20 kg under 1 year, ≥ 1.5 kg for a term newborn under 7 days; model-population weight bands from Table 1 are warned, not refused |

Details: INPUT-VALIDATION.md.

## Revision 4: evidence-based input rules, infusion overlap, daylight-saving handling, audit rows

| Item | Change |
|---|---|
| Weight/age rules | The invented impossibility limits of revision 3 are withdrawn. Hard refusals now rest only on documented human extremes (weight < 0.2 kg: smallest surviving birth weight 245 g; newborn > 11 kg: heaviest documented birth 9.98 kg) and the preview's scope (160 kg). Unusual-for-age weights (WHO 2006 / CDC 2000 weight-for-age \|z\| > 3, corrected age for preterm birth) stop the calculation until the administrator verifies the entry (`inputs_verified`); model-population boundaries and unknown-validity inputs are reported with sources in `input_review`. CLINICAL-REVIEW.md presents the rules, sources and eight questions for a pediatric clinician |
| Infusion overlap | The explicitly entered forecast anchor is checked against the end of the last recorded infusion; missing planned times are refused; a 12-hour recorded infusion with a q6h regimen is refused with the valid repairs (`validation.test.ts`, HTTP) |
| Daylight-saving time | The workspace no longer uses `Date.parse` on local input. `src/lib/pediatric/localTime.ts` resolves wall-clock entries against an explicitly selected IANA zone or fixed offset: non-existent local times are refused inline, repeated ones require the offset to be chosen, the resolved offset and UTC instant are displayed, and the exact offset-qualified instant is sent. Verified under five process zones and in a Tokyo-zoned Chromium with New-York entries |
| Dose history | Any entry order; absolute timestamps validated; duplicates and overlaps refused by original row number; the result's timeline lists the chronological history with the row numbers as entered |
| Renal function | Unstable renal function is reported as "clinical validity unknown" with the model's time-varying-creatinine estimation and the guideline/KDIGO sources; constant-clearance predictions are not described as validated (CLINICAL-REVIEW.md §4) |

## Access path

Page `/admin/dashboard/pediatric`; API `GET/POST /api/admin/pediatric`, `POST/DELETE /api/admin/pediatric/acknowledge`. Order on every request: middleware session check → signed JWT with the configured secret → fresh system-admin role and active account → current session token → JWT expiry and 60-minute inactivity → database MFA confirmation after the current login → (calculations only) valid acknowledgement for this user, this login session and this statement version → body read. Failure denies (401 from middleware without a token, otherwise 403). Nothing entered is persisted; telemetry is `{status, duration_ms}` and an `acknowledged` event without identity.

## Verification performed (all synthetic; none is clinical validation)

| Suite | Command | Result |
|---|---|---|
| Authorization and acknowledgement policy + wiring | `npm run test:pediatric` (part 1) | 47 cases |
| Engine behaviour: units, boundaries, gap refusal with and without the old flag, neonatal inputs, unsupported populations, prior vs posterior, forecast vs steady state, 1-/2-level recovery, importance-sampling ESS, determinism, extremes | `npm run test:pediatric` (part 2) | 83 checks |
| Validation regression: 15 bad age units incl. inherited names, bad weight/creatinine units, null/NaN/±Infinity/string/boolean in every numeric field, non-finite scan of results, 20 strict-timestamp cases (Feb 30, non-leap Feb 29 incl. 2100, leap days 2024/2000, 24:00, 08:60, :60, offsets ±14:00/+25:00/+14:01, no-offset DST case), forecast anchoring (48-h level refused; repaired by `next_dose_start` or by recording doses), default-anchor overlap (12-h infusion + q6h), next-dose constraints, unordered/duplicate/overlapping doses with audit row numbers, levels before the first dose, infusion and interval boundaries, documented hard limits, verification gate (z-score), model-population and unknown-validity items, age/GA/creatinine boundaries | `npm run test:pediatric` (part 3) | see commit message |
| Local-time resolution: DST gap and fold in New York and Sydney, offset choice, API round trip, fixed offsets, zone validation; the file re-runs itself under TZ = UTC, America/New_York, Asia/Tokyo, Pacific/Kiritimati, America/St_Johns | `npm run test:pediatric` (part 4) | 28 checks × 6 zones |
| Independent reference (Python standard library, RK4 ODE, own Nelder-Mead, own boundary rules): typical parameters both formulations, η/study-effect coupling, ODE profiles, MAP optima, 19 age-convention/boundary cases | `python3 scripts/pediatric/reference-cases.py` then `npm run test:pediatric` (part 5) | 381 checks; parameters 1e-9, ODE 2e-5, MAP η 2e-3, PMA 1e-12 |
| Interval-coverage diagnosis (480 patients × 2 designs × 4 methods × 4 nominal levels) | `npm run test:pediatric:coverage` → `coverage-diagnostics.json` | exact posterior calibrated (89.6 / 89.4 % at 90 %); Laplace 83.8 / 82.9 % |
| Synthetic predictive performance (engine method) | `npm run test:pediatric:synthetic` → `synthetic-performance.json` | prior: MAPE 22 %, coverage 89.6 %, category agreement 48 %; one level: MAPE 13 %, coverage 89.4 %, agreement 68 %; two levels: MAPE 11 %, coverage 89.8 %, agreement 71 %; 0 fit failures |
| HTTP/browser security and validation (fixture DB, real signed cookies, local Next server, Chromium with external traffic blocked) | `PLAYWRIGHT_MODULE=… npm run test:pediatric:http` → `http-browser-results.json`, `admin-preview.png` | 96 checks: every denied state (anonymous, pharmacist, disabled, pending MFA, expired, forged, spoofed headers, demoted, revoked) gets no result even with a valid acknowledgement cookie; acknowledgement refused for non-admins, false/stale/form-encoded bodies; another admin's cookie, a tampered cookie and a pre-re-login cookie refused; gap refused with and without the old flag; over HTTP: `toString`/`constructor`/`__proto__` units, `lb`, null weight, string dose, null dose, Feb 30, non-leap Feb 29, leap day 2024, 24:00, +25:00, −05:00 honoured, 48-h level refused then repaired with `next_dose_start`, next dose before infusion end, duplicate dose, unordered doses/levels, infusion > interval, 2-year-old at 0.4 kg, 10-day-old at 9 kg, 3-year-old at 6 kg warned, 6574/6575-day age boundary; every 4xx body is asserted to contain no dosing fields and no NaN/Infinity; browser shows the acknowledgement first, unlocks after it, renders a result, refuses ECMO and a 12-month-old |
| Adult regression, type check, build | `npm test`, `npx tsc --noEmit`, `npm run build` | pass (see commit message) |

## Remaining limitations

- The verification gate (|z| > 3) and the two documented hard limits are proposals awaiting the clinical review in CLINICAL-REVIEW.md; sex is not an input, so the more permissive of the two sex-specific z-scores is used; no preterm growth reference is loaded (Fenton 2013 is not machine-readable).
- Dose arrays may be supplied in any order (timestamps are absolute); rows keep their numbers in errors and in the audit table.
- The entries' time zone must be chosen by the administrator; the default is the browser's zone and is displayed.
- Unstable or changing renal function is flagged but not modelled; constant-clearance predictions in such patients are not validated.

- The formulation question is open until the authors answer; both representations are implemented and one constant switches them.
- All performance figures are self-consistency on virtual patients drawn from the model; real-patient bias, precision and coverage are unknown. AUC-category disagreement is about 30 % even with two levels.
- Pediatric data behind the model: four neonatal datasets (mostly premature) and one dataset of 118 children/adolescents; PMA 0.88–2.58 y has no data and is refused.
- The acknowledgement is per login session and statement version; it is not an audit record (nothing is stored), by design.
- Study-specific effects (heel-prick, haematological malignancy) are implemented but not offered as inputs.
- Playwright is an external test dependency outside the app.

## What remains before a safe release

1. Authors' clarification of the clearance parameterisation (outstanding), then pin the manifest and re-run the reference fixtures.
2. External evaluation on real pediatric data under separately authorised access: bias, precision, interval coverage and category agreement by age band, with pre-specified acceptance thresholds and clinical reviewers.
3. A decision on the adult engine's article-transcription prior (23 % below the candidate model), kept out of scope here.
4. Production access review: confirm the admin population, secret management, the acknowledgement cookie's `secure` flag behind TLS, and whether an audit trail of acknowledgements is wanted (none exists).
5. Clinical governance sign-off before any patient-care use; until then the research-only labelling, admin gate and acknowledgement stay in place.

## Not done / out of scope

No deployment, credential, user, access-setting or production-data change. No author contact from this work. No external pediatric dataset accessed. Adult engine untouched.

## Explicit timestamp entry (owner request, 2026-10-29)

Dose, sample and planned-dose timestamp fields start blank. Added rows never copy or advance a time. With a dose history, the UI and API require an explicit next planned dose timestamp. Prior-only steady-state calculations without histories remain available. Selected-zone/DST interpretation, admin authorization, session acknowledgement and research-only status are retained.

Verification for explicit entry: pediatric authorization 47, engine 84, existing validation 602 plus 12 missing-timestamp scenarios, timezone resolution 28 checks in six process configurations, independent reference 381, HTTP/browser 120 checks, and TypeScript `--noEmit --incremental false` passed. All HTTP/browser requests used an isolated synthetic fixture. No adult, authentication, acknowledgement, model or deployment changes.

## Production integration assessment

The release branch is based on production commit f93a6eb, with only pediatric additions, the admin navigation link and pediatric test scripts transferred from 94754f8. Production adult PK, public navigation, authentication, database schema and middleware are preserved. This release is an admin-only research preview, not approval for patient care.

The source/formulation question remains open. Weight boundaries are provisional research-scope choices, not validated physiological limits: a 2022 registry includes 212-g survivors; the 160-kg source maximum belongs to a mixed-age cohort; a birth-weight record does not establish a 28-day weight maximum. The 0.2/11/160-kg thresholds are unchanged pending clinical review. Verification flags can be acknowledged, while the dataset age gap and RRT/ECMO/non-IV exclusions remain absolute refusals. These issues block clinical use; they do not change the explicitly authorized restricted research-preview scope.
