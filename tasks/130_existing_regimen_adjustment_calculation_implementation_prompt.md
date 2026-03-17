Task: Create the first-pass Vancomyzer existing regimen adjustment calculation implementation prompt

Assigned role:
- agents/architect
- agents/docs
- agents/verifier
- agents/coder

Inputs:
- reports/calculator/VANCOMYZER_PK_ENGINE_MODULE_ARCHITECTURE.md
- reports/calculator/VANCOMYZER_EXISTING_REGIMEN_ADJUSTMENT_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_RECOMMENDATION_AND_EXPLANATION_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_CALCULATOR_API_CONTRACT.md
- website/src/app/api/calculate/route.ts
- website/src/types/calculator.ts

Objectives:
- convert the existing regimen adjustment engine blueprint into a direct implementation prompt
- define the first bounded calculation pass for patients already receiving vancomycin
- preserve assumptions, limitations, and bounded recommendation language
- keep the first implementation transparent and clinically readable
- avoid pretending the first adjustment pass is a robust posterior Bayesian model

Expected output:
- existing regimen adjustment calculation implementation prompt
- implementation constraints
- module targets
- guardrails
