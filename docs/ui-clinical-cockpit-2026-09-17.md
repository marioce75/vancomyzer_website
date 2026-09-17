# Calculator workspace — clinical cockpit redesign (17 Sep 2026)

UI/UX architecture change to `/calculator`. **No change to the PK engine, API
contract, validation, warnings, targets, units or clinical terminology.** Every
number on the page still comes from the same response fields it did before.

Screenshots of the rendered result (before / after, every target viewport) are
in `docs/ui-clinical-cockpit/`. This change was rendered and inspected before
it was handed over — the previous two-column attempt (reverted in e14af36) was
not, and the collapse it described is still what `main` renders today.

## 1. Problems found in the audit

- **Live defect on `main`:** the results row is `xl:grid-cols-[1fr_auto]` with
  the PREDICTED PK panel in the `auto` track. Its unbroken Colin citation makes
  that track claim the full width, so the `1fr` SUGGESTED DOSE track collapses
  to ~60 px at 1440×900 and to **0 px at 1366×768** — the recommendation is not
  visible at the two most common workstation sizes
  (`docs/ui-clinical-cockpit/before-1440x900.png`, `before-1366x768.png`).
- The graph sat below the fold even at 1920×1080 (`before-1920x1080.png`).
- Every empiric auto-recalc keystroke unmounted the results and showed a
  400 px loading block, so the page jumped on each edit.
- Wasted vertical space: a 150 px "CLINICAL DATA INTAKE" hero card, one-open-
  at-a-time accordion toggles (60 px each), a ~250 px sticky footer (long
  disclaimer + links + copyright) that overlapped the Calculation Method
  section, a 68 px header, and a 34 px page overflow from the regulatory strip
  sitting outside the `h-screen` frame.
- Advisories (age > 65, sampling recommendation, timing, fit quality) were
  full paragraphs in rounded cards stacked above the result; teaching notes
  and the interpretation block were interleaved with primary outputs.
- Display inconsistency on the existing-regimen path: PREDICTED PK showed the
  *current* regimen's exposure (`auc24`) while the dose card showed the
  *recommended* regimen's (`predicted_auc24` / the recommended option).
- `predicted_auc24` was never passed to `DoseRecommendationCard`, so the
  below-target banner quoted the current regimen's AUC on the adjustment path.

## 2. New information architecture

```
┌ header 48px ─────────────────────────────────────────────────────────────┐
├ INPUT RAIL (296–360px) ┬ DOSING RECOMMENDATION band                       ┤
│  Patient               │  dose · interval · infusion │ AUC₂₄ + target status │ peak │ trough
│  Renal function / RRT  │  advisories (severity-coded, under the decision)  │
│  Dosing history*       ├──────────────────────────────┬────────────────────┤
│  Drug levels*          │  CONCENTRATION-TIME PROFILE  │ CANDIDATE REGIMENS │
│  disclaimer (scrolls)  │  (fills remaining height)    │ table → band+graph │
│ [Reset] [Calculate]    │                              │ PK params · Method │
│  (sticky)              │                              │ Interpretation · Note
└ regulatory strip 33px ─┴──────────────────────────────┴────────────────────┘
* existing-regimen workflows only
```

Scan order is PATIENT → RECOMMENDATION → EXPOSURE → GRAPH → ALTERNATIVES →
PK DETAILS, left to right and top to bottom, with no vertical page scroll at
any desktop size. Selecting a row in the candidate table drives the band
metrics and the graph (one active option, as before). On the existing-regimen
path the table also carries the **current regimen as entered** (the response's
top-level `auc24/peak/trough/curve`), so current vs. recommended exposure is a
one-click comparison and the band labels which one it is showing.

Secondary information is one click away, never removed: PK parameters (with
Show Math), method/assumptions/references, interpretation & limitations, and
the clinical note preview live in the side-rail tabs.

## 3. Files

