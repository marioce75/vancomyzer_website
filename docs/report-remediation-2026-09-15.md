# Report remediation — 15–16 Sep 2026

Response to the external review *"Vancomyzer: international comparison and improvement plan"* (15 Sep 2026).
Branch: `report-remediation-2026-09-15` (base `389c3b1`). Model manifest: `2026-09-15.1`.

## Decisions approved by Mario (15 Sep 2026)

1. **Dosing model:** Colin 2019 for every adult at every BMI. The custom BMI ≥ 40 obesity branch is retired from dosing.
   Its coefficients are not in Smit 2020 or Zhang 2024, it was never externally validated, and it caused a step change at
   BMI 40 (35 y man, 175 cm, SCr 0.83: CL 6.2 → 11.1 L/h and V1 75 → 21 L for +0.3 kg; empiric dose 1000 → 1500 mg q8h).
   It also had no upper bound on clearance (25 y, 180 kg, SCr 0.5 → CL 31.5 L/h). FFM and CrCl comparisons remain as
   information only; BMI ≥ 40 gets an advisory recommending early levels.
2. **Work split:** a separate engine session owns PK math. This branch fixes claims, labels, documentation, evidence pages,
   input parsing and tests, and lists engine work below.
3. **Pricing facts:** core calculator free permanently; PDF export, note copy and interpretation free during the launch
   period; Individual Pro $9.99/mo billed annually or $19.99 month-to-month; Department $500/mo (5–10 seats) or
   $1,000/mo (11–20), card at signup; Hospital by quote.
4. **Delivery:** commit and push this branch; no merge to `main`, no deploy.

## What changed

| Area | Change |
|---|---|
| Model registry | New `website/src/lib/pk/modelRegistry.ts`: single source for model ids, names, citations, parameters, equation strings, the retired-model record and published comparators. `buildPriorParameters` reads Colin 2019 parameters from it. |
| Engine wiring (text only) | Every note, assumption, limitation and key-input label names the model through the registry. The wrong `(0.83/SCr)^0.80` description is gone. High-BMI advisory added to both workflows. History `bmi_above_40` now comes from measured BMI. |
| Calculator UI / PDF | Colin 2019 math panel for all results (retired-model notice for old records); obesity panel is information-only; illustrative ±X% band can no longer be narrower than the engine's uncertainty label; trough-reference and MIC labels; `parseClinicalNumber` + `ClinicalNumberInput` so "1,2" is never read as 1; unit hints; manual-hours levels send real ISO timestamps; partly entered levels are no longer silently dropped; PDF names the model, citation and manifest version; disclaimer version bumped to `2026-09-16` (users re-accept once). |
| Evidence pages | Predictive performance: synthetic result separated from Bai 2025 real-patient data, signed bias labelled correctly, formulas shown, held-out point moved to 6.0 h (not used in the fit). Cross-check: observed agreement only, no "interchangeable/corroborated", accurate outlier description, run date and the 2 BMI ≥ 40 patients that used the retired model. Cases: only same-model Colin 2019 reproductions are pass/fail (1% tolerance, CL and V1 checked); Smit, Adane and Carreño are context-only; infusion rates ≤ 10 mg/min; NaN can no longer pass. |
| Methods documentation | FAQ and equations page render Colin 2019 from the registry; retired-model section with reasons; Smit 2020 and Zhang 2024 listed as published models, not implemented; unsupported claims removed (see agent notes in PR). |
| Public claims | Regulatory wording ("designed to meet the criteria… not reviewed by the FDA"); validation-status sentence; competitor price and "same prior" claims removed; invented vendor quote removed; features that do not exist are labelled "not yet available"; prices, seat caps and free/launch copy consistent; SCr-floor advice replaced with Bukhari 2024-consistent guidance. |
| Tests | `website/src/lib/pk/__tests__/reportVerificationSuite.test.ts` implements report §10 (10 REQUIRED checks, 8 PENDING engine checks) and runs in `npm test`. |

## Verification (16 Sep 2026)

