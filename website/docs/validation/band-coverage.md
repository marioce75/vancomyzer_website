# Credible band — synthetic coverage check (2026-09-24)

**What this is:** a simulation–estimation check of the 90% credible band on the
concentration–time graph. Synthetic patients only; no patient data. It tests
whether the band is computed correctly *when the model's assumptions hold*, and
how far coverage moves when the population differs. It says nothing about how
well Colin 2019 describes real patients — only the validation study can.

Reproduce: `node --import tsx scripts/verify-band-coverage.ts --scenario <s> --design <d> --n 500`,
then `--report`. Raw numbers: `band-coverage-results.json`.

## Set-up

- 500 synthetic ICU adults per cell (covariates from `validation/predictive/syntheticIcuPopulation.ts`).
- Each patient gets a true parameter set; levels are simulated from it with assay error and run through the calculator.
- Coverage = share of plotted time points where the TRUE concentration lies inside the band, pooled over patients
  (± 1.96 × patient-clustered SE). "Trough"/"peak" = the last plotted trough and peak.

Designs: **empiric** (no levels) · **one_level** (11.5 h after the start of dose 5, q12h, steady state not confirmed)
· **peak_trough** (peak 1 h after the end of infusion + trough, same interval, true steady state).

Scenarios for the truth: **app** = the calculator's own prior SDs and error model (tests the machinery) ·
**published** = Colin 2019 published IIV (CV 27.9% CL, 27.3% V1, 97.9% V2, none on Q) and 21.5% proportional
residual error (stress test; IIV correlations not modelled) · **published_iiv** / **published_error** = one of the two.

## Results (target 90%)

| Truth | Design | Band shown | Coverage | Below / above | Trough | Peak |
|---|---|---|---|---|---|---|
| app | empiric | 500/500 | 88.0% (±2.4) | 5.5% / 6.5% | 88.2% | 89.8% |
| app | one_level | 492/500 | 91.0% (±1.7) | 3.4% / 5.6% | 93.3% | 91.7% |
| app | peak_trough | 500/500 | 90.3% (±1.8) | 2.9% / 6.8% | 91.6% | 92.0% |
| published | empiric | 499/500 | 92.6% (±1.9) | 3.5% / 3.9% | 96.2% | 93.6% |
| published | one_level | 495/500 | 87.4% (±2.0) | 4.5% / 8.1% | 87.1% | 85.5% |
| published | peak_trough | 500/500 | **81.8% (±2.5)** | 8.3% / 9.9% | 80.4% | 84.8% |
| published_iiv | peak_trough | 500/500 | 87.1% (±2.1) | 7.0% / 5.9% | 89.2% | 90.0% |
| published_error | peak_trough | 500/500 | 84.7% (±2.4) | 4.5% / 10.8% | 82.4% | 86.0% |

## Reading

1. **The machinery is calibrated.** Under the calculator's own assumptions all three designs are within
   sampling error of 90%.
2. **Before levels, the band is conservative** if Colin's published variability is right (92.6%): the app's
   prior SD on CL (0.35) is wider than published (≈0.27).
3. **With levels, it is overconfident** if Colin's published variability is right: 87% with one level, 82% with
   a peak and a trough. The larger cause is the residual error: the fit assumes 15% (floor 1 mg/L) where Colin
   reports 21.5%, so the fit trusts each level too much. V2 variability (97.9% published vs a 0.50 log-SD prior)
   is the smaller cause.
4. About 1–2% of single-level patients get no band (effective sample size too low); the graph says why.

## Implications before the validation study

- The chart labels the band "model-based; not yet validated". That label is accurate and should stay.
- Aligning the fit's prior SDs and residual error with Colin 2019 would be expected to bring the two-level
  case close to 90% *if Colin describes the population*. That changes dosing math and belongs with the
  validation plan, not a label edit.
- Pre-specify in the study protocol: coverage of the 90% band for a held-out later level (target 85–95%).
