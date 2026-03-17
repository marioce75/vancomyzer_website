# Existing Regimen PK Math Correction Note

## Problem
The current first-pass existing-regimen engine appears to compute:
- AUC24 from one relationship
while
- peak, trough, and curve are derived from a different relationship

This causes internal inconsistency:
- AUC24 suggests one exposure level
- peak/trough/curve suggest another

## Correction requirement
Use a single internally consistent one-compartment intermittent-infusion model for:
- AUC24
- peak
- trough
- concentration-time curve

All four outputs must come from:
- the same Ke
- the same V
- the same CL
- the same dosing and infusion assumptions

## Required model properties
- one-compartment
- intermittent IV infusion
- steady-state first-pass estimate
- no Bayesian fitting in this correction pass

## Implementation rule
Do not compute:
- AUC24 from one method
and
- peak/trough/curve from another unrelated method

Instead:
- derive concentrations from the same model used to define exposure
or
- derive exposure from the same model used to define concentrations

## What must stay unchanged
- dual workflow behavior
- API contract shape
- existing-regimen request structure
- recommendation/explanation architecture
- non-Bayesian framing

## Success criteria
The correction is successful if:
- AUC24, peak, trough, and curve are internally coherent
- peak/trough values are plausible relative to the reported AUC24
- the current first-pass model remains transparent and bounded
