Task: Rebuild the existing-regimen engine for full internal coherence in one pass

Assigned roles:
- agents/architect
- agents/pk-engine
- agents/backend
- agents/testing
- agents/verifier
- agents/docs

Inputs:
- website/src/lib/pk/existing/existingRegimenEngine.ts
- website/src/lib/pk/posterior/
- website/src/lib/pk/recommend/
- website/src/lib/pk/explain/
- website/src/app/api/calculate/route.ts
- website/src/types/calculator.ts

Objectives:
- rebuild the existing_regimen path from one internally consistent model
- enforce timing semantics explicitly
- make posterior-updated metrics, curve, and recommendation coherent
- reject or flag invalid steady-state timing cases
- keep API shape unchanged
- keep UI unchanged

Required artifact destinations:
- implementation note: reports/calculator/VANCOMYZER_EXISTING_REGIMEN_FULL_COHERENCE_REBUILD_NOTE.md
- safety review: reviews/VANCOMYZER_EXISTING_REGIMEN_FULL_COHERENCE_REVIEW.md
- code targets:
  - website/src/lib/pk/existing/existingRegimenEngine.ts
  - website/src/lib/pk/posterior/
  - website/src/lib/pk/recommend/
  - website/src/lib/pk/explain/
  - website/src/app/api/calculate/route.ts
  - website/src/types/calculator.ts
  - website/src/lib/pk/__tests__/existingRegimen.integration.test.ts

Expected output:
- coherent existing-regimen engine
- explicit timing validation
- validation test cases
- bounded recommendation logic
