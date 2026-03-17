Task: Create the Vancomyzer existing regimen adjustment engine blueprint

Assigned role:
- agents/architect
- agents/docs
- agents/verifier
- agents/coder

Inputs:
- reports/calculator/VANCOMYZER_PK_ENGINE_MODULE_ARCHITECTURE.md
- reports/calculator/VANCOMYZER_CALCULATOR_DUAL_WORKFLOW_CORRECTION.md
- reports/calculator/VANCOMYZER_CALCULATOR_API_CONTRACT.md
- reports/calculator/VANCOMYZER_INITIAL_REGIMEN_ENGINE_BLUEPRINT.md
- website/src/types/calculator.ts
- website/src/app/api/calculate/route.ts

Objectives:
- define the first-pass existing regimen adjustment engine
- define required inputs, internal stages, and outputs
- define how current regimen and measured levels are interpreted
- preserve assumptions, limitations, and clinician-readable adjustment outputs
- keep the first adjustment engine bounded and transparent

Expected output:
- existing regimen adjustment engine blueprint
- calculation stages
- output requirements
- implementation guardrails
