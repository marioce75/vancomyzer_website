# Vancomyzer Phase 1 Cursor Prompt

Use this prompt in Cursor to implement the Vancomyzer Phase 1 website.

Implement exactly these five pages:
1. Homepage
2. Trust & Evidence
3. FAQ
4. About
5. Contact / Institutional

Follow these required inputs:
- reports/implementation/VANCOMYZER_PHASE1_BUILDER_PROMPT_REFINED.md
- reports/implementation/VANCOMYZER_PHASE1_BUILDER_BRIEF.md
- reports/implementation/VANCOMYZER_PHASE1_HANDOFF_PACKET_REFINED.md
- reports/implementation/VANCOMYZER_PHASE1_BUILD_SEQUENCE_REFINED.md
- reports/implementation/VANCOMYZER_PHASE1_SITEMAP_AND_NAVIGATION_REFINED.md
- reports/implementation/VANCOMYZER_PHASE1_CROSSLINKING_PLAN.md
- reports/trust-evidence/VANCOMYZER_VALIDATION_AND_CLAIMS_GUARDRAILS.md

Use these page specs:
- reports/page-specs/VANCOMYZER_HOMEPAGE_IMPLEMENTATION_SPEC_REFINED.md
- reports/page-specs/VANCOMYZER_TRUST_EVIDENCE_IMPLEMENTATION_SPEC_REFINED.md
- reports/page-specs/VANCOMYZER_FAQ_IMPLEMENTATION_SPEC_REFINED.md
- reports/page-specs/VANCOMYZER_ABOUT_IMPLEMENTATION_SPEC_REFINED.md
- reports/page-specs/VANCOMYZER_CONTACT_INSTITUTIONAL_IMPLEMENTATION_SPEC_REFINED.md

Use these page asset selections:
- reports/page-specs/VANCOMYZER_HOMEPAGE_ASSET_SELECTION.md
- reports/page-specs/VANCOMYZER_TRUST_EVIDENCE_ASSET_SELECTION.md
- reports/page-specs/VANCOMYZER_FAQ_ASSET_SELECTION.md
- reports/page-specs/VANCOMYZER_ABOUT_ASSET_SELECTION.md
- reports/page-specs/VANCOMYZER_CONTACT_INSTITUTIONAL_ASSET_SELECTION.md

Locked shared assets:
- CTA family:
  - Explore the workflow
  - Review a sample case
  - Review a documentation-ready summary
  - Explore the Trust & Evidence page
  - Contact us / Request a workflow evaluation
- Case mapping:
  - CASE-001 -> Homepage / FAQ / About
  - CASE-003 -> Trust & Evidence
  - CASE-002 -> Contact / Institutional
- Export mapping:
  - quick summary export -> Homepage / FAQ / About
  - clinical note export -> Trust & Evidence / Contact / Institutional

Implementation rules:
- build only the five core Phase 1 pages
- keep navigation aligned with the refined sitemap
- apply the cross-linking plan across all pages
- keep copy clinician-readable and evidence-aware
- apply claims/trust guardrails everywhere
- reuse locked assets instead of inventing new variants
- do not add SEO pages, comparison pages, feature pages, resource hub, newsletters, lead magnets, webinars, outreach pages, or demo-deck pages

Recommended build order:
1. confirm locked shared assets
2. build Homepage
3. build Trust & Evidence
4. build FAQ
5. build About
6. build Contact / Institutional
7. run consistency QA across all five pages

Expected outputs:
- implemented templates/components for the five pages
- correct selected case and export/example placement
- consistent CTA family
- correct cross-links
- notes on blockers or missing inputs if encountered
