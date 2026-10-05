# Spanish and French localization — local review draft

Local-only implementation, 2026-10-05. Branch: `codex/spanish-french-localization`. No push, merge, publication, deployment, production change, new account or paid service. Original checkouts were left untouched; this is an isolated local clone. This document supersedes the earlier paused checkpoint.

## Implementation

English remains the default and fallback. A first-party `site-language` cookie stores only the selected language; root HTML language, navigation, page prose, form labels, accessibility attributes and descriptive metadata support English, Spanish and French. The selector waits for hydration. Client language changes preserve mounted calculator state. Unknown generated text remains verbatim rather than being guessed.

Translations are source-keyed with explicit numeric templates. Captured numeric text is inserted unchanged, without parsing or reformatting. Clinical values, units, defaults, validation rules and algorithms are unchanged. Original scientific references, author names and formula symbols remain intact. No translation service or private-data upload was used. The catalog includes shared vocabulary; an entry count is not a coverage percentage.

The privacy pages now describe the first-party language preference. This is also an English functional disclosure change and requires legal review. Legal acceptance versions were not changed. Same URLs are retained; localized URLs and hreflang are not implemented. Review cookie-aware caching and CDN behavior before release.

## Inventory and limits

Run `npm run audit:localization` to regenerate `coverage.json`; inspect `coverage-triage.json` for the static candidate classification. The scanner deliberately distinguishes bound text from unknown expressions. Its strict mode still fails while raw candidates remain, including legitimate citations and formulas. Do not describe this as complete translation coverage. Dynamic expressions include numbers, private free text, composed JSX and rare branches and require further contextual runtime review.

Existing English raster screenshots, prerecorded media were retained as source assets; their captions are translated where bound. Translate/recreate those assets with owner review before claiming a wholly localized experience. Authenticated and rare error-state browser coverage is incomplete. No authentication bypass or external form submission was performed.

## Clinical and legal review gates

Bilingual clinicians must review the glossary in `TERMINOLOGY.md`, warnings, reports, timing explanations and all clinical copy. Counsel must review terms, disclaimers, privacy, BAA language, professional attestation, liability and FDA/non-device CDS statements. US regulatory claims are not legal advice for France, Spain or other jurisdictions.

Owner review is required for these existing source claims; translations preserve them rather than inventing corrections:

- Dosys PN marketing references osmolarity despite the capability not being implemented; pilot/metadata promises need reconciliation with current product scope.
- Dosys articles include fixed 48–72-hour monitoring language, efficacy/safety assertions, US cost estimates and a derived meta-analysis chart percentage. These need clinical/editorial review.
- Vancomyzer SOC 2 “in progress Q4 2026” and sampling/accuracy statements require substantiation. Free/Pro/export and launch-period copy is inconsistent across surfaces.
- Vancomyzer FAQ says Cockcroft–Gault is advisory, while another methods page describes a fitted-clearance cap. Resolve the source explanation without changing the algorithm.
- Vancomyzer registration terms date (March 2026) differs from the embedded September 18, 2026 version. Counsel/owner must reconcile it before publication.
- “Independent reference calculation” is a developer-run check. It must not imply independent methods review, real-patient validation or regulatory clearance. Those statuses remain explicitly pending/not reviewed.

Publication needs Mario’s separate approval after review and remaining QA. No claim of clinical validation is made by this localization or its automated tests.

## Vancomyzer scope and verification

Public pages, FAQ, methods/equations, literature cases, software checks, synthetic evidence tables, calculator controls/warnings, copyable summaries and printable report presentation have bilingual drafts. Equation translation changes explanatory annotations only. Account/admin/research UI labels and 159 known API/error messages were added at the presentation layer; backend response payloads, enum values and clinical calculations are unchanged. Country labels use locale-aware display names while preserving ISO values. User-provided report fields remain verbatim and escaped.

Current inventory: 3,182 catalog entries; 1,772 static bindings; 459 dynamic bindings; zero missing translations for bound literals. There are 121 raw static candidates and 1,158 raw child expressions. See coverage-triage.json and dynamic-review.json. These are overlapping AST records, not counts of actual missing translations.

Passed: complete existing `npm test` pipeline (PK, oracle, horizon, HMAC, BAA, cases, safety-pattern, predictive, reports, study readiness/CLI and market-intelligence fixtures), 14 localization tests, TypeScript, lint and production build. Existing font, hideCalculate dependency and database-export lint warnings remain. Mock provider-error logging in the market-intelligence tests is expected. `src/lib/pk`, `src/lib/initialRegimen.ts` and `src/lib/parseClinicalNumber.ts` have no diff from base cb5ce36. Separate synthetic-output audit preserves all numeric tokens across 42 generated fields in both translations; it is not exhaustive clinical-state testing.

