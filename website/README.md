# Vancomyzer Phase 1 Website

Phase 1 site: five pages only (Home, Trust & Evidence, FAQ, About, Contact). Built from the locked Phase 1 strategy; no extra pages or asset variants.

## Run

- `npm run dev` — development server
- `npm run build` — production build
- `npm start` — serve production build

## Pages

1. **Home** (`/`) — Hero, Why Vancomyzer, trust highlights, CASE-001 preview, quick summary preview, FAQ preview, final CTA
2. **Trust & Evidence** (`/trust-evidence`) — CASE-003, clinical note export, transparency principles, evidence-aware copy
3. **FAQ** (`/faq`) — Locked 6-item FAQ shortlist, CASE-001 and quick summary references
4. **About** (`/about`) — Mission, philosophy, intended users, CASE-001 and quick summary support links
5. **Contact / Institutional** (`/contact`) — CASE-002, clinical note export, evaluator-focused, demo-first CTAs

## Locked assets (do not change)

- **CTA family:** Explore the workflow, Review a sample case, Review a documentation-ready summary, Explore the Trust & Evidence page, Contact us / Request a workflow evaluation
- **Case mapping:** CASE-001 → Home/FAQ/About; CASE-003 → Trust & Evidence; CASE-002 → Contact
- **Export mapping:** quick summary → Home/FAQ/About; clinical note → Trust & Evidence / Contact
- **Nav:** Home, Trust & Evidence, FAQ, About, Contact

Implementation sources: `reports/implementation/` build blueprints and `reports/trust-evidence/VANCOMYZER_VALIDATION_AND_CLAIMS_GUARDRAILS.md`.
