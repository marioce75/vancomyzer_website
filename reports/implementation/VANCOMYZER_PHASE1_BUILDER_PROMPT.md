# Vancomyzer Phase 1 Builder Prompt

Generated: 2026-03-13T00:03:50.686968Z

## Purpose
Provide a single implementation prompt that can be given to a builder agent or coding assistant to start Phase 1 website implementation.

## Builder brief

Implement the Vancomyzer Phase 1 website foundation.

Primary goals:
- create a credible, clinician-readable website
- emphasize transparency, interpretability, and workflow usability
- support demo-first exploration before stronger conversion asks
- keep all copy evidence-aware and avoid unsupported claims

## Pages to implement

1. Homepage
2. About page
3. Trust & Evidence page
4. FAQ page
5. Contact / Institutional page

## Required implementation inputs

- reports/implementation/VANCOMYZER_PHASE1_HANDOFF_PACKET.md
- reports/implementation/VANCOMYZER_PHASE1_BUILD_SEQUENCE.md
- reports/implementation/VANCOMYZER_PHASE1_ASSET_MANIFEST.md
- reports/implementation/VANCOMYZER_PHASE1_SITEMAP_AND_NAVIGATION.md
- reports/page-specs/VANCOMYZER_HOMEPAGE_IMPLEMENTATION_SPEC.md
- reports/page-specs/VANCOMYZER_TRUST_EVIDENCE_IMPLEMENTATION_SPEC.md
- reports/page-specs/VANCOMYZER_FAQ_IMPLEMENTATION_SPEC.md
- reports/page-specs/VANCOMYZER_ABOUT_IMPLEMENTATION_SPEC.md
- reports/page-specs/VANCOMYZER_CONTACT_INSTITUTIONAL_IMPLEMENTATION_SPEC.md

## Shared assets to finalize and reuse

- one final homepage headline/subheadline set
- one final CTA set reused consistently
- one primary sample case
- one primary documentation/export example
- one FAQ shortlist for preview use
- trust/claims guardrails applied across all pages

## Implementation requirements

- keep navigation simple
- keep copy clinician-readable
- keep trust-building assets visible
- use demo-first exploration patterns
- avoid unsupported superiority, ROI, or validation claims
- reuse the strongest selected assets across pages

## Suggested implementation order

1. finalize shared assets
2. implement homepage
3. implement trust & evidence page
4. implement FAQ page
5. implement about page
6. implement contact / institutional page
7. perform consistency QA pass

## Expected builder outputs

- implemented page components/templates
- page copy inserted into build-ready files
- navigation and footer links wired
- cross-links between key Phase 1 pages
- consistent CTA usage
- notes on any missing inputs or implementation blockers

## Handoff guardrails

- do not expand scope beyond Phase 1 core pages
- do not invent unsupported product claims
- do not introduce unnecessary asset variety
- preserve trust, caution, and interpretability throughout

## Copy-ready prompt

Use the Vancomyzer Phase 1 handoff packet and related page specs to implement the five core Phase 1 website pages: homepage, about, trust & evidence, FAQ, and contact/institutional. Reuse the strongest selected case, export, FAQ, and CTA assets across pages. Keep the site clinician-readable, evidence-aware, transparency-focused, and demo-first. Flag any missing inputs before making assumptions.
