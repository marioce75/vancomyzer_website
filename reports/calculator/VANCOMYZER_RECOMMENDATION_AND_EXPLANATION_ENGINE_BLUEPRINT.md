# Vancomyzer Recommendation and Explanation Engine Blueprint

## Purpose
Define how Vancomyzer converts raw PK or rule-based engine outputs into clinician-readable recommendation, interpretation, assumption, limitation, and documentation outputs.

## Core design principle
Separate:
- raw PK or rule-based calculations
from
- recommendation wording
- interpretation wording
- assumptions generation
- limitations generation
- documentation preview generation

This prevents the product from becoming a black-box calculator that emits unexplained output.

## Engine responsibilities

The recommendation and explanation layer should produce:
- recommended_dose
- recommended_interval_hours
- interpretation_summary
- assumptions
- limitations
- documentation_preview.quick_summary
- documentation_preview.clinical_note

It should work for both workflows:
- initial_regimen
- existing_regimen

## Input expectations
This engine receives structured upstream output, not raw UI fields.

Expected upstream inputs may include:
- workflow mode
- patient-normalized data
- regimen-normalized data if present
- level sufficiency signal
- estimated AUC24
- estimated peak
- estimated trough
- data quality signal
- model selection signal later
- recommendation candidate values
- caution flags

## Output-generation stages

### 1. Recommendation framing
Purpose:
- convert calculation output into clinician-readable recommendation wording

Examples:
- starting regimen recommendation for new patient
- adjustment recommendation for existing regimen

Guardrails:
- wording should reflect the workflow mode
- recommendation wording must remain bounded
- do not imply unjustified certainty

### 2. Interpretation summary generation
Purpose:
- explain the output in short clinician-readable language

Examples:
- why the current regimen appears above or below target
- why the initial regimen is being recommended
- what major covariates or data features influenced the result

Guardrails:
- keep summary concise
- keep language evidence-aware
- avoid marketing-style phrasing

### 3. Assumptions generation
Purpose:
- make important assumptions explicit

Examples:
- initial recommendation based on first-pass patient covariates
- no measured vancomycin levels available
- measured level timing assumed to be accurate
- renal function estimate used in first-pass logic

Guardrails:
- assumptions must be visible, not hidden
- assumptions should reflect the actual workflow mode and data

### 4. Limitations generation
Purpose:
- show where confidence is reduced or caution is required

Examples:
- no posterior update performed
- sparse levels limit precision
- timing uncertainty reduces confidence
- recommendation based on placeholder or first-pass model logic
- clinician judgment remains required

Guardrails:
- limitations must remain first-class outputs
- do not bury limitations in long text

### 5. Documentation preview generation
Purpose:
- turn outputs into immediately useful clinical communication text

#### Quick summary preview
Should be:
- short
- clinician-readable
- suitable for compact workflow display

#### Clinical note preview
Should be:
- more complete
- include rationale, assumptions, and limitations
- suitable for pharmacist documentation draft style

Guardrails:
- documentation text must not overstate certainty
- documentation must reflect workflow mode
- documentation must align with the same recommendation and limitation logic shown elsewhere

## Workflow-specific behavior

### Initial regimen
Recommendation layer should:
- frame output as an initial regimen suggestion
- explicitly note absence of measured levels
- avoid posterior-style certainty language

### Existing regimen
Recommendation layer should:
- frame output as evaluation/adjustment of the current regimen
- distinguish current regimen from recommended regimen
- surface data sufficiency and timing-quality issues clearly

## Suggested internal modules

recommend/
  buildInitialRecommendation.ts
  buildAdjustmentRecommendation.ts

explain/
  buildInterpretationSummary.ts
  buildAssumptions.ts
  buildLimitations.ts
  buildDocumentationPreview.ts

## Recommendation guardrails
- do not emit unsupported superiority claims
- do not emit ROI claims
- do not emit outcome-improvement claims
- do not describe weak first-pass estimates as robust posterior truth
- do not hide uncertainty

## Language rules
- clinician-readable
- concise
- evidence-aware
- bounded
- workflow-specific

Avoid:
- hype
- sales wording
- vague confidence language
- black-box phrasing

## Success criteria
The recommendation and explanation engine blueprint is successful if:
- recommendation generation is separated from raw calculation logic
- assumptions and limitations remain first-class outputs
- documentation preview generation is explicit
- both workflows produce appropriate clinician-readable outputs
- implementation can proceed without turning the calculator into an opaque recommendation engine
