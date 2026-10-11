# Redundancy cleanup — 11 October 2026

Review-only follow-up on branch `fix/redundancy-cleanup-20261011`, based on verified remote main and production `cbf541ba17e113c7297d9053ea57268a963ddbb0` (v0.1.0). No push, PR, merge or deployment of this follow-up is authorized or performed. Unrelated untracked review artifacts are preserved.

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
- Local production-build HTTP smoke: all four locale requests returned200 with the translated closing heading and exactly one rendered full launch offer. No desktop focus required.
- Standalone React server-render semantics harness: 20 real-component cases (four languages × AUC399,400,500,600,601) passed. In-range label appears once, low/high retain full meaning, numeric title retains AUC/target, and radiogroup/radio, checked state and tabIndex remain. Harness/log in review package.
- `git diff --check` passed. `website/src/lib`, `website/src/types`, and `website/src/app/api` are byte-identical to the verified base.
- New browser screenshots and VoiceOver checks are pending: global-focus coordination messages to the Bambu/drainage tasks were rejected by automatic approval review for lack of verified destination authorization. No browser focus was taken or printer accessed. Earlier production screenshots are not represented as screenshots of this follow-up. Source/render checks do not substitute for those visual checks.

## Changed source files

- `website/src/app/(site)/page.tsx`: closing heading; remove second offer paragraph.
- `website/src/components/calculator/LevelEntryTable.tsx`: concentration label only.
- `website/src/components/calculator/RegimenComparisonTable.tsx`: suppress identical accessible suffix only.
- `website/src/localization/messages.json`: localized heading, concentration label and Portuguese typo.

This review document is the only additional tracked file. Generated legacy coverage inventories are not rewritten; current runtime localization tests and the exact changed bindings were checked.
