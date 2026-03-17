Task: Correct the regimen recommendation engine so it proposes clinically sensible regimens

Assigned role:
- agents/architect
- agents/docs
- agents/verifier
- agents/coder

Inputs:
- website/src/lib/pk/recommend/buildAdjustmentRecommendation.ts
- website/src/lib/pk/existing/existingRegimenEngine.ts
- website/src/lib/pk/posterior/posteriorEngine.ts
- reports/calculator/VANCOMYZER_RECOMMENDATION_AND_EXPLANATION_ENGINE_BLUEPRINT.md
- website/src/types/calculator.ts

Objectives:
- replace naive proportional dose scaling with candidate-regimen evaluation
- enforce practical regimen boundaries
- prevent recommendations that exceed sensible daily dose limits
- preserve API contract and explanation architecture
- keep recommendation logic transparent and bounded

Expected output:
- recommendation engine correction note
- implementation prompt for candidate-regimen logic
- guardrails for clinically sensible regimen selection
