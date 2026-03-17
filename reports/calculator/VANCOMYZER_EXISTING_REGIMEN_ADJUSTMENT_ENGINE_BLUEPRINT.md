# Vancomyzer Existing Regimen Adjustment Engine Blueprint

## Purpose
Define the first-pass existing regimen adjustment engine for patients already receiving vancomycin.

## Workflow
This engine is used only for:
- mode = existing_regimen
- current regimen known
- one or more measured vancomycin levels available

## Engine objective
Given patient covariates, current regimen, and measured levels, produce:
- evaluated exposure metrics
- recommended dose adjustment
- recommended interval adjustment if applicable
- interpretation summary
- assumptions
- limitations
- documentation-ready preview text

## Required inputs
- age
- sex
- height_cm
- weight_kg
- serum_creatinine_mg_dl
- dose_mg
- interval_hours
- infusion_duration_hours
- one or more measured levels
- level collection timing context

## First-pass internal stages

### 1. Input normalization
- normalize patient fields
- normalize regimen fields
- normalize measured level fields
- reject malformed timing or clearly invalid values before calculation

### 2. Basic clinical validation
- current regimen must be plausible
- interval must be plausible
- infusion duration must be plausible
- level values must be plausible
- timing context must be plausible
- preserve caution for weak or sparse data rather than forcing false precision

### 3. Current regimen interpretation context
- explicitly represent the current regimen being evaluated
- do not hide which regimen is under review
- maintain separation between “current regimen” and “recommended regimen”

### 4. Level sufficiency assessment
First pass should explicitly assess:
- number of levels
- whether timing is usable
- whether data are sufficient for a bounded first-pass interpretation

This should feed assumptions and limitations.

### 5. Exposure evaluation logic
First pass should produce:
- AUC24 estimate or bounded placeholder estimate
- peak estimate if supported
- trough estimate if supported

These should be clearly framed according to data quality.

### 6. Adjustment recommendation logic
First pass should produce:
- recommended dose adjustment text
- recommended interval adjustment if applicable

This should remain bounded and transparent, not falsely framed as a fully individualized, high-certainty posterior recommendation when the data are weak.

### 7. Interpretation generation
Generate clinician-readable fields:
- interpretation_summary
- recommendation_type = existing_regimen

### 8. Assumptions and limitations generation
Always return:
- assumptions
- limitations

Examples:
- level timing may affect confidence
- sparse data limit precision
- regimen adjustment is based on available covariates and levels
- clinician judgment remains required

### 9. Documentation preview generation
Return:
- quick_summary
- clinical_note

These should explain that the recommendation is an adjustment-oriented interpretation of the current regimen.

## First-pass output requirements
The engine should be able to populate:
- auc24
- peak
- trough
- recommended_dose
- recommended_interval_hours
- interpretation_summary
- assumptions
- limitations
- documentation_preview

## Guardrails
- do not hide data-quality limitations
- do not overstate certainty from sparse or imperfect data
- do not mix raw evaluation logic with final recommendation wording
- do not blur the difference between the current regimen and the recommended regimen
- do not present a weak first-pass estimate as a robust posterior Bayesian truth

## Success criteria
The existing regimen adjustment engine blueprint is successful if:
- it supports regimen evaluation and adjustment with the correct workflow inputs
- the internal stages are explicit
- trust and limitation outputs remain first-class
- implementation can proceed without reopening the workflow model
