Task: Create the Vancomyzer posterior estimation engine architecture

Assigned role:
- agents/architect
- agents/docs
- agents/verifier
- agents/coder

Inputs:
- reports/calculator/VANCOMYZER_PK_ENGINE_MODULE_ARCHITECTURE.md
- reports/calculator/VANCOMYZER_EXISTING_REGIMEN_ADJUSTMENT_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_RECOMMENDATION_AND_EXPLANATION_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_EXISTING_REGIMEN_PK_MATH_CORRECTION_NOTE.md
- website/src/lib/pk/existing/existingRegimenEngine.ts
- website/src/types/calculator.ts

Objectives:
- define the posterior estimation layer that updates PK parameters using one or more measured levels
- define how posterior estimation differs from the current first-pass population model
- define the module boundaries for posterior fitting, recommendation generation, and explanation generation
- preserve assumptions, limitations, and bounded language
- prevent Bayesian logic from being mixed directly into the route layer

Expected output:
- posterior estimation engine architecture
- fitting-layer responsibilities
- data flow from observations to posterior outputs
- implementation guardrails