- `tsc --noEmit`: pass. `next build`: pass (Linux copy of the branch). `next lint`: 3 pre-existing warnings.
- `npm test`: pass — PK integration (28 + initial regimen), HMAC, BAA, cases, safety pattern, predictive, report suite.
- Colin anchors: CL 4.1024 L/h (+0.06%) and 2.5514 L/h (+0.02%); independent re-implementation matches on 10,800 grid points.
- BMI 39.9 → 40.0: CL ratio equals the allometric ratio (1.0019); BMI 35–70 sweep has no step > 0.09%.
- Predictive (synthetic, n = 200): vs noisy observation bias +0.48 mg/L, rBias +8.17%, rRMSE 31.69%; vs noise-free truth rRMSE 15.95%.
- Independent code review completed; its HIGH and MEDIUM findings are fixed on this branch.

## Engine-session handoff — closed 16 Sep 2026

All eight checks are fixed and were promoted from PENDING to REQUIRED in the same change.
The report suite is **18/18 REQUIRED passing**, `tsc --noEmit` is clean, and the full `npm test`
chain (PK integration, HMAC, BAA, cases, safety pattern, predictive, report suite) passes.
`next build` and `next lint` also pass after the engine commit; lint reports 5 warnings, all of
them in files this change does not touch (`Footer.tsx`, `ConcentrationTimeGraph.tsx`, `db.ts`)
or at lines it does not touch (`CalculatorWorkspace.tsx:614`). The "3 pre-existing warnings"
noted above undercounted.

| Check | Was | Now |
|---|---|---|
| p1 Doses 2–4 fitted with steady-state equations | posterior AUC24 −34.9% / −52.5% / −21.6% vs truth | **+0.3% / −12.4% / +6.3%** |
| p2 Single-dose AUC window | 476 at q8h, 408 at q12h for the same 1500 mg dose and level | 290 at both — the true AUC0–24, interval-independent |
| p3 Weight clamp | 350 kg computed as 300 kg | used as entered; ceiling raised to the 400 kg the API documents |
| p4 Late draw / missed dose | fitted identically to an on-time trough | CL 2.83 vs 3.90 L/h, flagged |
| p5 Administration history | silently ignored | explicit "administration history is not modelled" limitation |
| p6 Dialysis/RRT | toggle collected, never sent | in `CalculateRequestPatient`, sent by the workspace, refused by the route |
| p7 Level-pair chronology | standard trough→peak pair rejected | accepted in either entry order |
| j2 Initial-regimen input guard | SCr 88.4 returned a "severe renal impairment" refusal | `InitialRegimenInputError`, surfaced by the route as a 400 naming the field |

p1 and p4 share one fix: `fitPosteriorParameters.predictConcentration` superposes exactly
`doses_given` doses at the observation's true elapsed time — the same math `curvePoints` draws,
so the fit and the plotted curve can no longer disagree. N = 1 collapses to single-dose, so
pulse-dose results are provably unchanged.

### Also fixed from the list above
- Validator late-draw messages said "Level for dose N" for a level index — now "Level N".
- `runExistingRegimenPipeline` input type accepts `height_cm`/`sex`.
- Stale obesity-omega comments in `fitPosteriorParameters.ts` and `posteriorEngine.ts`.

### Also fixed, from the engine session's own audit (not in the report)
- **The chart contradicted the panel.** For a loading dose the curve was rebuilt on the
  *recommended* regimen after peak/trough/AUC had been computed from the patient's own, so the
  panel read trough 5.9 ("increase the dose") while the graph beside it never fell below ~17.9
  ("hold or reduce"). Across 2025 simulated cases the two disagreed in 727, worst case 15.75
  mcg/mL. Override deleted; measured after: curve at 24 h 17.56 against a reported trough 17.6.
- **A refusal shipped a dose menu.** `frequency_options` was attached unconditionally, so a
  patient the engine had just refused to dose still received three dose options, each with a
  generated clinical note, reachable via Export PDF. Now empty when dosing is blocked.
