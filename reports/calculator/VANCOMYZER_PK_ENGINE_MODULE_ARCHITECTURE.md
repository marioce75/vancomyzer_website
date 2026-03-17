# Vancomyzer PK Engine Module Architecture

## Purpose
Define the internal backend module structure for Vancomyzer so the calculator can evolve into a clinically useful dosing engine instead of a single monolithic route handler.

## Core design principle
Separate:
1. workflow selection
2. input normalization
3. clinical validation
4. PK calculation
5. recommendation logic
6. explanation generation
7. response assembly

## Workflow split

### Workflow A — Initial regimen recommendation
Use for:
- new patients
- no existing regimen
- no level data required

Responsibilities:
- estimate initial regimen based on patient covariates
- produce recommendation-oriented outputs
- return assumptions and limitations explicitly

### Workflow B — Existing regimen evaluation / adjustment
Use for:
- patients already receiving vancomycin
- current regimen known
- level-based interpretation supported

Responsibilities:
- evaluate existing regimen
- calculate posterior-style outputs later
- produce adjustment-oriented outputs
- return assumptions and limitations explicitly

## Recommended module structure

pk/
  index.ts
  types.ts
  workflowRouter.ts
  normalize/
    normalizePatient.ts
    normalizeRegimen.ts
    normalizeLevels.ts
  validate/
    validateInitialRegimenRequest.ts
    validateExistingRegimenRequest.ts
  models/
    modelSelector.ts
    adultGeneralModel.ts
  initial/
    initialRegimenEngine.ts
  existing/
    existingRegimenEngine.ts
  recommend/
    buildInitialRecommendation.ts
    buildAdjustmentRecommendation.ts
  explain/
    buildInterpretationSummary.ts
    buildAssumptions.ts
    buildLimitations.ts
    buildDocumentationPreview.ts
  response/
    buildCalculateResponse.ts

## Module responsibilities

### workflowRouter.ts
- inspect request mode
- send normalized input to the correct engine path

### normalize/*
- convert raw request payloads into internal structures
- keep API-shape handling separate from PK logic

### validate/*
- enforce mode-specific validation
- protect engines from malformed input

### models/modelSelector.ts
- choose the appropriate PK model family later
- keep model choice explicit and expandable

### initial/initialRegimenEngine.ts
- generate first-pass initial regimen logic
- no requirement for existing regimen or levels

### existing/existingRegimenEngine.ts
- handle current-regimen evaluation path
- later support level-based posterior updates

### recommend/*
- convert PK outputs into clinician-readable recommendation fields
- keep recommendation generation separate from raw calculations

### explain/*
- generate interpretation_summary
- generate assumptions
- generate limitations
- generate documentation_preview

### response/buildCalculateResponse.ts
- assemble the final API response
- keep response shape stable and contract-compliant

## Data flow

1. /api/calculate receives request
2. workflowRouter inspects mode
3. normalize modules normalize inputs
4. validate module checks workflow-specific requirements
5. engine module computes raw PK outputs or placeholder estimates
6. recommendation module derives regimen recommendation
7. explanation module derives interpretation, assumptions, limitations, documentation preview
8. response builder assembles final contract-compliant response

## Why this architecture is stronger
This design allows Vancomyzer to be better than generic calculators because it can:
- support both initial and existing-regimen workflows cleanly
- make model choice explicit later
- separate raw PK math from clinical recommendation language
- preserve explanation and documentation as first-class outputs
- expand without turning /api/calculate into one giant file

## Guardrails
- do not bury assumptions and limitations
- do not mix UI concerns into PK modules
- do not collapse all logic into route.ts
- do not combine raw PK math and recommendation logic into one opaque function
- do not hide workflow mode

## Success criteria
The PK engine module architecture is successful if:
- backend responsibilities are clearly separated
- dual-workflow logic has clear boundaries
- future PK implementation can proceed without reopening structure debates
- response assembly remains stable and contract-compliant
