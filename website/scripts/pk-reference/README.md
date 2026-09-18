# PK reference (oracle) for the two-compartment vancomycin engine

Independent numerical reference used to verify `src/lib/pk/steadyStateTwoCompartment.ts`
and `src/lib/pk/posterior/buildPriorParameters.ts`. Nothing here imports production code.

## Source

Colin PJ et al. *Vancomycin pharmacokinetics throughout life: results from a pooled
population analysis and evaluation of current dosing recommendations.*
Clin Pharmacokinet. 2019;58(6):767-780. DOI 10.1007/s40262-018-0727-5 (Eqs 6-13, Table 3).

Two-compartment IV infusion, first-order elimination:
`k10 = CL/V1`, `k12 = Q/V1`, `k21 = Q/V2`, `C = A1/V1`.

## Units

mg (dose, amounts), L (volumes), L/h (clearances), h (time), mg/L = mcg/mL (concentration),
mg·h/L (AUC), mg/dL (serum creatinine), years (age; PMA = age + 40/52).

## Pieces

| File | Method |
|---|---|
| `matrix_exp_reference.py` | `scipy.linalg.expm` on the augmented 4-state linear system `[A1, A2, AUC, 1]`. Exact for piecewise-constant infusion input; AUC is a state variable (analytic), with a Richardson-extrapolated trapezoid cross-check. Steady state by long simulation (>= 45 terminal half-lives and >= 200 doses), never the accumulation formula. |
| `fixtures.json` | Output of the script: 14 cases (reference regimen, q18h, q36h, T_inf 0.5-4 h, slow elimination CL 0.3 L/h, near-degenerate alpha ~ beta, four other Colin patients) plus the reference prior and BMI-continuity values. |
| `src/lib/pk/__tests__/oracle/closedFormOracle.ts` | Independent TypeScript closed form: macro constants, biexponential single infusion, superposition, geometric steady-state accumulation, analytic AUC. |
| `src/lib/pk/__tests__/oracle/oracle.test.ts` | Checks the closed form against the fixtures, asserts literal reference values, runs property tests, then compares production functions against the oracle. |

## Tolerances

* expm states: floating-point only (~1e-13 relative). Mass-balance residuals in the fixtures are < 1e-10 mg.
* Steady state by simulation: residual `2^-45` ~ 3e-14 relative; per-case `convergence_rel_change_last_interval` is stored.
* Trapezoid/Richardson AUC cross-check: agrees with the analytic AUC state to < 1e-10 relative (reported, not asserted).
* Closed-form oracle vs fixtures: 1e-6 relative on every concentration, AUC and amount.
* Production vs oracle: 1e-6 relative. Literal reference values: 1e-9 relative (limited by the 13 quoted digits); BMI CL values 1e-5 as specified.

## Known production finding

`singleDoseAuc` (fixed 0.02 h trapezoid) differs from the analytic AUC by 1e-6 to ~1.2e-5
relative (always low). It is quadrature error, not a formula error: the reference case
converges to the oracle at 3.2e-8 with step 0.01 h and 3.2e-12 with step 1e-4 h. The test
reports it rather than loosening tolerance. All other compared functions
(`computeExposure`, `concentrationAtTime`, `singleDoseConcentration`, `curvePoints`,
`buildPriorParameters`) agree at 1e-6.

## Regenerate / run

```
pip install --break-system-packages numpy scipy   # if missing
python3 scripts/pk-reference/matrix_exp_reference.py   # rewrites fixtures.json (~4 s)
npm run test:oracle                                    # or: npx tsx src/lib/pk/__tests__/oracle/oracle.test.ts
ORACLE_SEED=42 npm run test:oracle                     # different random regimen grid
```
