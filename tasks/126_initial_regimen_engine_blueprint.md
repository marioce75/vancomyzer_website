Task: Create the Vancomyzer initial regimen engine blueprint

Assigned role:
- agents/architect
- agents/docs
- agents/verifier
- agents/coder

Inputs:
- reports/calculator/VANCOMYZER_PK_ENGINE_MODULE_ARCHITECTURE.md
- reports/calculator/VANCOMYZER_CALCULATOR_DUAL_WORKFLOW_CORRECTION.md
- reports/calculator/VANCOMYZER_CALCULATOR_API_CONTRACT.md
- website/src/types/calculator.ts
- website/src/app/api/calculate/route.ts

Objectives:
- define the first real calculation layer for initial regimen recommendation
- define required inputs, internal steps, and outputs
- define what the first-pass initial engine should and should not attempt
- preserve trust, assumptions, limitations, and clinician-readable recommendation outputs

Expected output:
- initial regimen engine blueprint
- calculation stages
- output requirements
- implementation guardrails
