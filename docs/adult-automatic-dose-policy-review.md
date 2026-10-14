# Adult automatic maintenance dose policy review

Base: production `origin/main` verified by fetch at `cea9682cc3fb1018461f1b369dcdda85a5869f76` on 2026-10-13. Local review branch: `review/adult-auto-dose-policy`. No research-dashboard changes are included.

## Diagnosis

The existing-regimen selector admitted 250 mg in its primary and alternative grids. Pulse maintenance ranked in-target q8/q12 candidates ahead of q24, allowing a 250 mg q12 result even when a 500 mg q24 candidate had equal average AUC. Sparse scaling and heuristics could also return 250 mg. The UI only applied a 500 mg display rule, deliberately exempting the primary recommendation, so its warning did not enforce policy. A separate unchecked selector also generated the pulse comparison curve.

## Proposed behavior

- Shared automatic adult maintenance grid: 500, 750, 1000, 1250, 1500, 1750, 2000 mg. This is product policy, not a universal clinical prescribing minimum.
- Preserve 250 mg rounding increments, historical administered doses, loading calculations, measured levels and manual exposure calculations.
- Recompute candidate dose/interval/infusion/exposure; preserve the existing workflow intervals. Do not replace 250 mg with 500 mg at the same interval.
- Require the current 400–600 AUC target and existing peak, trough and institutional dose ceilings. No nearest out-of-target fallback is called a recommendation.
- Sparse-data paths remain constrained. They do not fall through to an unrestricted steady-state grid when existing drug exposure warrants refusal.
- When policy or target constraints leave no suitable candidate, show neutral pharmacy review with no automatic maintenance suggestion. Do not infer a hold/pulse action from product-policy failure.
- Generate pulse comparison curves from the finalized recommendation. Blocked results have no recommendation curve or alternatives. Shared UI, notes and print/PDF exports represent the same state; historical-dose rows remain visible.
- Colin model parameters, supported adult population and interval scopes are unchanged.

## Validation

Passed: 92 synthetic clearance/body-size/grid cases plus sparse/fallback, 250 mg history, measured-level preservation, 750/1250 increments, final exposure, comparison curve, shared UI card/table and export assertions. Synthetic CL 0.5 L/h recomputes to a supported 500 mg q48 pair at AUC 500; CL 0.2 and very high clearance can return no suitable automatic regimen. These are software tests, not treatment recommendations.

Passed: PK integration suite (including 28 existing-regimen cases), independent closed-form oracle, exposure-horizon regressions, report suite (18/18 required checks), selected-regimen reports, timing (19), localization (42), safety-pattern guard, TypeScript, and diff whitespace checks. Lint completed with five existing warnings in unrelated/pre-existing code.

One prior regression expected a below-target interval extension (approximately AUC 349). Its expectation now verifies the in-target same-interval recomputation instead. No Colin parameter/oracle fixture was changed.

Independent code/methods review found no blocking defect. Its requested test-command integration and blocked-export corrections were completed.

## Review preview and limits

`website/scripts/adult-dose-review-preview.tsx` renders production card/table components and a print report using synthetic inputs only. Run from `website` with `node --import tsx scripts/adult-dose-review-preview.tsx <output-directory>`; optionally compile the existing Tailwind CSS to `<output-directory>/preview.css`.

Interactive Chrome inspection completed on 2026-10-14 after Mac access was restored. The local harness mounted the actual CalculatorWorkspace and calculation pipeline, with only synthetic inputs and local request/auth/navigation adapters. Verified primary 750 mg q24h, selectable 1250 mg q48h alternative and changed graph, generated print/PDF report content matching the selection, blocked-result report, an empty candidate list for no suitable regimen, high-clearance initial refusal, and retained/selectable 250 mg historical dosing labeled “Current regimen (as entered)”. The generated print report was inspected; no saved PDF file was asserted. No full authenticated application server, patient database or account integration was exercised.

Visual inspection exposed one remaining blocked single-dose graph issue: its fallback curve implied repeated entered doses despite no maintenance recommendation. The bounded follow-up replaces that fallback with the recorded single-dose curve and labels it explicitly. Browser inspection confirmed decay without repeat peaks. Added regression assertions for the loading-only curve, monotonic post-infusion decay, and unchanged blocked non-pulse history. The 92-case policy suite, 56 exposure-horizon checks and TypeScript passed; independent review found no blocking issue.

Local interactive preview: `http://127.0.0.1:8766/interactive.html`. Harness and synthetic screenshots are outside the repository in the task workspace. No deployment, push or merge was performed.

The supplied screenshot was materialized and inspected privately. A reconstruction matching the cropped image reproduces the displayed dose and exposure values, but missing input digits cannot be visually verified. Those clinical inputs and the screenshot are excluded from this repository and preview.
