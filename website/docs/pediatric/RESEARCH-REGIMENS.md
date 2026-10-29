# Pediatric research regimen comparison

## Workflow

The adult calculator defaults to a recommended candidate, offers frequency/current-regimen comparisons, and has an explicit apply action. This pediatric change brings the comparison under **Current or planned maintenance regimen**: confirm the scenario, find research regimens, compare choices with the entered regimen, and apply dose/interval/infusion explicitly. The first choice is labeled closest to the AUC midpoint, not clinically best. Apply invalidates the result; recalculation updates the full result/graph. Actual administrations, measured levels, timezone and planned start are never changed. Input changes clear results and confirmations; delayed responses cannot restore stale choices.

The existing valid manual regimen remains necessary as a comparison baseline. This does not implement the adult automatic initial-dose mode, adult dose floor/rounding, loading-dose rules, or a neonatal optimizer. The old unfiltered candidate table is replaced in the UI by this gated comparison; the legacy illustrative candidate array remains in API output for compatibility.

## Evidence and explicit software policy

Primary source: Rybak et al., 2020 consensus executive summary, recommendations 17–21 and 25: https://pmc.ncbi.nlm.nih.gov/articles/PMC7358040/ . Initial dosing for children at least 3 months old with normal renal function and serious MRSA uses 60–80 mg/kg/day divided q6–8h. The usual empiric maximum is 3600 mg/day; most children need no more than 3000 mg/day. Monitoring is required, and exposure/toxicity uncertainties remain. Neonatal schedules depend on PMA, weight and creatinine and are not interchangeable with the older-child schedule.

The software uses the existing 1-mg-rounded pediatric candidate grid (10, 12.5, 15, 17.5, 20 mg/kg per dose), retaining only q6/q8 options whose actual rounded daily amount is 60–80 mg/kg/day and at most 3600 mg/day. Existing infusion rules (at least 60 minutes, no more than 10 mg/min) remain unchanged. Rounding/preparation feasibility requires pharmacy review.

Additional research filters: point steady-state AUC24 400–600 mg·h/L and trough <15 mg/L. Ranking by proximity to 500, then lower daily dose, is an explicitly disclosed software policy, not a guideline endorsement or proof of superiority. The initial-dose envelope deliberately constrains even posterior comparisons; it is **not** a comprehensive pediatric dose-adjustment policy. Regimens outside this envelope may be clinically appropriate but are not automatically selected here. No-match returns no fallback.

The active Colin supplementary formulation is unchanged and remains unresolved pending author clarification. AUC intervals scale exactly with daily amount for the same clearance draws. They describe model parameter uncertainty at steady state only; they do not establish clinical target-attainment probability. Candidate next-24-hour forecast points use the entered history and explicit next start; they are not steady-state AUC and have no candidate-specific forecast interval. Ranking is by steady state, not the next-24-hour forecast. One-level fits remain prior-dependent.

## Refusals and limitations

Selection requires explicit serious-MRSA/MIC-1 and independently assessed normal/stable renal-function confirmations. Serum creatinine alone does not establish normal function. Selection is withheld for infants under 3 months, any input-review flag (even acknowledged), unstable function, failed/nonconverged fits, effective sample size below 200, or large standardized residuals. Existing engine refusals for the PMA dataset gap, age ≥18, RRT, ECMO, non-IV administration, invalid weight and timing remain upstream and cannot be overridden.

Neonatal, renal impairment, obesity/other flagged populations and broader posterior adjustment need a separately reviewed policy and external validation. None of the implementation, rankings or uncertainty intervals is validated for patient care. Access remains admin-only, with the existing session research acknowledgement and warnings.

## Branch and release status

Isolated branch `feature/pediatric-research-regimens`, based on `fb8455c` (the implementation merged as production `5bf4bf0`). It does **not** include the separate `53cedb7` MFA/timing/UTF-8 fixes. Their known issues remain inherited on this feature branch. **Do not release this branch alone**: approval and deliberate integration of the pending fixes, conflict review and integrated testing are required. No source authentication/database changes, adult clinical changes, credential changes or deployment were made here.

## Validation

51 focused engine/policy checks cover ranking, per-dose and daily units, independent daily-dose/clearance AUC identity, uncertainty scaling, re-applied forecasts, assumption gates, age/weight boundaries, exclusions, timing and no-match behavior. The existing independent Python/RK4 reference suite remains part of the full suite. Browser/API fixtures exercise authorization, comparison, explicit apply, preserved timestamps, invalidation and delayed responses. Tests are synthetic, not clinical validation.

Final checks: full `npm test` exit 0; production `npm run build` exit 0; 125 isolated HTTP/browser checks passed. The new browser fixture includes delayed-response invalidation. Screenshot: `research-regimens.png`. No adult PK, calculator components, authentication, database or middleware files differ from the base.
