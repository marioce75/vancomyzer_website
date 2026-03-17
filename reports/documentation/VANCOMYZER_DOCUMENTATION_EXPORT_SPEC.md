# Vancomyzer Documentation Export Spec

## Purpose
Define how Vancomyzer should generate copyable, clinician-readable summaries from dosing outputs and case scenarios.

## Primary goals
1. Support clinical communication
2. Support documentation-ready summaries
3. Improve trust through transparent explanation
4. Make outputs easy to review, copy, and share internally
5. Preserve safety-critical context and assumptions

## Export types
### 1. Quick summary export
Short format for rapid review:
- regimen recommendation
- expected AUC
- expected trough
- major assumptions
- key caution notes

### 2. Clinical note export
Longer format for documentation or communication:
- patient context summary
- relevant inputs used
- method/model used
- recommendation summary
- rationale
- assumptions and limitations
- safety notes

### 3. Case teaching export
Educational format:
- scenario summary
- teaching points
- interpretation notes
- workflow lessons
- transparency highlights

## Required visible elements
- timestamp
- scenario or patient context label
- method used
- major input values
- key recommendation outputs
- assumptions affecting interpretation
- uncertainty / limitation notes
- safety or caution notes

## Export design rules
- plain clinical language first
- concise summary before technical detail
- no black-box wording
- preserve clinically relevant assumptions
- avoid implying certainty when uncertainty is elevated
- support copy/paste into documentation workflows

## Suggested quick summary format
Recommendation:
Estimated AUC:
Estimated trough:
Method:
Key assumptions:
Cautions:

## Suggested clinical note format
Patient/scenario:
Inputs used:
Method:
Recommendation:
Why this recommendation was made:
Assumptions:
Limitations:
Safety notes:

## Suggested educational case format
Case:
Scenario:
Teaching points:
Interpretation:
Why transparency matters here:
