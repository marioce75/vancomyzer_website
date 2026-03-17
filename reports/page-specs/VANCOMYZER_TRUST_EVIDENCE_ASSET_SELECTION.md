# Vancomyzer Trust & Evidence Asset Selection

## Purpose
Select the exact assets to use on the Phase 1 Trust & Evidence page so implementation can proceed without ambiguity.

## Selected Trust & Evidence asset bundle

### 1. Core trust/evidence language sources
Primary sources:
- reports/trust-evidence/VANCOMYZER_TRUST_AND_EVIDENCE.md
- reports/trust-evidence/VANCOMYZER_VALIDATION_AND_CLAIMS_GUARDRAILS.md

Usage:
- use the trust/evidence page copy as the main source for page language
- use the validation/claims guardrails as a visible constraint on all final copy choices
- ensure “designed to support review,” “intended to help,” and “emphasizes transparency” patterns are preserved

Rationale:
- this page is the strongest direct expression of Vancomyzer’s trust model
- it should be tightly aligned to the guardrail document
- it should reinforce interpretability and caution rather than imply validation

---

### 2. Primary case example for Trust & Evidence page
Selected case:
- CASE-003 — Sparse level data

Source:
- reports/case-library/VANCOMYZER_CASE_LIBRARY.md
- data/cases/case_library_seed.json

Rationale:
- strongest case for showing why assumptions and limitations matter
- supports uncertainty, data sufficiency, and cautious interpretation themes
- demonstrates why visible assumptions are important
- better fit for the Trust & Evidence page than the stable general-purpose homepage case

Why not lead with CASE-001 here:
- CASE-001 is the best low-friction homepage example
- CASE-003 is stronger for illustrating uncertainty, limitations, and review behavior

Why not lead with CASE-002 here:
- renal instability is also strong, but CASE-003 is the clearest direct demonstration of trust-through-transparency

Trust & Evidence page usage:
- one short case explanation
- explicitly connect the case to limited data, assumptions, and interpretation caution
- CTA to review the full case

---

### 3. Primary documentation/export example for Trust & Evidence page
Selected export type:
- clinical note style export example

Source:
- reports/documentation/examples/INDEX.md
- preferred file family: CASE-003 clinical note or closest available clinical-note example

Rationale:
- stronger than the quick summary for demonstrating how assumptions, limitations, and safety context can be surfaced
- better fit for a trust-oriented page than a purely scan-friendly summary
- supports evaluator confidence by showing richer interpretability

Why not use the homepage quick summary here:
- the quick summary is better for brevity and homepage scanning
- Trust & Evidence benefits from a fuller example that reinforces thoughtful review

Trust & Evidence page usage:
- short preview only
- explain why richer documentation improves clarity and review
- CTA to review a documentation-ready summary

---

### 4. Trust-supporting FAQ shortlist
Select supporting FAQ themes from:
- reports/faq/VANCOMYZER_FAQ.md

Recommended Trust & Evidence FAQ themes:
1. Why does transparency matter in a vancomycin dosing tool?
2. What should clinicians review before accepting a recommendation?
3. Why might AUC interpretation differ from trough-based reasoning?
4. Can documentation-ready summaries improve workflow?

Rationale:
- these questions reinforce review behavior, interpretability, and communication
- they strengthen the page’s trust-building purpose without duplicating the full FAQ page
- they help the visitor understand how to think about outputs, not just what the tool does

Usage:
- use as short supporting prompts or preview links
- do not turn this page into an FAQ clone

---

### 5. CTA family for Trust & Evidence page
Use this CTA family consistently:
- Review a sample case
- See how the workflow is explained
- Review a documentation-ready summary
- Explore the FAQ

Recommendation:
- primary CTA on this page: Review a sample case
- strongest secondary CTA: Review a documentation-ready summary

Rationale:
- keeps the user in a trust-building path
- emphasizes examples over abstract claims
- supports education-first exploration

---

## Reuse strategy
The Trust & Evidence page should reuse:
- the shared trust/claims guardrail language
- the broader CTA family already used in Phase 1

The Trust & Evidence page should intentionally differ by using:
- a stronger trust-building case than the homepage
- a richer documentation/export example than the homepage

Rationale:
- preserves Phase 1 coherence while giving this page a more credibility-focused asset mix

## Explicit non-selections for Trust & Evidence page
Do not use as primary assets:
- CASE-001 as the main trust case
- quick summary export as the main trust example
- broad comparison-page language
- institutional CTA language as the dominant CTA path
- marketing-style lead magnet language

## Implementation notes
- this page should feel more evidence-aware and caution-oriented than the homepage
- selections should reinforce clinician oversight and review behavior
- examples should support clarity, not promotional intensity
