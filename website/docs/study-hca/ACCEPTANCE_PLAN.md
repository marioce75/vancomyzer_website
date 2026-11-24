# Acceptance plan: timed-draw prediction (written before the comparisons were run)

Research workflow for the proposed HCA study. Fictional data only. This plan was committed before any comparison or reference test was executed, so the tolerances below were not tuned to the results.

## Pinned release

- Production commit served by vancomyzer.com `/api/health` on 2026-11-24: `feab09123a8c7124f77a86f59f8e63ac74f5f02b` (merge of PR #58).
- Model manifest `2026-09-25.1`: Colin 2019 adult model as shipped (article Eq. 6 / Table 3, typical CL 4.10 L/h for the 35 y / 70 kg / SCr 0.83 reference). Coefficients are not changed and the ESM2 normalised form is not used.
- Calculation functions reused unchanged: `buildPriorParameters` (population parameters), `concentrationFromHistory` and `singleDoseConcentration` (finite-history superposition).
- Gate 0: the four calculation source files listed in `src/lib/studyTimed/release.ts` must be byte-identical to the pinned commit (`git diff --quiet feab091 -- <files>`), and no file under `src/lib/pk`, `src/lib/initialRegimen.ts` or `src/app/api/calculate` may differ from it.

## Numerical tolerance (declared in advance)

For every compared quantity: `|new − release| ≤ 1e-12 × max(|release|, 1 mg/L)` (equivalently 1e-12 mg/L absolute below 1 mg/L). The only expected source of difference is floating-point rounding when an infusion duration is entered in minutes and converted back to hours; any larger difference is a failure. Values are compared unrounded.

## Where release and new workflow overlap (compared)

| Quantity | Release source | New source |
|---|---|---|
| CL, V1, Q, V2 | `computeInitialRegimen().pk_parameters` and `/api/calculate` (`initial_regimen`) JSON on a local preview of the branch | `predictAtDraw().model_parameters` |
| Concentration at every plotted time of the Empiric curve (uniform doses from time 0 at the recommended dose, interval and infusion duration) | `/api/calculate` `curve[].concentration` (unrounded in the JSON) and `computeInitialRegimen().curve` | `predictAtDraw()` with the doses started before that time |
| Loading + maintenance concentrations (dose-N peak and trough) | `historyExposure()` in `doseHistory.ts`, used by the 1- and 2-level tabs | `predictAtDraw()` at the same times |

## What cannot be compared to the public UI

- The public screens show values rounded to 0.1 mg/L; comparisons use the unrounded API/function values instead.
- The public tabs cannot express an irregular history: delayed or held doses, varying doses after the first maintenance dose, infusions still running at the sample, or clock times with offsets. These are checked against an independent numerical reference (ODE integration, below) only.
- The 1-level and 2-level tabs fit measured levels (MAP). This workflow is a priori by design and takes no level, so their posterior results are not comparable; only the shared dose-history functions are.
- Dose recommendations, AUC targets and the credible band are not part of this workflow.
- VigiLanz is the proposed clinical comparator and is not reproduced or simulated here. The separate Colin reproduction (research branch) is a software check for the technical appendix, not a clinical comparator.

## Reference tests for the timed-history workflow

An independent reference integrates the two-compartment ODEs (RK4, step ≤ 0.0005 h, breakpoints at every infusion start/stop and at the draw) from Colin 2019 parameters restated in the test. Tolerance against it: relative 1e-8. Required cases:

1. Single dose (draw after the infusion; draw before dose 2 with dose 2 listed and excluded).
2. Loading dose plus maintenance.
3. Delayed and held doses (actual times used; the scheduled-time substitute gives a different value).
4. Timing boundaries: draw exactly at end of infusion; draw during an infusion (only drug infused up to the draw); draw seconds after a dose start; dose starting exactly at the draw (refused); dose starting just after the draw (excluded, identical result to omitting it); draw before the first dose (refused); offsets across a daylight-saving change.
5. Invalid inputs: each refusal reason code.
6. No-level behaviour: any field or column that looks like a measured result is refused; the prediction modules import no outcome data; outcome values cannot change a prediction.

## Other checks

- Offline: the packaged command runs with all network access denied by the macOS sandbox and produces byte-identical output to the expected example output; the case-entry page loads with a Content-Security-Policy of `default-src 'none'` and makes no network request.
- Demo parity: the owner-only demo endpoint returns the same unrounded prediction as the offline command for every fictional case.
- Access: owner admin allowed; other admin, pharmacist, signed-out, forged token, disabled owner, expired admin session, flag off and owner ID missing all denied on the page, the status endpoint and the prediction endpoint, including by direct URL. Responses are `private, no-store`.
- Existing behaviour: the full existing test chain (`npm test`) passes unchanged, and the calculator/privacy source is unchanged (Gate 0).

No independent sign-off or clinical validation is claimed by any of these checks.
