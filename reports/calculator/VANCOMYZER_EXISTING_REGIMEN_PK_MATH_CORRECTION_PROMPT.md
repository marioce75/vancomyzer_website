# Existing Regimen PK Math Correction Prompt

Correct the first-pass existing_regimen PK math.

## Problem
The current engine appears to produce AUC24 values that do not align with the reported peak, trough, and curve values.

## Required correction
Use one internally consistent one-compartment intermittent-infusion model so that:
- AUC24
- peak
- trough
- concentration-time curve

all come from the same parameter set and dosing assumptions.

## Scope
Modify only what is strictly necessary for the PK math correction.

Prefer changes within:
- website/src/lib/pk/existing/existingRegimenEngine.ts
- small supporting PK utility files if needed

Do not redesign:
- the calculator UI
- the API contract
- the dual-workflow structure
- the recommendation/explanation architecture

## Rules
- keep this pass non-Bayesian
- keep it first-pass and transparent
- keep assumptions and limitations explicit
- do not introduce hype or certainty language
- do not change initial_regimen behavior

## Goal
After the correction:
- AUC24, peak, trough, and curve must be internally coherent
- the API response shape must remain unchanged
- the recommendation layer should continue working with the corrected outputs

Before editing, list the exact files you will modify and why.
