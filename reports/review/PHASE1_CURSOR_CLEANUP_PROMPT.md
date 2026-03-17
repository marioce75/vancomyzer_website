Do a strict cleanup pass on the existing Phase 1 website implementation.

Important:
- This is a cleanup pass, not a redesign pass.
- Do not add new pages.
- Do not change the locked CTA family.
- Do not change the locked case mapping.
- Do not change the locked export mapping.
- Do not add Phase 2/3 content.

Fix only these issues:

1. Cross-page anchor-link behavior
- Review all uses of /#sample-case and /#documentation.
- If these links appear on non-home pages, make sure the behavior is intentional and user-friendly.
- Prefer clear linking behavior rather than broken or misleading same-page expectations.
- Keep the locked CTA labels unchanged.

2. Contact page CTA behavior
- The Contact / Institutional page currently uses /contact as a placeholder CTA target for actions already on the contact page.
- Replace placeholder self-links with a more sensible Phase 1 behavior.
- Keep the page evaluator-oriented and non-sales-heavy.
- Do not invent a full backend contact system.
- A Phase 1-safe solution is acceptable, such as a mailto link, an anchored section on the same page, or a clearly structured contact block.

3. Review each page against its blueprint
- Homepage
- Trust & Evidence
- FAQ
- About
- Contact / Institutional

Make sure:
- section order matches the blueprint
- CTA emphasis matches the blueprint
- asset usage matches the blueprint
- cross-links remain aligned with the Phase 1 plan

4. Preserve guardrails
- no unsupported validation claims
- no superiority claims
- no ROI/productivity/outcome claims
- keep language clinician-readable and evidence-aware

5. Keep implementation minimal
- change only what is needed for cleanup
- do not restyle the whole site
- do not refactor unnecessarily

Before editing, summarize the files you will modify and why.
After editing, summarize exactly what you changed.
