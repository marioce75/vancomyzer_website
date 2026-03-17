Task: Create the first-pass Vancomyzer initial regimen calculation implementation prompt

Assigned role:
- agents/architect
- agents/docs
- agents/verifier
- agents/coder

Inputs:
- reports/calculator/VANCOMYZER_PK_ENGINE_MODULE_ARCHITECTURE.md
- reports/calculator/VANCOMYZER_INITIAL_REGIMEN_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_RECOMMENDATION_AND_EXPLANATION_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_CALCULATOR_API_CONTRACT.md
- website/src/app/api/calculate/route.ts
- website/src/types/calculator.ts

Objectives:
- convert the initial regimen engine blueprint into a direct implementation prompt
- define the first calculation pass for new-patient recommendations
- preserve assumptions, limitations, and bounded recommendation language
- keep the first implementation transparent and clinically readable
- avoid pretending the initial engine is a posterior Bayesian model

Expected output:
- initial regimen calculation implementation prompt
- implementation constraints
- module targets
- guardrails
