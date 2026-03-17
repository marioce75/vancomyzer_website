# Vancomyzer Phase 1 Site Cursor Build Prompt

Use this prompt in Cursor to build the full Vancomyzer Phase 1 website.

Implement exactly these five pages:
1. Homepage
2. Trust & Evidence
3. FAQ
4. About
5. Contact / Institutional

Do not add any other pages.

## Required implementation sources

### Core build blueprints
- reports/implementation/VANCOMYZER_HOMEPAGE_BUILD_BLUEPRINT.md
- reports/implementation/VANCOMYZER_TRUST_EVIDENCE_BUILD_BLUEPRINT.md
- reports/implementation/VANCOMYZER_FAQ_BUILD_BLUEPRINT.md
- reports/implementation/VANCOMYZER_ABOUT_BUILD_BLUEPRINT.md
- reports/implementation/VANCOMYZER_CONTACT_INSTITUTIONAL_BUILD_BLUEPRINT.md

### Builder guidance
- reports/implementation/VANCOMYZER_PHASE1_BUILDER_BRIEF.md
- reports/implementation/VANCOMYZER_PHASE1_BUILDER_PROMPT_REFINED.md

### Site structure
- reports/implementation/VANCOMYZER_PHASE1_SITEMAP_AND_NAVIGATION_REFINED.md
- reports/implementation/VANCOMYZER_PHASE1_CROSSLINKING_PLAN.md

### Guardrails
- reports/trust-evidence/VANCOMYZER_VALIDATION_AND_CLAIMS_GUARDRAILS.md

## Locked shared asset bundle

### CTA family
Use consistently across the site:
- Explore the workflow
- Review a sample case
- Review a documentation-ready summary
- Explore the Trust & Evidence page
- Contact us / Request a workflow evaluation

### Case mapping
- CASE-001 -> Homepage / FAQ / About
- CASE-003 -> Trust & Evidence
- CASE-002 -> Contact / Institutional

### Export mapping
- quick summary export -> Homepage / FAQ / About
- clinical note export -> Trust & Evidence / Contact / Institutional

### FAQ shortlist
Use this fixed shortlist:
1. What is AUC-guided vancomycin dosing?
2. How is Bayesian dosing different from traditional PK dosing?
3. Why might AUC interpretation differ from trough-based reasoning?
4. Why does transparency matter in a vancomycin dosing tool?
5. What should clinicians review before accepting a recommendation?
6. Can documentation-ready summaries improve workflow?

## Navigation rules
Top navigation must remain:
- Home
- Trust & Evidence
- FAQ
- About
- Contact

Do not add top-nav links for:
- SEO pages
- comparison pages
- feature pages
- resource hub
- newsletters
- lead magnets
- webinars/events
- outreach assets

## Cross-linking rules
Implement the defined cross-linking plan so that:
- Homepage links to Trust & Evidence, sample case, documentation-ready summary, and FAQ
- Trust & Evidence links to sample case, documentation-ready summary, FAQ, and Contact / Institutional
- FAQ links to Trust & Evidence, sample case, and documentation-ready summary
- About links to sample case, Trust & Evidence, and documentation-ready summary
- Contact / Institutional links to sample case, documentation-ready summary, Trust & Evidence, and direct contact/evaluation CTA

## Page-specific implementation rules

### Homepage
- keep one hero
- keep one case preview only
- keep one quick summary export preview only
- keep FAQ preview limited
- keep CTA flow demo-first

### Trust & Evidence
- keep trust practical and evidence-aware
- use CASE-003
- use clinical note style export
- make assumptions, limitations, and review behavior visible

### FAQ
- keep answers concise
- use the locked FAQ shortlist
- use CASE-001 and quick summary as supporting references
- reinforce transparency and clinician oversight

### About
- keep the page practical, not brand-heavy
- reuse CASE-001 and quick summary as support links
- reinforce mission, philosophy, and intended users
- link toward Trust & Evidence and examples

### Contact / Institutional
- keep the page evaluator-oriented, not sales-heavy
- use CASE-002
- use clinical note style export
- support demo-first review before direct inquiry
- avoid ROI, productivity, superiority, or validation claims

## Implementation constraints
- build only the five core Phase 1 pages
- do not invent new page variants
- do not invent new case mappings
- do not invent new export mappings
- keep language clinician-readable and evidence-aware
- apply claims/trust guardrails everywhere
- preserve Phase 1 scope

## Recommended build order
1. confirm locked shared assets
2. implement Homepage
3. implement Trust & Evidence
4. implement FAQ
5. implement About
6. implement Contact / Institutional
7. apply cross-links and shared navigation
8. run consistency QA across all five pages

## Expected outputs
- five implemented page templates/components
- locked CTA family used consistently
- correct case and export placement
- correct nav and footer structure
- correct cross-links
- no Phase 2/3 scope additions
- notes on blockers if any source file is insufficient

## Final instruction
Use the build blueprints as the source of truth for section order, section intent, asset placement, CTA emphasis, and page-level guardrails. Do not redesign the site. Implement the site.
