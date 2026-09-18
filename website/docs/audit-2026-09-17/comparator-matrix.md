# Comparator matrix — vancomycin dosing calculators (17 Sep 2026)

Practical comparison set, not a market ranking. Reference case: 35 y, 70 kg,
175 cm, male, SCr 0.83 mg/dL; 1000 mg q12h over 1.75 h; steady state.

| Product | Build / version | Model | Priors / error model | Renal assumption | Run status | AUC (mg·h/L) | CL (L/h) | Peak / trough (mg/L) | Recommended | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Vancomyzer (this tree) | manifest 2026-09-17.1, branch audit/engine-remediation | Colin 2019 two-comp; MAP | log-SD 0.35/0.25/0.5/0.5; σ=max(1,0.15·max(obs,pred)) | SCr direct (Colin); CG shown as context only | **RUN** (synthetic) | 487.5 (prior) / 486.8 (12.9 @12 h fit) | 4.102 / 4.108 | 31.92 / 12.93 (steady state, end-infusion / pre-dose) | 1000 mg q12h | oracle-verified |
| ClinCalc Vancomycin | public site, review of 17 Sep 2026 (manual, not this session) | one-compartment Buelga (default male, non-critically ill) | population, no Bayesian fit in the reviewed run | IDMS-corrected SCr = 1.065×0.83+0.067; CrCl ≈107 | **RECORDED from public review, not re-run here** | AUC/MIC 289 | 6.93 | 19 / 6.8 | — (regimen matched manually) | Different model family; disagreement is model-explained, not a target to tune to |
| VancoPK | not tested | CL = (0.75×CrCl + 4)×0.06 L/h (public equation) | — | CrCl | **BLOCKED** (application not run) | — | — | — | — | Equation only; no run |
| DoseMeRx | — | proprietary Bayesian | — | — | **BLOCKED** (no authorised account) | — | — | — | — | |
| InsightRX Nova | — | proprietary Bayesian | — | — | **BLOCKED** (no authorised account) | — | — | — | — | |
| PrecisePK | — | proprietary Bayesian | — | — | **BLOCKED** (no authorised account) | — | — | — | — | |
| Tucuxi (tucucli) | commit hash to record | Vancomyzer prior baked into .tdd | mixed σ (1.0 add, 0.15 prop) — not identical in form | — | **BLOCKED** (no binary / model files); harness ready in `src/lib/validation/crosscheck/` | — | — | — | — | May 2026 snapshot remains on the public page, now labelled as such |

Rules applied: no fabricated results; blocked runs are blocked; common-math
checks (same model, same priors — Tucuxi) are separated from between-model
predictive comparisons (ClinCalc et al.); majority agreement is not truth.
