# Vancomyzer PK Graph Rendering Prompt

Implement the first-pass concentration-time graph rendering for the calculator.

## Scope
Work only on rendering the graph from existing API response data.

Do not redesign:
- the calculator UI
- the API contract
- the recommendation/explanation outputs
- the PK engine math

## Inputs
- website/src/components/calculator/ConcentrationTimeGraph.tsx
- website/src/app/calculator/page.tsx
- website/src/types/calculator.ts

## Required behavior
- use the existing `curve` array from the API response
- use the existing `measured_levels` array from the API response
- render a simple line chart for concentration over time
- render measured levels as visible markers
- keep the graph readable and uncluttered
- handle empty-state gracefully when no curve is available

## Constraints
- use the already-installed chart dependency
- do not change the API response shape
- do not add advanced graph controls
- do not restyle the whole calculator
- do not touch informational pages

## Success criteria
- the graph displays returned curve data
- measured levels appear as markers
- empty-state remains clear when no curve is available
- existing calculator behavior remains unchanged except for graph rendering
