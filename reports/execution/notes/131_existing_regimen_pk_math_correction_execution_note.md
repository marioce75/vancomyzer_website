# Task Execution Note

## Task metadata
- Task file: 131_existing_regimen_pk_math_correction.md
- Task title: Correct the existing-regimen PK math so AUC24, peak, trough, and curve come from one internally consistent model
- Assigned role(s): agents/architect, agents/docs, agents/verifier, agents/coder
- Execution date: 2026-03-15
- Status: review_ready

## Inputs reviewed
- website/src/lib/pk/existing/existingRegimenEngine.ts
- reports/calculator/VANCOMYZER_EXISTING_REGIMEN_ADJUSTMENT_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_RECOMMENDATION_AND_EXPLANATION_ENGINE_BLUEPRINT.md
- website/src/app/api/calculate/route.ts
- website/src/types/calculator.ts

## Summary of work performed
- Began a focused correction pass after identifying that the current existing-regimen engine returns AUC24 values that do not align with the reported peak, trough, and curve outputs.
- Reviewed the current first-pass one-compartment implementation and preserved the decision to avoid Bayesian fitting in this pass.
- Focused on requiring one internally consistent intermittent-infusion model for all exposure outputs.

## Key decisions
- Defined a focused correction package after identifying that AUC24, peak, trough, and curve outputs were not internally coherent in the existing-regimen engine.
- Required a single internally consistent one-compartment intermittent-infusion model.
- Preserved the API contract, workflow structure, and non-Bayesian framing.
- Created a direct correction prompt for implementation.

## Output produced
- reports/calculator/VANCOMYZER_EXISTING_REGIMEN_PK_MATH_CORRECTION_NOTE.md

## Risks / blockers
- none yet

## Recommended next step
- finalize the PK math correction package and mark task review_ready

## Review notes
- keep the API contract unchanged
- keep recommendation and explanation layers intact unless math correction forces minimal wording updates
- do not add Bayesian language
- require one shared parameter set for AUC24, peak, trough, and curve

## Status recommendation
- review_ready
