# Vancomyzer Existing-Regimen Full Coherence Rebuild Note — 2026-03-16

## Step completed
The existing-regimen engine has been rebuilt around one shared steady-state one-compartment intermittent-infusion model so that:
- posterior parameter refinement
- AUC24
- peak
- trough
- concentration-time curve
- regimen recommendation inputs

all derive from the same parameter set and the same repeating-regimen timing assumptions.

This closes the major coherence gap where different outputs could previously be driven by partially separate calculation logic.

## Files verified as part of this rebuild
- `website/src/lib/pk/existing/existingRegimenEngine.ts`
  - uses the posterior engine output as the single parameter source for exposure and curve generation
  - computes AUC24, peak, trough, and curve from `steadyStateOneCompartment`
- `website/src/lib/pk/posterior/`
  - posterior refinement remains bounded and feeds the same parameter set into downstream calculations
- `website/src/lib/pk/recommend/`
  - recommendation logic evaluates bounded practical regimens instead of naive proportional scaling
- `website/src/lib/pk/explain/`
  - explanation content remains aligned with the bounded first-pass model framing
- `website/src/app/api/calculate/route.ts`
  - API shape preserved
- `website/src/types/calculator.ts`
  - public request/response shape preserved
- `website/src/lib/pk/__tests__/existingRegimen.integration.test.ts`
  - integration coverage exercises coherence, bounded posterior behavior, timing rejection, and recommendation guardrails

## What changed conceptually
1. **One shared PK model**
   - current-regimen outputs now come from a single structural model instead of mixed calculation pathways
2. **Posterior coherence**
   - when posterior refinement is used, it updates the parameter set that drives all downstream outputs rather than only a subset of them
3. **Recommendation coherence**
   - recommendations are constrained to practical candidate regimens and evaluated against the same fitted/current PK state
4. **Timing semantics kept explicit**
   - the repeating steady-state model is only used when the timing inputs are internally consistent with that assumption

## Verification run during this closeout step
Executed successfully in `website/`:
- `npx tsx src/lib/pk/__tests__/existingRegimen.integration.test.ts`
- `npm run build`

Observed result:
- all 8 existing-regimen integration tests passed
- Next.js production build passed

## Why this is a meaningful safety improvement
The main safety gain is not that the model became clinically complete; it did not. The gain is that the calculator is now less likely to present a false sense of precision by mixing outputs from incompatible logic. If the engine claims an AUC24, peak, trough, and curve, those values now come from one internally consistent parameterization.

## Limitations intentionally retained
- still a bounded first-pass model, not a commercial Bayesian platform
- still one-compartment
- still assumes a repeating steady-state intermittent-infusion regimen when interpreting existing-regimen levels
- no missed-dose inference, no dynamic renal-function model, and no uncertainty intervals
- invalid timing cases are rejected rather than reinterpreted with a more complex model

## Recommended next step
The next coherent upgrade step should be to add clearer user-facing limitation language for rejected or non-interpretable existing-regimen timing patterns, so the calculator explains *why* it refuses a steady-state interpretation instead of only returning a validation error.