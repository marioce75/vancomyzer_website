# Input validation, timestamp and forecast semantics of the pediatric preview

Date: 2026-10-29 (revision 4). Applies to `validatePediatricRequest`, `parseStrictTimestamp`, `IMPOSSIBLE_LIMITS` and the forecast anchoring in `src/lib/pediatric/engine.ts`. Every rule below is covered by `src/lib/pediatric/__tests__/engine.test.ts` and, over real HTTP, by `scripts/pediatric/http-browser.mjs`. Nothing here changes model eligibility; model-population limits remain those of DATASET-COVERAGE.md.

## 1. Units and numbers

- Units are matched against fixed lists: age `days | weeks | months | years`; weight `kg | g`; creatinine `mg/dL | umol/L`. The check is a list membership, never a property lookup, so inherited object names (`toString`, `constructor`, `__proto__`, `valueOf`, `hasOwnProperty`) are rejected like any other unknown unit.
- Every required number must be a finite JavaScript number. `null`, strings, booleans, `NaN` and `±Infinity` are rejected with a field error before any calculation.
- A successful result is scanned before it is returned: if any number anywhere in it is non-finite, or any required numeric field (derived ages, weight, creatinine, prior parameters, steady-state exposure, intervals, sensitivity row, posterior parameters when present) is missing, the engine returns `status: "invalid"` instead of the result. Optional fields that are legitimately `null` (forecast without a history, Laplace SDs when the Hessian is not positive definite) are not required numbers.

## 2. Timestamps and time zones

Accepted format (API): ISO 8601 `YYYY-MM-DDTHH:MM[:SS[.sss]]` followed by `Z` or an explicit `±HH:MM` offset, e.g. `2026-10-29T08:00:00-05:00`. Each field is range-checked: year 1900–2199; month 01–12; day 01 to the real length of that month (29 February only in leap years, Gregorian rule); hour 00–23 (`24:00` rejected); minute and second 00–59 (leap seconds rejected); offset between −14:00 and +14:00. Nothing is normalised: `2026-02-30` is an error, not 2 March. Local times without an offset are rejected.

All dose, sample and next-planned-dose timestamp fields start blank, including subsequent added rows. Administrators enter each timestamp explicitly. A dose history requires an explicit next planned dose time; missing event or planned times return no dosing result. Prior-only steady-state calculations without a history need no timestamps.

Workspace (browser) interpretation, `src/lib/pediatric/localTime.ts`: the administrator chooses the zone the entries were recorded in (any IANA zone, `UTC`, or a fixed offset such as `-05:00`; default is the browser's zone, shown explicitly). Each `datetime-local` entry is resolved against that zone's rules using the Intl database, never `Date.parse`:

- a wall-clock time that **does not exist** in the zone (spring-forward gap, e.g. America/New_York 2026-03-08 02:30) is refused inline and the form cannot be submitted;
- a wall-clock time that **occurs twice** (fall-back fold, e.g. America/New_York 2026-11-01 01:30) requires the offset in force to be chosen (−04:00 first occurrence, −05:00 second); until chosen, the form cannot be submitted;
- a unique time resolves to one instant; the resolved offset and the UTC instant are displayed beside the field, and exactly that offset-qualified string is sent to the API.

The resolution is verified under five different process time zones (`localTime.test.ts`) and in a Chromium context whose own zone is Asia/Tokyo while the entries are declared as America/New_York (`http-browser.mjs`).

## 3. Dose history and levels

- Order in the arrays carries no meaning; timestamps are absolute. Messages refer to entries by their position as supplied; no entry is moved or re-timed.
- Two doses at the same instant are rejected as duplicates; a dose that starts before the previous infusion ends is rejected as overlapping. The history may span at most 21 days.
- Levels require a dose history. A level at or before the first recorded dose, or more than 7 days after the last recorded dose, is rejected.

## 4. Forecast semantics

- **Steady-state AUC24** = daily dose ÷ clearance for the entered regimen, independent of timing.
- **Forecast AUC24** = the AUC over the 24 h that begin at the **next planned dose**, with the recorded history continued on the entered regimen (dose, interval, infusion).
- The next planned dose is the explicitly entered `regimen.next_dose_start`, required whenever a dose history is supplied. It is never inferred from the last dose or interval. It must be at or after the end of the last recorded infusion and within 7 days of the last recorded dose.
- **Every level used for the fit must precede the forecast start.** Entries at or after that time are refused; correct the recorded history or enter the actual planned time. No dose is moved or invented.
- The result's `timeline` reports the origin, the last dose, the next planned dose and which anchor was used, the forecast window as hours and ISO instants, and the time of the last level.

## 5. Hard limits, verification, model-population and unknown-validity flags

Four categories (CLINICAL-REVIEW.md §3 has the sources and the open questions):

| Category | Effect | Rules |
|---|---|---|
| A. Invalid or beyond documented human extremes | refused (`invalid`) | non-finite or wrongly typed numbers, unknown units; weight < 0.2 kg (smallest documented surviving birth weight 212 g); weight > 11 kg in the first 28 days (heaviest documented birth 9.98 kg); weight > 160 kg (preview scope: provisional limit from a mixed-age dataset); creatinine outside 0.1–10 mg/dL; dose/infusion/interval/concentration entry limits |
| B. Unusual for age: verification required | `needs_verification` (HTTP 409), no dosing result until resubmitted with `inputs_verified: true` | weight-for-age \|z\| > 3 against WHO 2006 (0–5 y) or CDC 2000 (5–20 y), corrected age for preterm birth under 2 years; \|z\| > 5 uses stronger wording (unit or age error likely). This is a data-entry confirmation, not an eligibility override, and the review items stay on the result |
| C. Outside the studied model population | computed; reported in `input_review` and warnings | weight outside the development bands (neonates 0.42–4.45 kg at PNA ≤ 95 d; children 8.7–160 kg); creatinine outside 0.15–9.75 mg/dL; neonatal postnatal age outside 1–95 days. The age gap (PMA 0.88–2.58 y), RRT, ECMO and non-IV route are refused by owner decision |
| D. Clinical validity unknown | computed; reported with sources | postnatal age < 72 h (maternal creatinine); preterm infant below term-equivalent age (no preterm growth reference loaded); weight-for-age z > +2 (obesity cannot be classified without height); unstable renal function (single creatinine, constant clearance) |

Every `input_review` item carries its category, field, message and source. Percentile positions are never called impossible.

## 6. Choices for review

See CLINICAL-REVIEW.md §7 (eight questions for the pediatric clinician). Out-of-order dose arrays are accepted because timestamps are absolute; rows keep their original numbers in errors and in the result's audit table.
