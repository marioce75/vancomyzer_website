# Vancomyzer Existing-Regimen Timing Semantics Note — 2026-03-16

## Step completed
Explicit timing-semantics validation is now in place for existing-regimen steady-state interpretation.

The validator uses both:
- `time_since_last_dose_hours`
- `collection_time`

when available, and rejects timing patterns that are not coherent with a simple repeating steady-state regimen.

## Files verified as part of this step
- `website/src/lib/pk/validate/validateExistingRegimenRequest.ts`
  - rejects levels outside the dosing interval
  - rejects contradictory absolute vs relative level timing
  - rejects multi-level timing that spans more than one interval in a way suggesting missed/held-dose or cross-interval interpretation
- `website/src/lib/pk/normalize/normalizeLevels.ts`
  - preserves the timing fields in normalized form for deterministic validation
- `website/src/lib/pk/runExistingRegimenPipeline.ts`
  - blocks downstream steady-state interpretation when validation fails
- `website/src/lib/pk/posterior/normalizeObservations.ts`
  - keeps posterior observations anchored to the normalized level timing context
- `website/src/types/calculator.ts`
  - API/UI shape preserved
- `website/src/lib/pk/__tests__/existingRegimen.integration.test.ts`
  - deterministic integration coverage for contradictory timing and cross-interval timing rejection

## Validation behavior now enforced
1. `time_since_last_dose_hours` must be non-negative
2. `time_since_last_dose_hours` must remain within the stated dosing interval for a repeating steady-state regimen
3. provided `collection_time` values must be valid datetimes
4. if multiple levels include `collection_time`, the observed spacing between collection times must agree with the reported spacing between `time_since_last_dose_hours` values within tolerance
5. if collection times span more than one dosing interval, the case is rejected rather than interpreted as a normal repeating steady-state profile

## Why this is clinically safer
Before this change class of behavior, contradictory or cross-interval timing could be silently funneled into a steady-state model that assumes regular repeating dosing. That is exactly the sort of hidden assumption failure that can make an output look polished while being semantically wrong.

The current behavior is more conservative:
- if timing is inconsistent, the engine refuses the steady-state interpretation
- invalid cases do not receive routine AUC24 / peak / trough / curve outputs as though the model assumptions were satisfied

## Verification run during this closeout step
Executed successfully in `website/`:
- `npx tsx src/lib/pk/__tests__/existingRegimen.integration.test.ts`
- `npm run build`

Observed result:
- all 8 existing-regimen integration tests passed
- website production build passed

## Remaining limitations
- rejection is safer than silent acceptance, but it is not yet a rich recovery experience
- the calculator still lacks a dedicated non-steady-state or missed-dose interpretation workflow
- tolerance is deterministic and simple, not probabilistic or workflow-aware

## Recommended next step
Add a clearer front-end/user-facing explanation for timing rejection states, including language that the current calculator path assumes a repeating steady-state regimen and cannot safely interpret held-dose, missed-dose, or cross-interval level patterns.