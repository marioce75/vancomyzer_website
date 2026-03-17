# Vancomyzer UI Transparency Spec

## Purpose
Define how Vancomyzer should present pharmacokinetic logic, assumptions, and dosing outputs in a way that is clinically interpretable, auditable, and workflow-friendly.

## Design goals
1. Make core dosing logic easier to understand
2. Reduce black-box perception
3. Improve clinician confidence in recommendations
4. Preserve speed while increasing interpretability
5. Support safety review and documentation

## Output sections that should be visible
- Recommended dose
- Dose interval
- Estimated AUC
- Estimated trough
- Estimated peak when relevant
- Model/method used
- Key patient inputs used in the calculation
- Major assumptions affecting the result
- Timestamp / scenario context

## Calculations and assumptions to expose
- Weight used and whether actual/adjusted/ideal body weight was applied
- Serum creatinine used
- Renal function assumptions
- Whether Bayesian logic or traditional PK logic was used
- Any MIC assumption used in AUC/MIC reasoning
- Number and timing of levels used
- Whether data are sparse, estimated, or measured
- Any major fallback logic or default assumptions

## Recommended UI blocks
### 1. Recommendation summary
Short, high-visibility summary of the current recommended regimen and expected exposure.

### 2. Why this recommendation
Plain-language explanation of the main drivers:
- renal function
- recent levels
- target exposure
- model behavior

### 3. Calculation details
Expandable technical section showing:
- inputs
- equations/approach
- assumptions
- intermediate outputs where appropriate

### 4. Confidence / limitations
Show when:
- data are limited
- assumptions are stronger than usual
- level timing is suboptimal
- uncertainty is elevated

### 5. Safety review notes
Highlight anything requiring clinician attention:
- nephrotoxicity risk context
- unusual exposure estimates
- unstable renal function
- poor data quality

## UX principles
- Default to a concise summary first
- Allow deeper technical inspection on demand
- Use plain clinical language first, technical detail second
- Avoid clutter, but do not hide clinically relevant assumptions
- Make changes in recommendation traceable

## Differentiation opportunity
Vancomyzer should compete on:
- explainability
- interpretability
- transparent assumptions
- workflow readability

Not just on:
- "more advanced" dosing claims
- vague precision claims without explanation

## Open questions
- Which intermediate PK values should be visible by default?
- Which values should be behind an expandable section?
- How should uncertainty be displayed without confusing clinicians?
- What must be exportable or copyable for documentation?
