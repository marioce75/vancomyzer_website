# Credible band — synthetic coverage check (calculator 2026-09-25.1)

**What this is:** a simulation–estimation check of the 90% credible band on the
concentration–time graph. Synthetic patients only; no patient data. It tests
pointwise latent-concentration coverage in selected app-like simulations and
simplified sensitivity scenarios, conditional on a band being available. It says nothing about how
well Colin 2019 describes real patients — only the validation study can.

Reproduce: `node --import tsx scripts/verify-band-coverage.ts --scenario <s> --design <d> --n 500`,
then `--report`. Raw numbers: `src/lib/validation/bandCoverage/band-coverage-results.json` (shown on /transparent-dosing/software-checks).

## Set-up

- 500 synthetic ICU adults per cell (covariates from `validation/predictive/syntheticIcuPopulation.ts`).
- Each patient gets a true parameter set; levels are simulated from it with assay error and run through the calculator.
- Coverage = share of plotted time points where the TRUE concentration lies inside the band, pooled over patients
  (± 1.96 × patient-clustered SE). "Trough"/"peak" = the last plotted trough and peak.

Designs: **empiric** (no levels) · **one_level** (11.5 h after the start of dose 5, q12h, steady state not confirmed)
· **peak_trough** (peak 1 h after the end of infusion + trough, same interval, true steady state)
· **loading_dose** (25 mg/kg load, max 3,000 mg, then maintenance q12h; one level 11.5 h after dose 3, load entered).

Scenarios for the truth: **app** uses the custom independent prior SDs and a similar, not identical, observation generator. The generator uses true concentration in its error SD; the fitter uses max(observed, predicted). **published**, **published_iiv** and **published_error** are historical identifiers for simplified sensitivity scenarios, NOT full Colin-model reproduction. The published scenario fixes Q, omits CL–V1 and Q–V2 random-effect coupling, and omits the additive residual SD of 1.23 mg/L. Absence of an independent Q random effect in Colin does not imply fixed Q. Noise is also rounded and floored. Raw historical results are retained unchanged.

## Results (target 90%)

| Truth | Design | Band shown | Coverage | Below / above | Trough | Peak |
|---|---|---|---|---|---|---|
| app | empiric | 500/500 | 88.0% (±2.4) | 5.5% / 6.5% | 88.2% | 89.8% |
| app | one_level | 492/500 | 91.0% (±1.7) | 3.4% / 5.6% | 93.3% | 91.7% |
| app | peak_trough | 500/500 | 90.3% (±1.8) | 2.9% / 6.8% | 91.6% | 92.0% |
| app | loading_dose | 494/500 | 90.4% (±1.7) | 2.9% / 6.7% | 91.5% | 88.5% |
| published | empiric | 499/500 | 92.6% (±1.9) | 3.5% / 3.9% | 96.2% | 93.6% |
| published | one_level | 495/500 | 87.4% (±2.0) | 4.5% / 8.1% | 87.1% | 85.5% |
| published | peak_trough | 500/500 | **81.8% (±2.5)** | 8.3% / 9.9% | 80.4% | 84.8% |
| published | loading_dose | 491/500 | 89.2% (±1.9) | 2.9% / 7.9% | 86.8% | 86.2% |
| published_iiv | peak_trough | 500/500 | 87.1% (±2.1) | 7.0% / 5.9% | 89.2% | 90.0% |
| published_error | peak_trough | 500/500 | 84.7% (±2.4) | 4.5% / 10.8% | 82.4% | 86.0% |

## Corrected interpretation — 3 October 2026

App-like scenarios have pooled coverage near 90% in this simulation; this does not establish calibration generally. The 81.8% peak/trough result belongs to the simplified sensitivity scenario, not the complete published Colin model. The split scenarios use different seeds and do not establish a universal causal ranking of error versus variability assumptions. Comparing the app CL SD directly with Colin's conditional CL random-effect SD ignores coupling.

Coverage is pooled over plotted time points, conditional on a band being available. The unavailable fraction is separately reported. These are latent concentration bands, not intervals for a future noisy measured concentration. Held-out measured-level coverage requires a separately defined posterior predictive interval including residual error, with reviewer-approved endpoints and failure handling. The earlier proposed 85–95% acceptance range is not an approved criterion.

Before study activation: clarify the source model; predefine full-model coupled variability and combined error simulations; use paired seeds for sensitivity comparisons; specify latent versus observed outcomes; obtain independent methods review. No dosing parameters are changed by this documentation correction.
