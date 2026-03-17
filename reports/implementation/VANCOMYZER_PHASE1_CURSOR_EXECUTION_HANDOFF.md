# Vancomyzer Phase 1 Cursor Execution Handoff

## Purpose
Provide the final operator-facing handoff for executing the full Phase 1 site build in Cursor.

This document is for the actual build pass, not further planning.

## Build target
Implement exactly these five pages:

1. Homepage
2. Trust & Evidence
3. FAQ
4. About
5. Contact / Institutional

Do not add any other pages.

## Source of truth
Use these as the governing implementation inputs:

- reports/implementation/VANCOMYZER_PHASE1_SITE_CURSOR_BUILD_PROMPT.md
- reports/implementation/VANCOMYZER_PHASE1_BUILDER_BRIEF.md
- reports/implementation/VANCOMYZER_PHASE1_HANDOFF_PACKET_REFINED.md
- reports/implementation/VANCOMYZER_PHASE1_BUILD_SEQUENCE_REFINED.md
- reports/trust-evidence/VANCOMYZER_VALIDATION_AND_CLAIMS_GUARDRAILS.md

## Pre-run checklist
Before pasting the build prompt into Cursor, confirm:

- repo is clean
- current branch is correct
- all five page blueprints exist
- locked asset mapping is unchanged
- CTA family is unchanged
- navigation and cross-linking rules are unchanged
- claims guardrails are unchanged

## Locked shared rules

### CTA family
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

### Navigation
Top navigation must remain:
- Home
- Trust & Evidence
- FAQ
- About
- Contact

## Cursor run instructions
1. Open the Vancomyzer website repo in Cursor.
2. Paste the full contents of:
   - reports/implementation/VANCOMYZER_PHASE1_SITE_CURSOR_BUILD_PROMPT.md
3. Instruct Cursor to implement, not redesign.
4. Require Cursor to preserve:
   - locked page set
   - locked CTA family
   - locked case/export mapping
   - locked navigation
   - claims/trust guardrails
5. Let Cursor generate the first full implementation pass.
6. Review the result before accepting additional redesign suggestions.

## During-run guardrails
Do not allow Cursor to:
- add Phase 2/3 pages
- add extra homepage sections
- invent new case mappings
- invent new export variants
- introduce unsupported claims
- drift into generic medical-marketing language
- turn Contact / Institutional into a sales page

## Post-run review checklist
After Cursor generates the site, verify:

- five pages exist
- section order matches the blueprints
- CTA family is consistent
- case mapping is correct
- export mapping is correct
- Trust & Evidence uses CASE-003 and clinical note example
- Contact / Institutional uses CASE-002 and clinical note example
- Homepage/About/FAQ use CASE-001 and quick summary example
- top nav matches the refined sitemap
- cross-links match the cross-linking plan
- no forbidden claims appear
- no out-of-scope pages were added

## Expected build outcome
A valid first build pass should produce:
- page templates/components for all five Phase 1 pages
- consistent nav and footer structure
- correct CTA family usage
- correct asset placement
- no Phase 2/3 additions
- a site ready for review and QA

## Final operator rule
Do not use Cursor to rethink strategy.
Use Cursor to implement the already-locked strategy.