Modified: `globals.css` (cockpit layout primitives, appended section),
`RegulatoryFooter.tsx`, `LevelEntryTable.tsx`, `DatePartInput.tsx`,
`scripts/check-safety-pattern.sh`, `lib/pk/recommend/buildAdjustmentRecommendation.ts`
(two JSDoc annotations only), `CalculationMethodPanel.tsx`, `CalculatorActionBar.tsx`,
`CalculatorHeader.tsx`, `CalculatorLayout.tsx`, `CalculatorWorkspace.tsx`,
`ConcentrationTimeGraph.tsx`, `DoseRecommendationCard.tsx`,
`InterpretationSummaryCard.tsx`, `LimitationsCard.tsx`,
`PatientCharacteristicsForm.tsx`, `PrimaryMetricsCard.tsx`, `RegimenForm.tsx`.

New: `Advisory.tsx`, `InputSection.tsx`, `RegimenComparisonTable.tsx`,
`ResultDetailTabs.tsx`.

No longer rendered by the workspace (files kept, unused): `ClinicalSignalStrip`,
`ResultScopeBanner`, `CalculatorLoadingState`, `CalculatorResultState` — their
content moved into the advisory stack / band footer / band header.

## 4. Major layout decisions

- **CSS Grid for the workspace, Flexbox inside components.** `.vz-shell` is
  `grid-template-columns: var(--vz-rail-w) minmax(0,1fr)`; `.vz-results` at
  ≥1280 px is a two-column grid with named areas `band / graph / side`. Every
  track that holds text is `minmax(0, …)`, which is what prevents the
  `1fr_auto` collapse from recurring.
- **Viewport-locked frame.** `.vz-app` is `calc(100dvh − var(--vz-footer-h))`
  from 1024 px up; the regulatory strip gets a fixed height (33 px one line at
  ≥1280, 49 px two lines at 1024–1279) so the page never overflows.
- **Graph fills its panel.** `ConcentrationTimeGraph` gained a `fill` prop;
  the canvas is `flex: 1 1 auto; min-height: 220px`. The draw loop already
  reads `clientWidth/clientHeight` every frame, so nothing in the plotting
  changed. Below 1280 px the canvas is `clamp(240px, 38vh, 320px)`.
- **Results stay mounted during recalculation.** `displayResult` falls back to
  the last result while inputs are stale or a request is in flight; the band,
  graph and side rail are blurred (6 px), 35 % opacity, `pointer-events: none`,
  `aria-hidden`, under an explicit "Inputs changed — recalculating…" /
  "press Calculate" overlay. Export/Copy are disabled while obscured. Stale
  numbers are not readable and nothing shifts.
- **Advisories are rows, not cards.** Severity is carried by border weight,
  a glyph and a visually hidden label (never colour alone); long guidance
  (age > 65, sampling timing, review status) sits behind a native
  `<details>` so the headline stays one line.
- **Input rail:** sections are always open (`InputSection`), 34 px inputs in
  two-column rows, RRT is a segmented control on the renal row, Calculation
  Method moved to the Method tab (it is output metadata). The long disclaimer
  scrolls with the rail; only Reset/Calculate are sticky.
- **Brand untouched.** Same `--color-*` tokens, navy header, `#2b6cb0`
  primary, Inter/JetBrains Mono, amber/red/emerald semantic colours, graph
  palette.

## 5. Responsive behaviour

| Width        | Layout                                                                 |
|--------------|------------------------------------------------------------------------|
| ≥1280 (xl)   | Rail + band + graph (fills) + side rail; no page scroll; single screen at 1920×1080 |
| 1024–1279    | Rail + stacked workspace (band, graph 38 vh, candidates, tabs) scrolling internally |
| 640–1023     | One column: Patient → Recommendation → Graph → Candidates → Details; brand/nav condensed |
| <640         | Same flow; band metrics 2+1 grid, advisory actions wrap under the text, "VZ" brand, settings gear in the compact header |

Checked for horizontal overflow at 390, 640, 768, 820, 1024, 1280 — none.

