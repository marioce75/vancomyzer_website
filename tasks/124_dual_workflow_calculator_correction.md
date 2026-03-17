Task: Redesign the Vancomyzer calculator around dual clinical workflows

Assigned role:
- agents/architect
- agents/docs
- agents/verifier
- agents/coder
- agents/customer-conversion

Inputs:
- reports/calculator/VANCOMYZER_CALCULATOR_ARCHITECTURE.md
- reports/calculator/VANCOMYZER_CALCULATOR_UI_BLUEPRINT.md
- reports/calculator/VANCOMYZER_CALCULATOR_API_CONTRACT.md
- website/src/app/calculator/page.tsx
- website/src/app/api/calculate/route.ts

Objectives:
- replace the single-regimen-required workflow with dual calculator modes
- support initial regimen recommendation for new patients
- support existing regimen evaluation/adjustment for current therapy
- define mode-specific required fields
- define mode-specific response expectations
- prevent another calculator redesign loop

Expected output:
- dual-workflow calculator architecture correction
- corrected API contract
- corrected UI requirements
- implementation prompt for the correction pass
