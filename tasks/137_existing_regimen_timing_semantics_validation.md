Task: Implement explicit timing-semantics validation for existing-regimen steady-state calculations

Assigned roles:
- agents/pk-engine
- agents/backend
- agents/testing
- agents/verifier
- agents/docs

Inputs:
- website/src/lib/pk/validate/validateExistingRegimenRequest.ts
- website/src/lib/pk/normalize/normalizeLevels.ts
- website/src/lib/pk/runExistingRegimenPipeline.ts
- website/src/lib/pk/posterior/normalizeObservations.ts
- website/src/types/calculator.ts
- website/src/lib/pk/__tests__/existingRegimen.integration.test.ts
- tasks/136_existing_regimen_full_coherence_rebuild.md
- reports/calculator/VANCOMYZER_PK_ENGINE_MODULE_ARCHITECTURE.md
- reports/calculator/VANCOMYZER_POSTERIOR_ESTIMATION_ENGINE_ARCHITECTURE.md

Objectives:
- use collection_time and time_since_last_dose_hours together when validating existing-regimen level timing
- reject internally inconsistent level timing inputs
- reject likely non-steady-state repeating-regimen cases instead of silently treating them as valid steady-state data
- prevent invalid timing cases from producing normal steady-state AUC24, peak, trough, and curve outputs
- preserve API shape and calculator UI shape
- add deterministic timing-validation and integration tests

Required artifact destinations:
- implementation note: reports/calculator/VANCOMYZER_EXISTING_REGIMEN_TIMING_SEMANTICS_NOTE.md
- safety review: reviews/VANCOMYZER_EXISTING_REGIMEN_TIMING_SEMANTICS_REVIEW.md
- code targets:
  - website/src/lib/pk/validate/validateExistingRegimenRequest.ts
  - website/src/lib/pk/normalize/normalizeLevels.ts
  - website/src/lib/pk/runExistingRegimenPipeline.ts
  - website/src/lib/pk/posterior/normalizeObservations.ts
  - website/src/types/calculator.ts
  - website/src/lib/pk/__tests__/existingRegimen.integration.test.ts

Acceptance criteria:
- valid single-level steady-state cases continue to pass
- contradictory collection_time versus time_since_last_dose_hours is rejected or explicitly bounded
- chronologically inconsistent multi-level cases are rejected or explicitly bounded
- likely missed-dose or held-dose timing patterns do not receive a normal steady-state exposure interpretation
- website build passes after changes
- existing-regimen integration tests pass after changes
- verifier review explicitly documents whether the bounded behavior is clinically safer than the prior behavior
