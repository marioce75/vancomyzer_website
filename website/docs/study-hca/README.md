# Vancomyzer timed-draw prediction: offline research package

Research use only for the proposed HCA study. Not for patient care. No dose recommendations. Built and tested with fictional data only; no HCA record, access, installation or study launch is represented by this package.

## What it does

For each case it predicts the vancomycin concentration (mg/L) at the actual time of the first usable blood draw, from age, weight and serum creatinine available at treatment start and the actual IV doses and infusion times up to the draw (including any loading dose). It uses the adult Colin 2019 model and calculation functions exactly as shipped in the pinned Vancomyzer release (see `RELEASE.json`). It never receives a measured result or a prior level. Ambiguous or unsupported histories are refused with a reason. Details: `FIELD_DICTIONARY.md`.

## Requirements

Node.js 18 or later, installed by the institution. Nothing else: no package installation, internet connection, account, cloud service or analytics. The command reads only the input files you name and writes only into a new output directory you name. Keep inputs and outputs in locations HCA has authorized.

## Verify the package

```
shasum -a 256 -c hca-timed-draw-package.tar.gz.sha256        # before unpacking
cd hca-timed-draw-package && shasum -a 256 -c SHA256SUMS      # after unpacking
node predict.cjs --version
```

The expected archive checksum is recorded separately with the release notes. Hashes show the files are unchanged; they are not a signature or access control.

## Batch run

JSON input:
```
node predict.cjs --json examples/fictional-cases.json --out /authorized/location/run-001
```
CSV input (one row per case plus one row per dose):
```
node predict.cjs --cases examples/fictional-cases.csv --doses examples/fictional-doses.csv --out /authorized/location/run-002
```
The output directory must not exist (runs are never overwritten). It receives `predictions.csv`, `predictions.json` and `run-manifest.json` with restrictive permissions. If a file is malformed, or a column is unknown or looks like a measured result, nothing is written and the reasons are printed.

Check the example run reproduces the expected output byte for byte:
```
cmp /authorized/location/run-001/predictions.csv examples/expected-predictions.csv && echo identical
```

## Single-case entry screen

Open `case-entry.html` in a browser on the approved workstation (double-click; no server). The page runs the same prediction function. Its Content-Security-Policy blocks every network request, and it stores nothing. "Save result (CSV)" writes through the browser's save dialog; choose an authorized folder.

## Separation of outcomes

The input format has no place for a measured concentration. Keep measured results in a separate file held by the analyst, and lock predictions (with `run-manifest.json` hashes) before outcomes are joined. Code cannot prove that no person viewed an outcome; HCA procedures must.

## Scope and limits

- Adults 18–120 y, 30–400 kg, SCr 0.1–10 mg/dL, intermittent IV infusions of 1–720 min, no renal replacement therapy.
- Population (a priori) prediction only. Population variability, residual error and covariates outside Colin 2019 (for example haematological malignancy) are not represented.
- VigiLanz is the proposed clinical comparator; HCA must confirm its version can predict at the draw time without the measured level. This package is not a VigiLanz substitute. The separate Colin reproduction is a software check for the technical appendix, not a clinical comparator.
- No independent sign-off or clinical validation is claimed. See `ACCEPTANCE_PLAN.md` and `REVIEWER_CASES.md`.
