# Existing Regimen Full-Coherence Rebuild Prompt

Rebuild the existing_regimen engine in one pass.

This is not a patch.
This is a controlled rebuild of the existing-regimen path so the outputs are fully coherent.

## Non-negotiable requirements

Use one internally consistent one-compartment intermittent-infusion model for:
- posterior parameter update
- AUC24
- peak
- trough
- concentration-time curve

All of these must come from the same parameter set and timing assumptions.

## Timing semantics
You must explicitly handle timing validity.

If:
- time_since_last_dose_hours > interval_hours
or
- the input implies missed/held doses under a simple steady-state repeating regimen
then do not silently treat the case as a normal repeating steady-state profile.

Instead:
- reject it with a validation error
or
- return a bounded limitation state that does not pretend the repeating curve is valid

Do not ignore timing inconsistency.

## Recommendation logic
Do not use naive proportional scaling.

Use bounded candidate-regimen evaluation:
- practical dose options
- practical interval options
- enforce total daily dose ceiling
- simulate candidates using the same current PK parameter set
- choose the most clinically sensible acceptable regimen

## Scope
Modify only what is strictly necessary in:
- existing regimen engine
- posterior module(s)
- recommendation module(s)
- validation module(s)
- minimal route integration if needed

Do not redesign:
- calculator UI
- API response shape
- initial_regimen path
- informational pages

## Required test cases
Implement and verify against these cases:

1. Steady-state q8 case with level inside interval
2. Steady-state q12 case with level inside interval
3. Invalid timing case where time_since_last_dose_hours > interval_hours for a repeating regimen
4. Posterior-updated case where measured level meaningfully shifts PK outputs
5. Recommendation case where naive scaling would exceed daily dose limit
6. Curve, AUC24, peak, and trough all remain internally coherent

## Required output behavior
- assumptions explicit
- limitations explicit
- posterior-updated wording only when truly used
- no black-box language
- no Bayesian marketing language
- no clinically absurd recommendation

Before editing, list the exact files you will modify and why.
Then implement the rebuild in one pass.
