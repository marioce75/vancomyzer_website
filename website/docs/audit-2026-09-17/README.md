# Vancomyzer engine & site audit — remediation record (17 Sep 2026)

Branch `audit/engine-remediation` on top of `main` @ `85589d6` (the 17 Sep UI
cockpit commits). Manifest at baseline: `2026-09-15.1`; after this work:
`2026-09-17.1` (engine semantics only; Colin 2019 parameters, prior SDs and
error model unchanged — see `model-documentation-2026-09-17.1.md`).

**Evidence input:** the reproduction details in the task brief. The referenced
`Vancomyzer-audit.md` was not attached to the request and was not read.
**Data:** synthetic cases only. **Deployment:** nothing deployed.
**Scope honesty:** nothing here establishes clinical validation, legal
compliance or equivalence to any competitor.

## 1. Baseline map

| Concern | Where |
|---|---|
| Frontend calculator | `src/components/calculator/CalculatorWorkspace.tsx` (+ cockpit components) |
| API | `src/app/api/calculate/route.ts` (validation, rate limit, audit log, history, fit-diagnostic log) |
| Existing-regimen pipeline | `src/lib/pk/runExistingRegimenPipeline.ts` → `validate/`, `normalize/`, `posterior/`, `existing/existingRegimenEngine.ts`, `recommend/buildAdjustmentRecommendation.ts`, `explain/`, `response/` |
| Empiric | `src/lib/initialRegimen.ts` |
| Model registry / manifest | `src/lib/pk/modelRegistry.ts` (`MODEL_MANIFEST_VERSION`) |
| Two-compartment math | `src/lib/pk/steadyStateTwoCompartment.ts` |
| Bayesian MAP fit | `src/lib/pk/posterior/fitPosteriorParameters.ts` (Nelder–Mead, multistart) |
| Chart | `src/components/calculator/ConcentrationTimeGraph.tsx` (canvas; curves come from the API) |
| Note / PDF | `src/lib/pk/explain/buildDocumentationPreview.ts`, `src/lib/generateReport.ts` |
| Auth | NextAuth (`src/lib/authOptions.ts`, `middleware.ts`), open access default on |
| Calculation logging | `src/lib/auditLog.ts` (console JSON + ring buffer), `security_audit_log` (fit diagnostics), `calculation_log` (history tier) — `src/lib/db.ts` |
| Public science/legal | `src/app/(site)/transparent-dosing/*`, `/privacy`, `/compliance`, `/disclaimer`; **dosys.health is a separate repo (`~/dosys-website`, not connected to this session)** |

## 2. Finding → fix table

| # | Finding (reproduced against `85589d6`) | Class | Fix | Test |
|---|---|---|---|---|
| F1 | Reference case: current row 486.9 / 30.6 / 12.0 vs recommended row (same regimen) 486.9 / 31.9 / 12.9, both "steady state". Three steady-state predicates (validator `<5`, fitter `≥5`, engine `≥5 ∧ 4 t½`); engine paired six-dose peak/trough read off the plotted grid with a steady-state daily AUC. | **Confirmed bug** | `lib/pk/exposureHorizon.ts` decides the horizon once (`steady_state` = clinician-confirmed / `actual_history` / `single_dose`); shared by validator, fit and engine. Top-level triple is the canonical steady-state projection; finite-dose values are computed analytically (`finiteHistoryExposure`) and carried in `actual_history_exposure`; half-life check is an advisory (`steady_state_warning`). | `test:horizon` §2, §3 |
| F2 | Band `predicted_peak` 36.7 vs table row 38.7 for the same 1500 mg q12h: candidates simulated at the *current* infusion time (1.75 h) but reported with the safe duration (2.5 h). | Confirmed bug | Candidates are simulated at the infusion duration they report (`collectFrequencyOptions`). | `test:horizon` "candidate == canonical" |
| F3 | `singleDoseAuc` 0.02 h trapezoid ~1e-5 relative low (oracle). | Numerical | Analytic biexponential integration. | `test:oracle` (1e-6) |
| F4 | Same-time discordant levels (28 & 12.9 both at 3 h) produced a prominent 1500 mg q12h recommendation with 45 % fit error. | Design / safety | `findObservationConflicts` (|Δt| ≤ 0.25 h, >20 % apart) → `review_hold`; recommendation and candidates withheld, exposure and diagnostics kept; UI renders a review state. Concordant replicates are not held. | `test:horizon` §4 |
| F5 | Fit diagnostics: no objective, convergence, boundary or per-observation detail; clamps to 0.1–10× prior applied silently after optimisation. | Verification gap | `posterior_fit` now carries prior/posterior, prior log-SDs, error-model string, objective components, predicted-at-observation (σ, z), convergence (starts, iterations, tolerance), `boundary_hits`, `observation_conflicts`. NM tolerance 1e-4→1e-6, iterations 200→400. | `test:horizon` |
| F6 | "≥5 doses = steady state" by count alone. | Design | UI "≥6 · steady state" sends `steady_state_confirmed: true`; 1–5 send `false` (actual history). Legacy API clients without the flag keep the old ≥5 rule. q6h added to the interval control. | `test:horizon` §1 |
| F7 | Out-of-order responses: an older `/api/calculate` response could overwrite a newer input, clear an RRT block and re-enable exports. Not previously confirmed; **now confirmed by a deterministic negative control** (540.4 → 487.5 with the guard disabled). | Confirmed bug | Sequence-numbered submissions; late/superseded responses discarded; RRT re-checked at response time; `lastCalculatedAt` = submit time; `result_snapshot` {manifest, mode, sha256 input digest, computed_at} attached to every result. | `scripts/e2e/result-lifecycle.mjs` (A/B/C) |
| F8 | Cockcroft–Gault shown as one unqualified value with sex blank (male assumed, ~18 % high for women); same assumption inside ARC advisory. | Display | Both values shown with the assumption stated; ARC message states the assumption. Posterior CL cap still uses the male-assumed CrCl when sex is blank — **open item** (clinical). | manual |
| F9 | `scripts/check-safety-pattern.sh` aborted before reporting (fixed 17 Sep, earlier commit). | CI | — | `npm test` |
| F10 | dosys.health/science still describes the retired obesity model as active with automated BMI ≥ 40 selection; dosys.health/legal/baa says data are "processed in-session on the client side and … not persisted to any Dōsys server, database, or log" — contradicted by server-side calculation and three logs. | Legal / evidence | Replacement copy drafted (`site-copy-updates.md`); repo not connected — **not changed**. | — |

