# Vancomyzer Homepage Asset Selection

## Purpose
Select the exact asset bundle to use on the Phase 1 homepage so implementation can proceed without ambiguity.

## Selected homepage asset bundle

### 1. Homepage headline/subheadline source
Use as primary source:
- reports/website-copy/VANCOMYZER_HOMEPAGE_COPY.md

Preferred direction:
- headline should emphasize clarity, transparency, and clinician readability
- subheadline should explain the workflow/value in plain clinical language
- avoid vague branding language or unsupported claims

Selection guidance:
- choose one headline/subheadline pair only
- do not rotate multiple variants in the Phase 1 implementation

---

### 2. Primary sample case for homepage preview
Selected case:
- CASE-001 — Stable adult with preserved renal function

Source:
- reports/case-library/VANCOMYZER_CASE_LIBRARY.md
- data/cases/case_library_seed.json

Rationale:
- most general-purpose and lowest-friction entry point for first-time visitors
- easiest case for explaining routine workflow and interpretation
- supports demo-first exploration without overwhelming the user
- safer homepage choice than a more complex or unstable scenario

Why not lead with the others:
- CASE-002 renal instability is stronger for trust/evidence depth, but not ideal as the first homepage example
- CASE-003 sparse data is useful for limitations/uncertainty, but less suitable as the primary first-visit preview
- CASE-004 AUC vs trough is educational, but better as a secondary explainer
- CASE-005 communication case is useful later, but not the strongest homepage anchor

Homepage usage:
- one short summary only
- one CTA to review the sample case
- do not add multiple cases to the homepage

---

### 3. Primary export/documentation preview for homepage
Selected export type:
- quick summary export example

Source:
- reports/documentation/examples/INDEX.md
- preferred file family: CASE-001 quick summary

Rationale:
- fastest to understand at a glance
- demonstrates practical workflow value without excessive density
- aligns well with homepage brevity
- works well next to a stable general-purpose case preview

Why not use the longer clinical note on homepage:
- clinical note style is valuable, but better for the dedicated export/documentation context or trust/evidence page
- homepage should emphasize clarity and scanability first

Homepage usage:
- short preview only
- one sentence on why it matters
- one CTA to review a documentation-ready summary

---

### 4. FAQ preview shortlist for homepage
Select 3 to 5 short FAQ items from:
- reports/faq/VANCOMYZER_FAQ.md

Recommended homepage FAQ themes:
1. What is AUC-guided vancomycin dosing?
2. How is Bayesian dosing different from traditional PK dosing?
3. Why does transparency matter in a vancomycin dosing tool?
4. What should clinicians review before accepting a recommendation?

Optional fifth item:
5. Can documentation-ready summaries improve workflow?

Rationale:
- these are the strongest first-order questions
- they support trust, workflow understanding, and interpretability
- they reduce first-visit confusion without expanding page scope

Homepage usage:
- use short previews, not full answers
- link out to the full FAQ page

---

### 5. Trust/transparency highlight source
Use as primary sources:
- reports/trust-evidence/VANCOMYZER_TRUST_AND_EVIDENCE.md
- reports/trust-evidence/VANCOMYZER_VALIDATION_AND_CLAIMS_GUARDRAILS.md

Recommended homepage trust highlight themes:
- visible assumptions
- visible method/model
- caution and limitation visibility
- documentation-ready communication support

Rationale:
- these are practical trust signals
- they differentiate the product without overclaiming
- they connect directly to the trust/evidence page

---

### 6. CTA family for homepage
Use this CTA family consistently:
- Explore the workflow
- Review a sample case
- See how calculations are explained
- Review a documentation-ready summary

Recommendation:
- primary CTA above the fold: Explore the workflow
- strongest secondary CTA: Review a sample case

Rationale:
- keeps conversion demo-first
- preserves educational tone
- supports trust before heavier asks

---

## Asset reuse guidance
These homepage-selected assets should be reused later where appropriate:

- CASE-001 as the primary general-purpose case across homepage, about, and FAQ where useful
- quick summary export as the primary homepage/general-purpose export preview
- same FAQ shortlist themes across homepage and early onboarding moments
- same trust themes across homepage and trust/evidence page

## Explicit non-selections for homepage
Do not use these as primary homepage assets:
- complex instability case as the main hero/demo case
- long clinical-note export as the main homepage preview
- large FAQ list
- multiple CTA families
- multiple case cards
- institutional-heavy evaluator messaging

## Implementation notes
- homepage should use the smallest viable asset set
- strongest general-purpose assets should appear first
- deeper/complex assets belong on trust/evidence, FAQ, or later pages
- homepage should stay coherent, fast to scan, and trust-oriented
