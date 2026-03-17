# Vancomyzer Initial Regimen Engine Blueprint

## Purpose
Define the first-pass initial regimen recommendation engine for new patients starting vancomycin.

## Workflow
This engine is used only for:
- mode = initial_regimen
- new patients
- no existing regimen required
- no vancomycin levels required

## Engine objective
Given patient covariates, produce:
- a recommended starting dose
- a recommended starting interval
- an interpretation summary
- assumptions
- limitations
- documentation-ready preview text

## Required inputs
- age
- sex
- height_cm
- weight_kg
- serum_creatinine_mg_dl

## First-pass internal stages

### 1. Input normalization
- normalize patient fields into a stable internal patient object
- reject missing or clearly invalid values before calculation

### 2. Basic clinical validation
- weight must be plausible
- serum creatinine must be plausible
- height must be plausible
- age must be plausible
- preserve caution for edge cases rather than forcing false precision

### 3. Body-size handling
First pass should explicitly define:
- actual body weight
- ideal body weight estimate
- adjusted body weight later if needed

Do not hide which size metric drives the recommendation.

### 4. Renal function estimate
First pass should produce an estimated renal function signal for dosing logic.
Keep this explicit and visible in assumptions.

### 5. Initial regimen selection logic
First pass should produce:
- starting dose recommendation
- starting interval recommendation

This should be rule-based and transparent in the first pass, not falsely framed as a fully individualized Bayesian posterior result.

### 6. Exposure expectation summary
If exposure is estimated in first pass:
- return it as an estimate
- label it clearly as a first-pass estimate
- do not overclaim certainty

### 7. Recommendation generation
Generate clinician-readable fields:
- recommended_dose
- recommended_interval_hours
- interpretation_summary

### 8. Assumptions and limitations generation
Always return:
- assumptions
- limitations

Examples:
- no measured levels available
- recommendation based on first-pass patient covariates
- clinical judgment remains required

### 9. Documentation preview generation
Return:
- quick_summary
- clinical_note

These should explain that the recommendation is an initial regimen suggestion, not a posterior update.

## First-pass output requirements
The engine should be able to populate:
- recommended_dose
- recommended_interval_hours
- interpretation_summary
- assumptions
- limitations
- documentation_preview

Optional first-pass placeholder metrics:
- auc24 estimate if safely labeled
- peak estimate if safely labeled
- trough estimate if safely labeled

## Guardrails
- do not pretend this is a posterior Bayesian update
- do not hide assumptions
- do not overstate confidence
- do not rely on levels that do not exist
- do not mix raw calculation logic with final recommendation wording

## Success criteria
The initial regimen engine blueprint is successful if:
- it supports new-patient recommendations without requiring an existing regimen
- the internal stages are explicit
- trust and limitation outputs remain first-class
- implementation can proceed without reopening the workflow model
