Task: Create the first-pass Vancomyzer posterior fitting implementation prompt

Assigned role:
- agents/architect
- agents/docs
- agents/verifier
- agents/coder

Inputs:
- reports/calculator/VANCOMYZER_POSTERIOR_ESTIMATION_ENGINE_ARCHITECTURE.md
- reports/calculator/VANCOMYZER_RECOMMENDATION_AND_EXPLANATION_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_CALCULATOR_API_CONTRACT.md
- website/src/lib/pk/existing/existingRegimenEngine.ts
- website/src/app/api/calculate/route.ts
- website/src/types/calculator.ts

Objectives:
- convert the posterior estimation architecture into a direct implementation prompt
- define the first bounded posterior parameter-updating pass from measured levels
- preserve assumptions, limitations, and bounded recommendation language
- keep the first implementation transparent and clinically readable
- avoid overclaiming certainty from sparse level data

Expected output:
- posterior fitting implementation prompt
- implementation constraints
- module targets
- guardrails
