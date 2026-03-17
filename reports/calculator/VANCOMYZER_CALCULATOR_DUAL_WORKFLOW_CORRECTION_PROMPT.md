# Vancomyzer Calculator Dual-Workflow Correction Prompt

Implement a correction pass on the existing `/calculator` route and `/api/calculate` route.

This is not a redesign of the whole site.
This is a targeted clinical workflow correction.

## Required correction
The calculator must support two explicit workflows:

1. Initial regimen recommendation
2. Existing regimen evaluation / adjustment

## Critical rule
Do not require an existing regimen when the user selects initial regimen mode.

## UI changes required
- add a workflow selector near the top of the calculator page
- allow switching between:
  - Initial regimen
  - Existing regimen / adjustment
- conditionally show and validate fields based on the selected mode

### Initial regimen mode
Show:
- patient characteristics
- calculate/reset controls
- recommendation-oriented results

Do not require:
- dose
- interval
- infusion duration
- level entry

### Existing regimen mode
Show:
- patient characteristics
- current regimen
- level entry
- calculate/reset controls
- full results stack

## API changes required
- update the request payload to include `mode`
- make validation conditional on `mode`
- allow initial_regimen requests without regimen or levels
- preserve the current contract shape where possible, but correct the workflow model

## Response changes required
- include workflow mode or recommendation type in the response
- preserve assumptions, limitations, interpretation, and documentation preview behavior

## Guardrails
- do not redesign the informational pages
- do not add advanced features
- do not invent a different product direction
- keep the UI clinician-readable
- preserve trust and limitation visibility
- avoid unsupported claims

Before editing, list the exact files you will modify and why.
Then implement the correction in one pass.
