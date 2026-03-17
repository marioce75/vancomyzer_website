# Regimen Recommendation Correction Prompt

Correct the regimen recommendation engine for existing_regimen.

## Problem
The current recommendation logic appears to scale the current dose proportionally toward target AUC, which can generate clinically unreasonable regimens such as very high total daily doses.

## Required correction
Replace naive proportional scaling with bounded candidate-regimen evaluation.

## Scope
Modify only what is strictly necessary in the recommendation layer and any minimal supporting simulation helper needed to score candidates.

Prefer changes within:
- website/src/lib/pk/recommend/buildAdjustmentRecommendation.ts
- small supporting PK utility files if needed

Do not redesign:
- the calculator UI
- the API contract
- the dual-workflow structure
- the posterior fitting architecture

## Required behavior
- generate practical candidate regimens
- simulate expected exposure for each candidate using the current PK parameter set
- compare candidates against target AUC and basic concentration plausibility
- reject clearly excessive or impractical regimens
- choose a clinically sensible regimen
- keep the recommendation layer transparent and bounded

## Rules
- keep this pass non-commercial and first-pass
- do not add hidden scoring systems
- do not add Bayesian marketing language
- do not change initial_regimen behavior
- keep assumptions and limitations explicit

Before editing, list the exact files you will modify and why.