Not changed (deliberately): Colin 2019 parameters and omitted covariates; prior
log-SDs 0.35/0.25/0.50/0.50; error model; dose grid, caps and target; the
0.1–10× parameter bounds (now reported, not removed).

## 3. What ran

- `npm test` (pk integration ×2, **oracle 254 checks**, **horizon regression 56 checks**, hmac, baa, literature cases, safety-pattern, predictive, report suite 18/18) — green.
- `npx tsc --noEmit`, `next lint` (11 pre-existing warnings), `next build`.
- `scripts/e2e/result-lifecycle.mjs` against the dev server — 7/7, plus the negative control.
- Reference values: all reproduced from the documented equations (matrix-exponential and closed form agree to ~1e-13); BMI 39.9 vs 40 continuity confirmed (CL ratio = (122.5/122.19375)^0.75).
- §4 regression numbers on the current build: 12.9@12h → CL 4.1083, AUC 486.8 (site 486.9); 25@12h → CL 2.6886 (independent 2.68849), current AUC 743.9, q18h 495.9; 28@3h+12.9@12h → CL 4.0911 (independent 4.08958, 0.04 % apart — a robust independent optimiser has not yet been run; tolerance left at 0.5 % in the test).
- Cross-check harness: fixture `crosscheck-seed42-n200.json` generated; Vancomyzer side run (200/200 fits, 0 boundary hits); posterior median |error| vs synthetic truth CL 10.0 % (prior 31.4 %), V1 25.9 %, Q 52.8 %, V2 25.0 %.

## 4. Not run / blocked (not passed)

- Tucuxi comparator: no binary, `.tdd`/`.tqf` not committed → **BLOCKED** (`compare.ts` exits 1).
- ClinCalc, VancoPK, DoseMeRx, InsightRX, PrecisePK: no authorised accounts → **BLOCKED**; see `comparator-matrix.md`.
- Real-patient validation: not performed; separately governed project.
- Independent re-minimisation with a second optimiser (e.g. SciPy L-BFGS/Powell on the identical objective) for the §4 tolerances.
- UI validation parity matrix (date rollover, DST, next-dose boundary): validator paths exist (`validateExistingRegimenRequest.ts`) but no new table-driven test was added in this pass.
- Administration history (missed/changed doses) is **explicitly unsupported**: the pipeline attaches a limitation string when a history is supplied; no fit uses it.

## 5. Residual questions

**Clinical** — (a) Should the engine's grid offer sub-500 mg or q6h regimens for adults at all (surfaced, flagged "review")? (b) With sex blank, should the posterior CL cap use the female (lower) CrCl? (c) Is the 4-half-life criterion the right advisory threshold? (d) Duplicate-window 0.25 h / 20 % discordance thresholds.
**Statistical** — (a) App-specific prior SDs vs Colin IIV (0.279/0.273/0.979; no published Q IIV) — documented model revision if changed. (b) The error model is not the published residual model. (c) Two levels do not identify four parameters; Q/V2 stay at the prior — say so in outputs? (d) No posterior covariance; the graph band is illustrative only (kept).
**Access** — dosys-website repo; Tucuxi build; comparator accounts; the attached audit document.
**Legal / privacy** — see `privacy-data-flow.md` and `regulatory-assessment-draft.md`; counsel decides FDA/HIPAA/state/FTC obligations and licence alignment. The BAA page statement (F10) needs correction before any BAA is signed.
