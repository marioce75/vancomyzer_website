Task: Create the Vancomyzer recommendation and explanation engine blueprint

Assigned role:
- agents/architect
- agents/docs
- agents/verifier
- agents/coder
- agents/customer-conversion

Inputs:
- reports/calculator/VANCOMYZER_PK_ENGINE_MODULE_ARCHITECTURE.md
- reports/calculator/VANCOMYZER_INITIAL_REGIMEN_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_EXISTING_REGIMEN_ADJUSTMENT_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_CALCULATOR_API_CONTRACT.md
- reports/trust-evidence/VANCOMYZER_VALIDATION_AND_CLAIMS_GUARDRAILS.md

Objectives:
- define how Vancomyzer converts raw PK outputs into clinician-readable recommendations
- define how interpretation_summary, assumptions, limitations, and documentation_preview are generated
- keep recommendation logic separate from raw calculation logic
- preserve trust, transparency, and bounded language
- avoid black-box recommendation behavior

Expected output:
- recommendation and explanation engine blueprint
- output-generation stages
- documentation preview generation rules
- implementation guardrails
