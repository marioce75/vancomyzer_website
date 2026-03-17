Task: Render the Vancomyzer concentration-time curve in the calculator UI

Assigned role:
- agents/architect
- agents/docs
- agents/verifier
- agents/coder

Inputs:
- website/src/components/calculator/ConcentrationTimeGraph.tsx
- website/src/app/calculator/page.tsx
- website/src/types/calculator.ts
- reports/calculator/VANCOMYZER_EXISTING_REGIMEN_PK_MATH_CORRECTION_NOTE.md
- reports/trust-evidence/VANCOMYZER_VALIDATION_AND_CLAIMS_GUARDRAILS.md

Objectives:
- render the returned curve and measured_levels arrays in the calculator UI
- use the existing API response shape without changing the contract
- keep graph behavior clinician-readable and simple
- preserve trust language and avoid visual clutter

Expected output:
- working concentration-time graph
- measured level markers
- bounded first-pass graph behavior
- no redesign of the calculator page
