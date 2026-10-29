# Investigation of the synthetic interval under-coverage

Date: 2026-10-29. Question: in the synthetic study at commit 296c7e2 the 90 % credible intervals for steady-state AUC24 covered the true value in only 83.75 % (one level) and 82.92 % (two levels) of virtual patients, while the prior interval covered 89.6 %. Which part is wrong: the simulation, the fit, the interval definition, the random effects or the error model? Everything here is synthetic (virtual patients drawn from the Colin 2019 model itself) and says nothing about clinical accuracy.

Reproduce: `npm run test:pediatric:coverage` (writes `coverage-diagnostics.json`, ~2 min) and `npm run test:pediatric:synthetic` (writes `synthetic-performance.json`).

## 1. Method

Same 480 virtual patients (four strata × 120, seed 20261029, η ~ N(0, Ω), levels simulated with the published combined residual error) and the same two sampling designs (trough only; peak + trough after dose 6). For each patient the 90 % interval of AUC24 = daily dose / CL(η) was obtained four ways and checked against the true AUC24 at nominal levels 50, 80, 90 and 95 %:

| Method | What it is |
|---|---|
| prior | 4000 draws from N(0, Ω) — no data |
| laplace600 | the engine method at 296c7e2: normal approximation at the MAP (inverse numerical Hessian), 600 draws |
| laplace4000 | same with 4000 draws (Monte-Carlo check) |
| exact | importance sampling of the exact posterior p(η\|y) ∝ L(y\|η)·N(η;0,Ω) with the prior as proposal, 40 000 draws, effective sample size (ESS) recorded |

Each coverage is reported with a Wilson 95 % limit (n = 480, so ±2.7 points around 90 %) and the side of every miss.

## 2. Results (`coverage-diagnostics.json`)

| Design | Method | nominal 50 % | nominal 80 % | nominal 90 % | nominal 95 % | misses below / above at 90 % |
|---|---|---|---|---|---|---|
| one level | prior | 49.6 | 82.9 | 89.6 | 94.6 | 4.2 / 6.3 |
| one level | laplace600 | 45.0 | 73.8 | **83.8** | 90.4 | 4.0 / **12.3** |
| one level | laplace4000 | 44.2 | 74.4 | 84.4 | 91.5 | 3.8 / 11.9 |
| one level | exact | 49.0 | 79.2 | **89.6** | 94.4 | 5.4 / 5.0 |
| two levels | prior | 49.6 | 82.9 | 89.6 | 94.6 | 4.2 / 6.3 |
| two levels | laplace600 | 44.4 | 70.6 | **82.9** | 89.0 | 3.5 / **13.5** |
| two levels | laplace4000 | 44.4 | 71.5 | 83.8 | 89.4 | 3.3 / 12.9 |
| two levels | exact | 49.0 | 79.6 | **89.4** | 93.8 | 6.3 / 4.4 |

Supporting measurements: 0 non-positive-definite Hessians in 960 fits; importance-sampling ESS median 23 000 (one level) and 16 000 (two levels), minimum 44–56; ratio of Laplace to exact 90 % interval width: median 0.86 (one level), 0.84 (two levels); ratio of the MAP AUC24 to the exact posterior median: median 0.961 (one level), 0.960 (two levels), 10th–90th percentile 0.95–0.98.

## 3. Interpretation

- **Simulation, random effects, residual-error model and interval definition are consistent.** The exact posterior is calibrated at every nominal level in both designs (89.6 % and 89.4 % at 90 %, with symmetric misses), and the prior interval was already calibrated. If the data-generating model, Ω, σ or the AUC transformation were wrong, the exact posterior would not be calibrated either.
- **The fit is correct but the interval approximation was not.** The Laplace normal at the MAP is 14–16 % too narrow and its centre (the posterior mode in η, pushed through the model) sits about 4 % below the posterior median of AUC24, because the AUC posterior is right-skewed and three η's are being summarised from one or two observations. Both effects push misses above the upper limit (12–13 % above versus 3–4 % below).
- Monte-Carlo draw count was not the cause (600 vs 4000 draws differ by < 1 point).

## 4. Change made

The engine now reports credible intervals from **deterministic importance sampling of the exact posterior** (`posteriorDraws` in `src/lib/pediatric/colin2019/fit.ts`): 4000 draws from a defensive mixture proposal (½ prior, ½ Laplace normal at the MAP inflated 1.5×), weights = likelihood × prior / proposal, seeded so identical inputs give identical intervals. The result reports the sampling method, draw count and ESS, warns when ESS < 200, and shows the posterior median AUC24 beside the MAP value. The MAP parameters remain the point estimate; the Laplace η SDs remain as a diagnostic in the parameter table.

Re-run of the synthetic study with the engine method (`synthetic-performance.json`):

| Estimate | median bias (MAP) | median bias (posterior median) | MAPE | RMSE | 90 % coverage (Wilson) | superseded Laplace | AUC category agreement |
|---|---|---|---|---|---|---|---|
| prior only | −2.6 % | – | 22.2 % | 35.3 % | 89.6 % (86.5–92.0) | – | 47.9 % |
| one level | −6.1 % | −2.8 % | 13.3 % | 20.1 % | 89.4 % (86.3–91.8) | 83.8 % | 68.3 % |
| two levels | −4.8 % | −1.1 % | 11.3 % | 17.5 % | 89.8 % (86.8–92.2) | 82.9 % | 71.3 % |

## 5. What this does and does not show

It shows the implementation is self-consistent: when children really follow Colin 2019 with its published variability, the reported 90 % intervals contain the truth about 90 % of the time. It does not show that real children follow the model, that the published Ω and σ apply to a given unit's assay and sampling practice, or that a 90 % interval is clinically adequate. The AUC-category disagreement of about 30 % even with two levels is a property of the model's residual uncertainty, not of the interval method, and is unchanged.
