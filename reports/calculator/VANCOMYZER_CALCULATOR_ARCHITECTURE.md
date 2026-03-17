# Vancomyzer Calculator Architecture

## Purpose
Define the architecture for the interactive vancomycin dosing calculator as the next major product layer after the Phase 1 informational website.

## Route
/calculator

## Product objective
The calculator should let a clinician:
1. enter key patient and dosing variables
2. enter one or more vancomycin levels with timing context
3. view interpretable PK/Bayesian results
4. review assumptions, limitations, and data sufficiency
5. see a clear dosing recommendation and concentration-time curve
6. access documentation-ready output

## High-level layout

### Left panel — Inputs
Organize inputs into grouped sections:

#### Patient characteristics
- age
- sex
- height
- weight
- serum creatinine
- optional renal function estimate display

#### Current vancomycin regimen
- dose amount
- dosing interval
- infusion duration
- therapy start / recent dose timing context

#### Level entry
- level value
- collection time
- time since last dose
- ability to enter one or more levels

#### Calculation controls
- calculate
- reset

### Right panel — Results
Group outputs into interpretable blocks:

#### Primary outputs
- AUC24
- peak concentration
- trough concentration
- recommended dose / interval adjustment

#### Interpretation block
- summary explanation
- whether the current regimen appears within target
- what assumptions affect interpretation
- caution notes if data are sparse or uncertain

#### Visualization
- concentration-time curve
- measured level markers
- predicted curve line

#### Documentation/export block
- quick summary output
- clinical note style output
- copy/export actions (later implementation layer)

## Core UI components

### Input components
- PatientForm
- RenalFunctionInput
- DoseRegimenInput
- LevelInputTable
- CalculationControls

### Result components
- AUCDisplay
- PeakDisplay
- TroughDisplay
- DoseRecommendationCard
- InterpretationSummary
- LimitationNotice

### Visualization components
- ConcentrationTimeGraph
- LevelMarkerOverlay
- TargetRangeOverlay

### Documentation components
- QuickSummaryPreview
- ClinicalNotePreview
- ExportActions

## Backend integration model

### API endpoint
POST /api/calculate

### Request structure
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
      "collection_time": "ISO-8601",
      "time_since_last_dose_hours": 0
    }
  ]
}

### Response structure
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
    { "time_hours": 0, "concentration": 0 }
  ],
  "measured_levels": [
    { "time_hours": 0, "concentration": 0 }
  ]
}

## Integration flow
1. User enters patient, regimen, and levels in the UI.
2. Frontend validates required fields.
3. Frontend submits request to `/api/calculate`.
4. Backend passes normalized data to the PK/Bayesian engine.
5. Engine returns PK metrics, recommendation, assumptions, limitations, and curve data.
6. Frontend renders numeric outputs, interpretation, graph, and documentation previews.

## Trust and guardrail requirements
- Do not present outputs as unquestionable.
- Always surface assumptions when possible.
- Always surface limitations or uncertainty when data are sparse.
- Keep language clinician-readable and evidence-aware.
- Avoid unsupported superiority, validation, ROI, or outcome claims.
- Preserve the Vancomyzer trust model from the site shell.

## Phase 1 calculator constraints
- one calculator route
- one main input panel
- one main results panel
- one graph
- one recommendation summary
- one quick summary preview
- one clinical note preview

## Recommended build sequence
1. calculator route shell
2. input form structure
3. result cards and interpretation block
4. graph component shell
5. API contract stub
6. PK engine integration
7. documentation/export previews
8. QA and trust review

## Success criteria
The calculator architecture is successful if:
- UI zones are clear
- backend contract is clear
- trust and interpretation are explicit
- PK engine integration boundary is defined
- future implementation can proceed without re-opening calculator structure
