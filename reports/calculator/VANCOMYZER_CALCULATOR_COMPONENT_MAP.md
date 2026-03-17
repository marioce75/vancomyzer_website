# Vancomyzer Calculator Component Map

## Purpose
Define the first-pass component map for the calculator route so implementation can proceed against explicit component boundaries.

## Route
/calculator

## Top-level page structure

### CalculatorPage
Responsibilities:
- render the calculator route
- assemble the page header and layout
- connect left-column input shell and right-column results shell
- own high-level page structure only

### CalculatorHeader
Responsibilities:
- render page title
- render short clinician-readable description
- render short trust note

### CalculatorLayout
Responsibilities:
- render two-column desktop layout
- render stacked mobile layout
- keep input and result regions visually distinct

## Left-column components

### PatientCharacteristicsForm
Responsibilities:
- render age
- render sex
- render height
- render weight
- render serum creatinine

### RegimenForm
Responsibilities:
- render dose amount
- render interval
- render infusion duration
- render dosing timing context

### LevelEntryTable
Responsibilities:
- render one or more entered vancomycin levels
- render collection time inputs
- render time-since-last-dose inputs
- support add/remove level rows in later pass if needed

### CalculatorActionBar
Responsibilities:
- render Calculate button
- render Reset button
- separate user actions from input fields

## Right-column components

### PrimaryMetricsCard
Responsibilities:
- display AUC24
- display Peak
- display Trough

### DoseRecommendationCard
Responsibilities:
- display recommended dose adjustment
- display recommended interval adjustment if applicable

### InterpretationSummaryCard
Responsibilities:
- display clinician-readable summary
- display target-context interpretation

### AssumptionsCard
Responsibilities:
- display assumptions list clearly

### LimitationsCard
Responsibilities:
- display limitations list clearly
- display caution notes for sparse or uncertain data

### ConcentrationTimeGraph
Responsibilities:
- render graph container
- accept curve data and measured level markers
- support later plotting implementation

### QuickSummaryPreview
Responsibilities:
- display quick summary preview text

### ClinicalNotePreview
Responsibilities:
- display clinical note preview text

## Integration-state components

### CalculatorLoadingState
Responsibilities:
- render loading feedback during calculation

### CalculatorErrorState
Responsibilities:
- render validation error or calculation error feedback

### CalculatorResultState
Responsibilities:
- control whether result components are visible
- separate empty state from populated result state

## Data-flow responsibilities

### Input state
Owned at calculator route level in first pass.

### Submission flow
- gather normalized form input
- submit to POST /api/calculate in later pass

### Result flow
- receive response payload
- pass metrics, recommendation, interpretation, assumptions, limitations, graph data, and documentation preview data to the correct child components

## Guardrails
- keep component responsibilities narrow
- keep trust and limitation visibility as first-class
- do not collapse assumptions/limitations into hidden details
- do not create dashboard-style component sprawl
- do not mix API logic deeply into presentational components

## Success criteria
The component map is successful if:
- component boundaries are clear
- responsibilities are explicit
- future implementation can proceed without reopening structure questions
