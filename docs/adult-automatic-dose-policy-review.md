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

## Actual local application integration — 2026-10-14

Ran the unchanged Next.js app on loopback port 8767 with a clean environment, no credential files, no session and its existing default open-access policy. No permission setting was changed. Eight real HTTP checks through middleware and `/api/calculate` passed: eligible pulse recommendation and candidate bounds; high-clearance initial no-suitable-regimen state; retained 250 mg multi-dose history and measured level; RRT rejection; missing-level rejection; low-clearance blocked pulse with only its recorded loading curve and monotonic post-infusion decay; anonymous history rejection; and forged identity-header history rejection. No local users database was created. Account-bound history remains protected (401). Responses include the route-generated input digest/model snapshot.

Re-ran report verification (18/18), selected-regimen report labels (5 options), exposure horizon (56), and adult policy (92 grid cases plus safety/UI/export assertions); all passed. Synthetic requests, responses and reproducible HTTP check script are retained outside the repository in the task's `integration-evidence` directory. No new application code was required.

Remaining release-verification blocker: the real browser app presents the healthcare-professional attestation and legal agreement before mounting CalculatorWorkspace. Human completion was requested; it has not been completed. The agent did not accept or fabricate acceptance. Thus the actual browser form → HTTP response → export-button flow remains untested, and no saved PDF from that flow has been verified. Earlier component-harness screenshots and print-report inspections are not full application integration. Signed-in paid-tier persistence is also untested because no test credentials were created or used. Release readiness is conditional on completing the real UI and saved-PDF checks; this is not a full integration pass.

## Completed browser-to-PDF verification — 2026-10-14

The preceding legal-gate blocker was resolved by the human user. Confirmed the actual browser gate was cleared before continuing; no credential or agreement was entered by the agent. Exercised the real Next.js calculator form and backend with synthetic inputs, selected a maintenance alternative, and used its Export PDF button plus Chrome Save as PDF. Saved and reopened two-page eligible and blocked PDFs; extracted-text assertions and visual inspection of all four pages passed. The real UI primary was 750 mg q24h (AUC24 588.8); the selected/exported alternative was 1250 mg q48h (AUC24 490.7, peak 46.9, trough 11.2, infusion 125 minutes). The blocked single-dose view had no automatic candidates and only its recorded-dose decay curve; its saved report explicitly withheld maintenance recommendation. PDFs do not embed the interactive graph; the graph was verified in the calculator separately.

This test exposed a remaining single-dose wording problem: the hidden q12h input placeholder appeared as an established current regimen or interval change in report prose. The bounded correction labels the recorded single dose in blocked interpretation and key inputs, omits maintenance-interval change comparisons for pulse notes, and suppresses a sparse-data interval-extension sentence in pulse cases. No PK, recommendation, interval or history-permission logic changed. Added pulse text regressions; independent review confirmed no blocking issue.

After correction: eight real HTTP checks, adult policy suite (92 grid cases plus assertions), report suite (18/18 and five selected-regimen cases), TypeScript, and independent review passed. Final saved evidence is `integration-evidence/eligible-alternative-verified.pdf` and `integration-evidence/blocked-single-dose-verified.pdf` in the task workspace; earlier PDFs are pre-correction diagnostic evidence. The eligible and blocked browser-to-backend-to-saved-PDF verification gap is closed. Signed-in paid-tier history persistence and production deployment remain untested; anonymous/forged-header history access remains rejected. Ready for bounded release review, not release authorization.

## Local follow-up to PR #37 review (2026-10-14, not published)

Base: released `cba1ed74d3a0b08ba44aa616454bcf34851f00f9`. Branch: `review/adult-policy-qa-followup`. Mario clarified that 500 mg remains eligible: omit 250 mg recommendations, preserve all other eligible alternatives, including 500, 750 and 1,250 mg. No dosing/model calculations or candidate-generation rules changed in this follow-up.

All four Copilot findings from review `5512605410` were verified:

- **Current/history row unreachable (moderate presentation defect):** the workspace hid the entire comparison table whenever an adjustment block existed. The inner table already preserved 250 mg history, but that code was never rendered for review-needed results. A shared rendering boundary now displays only the recorded reference row for `adjustment_dosing_blocked.review_required`, with no automatic options or Apply action. The no-candidate explanation remains. Existing hard hold/refusal and empiric blocks still suppress the table. This does not delete or alter administered-dose inputs.
- **Teaching paragraph untranslated (localization defect):** the new complete 500–2000 mg / 250 mg increment paragraph had no exact source key, so Spanish, French and Brazilian Portuguese fell back to English. Added exact translations preserving all numeric tokens and product-policy wording.
- **Current PDF heading untranslated (localization defect):** `Current regimen (as entered)` lacked an exact key; only the longer heading existed. Added the short key in all three languages and tested generated report HTML.
- **Inventory stale (audit defect):** released messages contained 3,308 entries while coverage reported 3,291. Regeneration now reports 3,310 entries, including the two new keys, and zero missing translations for bound literals. Counts are inventory, not a claim of exhaustive localization. Added a catalog/inventory-count regression.

