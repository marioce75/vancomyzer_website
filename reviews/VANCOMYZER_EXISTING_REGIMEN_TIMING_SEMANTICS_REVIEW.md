# Verifier Review — Existing-Regimen Timing Semantics Validation

Date: 2026-03-16
Task: `137_existing_regimen_timing_semantics_validation.md`
Status: Review-ready

## Review question
Did the timing-semantics validation changes materially reduce the risk that inconsistent existing-regimen level timing would be misinterpreted as a valid steady-state regimen?

## Conclusion
Yes.

This change is clinically safer than the prior behavior because the steady-state pathway is now explicitly gated on timing coherence instead of quietly accepting contradictory or cross-interval timing patterns.

## What was verified
- `website/src/lib/pk/validate/validateExistingRegimenRequest.ts`
  - rejects `time_since_last_dose_hours` values outside the stated interval for repeating steady-state interpretation
  - rejects contradictory `collection_time` versus `time_since_last_dose_hours` relationships
  - rejects multi-level timing patterns that imply cross-interval or non-routine dosing interpretation
- `website/src/lib/pk/normalize/normalizeLevels.ts`
  - preserves timing context needed for deterministic validation
- `website/src/lib/pk/runExistingRegimenPipeline.ts`
  - prevents downstream steady-state exposure outputs when validation fails
- `website/src/lib/pk/posterior/normalizeObservations.ts`
  - keeps posterior observations aligned with normalized timing inputs
- `website/src/lib/pk/__tests__/existingRegimen.integration.test.ts`
  - covers contradictory absolute-vs-relative timing rejection
  - covers cross-interval multi-level rejection
  - still passes valid repeating-regimen cases
- website production build passes after the current implementation state

## Safety assessment
### Safer than before
Yes.

Most important improvement:
- the calculator is less likely to present a polished but semantically invalid steady-state AUC24 / peak / trough / curve for a case whose dosing history is not actually coherent with the model assumptions

Also safer:
- likely missed-dose, held-dose, or delayed-sampling patterns are rejected instead of being silently normalized into the routine steady-state path
- posterior fitting no longer receives obviously contradictory timing data in normal flow

### Remaining limits
This is a conservative gate, not a complete recovery workflow.

Still true:
- rejection does not yet provide a richer alternate interpretation path
- tolerance handling is simple and deterministic, not uncertainty-aware
- the engine still assumes a bounded one-compartment repeating-regimen model when the case is accepted

## Recommendation
Accept this task as a meaningful safety improvement and keep the stricter rejection behavior.

Next follow-on should be better user-facing explanation for why a timing pattern is not safely interpretable as a routine steady-state existing-regimen case.

## Blockers to full confidence
- no dedicated non-steady-state workflow yet
- no uncertainty or confidence reporting
- no external clinical validation artifact for these rejection thresholds yet