Browser evidence: 17 public routes × 3 languages at desktop, 11 routes × 3 at 390 px, repeated FAQ switching preserves all 11 expanded items, and language survives reload. A French/Spanish long safety badge overflow was found, fixed with wrapping, rebuilt and retested: all 33 mobile combinations have no root overflow. Large tables retain internal horizontal scrolling. Screenshots capture the translated methods/equations and software-checks pages.

NOT RUN: calculator workflow/input/result browser checks beyond the legal gate; authenticated admin/account/research operations; external email, payment, BAA or enrollment submissions. Mario’s agreement tab at http://127.0.0.1:3111/calculator remains untouched and reserved for his personal action. It runs the earlier checkpoint. Do not accept, bypass, inject storage or move its consent to another origin. After Mario confirms acceptance, coordinate testing the final revision on the same approved local origin. Latest independent public-page QA preview is http://127.0.0.1:3112.

An earlier development-mode preview had a browser JavaScript/hydration failure; production preview works and was used for the route matrices. The development-mode cause was not established. Full logs, screenshots and route matrices are in the task workspace `tooling/` and `qa/` directories.

## Completed follow-up: source-domain review and media inventory

The Dosys social-image caption and all generated card titles now have Spanish/French. The image URL carries `?lang=es` or `?lang=fr`; English URLs remain unchanged. Descriptive metadata and repeat switching update only first-party generated image URLs. Image fetches do not depend on a cookie. This does not establish localized page URLs or crawler discovery for same-URL pages.

Additional source review added presentation bindings for account/billing/team messages, invitation confirmation, countries in admin displays, security and research labels, calendar weekdays, research exclusion criteria and calculator key inputs. API/schema keys, enum values, date parsing, study rules, calculations and user-entered content are untouched. Calculation-equation annotations reuse the existing presentation-only helper. Case summary sentences and plural phrases are translated as complete phrases to preserve grammar.

Run `npm run audit:localization` then `npm run audit:localization:dynamic`. The latter combines TypeScript domains, AST structure and explicit source-reviewed dispositions. It distinguishes numeric/symbol/formula/identifier records, nested React content, original user/third-party content and translated boundaries with open string domains. A classification is not proof of full translation coverage. In particular, open domains may still fall back to English for unseen messages and require runtime/source-case review; mixed React/user-data slots require review of caller copy. Third-party/AI market-analysis prose remains verbatim; it is not silently sent to a translation service.

`media-inventory.json` lists assets, current route references and localization options. The remaining known English media are the Dosys calculator screenshot on /, /products and /vancomyzer, and the Vancomyzer homepage tutorial/poster. One older unused video is retained. Localized rerecordings/captures require matching synthetic inputs and owner review; no replacement media was invented.

Both application suites were rerun successfully during this follow-up; final localization, typecheck, lint and production builds pass after the copy changes. One TypeScript error in the research list callback was fixed before the passing checks. Existing Vancomyzer warnings remain. No clinical library diff was introduced. The new tests cover all social-card copy, image URL scoping, current synthetic key-input numerics and preservation of inserted invitation identity text. Social cards were visually inspected in Spanish/French; metadata URLs were tested through en/es/fr/en. The public case page was checked at desktop and 390 px; the legal gate and authenticated workflow limitations remain unchanged.

Final static dynamic classification:

- literal spacing/symbol invariant: 404
- React element/helper — descendant copy separately reviewed: 1
- structural JSX — descendants inventoried separately: 378
- user/source data or technical identifier — preserved: 42
- React content slot — source children reviewed separately: 39
- finite copy catalogued: 138
- source-traced numeric/price/range display: 7
- verified author/vendor/user/product identity: 3
- typed numeric/boolean presentation: 135
- explicit localization expression: 1
- formatted numeric or punctuation expression: 18
- display unit — retain source: 4
- scientific citation/formula/version identifier: 11
- published platform or test-section identity — source spelling retained: 5
- verified citation or program identity: 8
- formula invariant: 2
- recorded timestamp — existing format retained: 4
- technical audit/schema identifier — retained for traceability: 11
- source-traced user-entered content — verbatim: 9
- source-traced icon/glyph: 4
- third-party or generated analysis content — verbatim, not UI catalog copy: 29
- external source brand: 1
- source-traced numeric display: 3
- recorded date — original format retained: 3
- user/source address — verbatim: 1
- mixed React/user-data slot — preserve data, caller copy reviewed separately: 3
- CSS invariant: 3
- source-traced metric/price quantity: 2
- localized generated note — existing report adapter: 1
- source-traced citation/model/version: 3
- translated legal text passed through brand-link formatter: 2
- React metrics slot: 1
- verified scientific symbol or unit: 3
- unpublished or unused component: 3
- localized open text — runtime/source domain review: 335