Verification completed locally: 46 localization tests; adult policy suite (92 grid/body-size cases plus interval/sparse/history/rounding/graph/export assertions); full PK suite; report suite (18/18 required plus five selected-option cases); TypeScript; lint (existing warnings only); production build; eight real loopback HTTP checks through middleware/API. The eligible HTTP case explicitly retains 500, 750 and 1,250 mg options and excludes 250 mg recommendations. Mixed table input containing 250/500/750/1250 retains three eligible recommendations plus the separate 250 mg history row. Engine no-suitable cases remain review-needed with no automatic alternatives. Eligible alternatives retain their own graph curves and selected report values.

Independent code/methods review found no implementation blockers. A reviewer-requested improvement tests blocked rendering with a non-null preselected option and Apply callback. Focused tests were rerun successfully afterward.

Pending visual QA while the Mac is locked: click/keyboard selection of the restored history row; confirm graph and report stay bound to history and review-needed status; inspect the new teaching paragraph and current-regimen report heading in ES/FR/PT-BR at desktop/mobile and in printed PDFs. Existing live-release screenshots do not verify this new local rendering boundary. No follow-up push, PR, merge, deployment, or review-thread resolution performed.

### Browser and print follow-up completed locally (2026-10-14)

The Mac was unlocked and the final local production build was exercised in Chrome on port 8767. The restored 250 mg recorded single-dose row responded to Enter and mouse selection, retained the review-needed state, and showed only the recorded single-dose decay curve. In the eligible case, 500 mg q18h was selected by mouse (AUC 523.4), then 1,250 mg q48h by keyboard (AUC 490.7); card/table/graph stayed aligned and the 750 mg option remained present. These are synthetic tests, not treatment advice.

The exact teaching paragraph was inspected in Spanish, French and Brazilian Portuguese on desktop and at 390×844; text wrapped without clipping or overlap. Current-regimen report headings were verified in all three native Chrome print previews. Browser QA found one additional composed-note gap: splitting the review-needed sentence at em dashes left lowercase `no automatic maintenance regimen` untranslated. Added that exact fragment in all three languages with a regression; 47 localization tests and a fresh production build passed. Coverage now contains 3,311 catalog entries.

Saved the final ES/FR/PT-BR PDFs, extracted their text, rendered and inspected all eight pages. The changed headings, review-needed wording and recorded 250 mg/exposure values are correct, without clipping or overlapping text. Separate existing limitations remain: some population-fit explanatory text still falls back to English, and the Spanish/French versions have a third page containing only the report footer under the default Chrome print settings. Those broader localization/pagination issues were not changed or represented as fully resolved by this bounded fix.

Evidence is outside Git under `integration-evidence/followup-qa/` in the task workspace: blocked-history selection, eligible 500 mg selection, three desktop/mobile teaching screenshots, final language PDFs and rendered pages. English preference, teaching mode off and normal viewport were restored. The task-scoped keep-awake assertion was used only during QA and released afterward; no password or security setting was changed. Read-only power inspection showed display sleep 30 minutes and system idle sleep disabled on AC; legacy password-delay defaults were absent, so no effective lock timeout was inferred from them. No additional release was published.

### Authorized report cleanup completed locally (2026-10-14)

The preceding report localization and pagination limitations are now resolved for the affected synthetic no-level, recorded-single-dose path in ES/FR/PT-BR. Added eight exact explanatory source keys and corrected one existing fit-quality translation. Population-only uncertainty, absence of posterior fitting, and first-dose 24-hour AUC versus steady-state exposure retain their original meanings. No clinical interpretation decision or calculation change was required. Regression tests exercise the actual calculation-to-report path and compare every numeric token with the English report.

Print-only spacing now uses 8 px section/footer margins and 1.4 line height for interpretation and clinical-note prose; font sizes and content are unchanged. A closing wrapper keeps the disclaimer and footer together. Exported all three reports again through the actual app and native Chrome Save as PDF. Each final report has two pages; extracted-text checks and visual inspection of all six rendered pages confirmed no footer-only page, clipping, overlap, or affected English fallback prose. Bibliographic source titles and existing timestamp formatting remain unchanged.

Passed: 48 localization tests, report verification (18/18 required), five selected-regimen report cases, production build/type validation, refreshed localization audit (3,319 catalog entries; zero missing bound translations), and diff whitespace checks. Independent review found no blocking localization or print-layout defect. These checks supplement the full PK, HTTP, interaction and graph verification above; this cleanup does not modify those calculations.

Final evidence: `integration-evidence/followup-qa/report-cleanup-es.pdf`, `report-cleanup-fr.pdf`, and `report-cleanup-pt.pdf`, with `clean-<locale>-<page>.png` rendered previews. Earlier PDFs remain diagnostic evidence. English preference was restored and the temporary task-scoped keep-awake process was stopped. Local follow-up is ready for review on `review/adult-policy-qa-followup`; no follow-up push, merge or deployment occurred.

### PR #38 release review correction

After publication approval, automated review identified that the child table selected history before the parent workspace did. Review-required existing-regimen results now derive current history as the effective selection before any interaction, so graph, notes, metrics and export share that selection. Eligible recommendation defaults, manual history selection, hard holds and empiric refusals remain unchanged. Regression checks cover pre-click current-regimen export; independent review found no blocker. Fresh PK, localization, report, TypeScript and production build checks passed. The actual local browser showed the checked 250 mg single-dose history row immediately after calculation; opening Export PDF reached the print tab, but the locked Mac blocked native print/content verification in this pass. Previously verified two-page localized PDFs and the unchanged print layout remain supporting evidence.
