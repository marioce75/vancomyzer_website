# Field dictionary: timed-draw prediction (input schema `vancomyzer-hca-timed-draw` v1)

Every field is required unless marked optional. Any other field or column is refused for the whole file. A field or column whose name looks like a measured result (for example `level`, `measured`, `observed`, `result`, `concentration`, `trough`, `peak`, `auc`, `lab`, `outcome`, `value`) is refused with `MEASURED_RESULT_SUPPLIED`. Measured concentrations and any prior vancomycin level stay in a separate outcome file held by the analyst.

## Case (JSON object in `cases`, or one row of `cases.csv`)

| Field | Type / unit | Rule |
|---|---|---|
| `study_case_id` | text | 1–64 characters: letters, digits, `.`, `_`, `-`, starting with a letter or digit. The study code only, never a medical record number or name. Must be unique in a batch (duplicates are all refused). |
| `time_basis` | `elapsed_hours` or `datetime` | How every time in the case is written. `elapsed_hours`: hours from any case-specific reference (for example the first dose = 0); negative values allowed. `datetime`: ISO 8601 with seconds optional and an explicit offset, `2030-01-05T08:00-06:00` or `...Z`. Times without an offset are refused. |
| `age_years` | years | Age at treatment start, 18–120. |
| `weight_kg` | kg | Weight recorded at treatment start, 30–400. |
| `serum_creatinine_mg_dl` | mg/dL | Serum creatinine available at treatment start, 0.1–10. Convert µmol/L by dividing by 88.4. |
| `scr_collected_at` | time | When that creatinine was collected. Must be at or before the first dose start. |
| `renal_replacement_therapy` | `true` / `false` | `true` is refused (outside the Colin 2019 adult population). |
| `history_complete_attested` | `true` / `false` | Must be `true`: every vancomycin administration from the first dose up to the draw, including any loading dose or dose given elsewhere, is listed with actual times. Anything else is refused. Missing doses are never inferred. |
| `draw_time` | time | Actual collection time of the first usable vancomycin sample. |
| `doses` | list (JSON) / rows in `doses.csv` | Actual IV administrations, any order. At least one must start before the draw. |

## Dose (JSON object in `doses`, or one row of `doses.csv`)

| Field | Type / unit | Rule |
|---|---|---|
| `study_case_id` | text | `doses.csv` only: the case this dose belongs to. |
| `start` | time | Actual infusion start, same basis as the case. |
| `dose_mg` | mg | Amount actually administered, 1–6000. |
| `infusion_minutes` | minutes | Actual infusion duration, 1–720. Give this **or** `end`, never both. |
| `end` | time | Actual infusion end (optional alternative to `infusion_minutes`). |

## Rules applied to the history

- Doses that start after the draw are excluded (warning `DOSES_AFTER_DRAW_EXCLUDED`). A dose that starts exactly at the draw time is refused as ambiguous (`DOSE_STARTS_AT_DRAW`).
- An infusion still running at the draw contributes only the drug infused up to the draw (warning `INFUSION_IN_PROGRESS_AT_DRAW`).
- Two doses with the same start (`DUPLICATE_DOSE_TIME`) or a dose starting before the previous one finished (`OVERLAPPING_INFUSIONS`) are refused.
- No steady state is assumed, no scheduled dose is substituted and no gap is filled. Gaps longer than 48 h are used as recorded with a warning `LONG_GAP_BETWEEN_DOSES`.

## Output (`predictions.csv` / `predictions.json`, one row per input case, input order)

| Column | Meaning |
|---|---|
| `study_case_id` | As supplied (blank if it was invalid). |
| `status` | `predicted` or `refused`. |
| `draw_time` | As supplied. |
| `draw_elapsed_hours` | Hours from the start of the first administered dose to the draw. |
| `predicted_concentration_mg_l` | Unrounded predicted vancomycin concentration (mg/L) at the draw. Blank when refused. |
| `doses_used` | Number of doses started before the draw. |
| `warnings` | `CODE: message` items separated by ` \| `. |
| `reasons` | Why no prediction was made, same format. |
| `release` | Workflow version, pinned calculation commit and model manifest. |

`predictions.json` additionally carries the population parameters used (CL, V1, Q, V2). `run-manifest.json` records SHA-256 hashes of the inputs and outputs, counts and versions. No dose recommendation is produced.

## Refusal and warning codes

Refusal: `INVALID_CASE`, `INVALID_STUDY_CASE_ID`, `INVALID_TIME_BASIS`, `INVALID_TIME`, `MISSING_OR_INVALID_NUMBER`, `OUT_OF_RANGE`, `UNSUPPORTED_POPULATION`, `UNSUPPORTED_RRT`, `MISSING_OR_INVALID_FLAG`, `HISTORY_NOT_ATTESTED`, `MISSING_DRAW_TIME`, `MISSING_SCR_TIME`, `SCR_AFTER_TREATMENT_START`, `NO_DOSES`, `TOO_MANY_DOSES`, `INVALID_DOSE`, `MISSING_DOSE_START`, `AMBIGUOUS_INFUSION_DURATION`, `INVALID_INFUSION_DURATION`, `UNSUPPORTED_INFUSION_DURATION`, `DUPLICATE_DOSE_TIME`, `OVERLAPPING_INFUSIONS`, `DOSE_STARTS_AT_DRAW`, `NO_DOSE_BEFORE_DRAW`, `UNKNOWN_FIELD`, `MEASURED_RESULT_SUPPLIED`, `DUPLICATE_STUDY_CASE_ID`, `NUMERICAL_FAILURE`.

Warning: `DOSES_AFTER_DRAW_EXCLUDED`, `INFUSION_IN_PROGRESS_AT_DRAW`, `LONG_GAP_BETWEEN_DOSES`.

File-level (nothing written): `CSV_SYNTAX`, `CSV_ROW_WIDTH`, `EMPTY_FILE`, `MISSING_COLUMN`, `DUPLICATE_COLUMN`, `DOSE_WITHOUT_CASE`, `JSON_SYNTAX`, `INVALID_ENVELOPE`, `NO_CASES`, `TOO_MANY_CASES`, plus `UNKNOWN_FIELD` / `MEASURED_RESULT_SUPPLIED` for a column or top-level key.
