# Vancomyzer Phase 1 Asset Selection Bundle

## Purpose
Lock the final reusable asset bundle for the five Phase 1 pages so implementation can proceed with minimal ambiguity and minimal asset sprawl.

## Final selected bundle

### 1. Homepage headline/subheadline source
Primary source:
- reports/website-copy/VANCOMYZER_HOMEPAGE_COPY.md

Selection rule:
- choose one final pair only during implementation
- do not carry multiple interchangeable hero variants into Phase 1 build

Selection direction:
- headline should emphasize clarity, transparency, and clinician readability
- subheadline should explain workflow support in plain clinical language
- avoid vague branding language and unsupported claims

---

### 2. Shared CTA family
Use across all Phase 1 pages:

- Explore the workflow
- Review a sample case
- Review a documentation-ready summary
- Explore the Trust & Evidence page
- Contact us / Request a workflow evaluation

Selection rule:
- keep wording stable across pages
- do not create page-specific CTA families unless required by the page purpose

---

### 3. General-purpose case
Selected case:
- CASE-001 — Stable adult with preserved renal function

Use on:
- Homepage
- About
- FAQ

Rationale:
- best low-friction entry point
- easiest to understand for first-time visitors
- strongest general-purpose workflow example

---

### 4. Trust-oriented case
Selected case:
- CASE-003 — Sparse level data

Use on:
- Trust & Evidence

Rationale:
- strongest illustration of assumptions, limitations, and cautious interpretation
- best fit for trust-building and evidence-aware messaging

---

### 5. Evaluator-oriented case
Selected case:
- CASE-002 — Renal function instability

Use on:
- Contact / Institutional

Rationale:
- strongest evaluator-facing example
- demonstrates why review, caution, and interpretability matter for teams

---

### 6. General-purpose export example
Selected export type:
- quick summary export example

Use on:
- Homepage
- About
- FAQ

Rationale:
- easiest to scan
- strongest fit for concise Phase 1 presentation
- complements CASE-001 well

---

### 7. Trust / evaluator export example
Selected export type:
- clinical note style export example

Use on:
- Trust & Evidence
- Contact / Institutional

Rationale:
- richer and more review-oriented
- better fit for credibility, documentation, and evaluator review

---

### 8. Final FAQ shortlist
Selected FAQ items:
1. What is AUC-guided vancomycin dosing?
2. How is Bayesian dosing different from traditional PK dosing?
3. Why might AUC interpretation differ from trough-based reasoning?
4. Why does transparency matter in a vancomycin dosing tool?
5. What should clinicians review before accepting a recommendation?
6. Can documentation-ready summaries improve workflow?

Use:
- FAQ page core content
- homepage FAQ preview subset

Rationale:
- covers first-order workflow, trust, and documentation questions
- remains concise enough for Phase 1

---

## Page-by-page final asset mapping

### Homepage
- one final homepage headline/subheadline pair
- shared CTA family
- CASE-001
- quick summary export
- FAQ preview subset
- trust highlights from trust/evidence sources

### About
- mission/philosophy copy
- shared CTA family
- CASE-001 support link
- quick summary export support link
- Trust & Evidence support link

### Trust & Evidence
- trust/evidence core copy
- validation/claims guardrails
- CASE-003
- clinical note export
- trust-supporting FAQ themes
- shared CTA family

### FAQ
- final FAQ shortlist
- shared CTA family
- CASE-001 support link
- quick summary export support link
- Trust & Evidence support link

### Contact / Institutional
- evaluator-facing copy
- shared CTA family
- CASE-002
- clinical note export
- Trust & Evidence support link
- evaluation/contact CTA emphasis

## Exact source documents

### Copy sources
- reports/website-copy/VANCOMYZER_HOMEPAGE_COPY.md
- reports/about/VANCOMYZER_ABOUT_PAGE.md
- reports/trust-evidence/VANCOMYZER_TRUST_AND_EVIDENCE.md
- reports/faq/VANCOMYZER_FAQ.md
- reports/institutional/VANCOMYZER_CONTACT_AND_INSTITUTIONAL_PAGES.md

### Claims guardrails
- reports/trust-evidence/VANCOMYZER_VALIDATION_AND_CLAIMS_GUARDRAILS.md

### Case sources
- reports/case-library/VANCOMYZER_CASE_LIBRARY.md
- data/cases/case_library_seed.json

### Export/example sources
- reports/documentation/examples/INDEX.md

## Final bundle rules
- reuse assets aggressively
- do not introduce additional Phase 1 variants unless implementation fails with the selected bundle
- preserve consistency of CTA language
- preserve consistency of trust language
- use richer assets only on trust/evaluator pages
- keep homepage/about/FAQ lighter and easier to scan

## Remaining implementation-level confirmations
These are still confirmed during build, not strategy:
- exact chosen homepage headline line
- exact chosen homepage subheadline line
- exact file names for the quick-summary and clinical-note examples

## Bundle success criteria
The asset bundle is successful if:
- all five Phase 1 pages can be built without inventing new assets
- asset reuse is clear
- trust, example, and CTA logic remain coherent
- Phase 1 scope stays tight