- **A refusal printed a recommendation.** The interpretation panel and the chart note read
  "Recommended adjustment: — every 0 h" and "interval shortening from q6h to q0h" — pointing
  opposite to the hold on the safety card, in the permanent record. Both now state the hold.
- **A refusal still offered an "Engine recommendation" curve** chosen from an uncapped grid
  (250 mg q24h: trough 55.1, AUC24 1371). Dropped when blocked, and gated in the UI.
- `height-typo-flips-refusal`, rated critical against the old code, is **moot**: with the obesity
  branch retired, 65 y / 130 kg / SCr 5.0 returns `blocked=YES, CL 0.2907, colin_2019` with and
  without a height. Verified by execution, not assumed.

### Renal estimate and the ARC advisory — 16 Sep 2026

Creatinine clearance never enters a dose (Colin 2019 takes serum creatinine directly), so this
changes what the clinician is shown and when the advisory fires, not the dosing.

**Displayed estimate** now selects the body weight by BMI stratum, per Winter 2012 (n = 3678):
actual body weight when underweight, ideal body weight at normal weight, adjusted body weight
(IBW + 0.4 × (TBW − IBW)) at BMI 25 or above. It falls back to actual body weight, and says so,
when height or sex is missing. Measured: 25 y / 200 kg / SCr 0.7 goes from **456 to 291 mL/min**
(−36%); a 60 y / 80 kg patient moves −7%; a 48 kg patient does not move. The label now names the
weight used, states that the value is absolute rather than indexed to 1.73 m², and says the dose
does not use it. No cap is applied — no primary evidence supports any specific ceiling.

**ARC advisory** now tests the clearance indexed to body surface area (Du Bois) against
130 mL/min/1.73 m² — the definition used by Udy 2013, Barletta 2017 and Cucci 2023 — instead of an
absolute value against 150, which was both the wrong number and the wrong basis. The
`auc_range_status === "below_target"` conjunction is gone: a patient with genuine augmented
clearance whose regimen happens to land inside 400–600 still has augmented clearance, and
previously got no warning. The trigger deliberately stays on **total** body weight: in ICU patients
with measured ARC, Cockcroft-Gault accuracy was 70% on total body weight but 61% on adjusted and
38% on lean, so every lean-weight substitution under-detects (Cucci 2023, Pharmacotherapy
43:1131-8). Wording changed from "DETECTED" to "possible", naming a measured 8–24 h urinary
creatinine clearance as the confirmatory test.

Measured firing rate on the synthetic ICU-like cohort (n = 200, seed 42): **0% before, 23% after**,
against published ARC prevalence of 57.7–67% in at-risk ICU cohorts — conservative, not excessive.
It concentrates where the validated tools predict: 39% at age under 56 versus 6% over 75, and 43%
at SCr below 0.7 versus 0% in every band at or above 0.7. The old rule never fired once in 200
realistic patients.

The panel's citation was corrected: it claimed the 2020 ASHP/IDSA/SIDP guideline as the source of
the ARC threshold, but that guideline defines no adult ARC threshold.

**Four starved safety surfaces fixed.** `CalculatorWorkspace` rebuilt the API response field by
field and dropped `arc_advisory`, `auc_range_status`, `timing_warnings` and `fit_quality_warnings`,
so the red ARC card, the below-target banner, the late-draw timing warnings and the poor-fit
warning could never render. The text still reached clinicians through `interpretation_summary` and
the clinical note, but every dedicated panel was dead code.

### Adjustment-path exposure, fit diagnostic, and workspace layout — 16 Sep 2026

**`posterior_fit` is now returned.** The graph's uncertainty band reads the engine's own
`uncertainty_label` directly instead of reconstructing a width from whatever else the response
happens to carry. The reconstruction stays as the fallback for a result restored from an older
session snapshot.

**The adjustment path now reports the exposure it recommends.** `finalizeRecommendation` already
simulated peak, trough and AUC24 to run the safety caps and then threw them away, so an
existing-regimen recommendation shipped without ever stating the exposure it expected: nothing
could fire the below-target banner, and the dose card fell back to displaying the exposure of the
regimen the patient was *already on*. The recommendation now carries `predicted_auc24`,
`predicted_peak`, `predicted_trough` and `auc_range_status`, and the banner quotes the recommended
regimen instead of the current one.

