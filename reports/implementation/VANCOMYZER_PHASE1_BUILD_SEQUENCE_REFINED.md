# Vancomyzer Phase 1 Build Sequence — Refined

## Purpose
Define the most practical implementation order for Phase 1 so the five core pages can be built with minimal rework and maximum consistency.

## Refined build philosophy
- finalize shared assets before page implementation
- build the homepage first because it anchors messaging and asset reuse
- build trust-supporting pages before evaluator-facing pages
- reuse the same strongest examples across pages
- keep the sequence tightly limited to Phase 1 scope

## Final implementation order

### Step 1 — Finalize shared assets
Required confirmations:
- final homepage headline/subheadline pair
- final shared CTA family wording
- final FAQ shortlist wording
- final case mapping:
  - CASE-001 homepage/about/FAQ
  - CASE-003 Trust & Evidence
  - CASE-002 Contact / Institutional
- final export mapping:
  - quick summary for homepage/about/FAQ
  - clinical note for Trust & Evidence / Contact-Institutional

Reason:
- these decisions affect all five pages
- finalizing them first prevents repeated rework later

---

### Step 2 — Build Homepage
Required inputs:
- reports/page-specs/VANCOMYZER_HOMEPAGE_IMPLEMENTATION_SPEC_REFINED.md
- reports/page-specs/VANCOMYZER_HOMEPAGE_ASSET_SELECTION.md
- shared asset bundle

Reason:
- homepage is the main entry point
- homepage sets tone, CTA pattern, trust emphasis, and case/export preview style

---

### Step 3 — Build Trust & Evidence page
Required inputs:
- reports/page-specs/VANCOMYZER_TRUST_EVIDENCE_IMPLEMENTATION_SPEC_REFINED.md
- reports/page-specs/VANCOMYZER_TRUST_EVIDENCE_ASSET_SELECTION.md
- claims guardrails

Reason:
- trust is a core differentiator
- this page supports both homepage flow and evaluator review
- it should be established before FAQ/about/contact pages are finalized

---

### Step 4 — Build FAQ page
Required inputs:
- reports/page-specs/VANCOMYZER_FAQ_IMPLEMENTATION_SPEC_REFINED.md
- reports/page-specs/VANCOMYZER_FAQ_ASSET_SELECTION.md

Reason:
- FAQ reduces first-order confusion
- FAQ should reinforce the same trust and example paths established by homepage and trust page

---

### Step 5 — Build About page
Required inputs:
- reports/page-specs/VANCOMYZER_ABOUT_IMPLEMENTATION_SPEC_REFINED.md
- reports/page-specs/VANCOMYZER_ABOUT_ASSET_SELECTION.md

Reason:
- About page depends on already-stable mission, trust, and example language
- it should reinforce existing paths rather than invent new ones

---

### Step 6 — Build Contact / Institutional page
Required inputs:
- reports/page-specs/VANCOMYZER_CONTACT_INSTITUTIONAL_IMPLEMENTATION_SPEC_REFINED.md
- reports/page-specs/VANCOMYZER_CONTACT_INSTITUTIONAL_ASSET_SELECTION.md

Reason:
- evaluator-facing page should come after trust, examples, and documentation paths are already defined
- it is strongest when it can point to already-built materials

---

### Step 7 — Phase 1 QA and consistency pass
Required checks:
- CTA consistency across all pages
- claims guardrail consistency across all pages
- case and export reuse consistency
- trust-first navigation consistency
- cross-linking consistency
- footer and top-nav consistency

Reason:
- prevents drift between pages
- ensures Phase 1 feels coherent rather than assembled page-by-page

## Dependencies and sequencing notes

### Hard dependencies
- shared asset bundle must be finalized before Step 2
- Trust & Evidence should be finalized before Contact / Institutional
- cross-linking plan should be applied during implementation, not retrofitted later

### Soft dependencies
- FAQ can technically be built before Trust & Evidence, but that creates more rework risk
- About can be drafted early, but should be finalized after homepage and trust language stabilize

## Explicit anti-scope-drift rules
Do not interrupt the build sequence to add:
- SEO pages
- comparison pages
- feature pages
- resource hub
- lead magnets
- newsletters
- webinar/event pages
- outreach assets

Those remain outside Phase 1 implementation.

## Refined deliverable checklist
A successful Phase 1 build sequence ends with:

- shared asset bundle finalized
- homepage implemented
- Trust & Evidence implemented
- FAQ implemented
- About implemented
- Contact / Institutional implemented
- cross-links applied
- CTA family consistent
- claims guardrails applied everywhere
- Phase 1 QA pass completed

## Success criteria
The sequence is successful if:
- no page needs major rework because shared assets changed late
- trust and exploration paths remain coherent
- implementation stays within 5 core pages
- builder can follow the order without ambiguity

## Implementation guardrails
- do not skip shared asset finalization
- do not build Contact / Institutional before trust assets are stable
- do not introduce additional asset variants mid-build
- prioritize coherence over speed if the two conflict
