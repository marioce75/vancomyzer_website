# Vancomyzer Calculator Route Shell Build Blueprint

## Purpose
Translate the calculator architecture, UI blueprint, and API contract into a direct build blueprint for the first calculator route implementation pass.

## Route
/calculator

## Build objective
Create a calculator route shell that:
- establishes the final page structure
- places all major UI regions correctly
- preserves trust, interpretation, and documentation visibility
- is ready for later form wiring and API integration
- avoids premature feature sprawl

## Final route shell structure

### 1. Calculator page header
Purpose:
- identify the page as the Vancomyzer calculator
- explain the page in one short clinician-readable statement
- reinforce that outputs support interpretation rather than replace judgment

Required elements:
- page title
- short description
- short trust note

Guardrails:
- keep language clinician-readable
- avoid hype or unsupported claims
- keep the trust note visible but concise

---

### 2. Main calculator shell
Use:
- two-column layout on desktop
- stacked layout on smaller screens

#### Left column
Reserved for:
- Patient characteristics section
- Regimen section
- Level entry section
- Calculation controls

#### Right column
Reserved for:
- Primary outputs
- Recommendation block
- Interpretation summary
- Assumptions and limitations
- Graph
- Documentation previews

Guardrails:
- keep left side input-focused
- keep right side results-focused
- do not mix outputs into the input column

---

### 3. Input column layout

#### Patient characteristics block
Place near the top of the left column.

Expected fields:
- age
- sex
- height
- weight
- serum creatinine

#### Regimen block
Place directly below patient characteristics.

Expected fields:
- dose amount
- interval
- infusion duration
- dosing timing context

#### Level entry block
Place below regimen.

Expected fields:
- level value
- collection time
- time since last dose
- support for one or more entered levels

#### Calculation controls block
Place at the bottom of the input column.

Expected controls:
- Calculate
- Reset

Guardrails:
- input sections should be visually grouped
- controls should be visually separated from data-entry fields

---

### 4. Results column layout

#### Primary outputs block
Place at the top of the right column.

Metrics:
- AUC24
- Peak
- Trough

#### Recommendation block
Place directly below primary outputs.

Expected content:
- recommended dose adjustment
- recommended interval adjustment if applicable

#### Interpretation block
Place directly below recommendation.

Expected content:
- short interpretation summary
- whether current regimen appears within target
- explanation context

#### Assumptions and limitations block
Place directly below interpretation.

Expected content:
- assumptions list
- limitations list
- caution notes for sparse or uncertain data

Guardrails:
- do not bury limitations below the fold if avoidable
- keep assumptions and limitations visually distinct from recommendation

#### Graph block
Place below assumptions/limitations.

Expected content:
- concentration-time curve area
- measured level markers
- graph container sized for later plotting

#### Documentation preview block
Place below graph.

Expected content:
- quick summary preview area
- clinical note preview area

Guardrails:
- previews should be visible in the first pass
- no separate export workflow yet

---

### 5. API integration boundaries
In the first shell pass, include explicit integration points for later wiring:

- input form state container
- calculate action trigger
- loading state placeholder
- result state container
- error state container

Expected later connection:
- POST /api/calculate

Guardrails:
- route shell should show where API results will land
- do not implement backend logic in the shell blueprint
- keep data flow direction clear

---

### 6. Trust note placement
Include a trust-oriented note on the calculator page that reinforces:
- assumptions matter
- limitations should be reviewed
- clinician judgment remains essential

Recommended placement:
- near the page header or near the interpretation block

Guardrails:
- keep it concise
- align with trust/claims guardrails

## Component placement map

### Page shell
- CalculatorPageShell
- CalculatorHeader
- CalculatorLayout

### Left column
- PatientCharacteristicsForm
- RegimenForm
- LevelEntryTable
- CalculatorActionBar

### Right column
- PrimaryMetricsCard
- DoseRecommendationCard
- InterpretationSummaryCard
- AssumptionsCard
- LimitationsCard
- ConcentrationTimeGraph
- QuickSummaryPreview
- ClinicalNotePreview

### Integration support
- CalculatorResultState
- CalculatorErrorState
- CalculatorLoadingState

## Implementation guardrails
- build only the route shell in this step
- do not implement full API wiring yet
- do not add advanced settings panels
- do not add multi-patient workflows
- do not add dashboard analytics
- keep the first pass clinician-readable and focused

## Success criteria
The route shell blueprint is successful if:
- the calculator page structure is locked
- all major UI zones are placed clearly
- API integration points are explicit
- trust and limitations remain visible
- future component implementation can proceed without reopening layout debates
