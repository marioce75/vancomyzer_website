# Vancomyzer Initial Regimen Calculation Implementation Prompt

Implement the first-pass initial regimen calculation layer for Vancomyzer.

This implementation is only for:
- mode = initial_regimen
- new patients
- no existing regimen required
- no measured vancomycin levels required

## Required inputs
- reports/calculator/VANCOMYZER_PK_ENGINE_MODULE_ARCHITECTURE.md
- reports/calculator/VANCOMYZER_INITIAL_REGIMEN_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_RECOMMENDATION_AND_EXPLANATION_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_CALCULATOR_API_CONTRACT.md
- website/src/app/api/calculate/route.ts
- website/src/types/calculator.ts

## Goal
Replace the placeholder initial-regimen response path with a real first-pass calculation path that produces:
- recommended_dose
- recommended_interval_hours
- interpretation_summary
- assumptions
- limitations
- documentation_preview

Optional first-pass estimated outputs:
- auc24 estimate
- peak estimate
- trough estimate

If returned, they must be clearly framed as first-pass estimates.

## Implementation scope
Implement only the initial_regimen path.

Do not implement:
- posterior Bayesian updating
- full existing_regimen calculation logic
- multi-model selection logic beyond a simple explicit first-pass path
- advanced special-population logic
- hidden confidence scoring systems

## Recommended module targets
Create or update modules under a structure like:

website/src/lib/pk/
  types.ts
  workflowRouter.ts
  normalize/
    normalizePatient.ts
  validate/
    validateInitialRegimenRequest.ts
  initial/
    initialRegimenEngine.ts
  recommend/
    buildInitialRecommendation.ts
  explain/
    buildInterpretationSummary.ts
    buildAssumptions.ts
    buildLimitations.ts
    buildDocumentationPreview.ts
  response/
    buildCalculateResponse.ts

You may adapt the exact file layout to the repo, but keep responsibilities separated.

## Required behavior

### 1. Normalize patient input
Normalize:
- age
- sex
- height_cm
- weight_kg
- serum_creatinine_mg_dl

### 2. Validate initial-regimen input
Reject clearly invalid input.
Keep validation explicit and readable.

### 3. Compute a first-pass regimen recommendation
Produce a transparent initial recommendation using a bounded first-pass logic path.

This first pass should:
- use patient covariates
- produce a recommended dose
- produce a recommended interval
- avoid claiming posterior precision

### 4. Generate explanation outputs
Always generate:
- interpretation_summary
- assumptions
- limitations
- quick_summary
- clinical_note

### 5. Integrate into /api/calculate
When mode = initial_regimen:
- call the initial regimen engine
- return a contract-compliant response
- include recommendation_type = initial_regimen

When mode = existing_regimen:
- keep current placeholder behavior unless already separated safely

## Guardrails
- do not frame the initial engine as a posterior Bayesian update
- do not hide assumptions
- do not hide limitations
- do not emit hype, superiority, ROI, or outcome-improvement claims
- do not invent a different API contract
- keep language clinician-readable and evidence-aware

## Success criteria
The implementation is successful if:
- initial_regimen requests return a real first-pass recommendation
- no existing regimen is required in that mode
- assumptions and limitations remain explicit
- documentation preview is generated from the same output object
- /api/calculate remains contract-compliant
