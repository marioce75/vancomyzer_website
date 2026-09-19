# Vancomyzer 2026-09-19.1 — study preparation release

Research preparation only. No external investigator, clinical validation, ethics approval, regulatory determination or institution-approved deployment is represented by this package. Outreach is on hold at the owner's instruction.

## Supported design

Adults, intermittent infusion, known uniform dose/interval/duration, no RRT or ECMO. The one- or two-level input samples must follow the same most recent dose. Every input result and covariate must be available by cutoff. A held-out forecast follows cutoff and every fitted sample. Regular future infusions are explicit. Dose-conditional and operational forecasts are separately labeled; the latter requires a plan available by cutoff. No irregular, changed, held, interrupted or loading-to-maintenance history is approximated.

The public engine retains documented legacy API horizon inference for compatibility. The research runner does not: it requires a dose count, explicit horizon, history verification and a steady-state rationale. The calculator UI now separates exact dose count from an affirmative steady-state checkbox.

Time zero is the start of the last infusion preceding ALL input samples. `doses_given` counts prior uniform administrations including time zero. `covariates_available_hour` is the latest availability time among all entered covariates. `history_verified_uniform` is an institutional source-data attestation, not automatic proof of the medication record. Future doses are sorted at tau, 2*tau, ... through the forecast time. Cutoff precedes the next administration. Relative times preserve chronology without exporting exact dates.

## Running locally

Install dependencies in a staging environment with no patient data. Then use the locked, reviewed package on institution-approved local infrastructure. The forecast and analysis entry points import no web server, database, account, analytics, email or networking clients and do not load environment files. Do not run the public Next.js app as a substitute for this research runner.

From the website directory:

```
node --import tsx scripts/research/forecast.ts docs/study-release/synthetic-input.json /approved/new-run
node --import tsx scripts/research/analyze.ts /approved/new-run docs/study-release/synthetic-outcomes.json /approved/new-analysis.json
```

Both demonstration files contain fabricated data. Their results demonstrate mechanics only. They are not clinical evidence. Real records require prior institutional approval.

A packaged build can instead use `node forecast.cjs ...` and `node analyze.cjs ...` from its release directory. It requires Node.js, but no package installation, web account or network connection at execution time.

## Separation and traceability

- The forecast schema refuses unknown fields, including outcome concentrations. Outcomes remain in a separate file controlled by the independent analyst.
- Codes must identify exactly one primary patient/forecast within a site. Duplicate site/case keys are rejected. The institution must additionally verify that different codes do not conceal repeat patients.
- Invalid and unsupported records receive reason codes, rather than disappearing from the attempted cohort.
- Inputs, outputs and source files are hashed. The manifest records runtime, model version and runner digest. Record the reviewed source commit and deployment commit separately when freezing the final study.
- Output files use restrictive creation permissions. Existing run directories/reports are not overwritten. Hash verification detects changed prediction contents relative to the manifest. These controls are not a digital signature or proof against someone changing both files; place locked artifacts in an institution-controlled read-only archive.
- Freeze forecast inputs and predictions before the independent analyst accesses outcomes. Filesystem separation and organizational independence must enforce this; code cannot prove that a human never viewed outcomes.
- Do not edit values to make an excluded course fit. Report representability and screening counts. Do not use the study prediction as a patient-care recommendation.

The analysis script provides F30/Wilson intervals, MAE, RMSE, geometric ratio, a fixed-seed site-stratified bootstrap interval, site summaries and attempted/evaluable/coverage denominators. It does not automatically grant a clinical pass. The independent statistician must approve the full SAP, including additional subgroup, comparator, censoring and sensitivity analyses before study activation.

## Correction disposition

| Requirement | Implemented | Remaining approval/verification |
|---|---|---|
| R1 cycle history | Reject cross-cycle finite-history samples, both entry orders; dated samples distinguished for duplicate detection | Event-history expansion is a future release, not silently supported |
| R2 late sample | Actual elapsed time retained in steady-state tail, with no invented next dose | Clinical eligibility for the first study remains deliberately narrower |
| R3 final diagnostics | Objective, observation residuals, summary and parameter record recomputed after CL policy bounds | Original optimizer provenance separately labeled; clinical review of bounds still required |
| R4 unsupported history | Reject supplied loading/changed/irregular history before calculation | Site must verify undocumented real-world history |
| R5 explicit horizon | Research schema requires count/flag/justification; UI separates count from confirmation | Legacy API compatibility documented; reviewer approves study's steady-state criteria |
| R6 study runner | Local deterministic forecasts, outcome separation, manifests, no overwrite, analysis entry point | Independent run and full SAP signoff |
| R7 data governance | New operational logs omit clinical values/email; fit-diagnostic security logging removed; local runner avoids hosted services | Historical logs/backups, actual hosting, access and retention require owner/institution review; no deletion claimed |
| R8 claims | Science, renal-policy and privacy/BAA statements reconciled in source | Confirm both live deployments and obtain qualified regulatory/legal review |
| R9 model choices | Unchanged assumptions documented in reviewer decision register | Independent clinical/pharmacometrics/statistical decisions cannot be self-certified |
| R10 raw validation | Finite values, bounds, integer dose counts, explicit timestamp offsets, valid calendar dates, units and unsupported populations checked | Site extraction/unit mapping and human-factors review |
| R11 provenance | Manifest version, source/dependency/runner hashes and deployment revision in API result snapshot | Verify deployed revision and freeze institutional configuration |
| R12 uncertainty | No statistically calibrated band introduced; existing band remains illustrative | A validated uncertainty interval needs a future protocol/model revision |

## Clinical and governance decision register

1. Priors: log-SDs CL/V1/Q/V2 = 0.35/0.25/0.50/0.50; no covariance. Residual SD = max(1 mg/L, 0.15 × max(observed,predicted)). These are application choices, not the published Colin variability. No change in this release.
2. Colin adult covariates: total body weight, age and SCr; malignancy effect omitted; SCr floor 0.4 mg/dL. Clinical reviewer must accept/restrict intended population or specify a new model version.
3. Post-fit policy: nonrenal CL floor 0.4 L/h per 70 kg with allometry; upper bound twice Cockcroft–Gault on total body weight. Missing sex currently uses the existing male calculation. This needs an explicit independent clinical decision; it is not proof of physiological impossibility.
4. Optimizer and clamps: multistart Nelder–Mead, tolerance 1e-6, 400 iterations/start, 0.1–10 times prior bounds. Research runner abstains on nonconvergence or conflicting duplicate samples. Parameter limits are documented, not silently revised to improve validation results.
5. Dose-policy settings: freeze the intended institution's settings separately; the current research runner returns concentration forecasts, not dose recommendations. A concentration validation does not validate recommendation policy.
6. Privacy: identify current log/backups owners, actual retention, access controls and institutional data roles. Do not infer HIPAA de-identification from omitted names or hashing.
7. Regulatory: assess each function/intended use under current FDA and EU guidance. Neither transparency nor this release record establishes exemption or authorization.
8. Independent review: a developer-run oracle or synthetic test is not an independent investigator's signoff. Mark reviewer names, conflicts, dates, decisions and unresolved issues before activation.

## Release acceptance

Run the entire test chain, research typecheck, both site builds, synthetic end-to-end CLI and changed UI/API checks. Preserve evidence. Confirm final source/deployment identities. No patient records, institution contacts or grant submissions are part of this release operation. Keep outreach paused until the owner reviews the remaining external gates.
