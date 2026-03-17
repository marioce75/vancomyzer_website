Task: Create the Vancomyzer calculator API route skeleton

Assigned role:
- agents/architect
- agents/docs
- agents/verifier
- agents/coder

Inputs:
- reports/calculator/VANCOMYZER_CALCULATOR_API_CONTRACT.md
- reports/calculator/VANCOMYZER_CALCULATOR_IMPLEMENTATION_PROMPT.md
- website/src/types/calculator.ts
- website/src/app/calculator/page.tsx
- reports/trust-evidence/VANCOMYZER_VALIDATION_AND_CLAIMS_GUARDRAILS.md

Objectives:
- create the first-pass /api/calculate route skeleton
- validate request shape against the locked API contract
- return a contract-compliant placeholder response
- return contract-compliant error responses
- preserve trust, assumptions, and limitations in the response layer

Expected output:
- /api/calculate route skeleton
- validation logic
- placeholder success response
- validation and error response behavior
