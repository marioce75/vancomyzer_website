# Engine cross-check — acceptance criteria (set 17 Sep 2026, before any new run)

Scope: agreement between Vancomyzer's MAP posterior and an independently
implemented MIPD engine given IDENTICAL priors, error model and data, on the
committed synthetic fixture (`fixtures/crosscheck-seed42-n200.json`). This is a
common-math/optimiser check. It is **not** clinical validation, and majority
agreement is never treated as ground truth.

Criteria (posterior parameter, per patient, % difference vs comparator):

| Parameter | Median \|Δ\| | P95 \|Δ\| | Notes |
|---|---|---|---|
| CL | ≤ 2 % | ≤ 10 % | CL drives AUC; tightest |
| V1 | ≤ 3 % | — | |
| Q, V2 | reported | — | weakly identified by 2 levels; no threshold |

- Excluded/failed fits ≤ 2 % of the cohort, every exclusion listed by id and reason.
- Every |Δ CL| > 10 % case is investigated individually (boundary hit, local
  minimum, error-model form difference, sample timing) and explained in the
  report; unexplained outliers block a "pass".
- Comparator configuration must be recorded in the result file: product/build,
  model file hash, prior values, prior SDs, error model form (the comparator's
  `mixed` sigma is NOT identical in form to `max(1, 0.15·max(obs,pred))` and this
  must be stated), dose history, sample times, units.
- The exposure comparison (AUC24, peak, trough) is done on the steady-state
  horizon only, with the same infusion duration.

A run that cannot be executed (no comparator binary/licence) is recorded as
**BLOCKED**, never as passed.
