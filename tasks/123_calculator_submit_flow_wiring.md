Task: Wire the Vancomyzer calculator submit flow to /api/calculate

Assigned role:
- agents/architect
- agents/docs
- agents/verifier
- agents/coder

Inputs:
- website/src/app/calculator/page.tsx
- website/src/app/api/calculate/route.ts
- website/src/types/calculator.ts
- reports/calculator/VANCOMYZER_CALCULATOR_IMPLEMENTATION_PROMPT.md
- reports/trust-evidence/VANCOMYZER_VALIDATION_AND_CLAIMS_GUARDRAILS.md

Objectives:
- connect the calculator page Calculate action to POST /api/calculate
- send contract-compliant request payloads
- display loading state during submission
- display validation/calculation error state on failure
- populate result components from the response payload on success

Expected output:
- wired calculator submit flow
- request payload assembly
- loading/error/result state behavior
- no PK engine integration yet
