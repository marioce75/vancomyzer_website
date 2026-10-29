# Colin 2019 pediatric implementation review — 2026-10-29

Mario selected Colin 2019. Selection is recorded in the protected API and preview. No alternate model has been substituted. No patient-level pediatric calculation is enabled.

## Primary evidence and exact mismatch

[Colin 2019 article](https://link.springer.com/article/10.1007/s40262-018-0727-5) includes 559 newborns and 118 children/adolescents among 2,554 individuals. PMA, weight and serum creatinine are covariates. Non-neonatal PMA uses postnatal age plus 40 weeks. Renal replacement, ECMO and non-IV studies were excluded. These are development data, not independent validation of Vancomyzer. The reference case is age 35 years, weight 70 kg, SCr 0.83 mg/dL, CL 4.10 L/h. The final equations scale CL through V1 and Q through V2, with study-specific malignancy and heel-prick effects. The displayed decline equation is inconsistent with its narrative half-point.

[Supplementary NONMEM output](https://media.springernature.com/original/springer-static/esm/art%3A10.1007%2Fs40262-018-0727-5/MediaObjects/40262_2018_727_MOESM2_ESM.txt) normalizes maturation and decline to PMA_R = 35 + 40/52. At that reference age these ratios cancel. Using final-iteration log-CL 1.6674 and final renal coefficient gives 5.30335 L/h, about 29.3% above the article reference. This is an arithmetic finding, not evidence identifying which formulation the authors intended for deployment.

Run `python3 scripts/pediatric/source-discrepancy.py`. Its fixed synthetic adult reference is a source-audit probe only. Outputs are in `source-discrepancy.json`. It does not calculate a pediatric regimen, fit concentrations, or change the adult engine. The published narrative/table formulation yields 4.10238 L/h in this independent calculation. Do not silently combine a normalized supplementary clearance with the article’s unnormalized value.

## Existing implementation assessment

The original checkout and report-remediation worktree have adult-only implementations; no completed pediatric engine was found in the inspected research/worktree files. In `buildPriorParameters.ts`, MIN_WT_KG=30, the non-neonatal PMA assumption, omitted study effects and later adult renal constraints preclude lowering an age limit to produce a pediatric implementation. Existing independent adult crosschecks do not establish pediatric validity. Adult files are unchanged.

For a future exact population-model implementation, document reference normalization, parameter precision, PMA unit conversion, compartmental allometry, covariance/ETA coupling, study indicator interpretation, and the combined residual error. A study indicator must not automatically become an unvalidated clinical checkbox. Serum creatinine is a model covariate; an adult creatinine-clearance equation is not a substitute. Combined dataset minima/maxima do not establish valid age–weight–renal combinations.

## Other primary pediatric evidence considered

[Le 2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4101060/) assessed one- versus two-sample Bayesian monitoring in ages 3 months–21 years, with exclusions including haemodialysis and cystic fibrosis. Two samples improved estimation and future prediction. It does not establish validity for Colin 2019 or neonates.

[Lv 2021](https://pubmed.ncbi.nlm.nih.gov/33751618/) evaluated ten models against 451 concentrations in 220 Chinese pediatric patients. None met all population-prediction standards; individual forecasting improved with observations. This supports separate evaluation of prior-only and updated predictions, not a blanket endorsement or rejection of Colin.

Recommendation: retain Colin as selected, resolve its exact authoritative formulation first, and begin a separately versioned synthetic-only pediatric parameter explorer before any dose selection. Neonates should remain separately blocked until actual gestational/postnatal age handling and the neonatal sampling model are explicitly specified. All ages currently remain blocked because source reconciliation is unresolved.

## Reproducible validation plan

1. Pin a reviewed model manifest to primary-source URLs, parameter estimates and a documented resolution of the normalization discrepancy. Obtain author clarification or an authoritative, independently verified implementation; no outreach has been sent.
2. Produce independent oracle fixtures outside the TypeScript implementation. Use analytic two-compartment solutions and a second numerical ODE solver. Set tolerances before testing (proposed numerical tolerance 1e-6 relative for parameters; clinically acceptable prediction thresholds require reviewer agreement).
3. Add exact boundary fixtures for the chosen chronological age range, PMA and gestational age; include just below/at/above each bound, leap-year/date conversion, prematurity, missing values, NaN/infinity, wrong units and age–weight inconsistencies. Do not invent eligibility bounds from pooled extrema.
4. Verify mg/dL versus µmol/L conversion, kg versus grams rejection, and hour/minute boundaries. Test known reference cases, renal extremes, unstable renal state, RRT, ECMO, heel-prick sampling and malignancy handling. Unsupported or unknown states must fail closed without adult fallback.
5. Separately test prior-only parameters, one-level and two-level fits, held-out future concentrations, infusion/event timing, missing doses and loading doses. Never score training observations as external predictions.
6. Assess external pediatric data only after separately authorized access: bias, absolute prediction error, interval coverage, calibration and subgroup results by age, size and renal function. Prespecify inclusion criteria and thresholds with clinical reviewers. No patient data was accessed for this task.
7. Review source equivalence, uncertainty and limitations independently; require a clinical release decision before patient-care use. Admin-only availability does not constitute validation.

## Update 2026-10-29: implementation delivered

The source discrepancy is assessed (not resolved; author clarification outstanding) in MODEL-RESOLUTION.md and the full model (η-coupled compartmental allometry, study effects, Ω, combined residual error) is implemented under `src/lib/pediatric/` on the supplementary NONMEM parameterisation held as a research candidate, with independent Python/RK4 fixtures, synthetic prior/posterior performance and HTTP/browser security tests. READINESS.md records the owner decisions taken on 2026-10-29 and what remains. The validation plan above remains the route to clinical use; items 1-5 are now covered by synthetic fixtures, items 6-7 (external pediatric data, clinical release decision) are not.
