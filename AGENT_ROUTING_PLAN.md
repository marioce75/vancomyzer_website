Vancomyzer multi-agent routing plan

Main orchestrator:
- vancomyzer

Delegation map:
- PK math, Bayesian logic, AUC, clearance, equations -> agents/pk-engine
- Backend code, server.py, api.ts, endpoints -> agents/backend
- Clinical plausibility, safety review, final verification -> agents/verifier
- System/module design, boundaries, maintainability -> agents/architect
- Regression tests, scenario generation, edge-case validation -> agents/testing
- Documentation, formulas, assumptions, change logs -> agents/docs
- Copyright, licensing, trademark, claims/compliance wording, disclaimers, and regulatory-readiness review -> agents/regulatory-compliance

Operating rules:
- The orchestrator reviews all outputs before adopting any change.
- Safety-critical changes require verifier review.
- Math changes require both pk-engine and testing review.
- Structural refactors require architect review.
- Documentation is updated after any clinically relevant logic change.
- Public-facing claims, comparison language, disclaimer changes, third-party asset usage, licensing questions, and regulatory-readiness artifacts should receive regulatory-compliance review before adoption or publication.
- Regulatory-compliance review is advisory and gatekeeping support; it does not replace legal counsel or regulatory consultants.

Additional delegation map:
- Literature/forum/guideline/competitor monitoring, trend detection, clinician pain points, and external intelligence synthesis -> agents/research-intelligence
- Growth strategy, SEO, content, positioning -> agents/marketing
- Feature prioritization, roadmap, product decisions -> agents/product-strategy
- Competitor monitoring and differentiation -> agents/competitive-intel
- Landing page, onboarding, conversion optimization -> agents/customer-conversion

Additional operating rules:
- Research-intelligence is a monitoring/reporting/task-proposal lane and should not directly modify code.
- Research findings are summarized into reports/market-intel.
- Competitor-specific monitoring can also feed reports/competitive-intel.
- Product strategy reviews research and competitive reports before roadmap proposals.
- Marketing uses approved research/product outputs only.
- Conversion recommendations should be testable and tied to metrics.
