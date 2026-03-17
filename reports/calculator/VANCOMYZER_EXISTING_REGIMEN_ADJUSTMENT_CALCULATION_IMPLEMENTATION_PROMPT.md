# Vancomyzer Existing Regimen Adjustment Calculation Implementation Prompt

Implement the first-pass existing regimen adjustment calculation layer for Vancomyzer.

This implementation is only for:
- mode = existing_regimen
- patients already receiving vancomycin
- current regimen known
- one or more measured vancomycin levels available

## Required inputs
- reports/calculator/VANCOMYZER_PK_ENGINE_MODULE_ARCHITECTURE.md
- reports/calculator/VANCOMYZER_EXISTING_REGIMEN_ADJUSTMENT_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_RECOMMENDATION_AND_EXPLANATION_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_CALCULATOR_API_CONTRACT.md
- website/src/app/api/calculate/route.ts
- website/src/types/calculator.ts

## Goal
Replace the placeholder existing-regimen response path with a bounded first-pass evaluation path that produces:
- auc24
- peak
- trough
- recommended_dose
- recommended_interval_hours
- interpretation_summary
- assumptions
- limitations
- documentation_preview

## Implementation scope
Implement only the existing_regimen path.

Do not implement:
- full posterior Bayesian updating
- complex multi-model selection
- advanced special-population logic
- hidden confidence scoring systems
- redesign of UI or API contract

## Recommended module targets
Create or update modules under a structure like:

website/src/lib/pk/
  normalize/
    normalizeRegimen.ts
    normalizeLevels.ts
  validate/
    validateExistingRegimenRequest.ts
  existing/
    existingRegimenEngine.ts
  recommend/
    buildAdjustmentRecommendation.ts
  explain/
    buildInterpretationSummary.ts
    buildAssumptions.ts
    buildLimitations.ts
    buildDocumentationPreview.ts
  response/
    buildCalculateResponse.ts

You may adapt the exact file layout to the repo, but keep responsibilities separated.

## Required behavior

### 1. Normalize regimen and level input
Normalize:
- dose_mg
- interval_hours
- infusion_duration_hours
- level value
- collection_time
- time_since_last_dose_hours

### 2. Validate existing-regimen input
Reject clearly invalid or insufficient input.
Keep validation explicit and readable.

### 3. Compute a bounded first-pass evaluation
Produce:
- auc24 estimate or bounded first-pass evaluation metric
- peak estimate if supported
- trough estimate if supported
- regimen-adjustment-oriented outputs

This first pass should:
- use current regimen and level timing context
- produce an interpretable adjustment recommendation
- avoid claiming robust posterior precision

### 4. Generate explanation outputs
Always generate:
- interpretation_summary
- assumptions
- limitations
- quick_summary
- clinical_note

### 5. Integrate into /api/calculate
When mode = existing_regimen:
- call the existing regimen engine
- return a contract-compliant response
- include recommendation_type = existing_regimen

When mode = initial_regimen:
- keep current initial regimen implementation behavior intact

## Guardrails
- do not frame this first pass as a robust posterior Bayesian update
- do not hide assumptions
- do not hide limitations
- do not emit hype, superiority, ROI, or outcome-improvement claims
- do not invent a different API contract
- keep language clinician-readable and evidence-aware
- clearly distinguish current regimen from recommended regimen

## Success criteria
The implementation is successful if:
- existing_regimen requests return a real first-pass evaluation and adjustment recommendation
- regimen and level inputs are required only in that mode
- assumptions and limitations remain explicit
- documentation preview is generated from the same output object
- /api/calculate remains contract-compliant
