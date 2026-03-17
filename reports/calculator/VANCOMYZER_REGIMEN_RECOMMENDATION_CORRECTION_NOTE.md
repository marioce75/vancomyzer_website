# Regimen Recommendation Correction Note

## Problem
The current recommendation layer appears to scale dose proportionally toward the target AUC.

This can produce mathematically directional but clinically unreasonable regimens, for example:
- 1750 mg every 8 hours
- excessive total daily dose
- awkward or impractical regimens

## Correction requirement
Replace naive proportional scaling with candidate-regimen evaluation.

## Required behavior
The recommendation engine should:
1. generate a bounded list of practical regimen candidates
2. simulate expected exposure for each candidate using the current PK parameter set
3. score candidates against:
   - target AUC
   - trough plausibility
   - peak plausibility
   - practical regimen selection
4. reject unsafe or clearly impractical options
5. choose the best clinically sensible regimen

## Candidate regimen examples
Examples of candidate doses:
- 500 mg
- 750 mg
- 1000 mg
- 1250 mg
- 1500 mg
- 1750 mg
- 2000 mg

Examples of candidate intervals:
- every 8 hours
- every 12 hours
- every 24 hours

## Guardrails
- do not recommend regimens that exceed sensible daily dose limits
- do not recommend regimens solely because they mathematically hit AUC if they are impractical
- do not hide recommendation logic
- keep recommendation generation separate from PK estimation
- preserve API contract and explanation architecture

## Success criteria
The correction is successful if:
- the engine no longer recommends obviously excessive daily regimens
- recommendation outputs are clinically more sensible
- the chosen regimen is based on candidate evaluation rather than blind proportional scaling
