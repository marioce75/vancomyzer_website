# Approved numeric-input fixes — local review

Mario approved the bounded parsing/validation fixes after the original localization checkpoint. Implemented locally on review/pt-br; no push, merge or deployment. No formula, pharmacokinetic model, dose target, unit conversion, clinical threshold or output formatter changed.

## Evidence and exact reproduction scope

The original findings were reproduced in local Chrome 154.0.8037.99 using source based on verified upstream main: Dōsys 40068fae6ebd012e32175a8e181ce4593cb2a5c8 and Vancomyzer 86c9ea7c9b18ae86a4d74f65034c325f63577a86. The initial pt-BR commits did not change the implicated calculator components or parser. **No numeric entry on live dosys.health or vancomyzer.com was performed.** This is reproduced existing-production-source behavior in a local browser, not actual live-production browser verification.

Original Dōsys reproduction: on the local /products/parenteral-nutrition/calculator route, load the provided synthetic example, clear Calculation weight (#pn-weight), type `1,2` character by character, then blur. The native number input became `12`, without browser badInput, in both English and pt-BR. `1,000` became `1000`; `1.000` remained `1.000`. Ordinary point decimal `1.2` remained correct. The browser discarded the comma before React received it.

Original Vancomyzer reproduction: mount the actual ClinicalNumberInput in the separate local React harness with the same unguarded props used for weight. Enter and blur `1,000`: the component emitted 1. Its existing guarded dose/creatinine configuration rejected `1,000`, `1.000` and mixed separators. Ordinary `1.2` and comma `1,2` parsed correctly. This proves the input-component behavior, not acceptance of weight 1 kg by the complete calculator; downstream weight bounds may reject that example. Ambiguous but in-range entries such as `70,000` use the same parser path. Other fields below were source-identified first and the shared behavior is now covered by component tests.

Original evidence is preserved in numeric-browser-report.json and tooling/numeric-browser-qa.cjs. That old script deliberately asserts the old behavior; use fixed-input-browser.cjs and pn-fixed-input-browser.cjs for the repaired version.

## Exact field/component scope

Dōsys, app/products/parenteral-nutrition/calculator/:

- PNCalculator.tsx: weight; amino acids, dextrose and lipid grams; aqueous/combined bag volume; bag/lipid hours; other calories and energy target; lipid percentage and labeled kcal/mL; peripheral osmolarity and policy limit. Weight-unit conversion now reads the same strict parser.
- ClinicalPanel.tsx: age, ICU day, creatinine and its lower/upper limits, urine volume/hours, laboratory age; result/lower/upper limit for sodium, potassium, magnesium, phosphorus, calcium, chloride, bicarbonate, glucose and triglycerides; sodium, potassium, magnesium, sodium acetate, potassium acetate, vitamins and trace-element doses.
- CalciumPhosphatePanel.tsx: elemental calcium and inorganic phosphate per bag.
- NumericTextInput.tsx is the shared text-entry control. lib/parseClinicalNumber.ts supplies parsing; lib/pn/clinical.ts and lib/pn/compatibility.ts change string conversion only. Quantity calculations already consume clinical.numeric. Core calculate.ts is unchanged.

Vancomyzer, website/src/:

- components/calculator/ClinicalNumberInput.tsx: universal strict grammar and inline localized error, raw-text preservation, malformed-number state distinct from optional zero.
- PatientCharacteristicsForm.tsx: age, weight, height, serum creatinine (shared control).
- RegimenForm.tsx: maintenance/loading doses, maintenance/loading infusion minutes, loading-to-maintenance hours, exact number of doses. Preset interval selection remains unchanged.
- LevelEntryTable.tsx: measured concentration and manual hours since last dose (shared control; source file itself unchanged).
- BedboundAdvisoryPanel.tsx: administered dose and infusion hours; interrupted edits invalidate the previously copied dose.
- CalculatorWorkspace.tsx: strict URL prefill parser; malformed values block requests, optional malformed timing is not silently omitted, pending result responses are invalidated after malformed edits, invalid numeric status survives session serialization.
- app/research/enter/page.tsx: age, weight, height, baseline creatinine, each dose/infusion-minutes/time, each concentration/time, serial creatinine/time and hospital length of stay. Strict parsing replaces partial parseFloat conversion; malformed fields block submission before any write.
- app/(site)/settings/page.tsx: numeric institutional AUC/trough targets, infusion/loading-dose policies, dose limits and other numeric fields from its FIELDS configuration. Values must pass input validation before Save; no setting was saved during QA.
- Nonclinical administrator filtering/billing-count inputs were not changed.

## Deliberate entry policy

- Accept one decimal point OR comma in every language, independent of the current language; preserve the exact entered text through editing, blur and language changes. Messages are translated.
- Reject mixed/repeated separators, grouping spaces, units, exponents, plus signs and trailing/incomplete characters. `1.` and `1,` remain visible but invalid until completed.
- Reject a nonzero integer of up to three significant digits followed by exactly three fractional digits: `1,000`, `1.000`, `75,500`. Do not guess whether it means grouping or a decimal.
- Remove the separator to confirm an integer; append a zero to confirm a decimal (`1.2340` means exactly 1.234). This preserves precision rather than demanding rounding. `0.001` remains unambiguous. Trusted numeric prefills receive an explicit trailing zero where needed.
- Existing field bounds and integer-count requirements remain in force. Ordinary `1.2` is unaffected; three-place point entries matching the ambiguity rule now need explicit confirmation in formerly unguarded fields.
- Malformed text cannot become a stale last-valid value, optional zero, omitted optional timing or JSON null. A restored invalid numeric field needs re-entry; the exact malformed raw text is not persisted across reloads. Valid numeric session state continues to restore normally.
- Output number formatting stays unchanged. This patch does not localize result grouping or change engine numeric values.

## Verification and limitations

Dōsys: 56 application tests and 13 locale tests passed. Vancomyzer: full existing npm test chain and 30 locale/parser tests passed. Both typechecks, lints and production builds passed; Vancomyzer research typecheck passed. Existing lint warnings remain. Source inspection confirms no dosing/PK formula changes.

Browser checks passed: 156 rejection cases across shared Vancomyzer components and four locales, plus accepted decimals, raw precision, bounds, integer counts, empty/partial edits, blur, reset, locale changes, real regimen optional timing and exact-dose-count fields; 208 ambiguity cases across all 52 currently rendered synthetic PN fields/four locales, plus typed punctuation and mixed/invalid text. Parser/engine tests compare canonical point/comma inputs and initial/existing Vancomyzer and PN results. Session serialization tests preserve invalid status. Forty responsive route/viewport combinations passed on the pt-BR builds. QA uses an isolated headless profile and local synthetic data.

These are developer synthetic regression checks, not independent clinical validation. No live production form, patient record, authenticated research submission or institutional settings write was exercised. Full authenticated workflow/network-race integration and real iOS/Android keyboards still need independent release QA. Brazilian bilingual clinical/legal/editorial review of the machine-assisted translation remains pending. Portuguese narration/video and replacement raster figures are not produced; explicit English tutorial fallback is labeled English.
