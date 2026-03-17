Task: Create the Vancomyzer PK engine module architecture

Assigned role:
- agents/architect
- agents/docs
- agents/verifier
- agents/coder

Inputs:
- reports/calculator/VANCOMYZER_CALCULATOR_ARCHITECTURE.md
- reports/calculator/VANCOMYZER_CALCULATOR_API_CONTRACT.md
- reports/calculator/VANCOMYZER_CALCULATOR_DUAL_WORKFLOW_CORRECTION.md
- website/src/app/api/calculate/route.ts
- website/src/types/calculator.ts

Objectives:
- define the internal PK engine module structure
- separate initial-regimen logic from existing-regimen logic
- define model-selection, validation, recommendation, and explanation layers
- define how the API route should call the PK engine
- prevent a monolithic calculator backend

Expected output:
- PK engine module architecture
- module responsibilities
- data-flow diagram
- implementation guardrails
