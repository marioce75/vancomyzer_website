# Vancomyzer Calculator Dual-Workflow Correction

## Purpose
Correct the calculator design so it matches real clinical use instead of forcing all users into a single existing-regimen workflow.

## Correct workflow model

The calculator must support two explicit modes:

### Mode 1 — Initial regimen recommendation
Use when:
- patient is new to vancomycin
- no current regimen exists yet
- no levels exist yet
- clinician wants a starting recommendation

Required inputs:
- age
- sex
- height
- weight
- serum creatinine

Optional later inputs:
- indication
- target strategy
- obesity flag
- renal instability flag

Outputs:
- recommended starting dose
- recommended interval
- rationale summary
- assumptions
- limitations
- estimated exposure summary if available

Validation rule:
- do not require an existing regimen
- do not require levels

### Mode 2 — Existing regimen evaluation / adjustment
Use when:
- patient is already receiving vancomycin
- clinician wants evaluation or adjustment
- one or more levels may be available

Required inputs:
- age
- sex
- height
- weight
- serum creatinine
- current regimen
- level entry as appropriate

Outputs:
- AUC24
- peak
- trough
- recommended dose adjustment
- recommended interval adjustment
- interpretation summary
- assumptions
- limitations
- graph
- documentation preview

Validation rule:
- current regimen is required
- levels are required when performing level-based adjustment

## UI correction requirements

The calculator page must begin with a workflow selector:
- Initial regimen
- Existing regimen / adjustment

The page should conditionally show fields based on the selected mode.

### Initial regimen mode UI
Show:
- patient characteristics
- calculation controls
- initial recommendation results

Hide or disable:
- current regimen section
- level entry section
- level-based graph expectations if not applicable

### Existing regimen mode UI
Show:
- patient characteristics
- current regimen
- level entry
- calculation controls
- full results stack

## API contract correction

The request must include:
- mode

Allowed values:
- initial_regimen
- existing_regimen

### Corrected request shape
{
  "mode": "initial_regimen",
  "patient": { ... },
  "regimen": null,
  "levels": []
}

or

{
  "mode": "existing_regimen",
  "patient": { ... },
  "regimen": { ... },
  "levels": [ ... ]
}

### Validation logic
- validation must be conditional on mode
- do not apply existing-regimen requirements to initial-regimen mode
- do not allow mode ambiguity

## Response correction

The response should indicate which workflow produced it.

Example:
{
  "mode": "initial_regimen",
  "recommendation_type": "initial",
  ...
}

or
{
  "mode": "existing_regimen",
  "recommendation_type": "adjustment",
  ...
}

## Trust requirements
- initial recommendations must clearly state assumptions
- existing-regimen outputs must clearly state limitations
- neither mode should imply certainty beyond the available data
- clinician judgment remains explicit in both modes

## Success criteria
The correction is successful if:
- a new patient can receive an initial regimen recommendation without entering an existing regimen
- an existing patient can still undergo regimen evaluation and adjustment
- validation matches the selected workflow
- the calculator no longer forces the wrong clinical path
