# Site copy that must change (evidence sync) — drafts, not applied where the repo is not connected

## dosys.health/science (repo `~/dosys-website`, NOT connected in this session — not changed)
Remove: "uses the Colin 2019 … for all patients with BMI below 40 kg/m²",
"When BMI ≥ 40 kg/m² is detected, Vancomyzer™ automatically activates the
Obesity Model…", the meta description "FFM-based obesity model (Smit 2020 +
Zhang 2024) for BMI ≥ 40", and any attribution of the retired model to Smit or Zhang.
Replace with (mirrors `modelRegistry.ts`):
> Vancomyzer™ uses the Colin 2019 two-compartment pooled population model for
> every adult, at any body size. A custom BMI ≥ 40 model that was never
> externally validated was retired from dosing on 15 September 2026; results
> calculated with it before that date remain labelled as such. At a BMI of
> 40 kg/m² or above the calculator shows an advisory and contextual fat-free
> mass and creatinine-clearance estimates that do not change the dose.
> Published obesity models (Smit 2020; Zhang 2024) are documented for
> comparison and are not implemented. Model manifest: 2026-09-17.1.

## dosys.health/legal/baa — see privacy-data-flow.md (false "client-side / not persisted" statement).

## vancomyzer.com (this repo) — items to apply after counsel review
- /privacy HIPAA Notice paragraph → draft in privacy-data-flow.md.
- /transparent-dosing/engine-crosscheck: add "Snapshot of 30 May 2026; a
  reproducible harness with committed fixtures now exists
  (`src/lib/validation/crosscheck/`); the comparator run has not been repeated."
- Quick-reference / downloads: state manifest 2026-09-17.1 and the exposure-horizon labels.
