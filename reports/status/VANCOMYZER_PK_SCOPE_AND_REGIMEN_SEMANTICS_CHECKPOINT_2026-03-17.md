# Vancomyzer PK Scope and Regimen Semantics Checkpoint

Date: 2026-03-17
Status: Implemented and validated

## What was implemented
- Added explicit loading-dose guidance for the initial-regimen workflow via `buildEmpiricLoadingDose.ts`.
- Updated initial-regimen interpretation, assumptions, limitations, quick summary, and clinical note to clarify:
  - adult prior-model scope
  - maintenance-vs-loading semantics
  - loading-dose guidance is generic empiric support, not patient-specific certainty
- Tightened existing-regimen recommendation semantics so weak/high-uncertainty sparse fits keep interval recommendations conservative.
- Added explicit interpretation/limitations language for:
  - weak posterior evidence
  - levels drawn during infusion or too close after infusion
  - near-continuous infusion being outside the intermittent steady-state model
- Updated calculator UI copy to improve population-scope transparency and regimen semantics:
  - header now states adult intermittent-infusion scope and exclusions
  - workflow selector now distinguishes adult prior-only initial maintenance workflow vs adult intermittent steady-state existing-regimen workflow
  - regimen form now states infusion duration should remain materially shorter than the interval
  - level-entry guidance now states to use current-interval levels and avoid during-/immediately-post-infusion samples
  - error handling now surfaces field-level validation errors in the result panel
- Updated dose recommendation card labeling so initial-regimen results display as a maintenance recommendation and point users to loading-dose guidance in the interpretation/clinical note.

## Validation added or exercised
- `website/src/lib/pk/__tests__/initialRegimen.integration.test.ts`
  - bounded loading-dose guidance presence and cap behavior
- `website/src/lib/pk/__tests__/existingRegimen.integration.test.ts`
  - infusion-timing rejection
  - near-continuous infusion rejection
  - conservative recommendation behavior for weak/high-uncertainty sparse fits

## Validation results
- Existing-regimen integration tests: passed
- Initial-regimen integration tests: passed
- Production build (`npm run build`): passed

## Remaining follow-ons
- Add dedicated UI treatment for field-level validation errors near the affected inputs instead of only in the result/error panel.
- Consider a dedicated non-steady-state / held-dose / delayed-sample workflow rather than hard rejection alone.
- Consider a more structured “population scope / not for” result banner instead of relying on header and assumptions text only.
