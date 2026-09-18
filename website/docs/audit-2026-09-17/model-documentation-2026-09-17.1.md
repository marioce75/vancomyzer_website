# Vancomyzer model documentation — manifest 2026-09-17.1

## Structural model
Two-compartment, intermittent IV infusion, first-order elimination.
k10 = CL/V1, k12 = Q/V1, k21 = Q/V2. Closed-form biexponential solution
(`steadyStateTwoCompartment.ts`), verified against an independent scipy
`expm` reference and an independent closed-form implementation
(`src/lib/pk/__tests__/oracle/`, 254 checks at 1e-6 relative).

## Population prior — Colin et al. 2019 (DOI 10.1007/s40262-018-0727-5)
θCL 5.31 L/h, θV1 42.9 L, θV2 41.7 L, θQ 3.22 L/h (per 70 kg); allometric
0.75 on CL and Q, linear on V1 and V2; PMA = age + 40/52 y; FMat (PMA50 46.4 wk,
Hill 2.89); FDecline (61.6 y, Hill 2.24); SCRstd = exp(−1.228 + 0.672·log10(PMA)
+ 6.27·exp(−3.11·PMA)); FSCR = exp(−0.649·(SCr − SCRstd)), SCr in mg/dL.
Reference: 35 y / 70 kg / SCr 0.83 → CL 4.102381651824105, V1 42.9, Q 3.22, V2 41.7.

**Intentionally omitted published covariates:** haematological malignancy
(+29.4 % CL); heel-prick sampling (neonatal). Sex is not a covariate. The
full published model is therefore NOT implemented; the adult subset is.
Published IIV (CV): CL 27.9 %, V1 27.3 %, V2 97.9 %; residual proportional
21.5 % — documented, **not used by the fit** (below).

Floors: age < 18 refused; SCr < 0.4 mg/dL raised to 0.4 before use.

## Exposure horizon (new, `exposureHorizon.ts`)
- `steady_state`: clinician-confirmed (`steady_state_confirmed: true`), no history, or legacy ≥5 doses without the flag.
- `actual_history`: exactly N doses superposed (fit and exposure); N reported.
- `single_dose`: loading/pulse dose; AUC = analytic AUC0–24 of the one dose.
Advisory: fraction of steady state = 1 − 2^(−N·τ/t½β); warning when < 4 t½.

Canonical steady-state exposure: `computeExposure` — daily AUC = daily dose/CL
(linear PK); peak at end of infusion; trough at end of interval. Every
"steady state" number in the response uses it with the same infusion duration.

## MAP fit (`fitPosteriorParameters.ts`)
Objective in log-parameter space:
Σ_i [0.5·((y_i − f_i)/σ_i)² + ln σ_i] + Σ_p 0.5·((ln θ_p − ln θ_p,prior)/ω_p)²,
σ_i = max(1 mg/L, 0.15·max(y_i, f_i)); ω = (0.35, 0.25, 0.50, 0.50) for
(CL, V1, Q, V2); independent priors, no covariance. These ω and σ are
application-specific choices, not the Colin 2019 published variability.
Optimiser: Nelder–Mead, 5 starts, ≤400 iterations, tolerance 1e-6; result
clamped to 0.1–10× prior (clamps reported as `boundary_hits`). Deterministic.
Identifiability: two levels cannot identify four parameters; Q and V2 remain
near the prior. Uncertainty band on the graph is illustrative only.
Observation conflicts: same-time (≤0.25 h) entries differing by >20 % →
`review_hold`.
Independent cross-check (18 Sep 2026): against Tucuxi-core (`d09737e3`, built
from source) with the same Colin prior, the same ω and a `mixed`
σ = √((0.15·f)² + 1²), on 200 synthetic patients: CL median |Δ| 0.84 %
(P95 4.8 %, max 9.2 %), V1 0.87 %, 0 failures; the whole tail is the
σ-form difference (max(y, f) vs f-only), reproduced to ≤ 0.01 % by an
independent refit. Record: `src/lib/validation/crosscheck/tucuxi/README.md`.

## Recommendation
Grid: doses 250–2000 mg (adjustment) / 500–2000 (empiric) at q6/8/12/18/24/36/48 h;
each candidate simulated at its own safe infusion duration (≥1 h, ≤10 mg/min);
caps peak ≤ 80 mcg/mL, trough ≤ 20 mcg/mL, AUC24 ≤ 650 mg·h/L (institutional policy may tighten);
target 400–600 mg·h/L (mid 500); every emitting path routes through
`finalizeRecommendation` (CI-checked).

## Changelog
See `MODEL_MANIFEST_VERSION` CHANGELOG in `src/lib/pk/modelRegistry.ts`.
