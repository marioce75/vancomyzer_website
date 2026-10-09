# pt-BR implementation — local review only

Prepared in isolated local clones, both on `review/pt-br`. No source checkout was edited. No push, merge, deployment, clinical-data submission, paid narration or video generation was performed. Bambu Studio and printer control were not used.

## Baselines

Verified against upstream main with read-only `git ls-remote`:

- Dōsys: `40068fae6ebd012e32175a8e181ce4593cb2a5c8`, copied from the October 5 localization task's `dosys-es-fr` clone.
- Vancomyzer: `86c9ea7c9b18ae86a4d74f65034c325f63577a86`, copied from that task's `release-vancomyzer-tutorials` clone. This includes the licensed clean French opening.

The initially suggested `~/dosys-website`, `~/vancomyzer_website`, and September release checkout were older than the published localization. Their branches and dirty/untracked files were inspected and preserved.

## Implementation

- `Português (Brasil)` selector, `pt-BR` cookie state and root document language; pt_BR Open Graph locale, reversible descriptive metadata and country labels.
- 1,561 Dōsys catalog entries / 78 numeric templates; 3,206 Vancomyzer catalog entries / 120 numeric templates. English source keys and all existing Spanish/French catalog values are byte-identical to their baselines.
- Additional Portuguese-only homepage bindings fill 13 previously uncatalogued evidence-table and audience strings, retaining the previous behavior of other languages.
- Three Portuguese Dōsys MDX articles; original citation sections, URLs, figures, author/date and numerical values retained.
- Clinical labels, warnings, disclaimers, method prose, generated reports, dynamic numeric templates and 51 equation annotations extended to Portuguese.
- No changes to clinical libraries, number parsers/formatters, dose logic, model constants, assumptions, API payloads or calculator components. New synthetic tests exercise existing calculations and presentation.

The bulk catalog began as offline Argos en→pt 1.9 machine translation, processed on this Mac. Clinical terminology, formulas and key disclaimer/validation language were corrected in the review process. 187 explicit dictionary overrides, every unique numeric template (165), all equation annotations, the three article bodies and tutorial script received agent-authored translation/corrections. This is NOT a claim of bilingual professional review of every sentence. Machine-derived copy still needs comprehensive Brazilian Portuguese editorial, clinical and legal review. Do not release on the strength of passing automated tests alone.

## Decimal behavior — release blockers for separate approval

No localized numeric formatter or parser was introduced. Numeric captures, units and existing decimal spelling are preserved. Headless browser tests reproduced existing behavior in English and Portuguese:

| Surface | Input | Observed existing behavior |
|---|---|---|
| Vancomyzer guarded dose / creatinine input | `1,2` or `1.2` | Numeric value 1.2; blur displays `1.2` |
| Vancomyzer guarded dose input | `1,000`, `1.000`, `1,234.5`, `1.234,5` | Invalid; no usable numeric dose; warning |
| Vancomyzer unguarded weight input | `1,000` | Interpreted as 1; pre-existing ambiguous grouping risk |
| Dōsys native number field, Chrome tested | typed `1,2` | Browser drops comma and exposes `12`; same in en and pt-BR |
| Dōsys native number field, Chrome tested | typed `1,000` / `1.000` | Exposes `1000` / `1.000`; punctuation is not locale-aware |

These findings block a safe Portuguese calculator release. Fixing them requires a separately approved numeric-input change and dedicated regression review. They were not silently “fixed” or introduced by translation. See `numeric-browser-report.json` for exact cases. Safari/iOS, Android keyboards and other OS locale combinations remain untested.

## Tutorials and media

Vancomyzer's EN/es-ES/fr-FR media mappings, hashes, posters, durations and captions are unchanged. `tutorialMedia["pt-BR"]` is null. Portuguese shows an unavailable notice; only an explicit button opens the English recording, labelled as English narration and on-screen text. It never calls English audio Portuguese, never autoplays as a language fallback, and does not show a false Portuguese duration.

`website/docs/localization/pt-BR/tutorial-script.json` contains Portuguese translations of 23 source segments. `tutorial-captions.draft.vtt` uses English source cue times for review only; it is outside public assets and is not attached to a player. Portuguese narration/video approval, recording, timing alignment, caption review, media QA and release approval are still required. No credits were spent on media.

Dōsys has no local narrated tutorial to replace; its Vancomyzer links and existing English raster screenshots are retained. A fully localized media experience requires reviewed Portuguese replacement images and a tutorial asset.

## Verification

- Both production builds passed. Dōsys used its supported webpack build (`npm run build -- --webpack`) with existing dependencies; Vancomyzer used `npm run build`.
- Both TypeScript checks passed; Vancomyzer research typecheck passed.
- Both lints passed; Vancomyzer retains existing warnings.
- Existing Dōsys application suite: 50 passed. Existing full Vancomyzer `npm test` chain passed (PK initial/existing, oracle, horizon, HMAC, BAA, published cases, safety patterns, predictive, reports, study/research and market-intelligence fixtures).
- Extended locale suites: 13/13 Dōsys and 23/23 Vancomyzer passed. They cover all catalogs, numbers, templates, formulas, reports, public case/FAQ content, articles, social cards, locale parsing/reversal, generated text, input-key preservation, invitation identity preservation and media hashes.
- New synthetic calculations compare initial, one-level and two-level Vancomyzer outputs and PN results through locales without mutating input/result objects. These are DEVELOPER SYNTHETIC REGRESSION CHECKS, not independent clinical validation.
- Headless responsive QA passed all 40 route/viewport combinations (10 routes × 320/390/768/1280 px) with normal site fonts, with no JavaScript errors or horizontal overflow. A separate offline-font check found a pre-existing 7 px overflow at 768 px in Vancomyzer across all languages; no layout change was made.
- Headless browser: repeated en/es/fr/pt-BR switching, reload persistence, root lang, explicit English media fallback; desktop/mobile screenshots. No clinician agreement was accepted; authenticated billing/admin workflows remain untested.
- PN synthetic example field state survived language changes. Real input-component tests verified commas, points, ambiguous grouping, warnings and raw-state preservation. The local test harness is separate from application routing and does not bypass authentication or modify application consent gates.

The existing static/dynamic localization audits also ran. They report 36 Dōsys / 121 Vancomyzer unbound candidates and 142 / 460 dynamic boundaries. Their legacy catalog counters are not Portuguese coverage percentages; formulas, citations, unused code and open-ended generated text remain among the audit candidates. Unknown generated prose retains the English fallback and must be included in further runtime review.

Logs, JSON reports and screenshots are in this task's `qa/` directory. `changed-files.json` lists exact review files. `Review.html` links the previews and screenshots. See `TERMINOLOGY-pt-BR.md` for Brazilian primary references and scope.

## Remaining review

1. Approve and implement a separate numeric-input safety fix before Portuguese calculator release.
2. Bilingual Brazilian clinical, translation and legal review of the full catalogs, legal terms and inherited English clinical claims. Existing source limitations were not independently clinically revalidated.
3. Approve production of a Portuguese tutorial and translated raster media if required for launch.
4. Independent clinical validation remains pending. Test success does not change that status.
5. Review authenticated/rare error states, report rendering on target devices, real iOS/Android numeric keyboards and cookie-aware deployment caching before release.

No release authorization has been requested or assumed by this implementation task.
