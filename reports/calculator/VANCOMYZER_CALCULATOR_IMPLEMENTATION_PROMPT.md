# Vancomyzer Calculator Implementation Prompt

Use this prompt to implement the first-pass Vancomyzer calculator route.

Implement a new `/calculator` route using the calculator architecture, UI blueprint, API contract, route shell blueprint, and component map.

## Required inputs
- reports/calculator/VANCOMYZER_CALCULATOR_ARCHITECTURE.md
- reports/calculator/VANCOMYZER_CALCULATOR_UI_BLUEPRINT.md
- reports/calculator/VANCOMYZER_CALCULATOR_API_CONTRACT.md
- reports/calculator/VANCOMYZER_CALCULATOR_ROUTE_SHELL_BLUEPRINT.md
- reports/calculator/VANCOMYZER_CALCULATOR_COMPONENT_MAP.md
- reports/trust-evidence/VANCOMYZER_VALIDATION_AND_CLAIMS_GUARDRAILS.md

## Goal
Implement the first-pass calculator route shell and its major components.

This pass should:
- create the calculator page structure
- create the input and results layout
- create the named components from the component map
- include placeholders for result, graph, and documentation preview areas
- prepare the route for later API wiring

This pass should not:
- fully implement Bayesian calculations
- add advanced dashboard features
- add extra calculator routes
- redesign the site
- introduce unsupported claims

## Required route structure
Create a `/calculator` page with:
1. page header
2. short trust note
3. left input column
4. right results column
5. graph container
6. documentation preview area

## Required component structure
Implement the first-pass components:
- CalculatorPage
- CalculatorHeader
- CalculatorLayout
- PatientCharacteristicsForm
- RegimenForm
- LevelEntryTable
- CalculatorActionBar
- PrimaryMetricsCard
- DoseRecommendationCard
- InterpretationSummaryCard
- AssumptionsCard
- LimitationsCard
- ConcentrationTimeGraph
- QuickSummaryPreview
- ClinicalNotePreview
- CalculatorLoadingState
- CalculatorErrorState
- CalculatorResultState

## Required behavior
- use a two-column desktop layout
- use a stacked mobile layout
- keep inputs on the left
- keep results on the right
- keep assumptions and limitations visible
- keep documentation preview visible
- keep tone clinician-readable and evidence-aware

## API preparation
Prepare the page for later POST /api/calculate integration.

You may:
- create local placeholder state
- create stub handlers
- create empty-state/result-state sections

Do not:
- invent a different API contract
- hardcode hype language
- hide uncertainty

## Trust rules
- outputs must be framed as interpretation support
- assumptions and limitations must remain visible
- clinician judgment must remain explicit
- no superiority, validation, ROI, or outcome claims

## Implementation constraints
- first pass only
- route shell and components only
- no advanced settings modules
- no dashboard analytics
- no multi-patient workflow
- no deployment work in this step

## Expected output
- implemented `/calculator` route shell
- component files for the first calculator pass
- layout ready for later API wiring
- no redesign of existing informational pages