## 6. Clinical-risk items — resolved in the follow-up pass

- **Recommendation vs. the candidate display rule.** The engine's
  `is_recommended` option is always listed and always headlines the band. When
  it falls outside the list's rule (dose ≥ 500 mg, AUC₂₄ ≤ 600) it is no longer
  silently replaced by the first alternative (the old card behaviour): the row
  carries a "review" chip and a caution advisory under the band states the
  regimen, its AUC₂₄ and which bound it crosses, and asks for protocol review.
- **Pulse-dose graph/label agreement.** The engine's top-level pulse curve is
  the loading dose *continued at the entered dose and interval* (not a
  single-dose profile) and every candidate's curve is loading → that
  maintenance. The recommended candidate stays the default (as before) and the
  label now says so ("Graph shows the loading dose followed by the selected
  maintenance regimen"); the continuation of the entered regimen is an explicit
  table row labelled "continued as entered" with the band kicker "LOADING DOSE
  CONTINUED AS ENTERED". Exposure metrics follow one rule on every path
  (active option, else the response's top-level values).
- **`predicted_auc24`** is passed to the card (below-target banner on the
  adjustment path quotes the recommended regimen's AUC).
- **`scripts/check-safety-pattern.sh`** aborted on an empty `grep` under
  `set -o pipefail` before it could report anything (exit 1 on a clean tree).
  It now also recognises `const NAME = (` arrow declarations, and once running
  it found two un-annotated dose-emitting closures in
  `buildAdjustmentRecommendation.ts` (`gridRecommendation`, `lastResort`).
  Both return only through `finalizeRecommendation` (directly, or via the
  already-annotated `conservativeSameIntervalDose`); they now carry
  `@safety-checked-via: finalizeRecommendation`. Comments only — no logic
  change; `npm test` passes end to end.

Still unchanged: all engine calls, request/response handling, session
restore, URL pre-fill, literature-case deep links, bedbound gating, undo,
keyboard shortcut, analytics, feature gates.

## 7. Future-opportunity items — implemented

- **Estimated CrCl on the renal row.** Parsed from the engine's own
  `calculation_details.key_inputs` text ("Estimated CrCl N mL/min (method…)")
  after a fresh result; shown as context beside SCr with the method and the
  note that the dose is calculated from SCr. Nothing is computed client-side.
- **Dual-curve overlay.** `ConcentrationTimeGraph` takes `comparison_curve` /
  `comparison_label`; whenever an alternative, the current regimen or the
  continued loading dose is selected, the engine recommendation is drawn as a
  dashed reference beneath the predicted curve, with a legend entry. The y-axis
  domain includes both curves.
- **Loading-dose popover.** The configurator is a `LoadingDoseConfigurator`
  panel; the band header hosts a "Loading dose ▾" popover (Escape / outside
  click closes, `aria-expanded`/`aria-controls`), so the band no longer carries
  the inline expander. Same arithmetic.
- **Persisted tab and zoom.** Detail tab (`vancomyzer_detail_tab`) and graph
  window (`vancomyzer_graph_zoom`) are kept in `sessionStorage`, so a
  recalculation keeps the clinician's view.
- **"Use as draft"** under the candidate table (existing-regimen path) copies
  the selected candidate into the dosing-history draft.
- **`LevelEntryTable` / `DatePartInput`** moved to the rail's light surface
  (34 px inputs, neutral borders), finishing the visual unification.

## 8. Verification

`tsc --noEmit` clean · `next lint` (pre-existing warnings only) ·
`npm test` green end to end (pk, hmac, baa, cases, safety-pattern,
predictive, report-suite) · `next build` passes · rendered with headless
Chromium at 1920×1080, 1680×1050, 1440×900, 1366×768, 1024×768, 820×1180,
390×844 in empty, calculated (empiric and 1-level), alternative-selected,
current-regimen, stale, error, empiric-blocked, pulse-dose, loading-dose
configurator and RRT states.