**Workspace layout.** The analysis column is a two-column grid at `xl`: dose card, exposure
metrics, concentration-time graph and signal strip in the main column, with the advisory stack in a
parallel rail. The advisories previously ran full width *above* the results and pushed the
concentration-time graph below the fold, so the clinician had to scroll to see the curve. Nothing is
hidden or collapsed by the move, and below `xl` the grid returns to the original single-column
order. Separately, the derivation panel in `PKParametersMath` now starts collapsed — it runs ~350px
expanded and its own Show Math toggle sits directly above it — and the workspace header is a single
line. The right column is its own scroll region (`CalculatorLayout.tsx:19`), so these reductions are
what decide whether the first screen holds everything.

### Still open in the engine (not fixed here)
- `normalizePatient` turns missing weight into 70 kg and missing SCr into 1.0; SCr 0.1–0.39 is
  floored to 0.4 and notes print 0.4. (The 300 kg ceiling is fixed; the defaults are not.)
- Mixing manual-hours and date/time levels still gives misleading rejections.
- ARC advisory suggests a continuous-infusion rate although continuous infusion is out of scope.

### Needs clinical sign-off before it can be fixed (each changes emitted doses)
Reproduced by execution in the 15–16 Sep engine audit, deliberately left alone:
- **Colin prior CL collapses at high SCr.** At SCr 6.0 the prior gives CL 0.106 L/h and the MAP
  fit is dragged to 0.493 against a true 0.7, so the engine halves a dose that was correct.
  Flooring the prior also moves the empiric refusal boundary.
- **Posterior CL is not renally bounded.** One mis-drawn 1.0 mcg/mL trough raises CL to 4.09× the
  patient's own CrCl and ships 4500 mg/day to a patient with CrCl 39.
- **Steady state is a fixed count of 5 doses.** Entering 4 vs 5 doses changes the daily dose by
  33% on identical PK; it should key on the patient's own terminal half-life.
- **The sparse path refuses when a safe regimen exists** (750 mg q8h, AUC 492) because its
  heuristic candidate failed the hard cap first.
- **The empiric tie-break prefers the longest interval**, offering a 45 kg adult 2000 mg q24h
  (44 mg/kg) over 1000 mg q12h at identical predicted AUC.
- **Institutional dose ceilings are ignored** — /settings values are validated, saved, never read.
- Fixed Q, uncapped Cockcroft–Gault, the SCr 0.4 floor, and an unbounded curve horizon at very
  low clearance (a 6.18-year, 11.6 MB curve for one request).

## Open decisions (Mario / counsel)

- `privacy/page.tsx` says Vancomyzer is not a business associate and stores no PHI; reconcile before a BAA is offered.
- `terms/page.tsx` "non-commercial purposes only" vs paid institutional plans; Footer BAA link to dosys.health.
- Disclaimer gate attestation says "professional or trainee"; regulatory text says "licensed healthcare professionals".
- Internal market-intelligence prompt (`lib/scraper/aiAnalyst.ts`) mentions "building toward FDA 510(k) submission", which conflicts with the non-device CDS positioning; confirm the intended regulatory path with counsel.
- Dose and SCr inputs reject "1,000"/"1.500" style entries (ambiguous thousands separator); keep or change.
- Predictive harness: rebuild the Goti truth model from the full text (weight scaling is a developer choice); synthetic regimen infuses up to 3000 mg over 1.5 h.
- Re-run the Tucuxi cross-check with the current engine and store per-patient inputs.
- Case notes: Adane CrCl source label, whether the Carreño card adds value, verify the ter Heine 2020 citation; equations page says "fork to verify" while the terms restrict copying.

## Still required outside the code (from the report)

Independent pharmacometric review of model choice; external validation protocol and dataset (§09); prospective silent
evaluation; discovery interviews and pilot economics (§11–12); qualified regulatory review of intended use (§14).
