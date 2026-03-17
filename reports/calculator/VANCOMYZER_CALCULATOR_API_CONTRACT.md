# Vancomyzer Calculator API Contract Blueprint

## Purpose
Define the API contract for the Vancomyzer calculator so frontend and backend implementation can proceed against a stable interface.

## Primary endpoint
POST /api/calculate

## Endpoint objective
Accept normalized patient, regimen, and vancomycin level inputs and return:
- PK/Bayesian result metrics
- recommendation data
- interpretation summary
- assumptions
- limitations
- graph-ready curve data
- documentation-ready preview data

## Request contract

### Required top-level keys
- patient
- regimen
- levels

### Request shape
{
  "patient": {
    "age": 0,
    "sex": "male",
    "height_cm": 0,
    "weight_kg": 0,
    "serum_creatinine_mg_dl": 0
  },
  "regimen": {
    "dose_mg": 0,
    "interval_hours": 0,
    "infusion_duration_hours": 0
  },
  "levels": [
    {
      "value_mcg_ml": 0,
      "collection_time": "2026-03-14T12:00:00Z",
      "time_since_last_dose_hours": 0
    }
  ]
}

## Request field notes

### patient
- age: required, numeric
- sex: required, normalized string
- height_cm: required for first-pass contract
- weight_kg: required
- serum_creatinine_mg_dl: required

### regimen
- dose_mg: required
- interval_hours: required
- infusion_duration_hours: required

### levels
- at least one level required for first pass
- support array shape from day one
- collection_time should be ISO-8601
- time_since_last_dose_hours should be explicit even if backend later derives it

## Request validation rules
Reject or flag:
- missing required fields
- non-numeric dose/weight/SCr values
- non-positive interval or dose
- negative time-since-dose values
- empty levels array
- malformed timestamps

## Successful response contract

### Response shape
{
  "auc24": 0,
  "peak": 0,
  "trough": 0,
  "recommended_dose": "string",
  "recommended_interval_hours": 0,
  "interpretation_summary": "string",
  "assumptions": [
    "string"
  ],
  "limitations": [
    "string"
  ],
  "curve": [
    {
      "time_hours": 0,
      "concentration": 0
    }
  ],
  "measured_levels": [
    {
      "time_hours": 0,
      "concentration": 0
    }
  ],
  "documentation_preview": {
    "quick_summary": "string",
    "clinical_note": "string"
  }
}

## Response field notes

### Primary metrics
- auc24
- peak
- trough

These should be numeric and directly renderable in the UI.

### Recommendation
- recommended_dose: clinician-readable text
- recommended_interval_hours: numeric if applicable

### Interpretation
- interpretation_summary should explain the result briefly in clinician-readable language
- assumptions must be explicit when relevant
- limitations must be explicit when relevant

### Graph data
- curve should be graph-ready without additional reshaping
- measured_levels should be graph-ready markers

### Documentation preview
- quick_summary should support the compact preview block
- clinical_note should support the richer documentation preview block

## Error response contract

### Validation error shape
{
  "error_type": "validation_error",
  "message": "string",
  "field_errors": {
    "patient.weight_kg": "string",
    "levels[0].collection_time": "string"
  }
}

### Calculation error shape
{
  "error_type": "calculation_error",
  "message": "string",
  "details": [
    "string"
  ]
}

### Unsupported or uncertain-result shape
{
  "error_type": "insufficient_data",
  "message": "string",
  "limitations": [
    "string"
  ]
}

## Trust and guardrail requirements
- API responses must preserve assumptions and limitations
- API should not imply certainty when data are sparse
- API should support interpretation, not black-box output
- recommendation text must remain evidence-aware
- do not expose hype or unsupported superiority language in API-generated text

## Frontend integration expectations
The frontend should be able to:
- render all primary metrics directly
- show recommendation text directly
- show assumptions and limitations without extra inference
- render the graph directly from returned curve/measured_levels arrays
- display quick summary and clinical note previews directly

## Versioning guidance
For first pass:
- keep one stable contract
- avoid premature version sprawl

Future option:
- /api/calculate/v2 only if the response shape must materially change

## Success criteria
The API contract blueprint is successful if:
- frontend and backend can implement independently against it
- validation expectations are explicit
- response data is UI-ready
- trust, interpretation, and limitations remain first-class
- future implementation can proceed without reopening payload shape debates
