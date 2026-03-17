# Vancomyzer Posterior Estimation Engine Architecture

## Purpose
Define the posterior estimation layer that updates PK parameters from measured vancomycin levels so existing-regimen evaluation can move beyond first-pass population estimates.

## Why this layer exists
The current existing-regimen engine is a bounded first-pass model:
- one-compartment
- population-based Ke and V
- no posterior fitting to measured levels

The posterior estimation layer should:
- use one or more observed levels
- update PK parameter estimates
- produce more individualized exposure outputs
- keep assumptions and limitations explicit

## Core design principle
Separate:
1. population prior / initial parameter guess
2. observation normalization
3. posterior fitting or parameter update
4. exposure calculation from posterior parameters
5. recommendation generation
6. explanation generation
7. response assembly

## Posterior workflow inputs
- patient-normalized data
- regimen-normalized data
- one or more measured levels
- level timing context
- infusion duration
- initial parameter guess or population prior

## Posterior workflow outputs
- posterior CL estimate
- posterior V estimate
- posterior Ke estimate
- posterior half-life estimate
- posterior AUC24
- posterior peak
- posterior trough
- posterior concentration-time curve
- recommendation inputs
- assumptions
- limitations

## Recommended module structure

website/src/lib/pk/
  posterior/
    buildPriorParameters.ts
    normalizeObservations.ts
    fitPosteriorParameters.ts
    posteriorEngine.ts
  recommend/
    buildAdjustmentRecommendation.ts
  explain/
    buildInterpretationSummary.ts
    buildAssumptions.ts
    buildLimitations.ts
    buildDocumentationPreview.ts
  response/
    buildCalculateResponse.ts

## Module responsibilities

### buildPriorParameters.ts
- derive initial CL/V/Ke guesses from population logic
- keep prior construction explicit

### normalizeObservations.ts
- turn levels and timing into a stable fitting input structure
- isolate measurement-shape handling from fitting logic

### fitPosteriorParameters.ts
- estimate updated PK parameters from observed data
- keep fitting logic separate from recommendation wording
- support one-level and multi-level fitting paths later

### posteriorEngine.ts
- orchestrate prior + observations + fitting
- compute posterior AUC24, peak, trough, and curve from fitted parameters

## Data flow

1. Existing-regimen request is normalized
2. Population prior parameters are generated
3. Observed levels are normalized
4. Posterior fitting updates PK parameters
5. Exposure outputs are derived from fitted parameters
6. Recommendation layer converts outputs into clinician-readable adjustments
7. Explanation layer generates interpretation, assumptions, limitations, and documentation preview
8. Response builder assembles the final API response

## Guardrails
- do not hide that posterior fitting depends on the quality of level timing
- do not overstate certainty from one sparse level
- do not mix posterior fitting and recommendation wording into one function
- do not collapse posterior outputs back into vague population-only language
- keep Bayesian/posterior behavior explicit and bounded

## Workflow distinctions
The system must clearly distinguish:
- first-pass population estimate
from
- posterior-updated estimate

This distinction should appear in:
- interpretation_summary
- assumptions
- limitations
- documentation preview text

## Success criteria
The posterior estimation engine architecture is successful if:
- the fitting layer is clearly separated from current first-pass logic
- posterior outputs can be generated from measured levels without rewriting the API contract
- explanation and recommendation layers remain first-class
- future implementation can proceed without turning /api/calculate into a monolithic Bayesian handler
