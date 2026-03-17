# Verifier Review — Existing-Regimen Full Coherence Rebuild

Date: 2026-03-16
Task: `136_existing_regimen_full_coherence_rebuild.md`
Status: Review-ready

## Review question
Did the existing-regimen rebuild materially improve internal coherence and reduce clinically misleading behavior without changing the public API/UI contract?

## Conclusion
Yes, with important retained limitations.

The current implementation is materially safer than the prior mixed-logic state because:
- AUC24, peak, trough, and curve are generated from one shared parameter set
- posterior refinement feeds that same parameter set
- recommendation logic is bounded to practical candidate regimens
- invalid repeating-regimen timing patterns are rejected instead of silently treated as valid steady-state data

## What was verified
- `website/src/lib/pk/existing/existingRegimenEngine.ts` uses posterior-derived `Ke` and `V` as the shared basis for exposure and curve generation
- the integration suite covers:
  - valid q8 case
  - valid q12 case
  - invalid `time_since_last_dose_hours > interval_hours`
  - posterior data responsiveness
  - recommendation daily-dose ceiling behavior
  - curve/AUC coherence
  - contradictory absolute-vs-relative timing
  - cross-interval multi-level timing rejection
- website production build passes after the current implementation state

## Safety assessment
### Safer than before
Yes.

Most important improvement:
- the engine no longer appears to present mutually inconsistent outputs as if they belonged to one coherent PK interpretation

Also safer:
- likely missed-dose / held-dose / cross-interval timing patterns are not granted a routine steady-state exposure interpretation
- regimen recommendations are less likely to drift into mathematically convenient but clinically awkward dosing suggestions

### Not fully safe / not complete
Still true.

This remains a bounded first-pass calculator and should not be overstated. Specifically:
- one-compartment structure may be inadequate for some real patients
- sparse-level interpretation is still limited
- no formal posterior uncertainty communication is present
- validation failure currently stops interpretation rather than offering a richer alternate workflow

## Recommendation
Accept this rebuild as a meaningful safety-and-coherence improvement for the current product stage.

Do **not** market it as equivalent to a validated commercial Bayesian platform.

## Blockers to full confidence
- no richer fallback pathway yet for non-steady-state or ambiguous timing cases
- no uncertainty bounds in output
- no external clinical validation artifact tied to this code path yet