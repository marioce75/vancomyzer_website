# Explicit numeric clarification — final decision

The parent requested replacing the trailing-zero workaround within the approved input-safety scope. This follow-up does so without changing pharmacokinetic/dosing formulas or clinical limits. No new clinical terms were accepted; no production research/settings data was changed; no release occurred.

## User-facing behavior

Typing `1.234` or `1,234` leaves the raw entry visible and the field invalid until a choice is made. The UI says:

- English: “This number is ambiguous. Choose the intended value below before continuing.”
- pt-BR: “Este número é ambíguo. Selecione abaixo o valor pretendido antes de continuar.”

Two unselected buttons show the explicit alternatives:

- English: **Decimal value: 1.234** / **Whole-number value: 1234**.
- pt-BR: **Valor decimal: 1,234** / **Valor inteiro: 1234**.

For `1.000`, these are decimal 1 and whole number 1000. Clicking or keyboard-activating a choice confirms that exact value. The original raw entry stays `1.000`; the interface does not append digits or ask the user to do so. “Confirmed value” / “Valor confirmado” and the pressed button identify the current interpretation. The user can change the choice. Any subsequent text edit clears it and blocks the field again when still ambiguous. Language switching preserves raw text, interpretation and canonical numeric value; only labels and the choice's decimal display change.

Three-decimal clinical values are therefore usable at their original precision. The calculator stores numeric values, not a separate significant-figures model, as before. Ordinary unambiguous point/comma decimals continue to work. `0.001` remains unambiguous. Mixed/repeated separators, grouping spaces, units, exponents and incomplete text stay invalid and do not receive a choice control. Grouping is never silently accepted; only the explicit whole-number choice converts the specific ambiguous entry. Existing field limits still apply after selection.

## Bounded implementation

The new NumberClarification component sits alongside the existing input. This is an in-place decision, not a modal, new workflow or inference based on locale. It introduces no network action.

Vancomyzer's number-valued ClinicalNumberInput tracks raw text and an explicit interpretation independently of its numeric parent state. Unresolved values still propagate invalid numeric state, block requests and invalidate pending results. Optional values and session serialization cannot turn malformed input into a usable zero/null. Restored canonical numeric values are trusted prefills; restoring an unresolved field still requires re-entry.

Dōsys PN and Vancomyzer research forms already use string-valued state. Their NumericTextInput now owns the raw text and emits only a canonical decimal string, empty string or invalid sentinel through onValueChange. The form's existing calculation boundaries read that canonical state with parseCanonicalClinicalNumber. This parser is not used for raw keyboard/paste/URL input. Raw input still passes through strict parseClinicalNumber, with ambiguity unresolved until the explicit choice. This distinction avoids both reinterpreting a confirmed decimal and adding fake precision to get past validation.

No formula, PK assumption, dose target, numeric unit conversion or output formatter changed. The exact modified-file inventory is changed-files.json. The original source-reproduction details and affected fields remain in NUMERIC-REVIEW.md.

## Verification

- Dōsys: 61 application tests, 13 locale tests; Vancomyzer: full application suite and 35 locale/parser tests passed.
- Both TypeScript checks, lints and production builds passed; Vancomyzer research typecheck passed. Existing lint warnings remain.
- Explicit-choice tests cover decimal/whole interpretations of point/comma forms, no default choice, untouched raw text, keyboard selection, language changes, choice invalidation after editing, field bounds, trusted numeric prefills and rejecting mixed/malformed input even with a choice argument.
- Canonical confirmed three-decimal inputs produce the same PN and initial/existing Vancomyzer engine results as direct numeric fixtures.
- Browser clarification tests passed 64 combinations on actual shared Vancomyzer components and 208 field/locale combinations on the 52 rendered PN synthetic inputs. Both choices, editing invalidation, locale persistence and weight-unit conversion passed. Clarification controls fit 320/390/768/1280 px layouts. Broader invalid-entry/blur/reset regression checks and the 40-route/viewport pt-BR page QA also run on these builds.

These are local developer synthetic checks, not independent clinical validation. The original defects were reproduced locally from verified upstream source, not observed through input on live production sites. Authenticated end-to-end research/settings writes, full-route network-race tests, real iOS/Android keyboards and independent Brazilian clinical/legal/editorial review remain pending. No new Portuguese voice/video was commissioned. Release remains on hold.
