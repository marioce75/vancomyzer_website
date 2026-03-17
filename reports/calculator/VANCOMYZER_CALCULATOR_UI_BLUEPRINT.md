# Vancomyzer Calculator UI Blueprint

## Purpose
Translate the calculator architecture into a direct UI build blueprint for the first calculator implementation pass.

## Route
/calculator

## Build objective
Create a calculator page that:
- supports clinician data entry clearly
- presents interpretable outputs clearly
- keeps assumptions and limitations visible
- includes a graph and documentation preview
- avoids a black-box calculator experience

## Final calculator page structure

### 1. Page header
Purpose:
- identify the page as the Vancomyzer calculator
- explain the calculator in one short clinician-readable statement

Required elements:
- page title
- short description
- optional trust/support note

Guardrails:
- avoid hype language
- avoid unsupported claims
- keep tone clinician-focused

---

### 2. Main calculator layout
Use a two-column desktop layout and a stacked mobile layout.

#### Left column — Input panel
Purpose:
- collect all required user inputs in a structured order

Input groups:
1. Patient characteristics
2. Current vancomycin regimen
3. Vancomycin level entry
4. Calculation controls

Guardrails:
- group fields clearly
- avoid excessive advanced settings in the first pass
- keep labels explicit and clinician-readable

#### Right column — Results panel
Purpose:
- display key outputs and interpretation in a stable visual hierarchy

Result groups:
1. Primary numeric outputs
2. Dose recommendation
3. Interpretation summary
4. Assumptions and limitations
5. Graph
6. Documentation previews

Guardrails:
- show outputs as interpretable aids, not unquestionable truth
- keep interpretation and limitations visible near the results

---

### 3. Input panel detail

#### Patient characteristics section
Fields:
- age
- sex
- height
- weight
- serum creatinine

Optional later display:
- estimated renal function

#### Regimen section
Fields:
- dose amount
- dosing interval
- infusion duration
- timing context

#### Level entry section
Fields:
- level value
- collection time
- time since last dose
- ability to add one or more levels

#### Calculation controls
Controls:
- Calculate
- Reset

Guardrails:
- clear separation between data entry and calculation actions
- no unnecessary control clutter

---

### 4. Results panel detail

#### Primary outputs block
Show prominently:
- AUC24
- Peak
- Trough

#### Recommendation block
Show:
- recommended dose adjustment
- recommended interval adjustment if applicable

Guardrails:
- recommendation should remain evidence-aware
- do not hide uncertainty

#### Interpretation block
Show:
- summary explanation
- whether current regimen appears within target
- what assumptions affect interpretation

#### Assumptions and limitations block
Show:
- assumptions list
- limitations list
- caution language when data are sparse

Guardrails:
- this block must remain visible in the first pass
- do not bury uncertainty

---

### 5. Graph block
Purpose:
- show concentration-time behavior visually

Required elements:
- predicted concentration-time curve
- measured level markers
- optional target-range visual support later

Placement:
- below core numeric outputs and recommendation
- above documentation previews

Guardrails:
- graph should support interpretation, not distract from it

---

### 6. Documentation preview block
Purpose:
- connect calculator output to real workflow documentation

Required previews:
- quick summary preview
- clinical note preview

Guardrails:
- keep previews concise in first pass
- do not turn exports into a separate module yet

---

### 7. Page-level trust note
Purpose:
- reinforce the Vancomyzer trust model on the calculator page

Themes:
- outputs support review
- assumptions matter
- limitations should be considered
- clinician judgment remains essential

Guardrails:
- keep language aligned with claims/trust guardrails

## Component map

### Layout components
- CalculatorPageShell
- CalculatorHeader
- CalculatorTwoColumnLayout

### Input components
- PatientCharacteristicsForm
- RegimenForm
- LevelEntryTable
- CalculatorActionBar

### Result components
- PrimaryMetricsCard
- DoseRecommendationCard
- InterpretationSummaryCard
- AssumptionsCard
- LimitationsCard

### Visualization components
- ConcentrationTimeGraph

### Documentation components
- QuickSummaryPreview
- ClinicalNotePreview

## Implementation guardrails
- one calculator route only
- one clear input column
- one clear results column
- trust/limitations must remain visible
- do not add advanced feature modules yet
- do not redesign into a generic dashboard

## Success criteria
The calculator UI blueprint is successful if:
- layout is clear
- inputs are grouped logically
- results hierarchy is clear
- graph placement is clear
- trust and interpretation remain visible
- implementation can proceed without reopening core calculator layout
