Task: Correct the existing-regimen PK math so AUC24, peak, trough, and curve come from one internally consistent model

Assigned role:
- agents/architect
- agents/docs
- agents/verifier
- agents/coder

Inputs:
- website/src/lib/pk/existing/existingRegimenEngine.ts
- reports/calculator/VANCOMYZER_EXISTING_REGIMEN_ADJUSTMENT_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_RECOMMENDATION_AND_EXPLANATION_ENGINE_BLUEPRINT.md
- website/src/app/api/calculate/route.ts
- website/src/types/calculator.ts

Objectives:
- identify the inconsistency between AUC24 and peak/trough/curve calculations
- require a single internally consistent one-compartment intermittent-infusion model
- make AUC24, peak, trough, and curve derive from the same parameter set
- preserve the current workflow, API contract, recommendation layer, and explanation layer
- avoid introducing Bayesian language or logic

Expected output:
- PK math correction note
- implementation prompt for the correction pass
- guardrails for the corrected one-compartment model
