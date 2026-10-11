# Redundancy cleanup — 11 October 2026

Historical record of the redundancy-only follow-up on `fix/redundancy-cleanup-20261011`, based on verified remote main and production `cbf541ba17e113c7297d9053ea57268a963ddbb0` (v0.1.0). It began as a review-only change on 11 October 2026. Later that day, Mario approved publication of `ddd2996592d14e0f2012edc609f4e1763067190f`; [PR #29](https://github.com/marioce75/vancomyzer_website/pull/29) merged at 22:38:45 UTC as `91ef262ff95cb8399f606d42bae3cf0405297d5a`. Render deployment `dep-db60vtrrjlhs73b8p1r0` reached **Live**, and production version/health checks confirmed that commit. The deployed merge tree matched the approved tree exactly. Unrelated edits were preserved.

The wording tables below describe PR #29 at publication, not later free-access/contact changes. This documentation reconciliation belongs to the subsequent isolated review branch; it does not reopen, roll back or redeploy PR #29.

## Exact wording

| Location | Language | Before | After |
|---|---|---|---|
| Department plans | en | Two flat plans. Pick how many clinicians will use Vancomyzer. | Two flat plans. Pick how many clinicians will use Vancomyzer. (retained) |
| Department plans | es | Dos planes de tarifa fija. Elija cuántos profesionales clínicos utilizarán Vancomyzer. | Dos planes de tarifa fija. Elija cuántos profesionales clínicos utilizarán Vancomyzer. (retained) |
| Department plans | fr | Deux offres forfaitaires. Choisissez le nombre de cliniciens qui utiliseront Vancomyzer. | Deux offres forfaitaires. Choisissez le nombre de cliniciens qui utiliseront Vancomyzer. (retained) |
| Department plans | pt-BR | Dois planos planos. Escolha quantos clínicos usarão Vancomyzer. | Dois planos de preço fixo. Escolha quantos clínicos usarão Vancomyzer. |
| Concentration label | en | Vancomycin level concentration (mg/L) | Vancomycin concentration (mg/L) |
| Concentration label | es | Concentración de vancomicina (mg/L) | Concentración de vancomicina (mg/L) (retained) |
| Concentration label | fr | Concentration de vancomycine (mg/L) | Concentration de vancomycine (mg/L) (retained) |
| Concentration label | pt-BR | Concentração do nível de vancomicina (mg/L) | Concentração de vancomicina (mg/L) |
| Closing homepage heading | en | Open the calculator | Access and plans |
| Closing homepage heading | es | Abrir la calculadora | Acceso y planes |
| Closing homepage heading | fr | Ouvrir le calculateur | Accès et offres |
| Closing homepage heading | pt-BR | Abrir a calculadora | Acesso e planos |

## Accessible comparison status

Only the redundant `sr-only` suffix is omitted when the source short/full labels are identical. Visible text, numeric title, AUC boundaries, row filtering, roles, checked state, tab stops and keyboard handlers are unchanged. No live-region or alert code was changed.

| Language | Before, in range | After, in range | Retained below/above explanations |
|---|---|---|---|
| en | In range (In range) | In range | Low (Below target); High (Above target) |
| es | Dentro del rango (Dentro del rango) | Dentro del rango | Bajo (Por debajo del objetivo); Alto (Por encima del objetivo) |
| fr | Dans la plage (Dans la plage) | Dans la plage | Bas (En dessous de la cible); Élevé (Au-dessus de la cible) |
| pt-BR | No intervalo (No intervalo) | No intervalo | Baixo (Abaixo do alvo); Alta (Acima do alvo) |

## Repeated homepage offer

The complete launch paragraph remains in the hero. Only its second rendering in the closing pricing section is removed. The closing calculator button and hospital-plan/account links remain. Exact preserved hero copy:

- en: The core calculator is free, permanently. During our launch period, PDF export, note copy and result interpretation are free too — no account needed.
- es: La calculadora principal es gratuita de forma permanente. Durante el periodo de lanzamiento, la exportación PDF, la copia de notas y la interpretación de resultados también son gratuitas, sin necesidad de cuenta.
- fr: Le calculateur principal est gratuit sans limite de durée. Pendant la période de lancement, l’exportation PDF, la copie de notes et l’interprétation des résultats sont également gratuites, sans compte.
- pt-BR: A calculadora básica é gratuita, permanentemente. Durante o período de lançamento, a exportação em PDF, a cópia de notas e a interpretação dos resultados também são gratuitas — sem necessidade de conta.

## Intentionally retained

Clinical scope restrictions, FDA and regulatory/legal disclosures, validation limitations, model uncertainty, scientific citations, result/export cautions, units, and row-specific timing explanations are unchanged. Repeated CTAs separated by substantial content, breadcrumb/title orientation, and French reflexive “vous vous” remain. Concentration translations already concise in Spanish/French are unchanged. No clinical formula, model parameter, calculation, timing-validation behavior or defined clinical term changed.

## Verification

- Full `npm test` passed, including 19 timing regressions; localization 41/41 passed.
- Lint passed with existing warnings; research types, production build and `tsc --noEmit` passed. Packaged logs record each check.
- Local production-build HTTP smoke: all four locale requests returned 200 with the translated closing heading and exactly one rendered full launch offer. No desktop focus required.
- Standalone React server-render semantics harness: 20 real-component cases (four languages × AUC399,400,500,600,601) passed. In-range label appears once, low/high retain full meaning, numeric title retains AUC/target, and radiogroup/radio, checked state and tabIndex remain. Harness/log in review package.
- `git diff --check` passed. `website/src/lib`, `website/src/types`, and `website/src/app/api` are byte-identical to the verified base.
- Initial review stage, 11 October: cross-task foreground coordination was blocked by automatic approval review; visual work was deferred at that stage. This is historical context, not the final verification status.
- Final prepublication visual review, 11 October: four production-build homepage locales at 375×812 and 12 synthetic real-component previews (LevelEntryTable and RegimenComparisonTable at 320×740; retired Department component at 375×812). An additional French comparison view at 430 px retained intended internal table scrolling. Sixteen root-width measurements had no page-wide overflow.
- Component previews were static server-rendered source linked to built CSS, not hydrated full-app/checkout workflows. The local origin required new disclaimer acceptance, which was not accepted or bypassed; no new full local calculator session was claimed.
- Postpublication checks, 11 October: live four-language homepage headings and concentration labels, non-duplicated accessible in-range status, selected-radio semantics and input preservation passed. The existing production profile had already accepted the disclaimer. A synthetic adult case returned 1250 mg every 12 hours over 125 minutes, AUC 518.5, peak 34.4 and trough 13.2, matching the reviewed result. No real patient data or billing submission was used.
- Full VoiceOver, authenticated department checkout and physical iPhone testing remain unperformed. The earlier complete responsive matrix was not repeated after deployment. The live retired department URL redirected to pricing; catalog verification is not a live department checkout test. No printer/Bambu controls were accessed.
- Supporting confirmed Library artifacts: final visual report `libfile_63bbc5ddb54c81919e8fea22c88f65c6`; publication report `libfile_c82485a12b64819184b372d4edfd7e95`; release evidence `libfile_06d5e26a11e48191986031e202062984`.

## Changed source files

- `website/src/app/(site)/page.tsx`: closing heading; remove second offer paragraph.
- `website/src/components/calculator/LevelEntryTable.tsx`: concentration label only.
- `website/src/components/calculator/RegimenComparisonTable.tsx`: suppress identical accessible suffix only.
- `website/src/localization/messages.json`: localized heading, concentration label and Portuguese typo.

This review document is the only additional tracked file. Generated legacy coverage inventories are not rewritten; current runtime localization tests and the exact changed bindings were checked.

## Documentation review follow-up

On the subsequent isolated review branch, the stale publication/visual status and `returned 200` spacing were corrected. GitHub review threads for comments [4243553474](https://github.com/marioce75/vancomyzer_website/pull/29#discussion_r4243553474), [4243553501](https://github.com/marioce75/vancomyzer_website/pull/29#discussion_r4243553501), and [4243553511](https://github.com/marioce75/vancomyzer_website/pull/29#discussion_r4243553511) were verified unresolved. They remain unresolved until this corrected artifact is published and verified. These are documentation findings, not runtime defects.
