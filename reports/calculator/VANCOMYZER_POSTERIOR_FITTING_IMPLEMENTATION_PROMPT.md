# Vancomyzer Posterior Fitting Implementation Prompt

Implement the first-pass posterior fitting layer for Vancomyzer existing-regimen evaluation.

This implementation is only for:
- mode = existing_regimen
- patients already receiving vancomycin
- current regimen known
- one or more measured vancomycin levels available

## Required inputs
- reports/calculator/VANCOMYZER_POSTERIOR_ESTIMATION_ENGINE_ARCHITECTURE.md
- reports/calculator/VANCOMYZER_RECOMMENDATION_AND_EXPLANATION_ENGINE_BLUEPRINT.md
- reports/calculator/VANCOMYZER_CALCULATOR_API_CONTRACT.md
- website/src/lib/pk/existing/existingRegimenEngine.ts
- website/src/app/api/calculate/route.ts
- website/src/types/calculator.ts

## Goal
Introduce a bounded first-pass posterior parameter-updating path that:
- starts from population prior parameters
- uses measured level observations to update PK parameters
- produces updated AUC24, peak, trough, and curve outputs
- preserves assumptions, limitations, interpretation, and documentation preview behavior

## Implementation scope
Implement only the existing_regimen posterior update path.

Do not implement:
- full commercial-grade Bayesian engine behavior
- advanced population model selection
- multi-population priors
- hidden confidence scoring systems
- redesign of UI or API contract

## Recommended module targets
Create or update modules under a structure like:

website/src/lib/pk/
  posterior/
    buildPriorParameters.ts
    normalizeObservations.ts
    fitPosteriorParameters.ts
    posteriorEngine.ts
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

### 1. Build prior parameters
Derive initial CL/V/Ke guesses from the current first-pass population logic.

### 2. Normalize observed levels
Normalize:
- level concentration
- collection time
- time_since_last_dose_hours
- regimen timing context

### 3. Fit posterior parameters
Implement a bounded first-pass fitting/update method that adjusts PK parameters from observed data.

This pass should:
- support one measured level
- remain transparent and explainable
- avoid claiming high-certainty posterior precision from sparse data

### 4. Recompute exposure outputs from posterior parameters
Use the fitted parameters to produce:
- posterior AUC24
- posterior peak
- posterior trough
- posterior concentration-time curve

### 5. Preserve explanation outputs
Always generate:
- interpretation_summary
- assumptions
- limitations
- quick_summary
- clinical_note

These should explicitly distinguish:
- first-pass population estimate
from
- posterior-updated estimate

### 6. Integrate into /api/calculate
When mode = existing_regimen:
- call the posterior-aware existing regimen path
- return a contract-compliant response
- include recommendation_type = existing_regimen

When mode = initial_regimen:
- keep current initial regimen behavior unchanged

## Guardrails
- do not turn the route handler into the fitting engine
- do not hide assumptions
- do not hide limitations
- do not emit hype, superiority, ROI, or outcome-improvement claims
- do not invent a different API contract
- keep language clinician-readable and evidence-aware
- do not overstate certainty from one sparse level

## Success criteria
The implementation is successful if:
- existing_regimen requests can update PK outputs from measured levels
- posterior outputs remain contract-compliant
- assumptions and limitations remain explicit
- recommendation and documentation outputs still derive from the same output object
- the implementation remains modular and non-monolithic
