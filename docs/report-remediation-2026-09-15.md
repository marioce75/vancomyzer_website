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

## Engine-session handoff (not fixed here)

PENDING checks in the report suite print "NOW PASSING" when fixed — promote them to REQUIRED then.

| Check | Measured on this branch |
|---|---|
| p1 Doses 2–4 fitted with steady-state equations | doses_given = 2: posterior AUC24 −34.9%, −52.5%, −21.6% vs truth. **Clinically important: underestimated exposure can drive dose increases.** |
| p2 Single-dose AUC window | "first-dose AUC24" = AUC0–τ × 24/τ (q12h: 408 vs true AUC0–24 290) |
| p3 Weight clamp | 350 kg accepted and computed as 300 kg in the existing-regimen path |
| p4 Late draw / missed dose | level 23.5 h after a q12h dose fitted identically to an on-time trough |
| p5 Administration history | loading dose then regimen change silently ignored |
| p6 Dialysis/RRT | UI toggle only; not in the API contract, note, PDF or history |
| p7 Level-pair chronology | trough before dose N+1 then peak after it is rejected |
| j2 Initial-regimen input guard | below the route, SCr 88.4 and age 17 are computed (route rejects both) |

Also:
- `CalculatorWorkspace` result-copy block drops `fit_quality_warnings`, `timing_warnings`, `arc_advisory`, `auc_range_status`; return `posterior_fit` in the API response so the band uses the engine label directly.
- `normalizePatient` turns missing weight into 70 kg and missing SCr into 1.0; SCr 0.1–0.39 is floored to 0.4 and notes print 0.4.
- Validator late-draw messages use the level index as the dose number; mixing manual-hours and date/time levels gives misleading rejections.
- `runExistingRegimenPipeline` input type lacks `height_cm`/`sex` (the BMI advisory needs them).
- Stale comments: `fitPosteriorParameters.ts:22,66`, `posteriorEngine.ts:76` (obesity-model omegas).
- ARC advisory suggests a continuous-infusion rate although continuous infusion is out of scope.

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
