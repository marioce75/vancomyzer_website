# Colin 2019 reference normalization investigation

Investigated 2026-10-29. Outcome: the numerical cause is identified; an author-approved resolution of the conflicting published representations has not been established. Pediatric calculations remain disabled. No adult equation has been edited.

## Reproduction

From `website/`, run:

```sh
python3 scripts/pediatric/source-discrepancy.py
```

This standard-library script evaluates a fixed synthetic reference, not patient input. It asserts reference outputs, unit consistency, normalization equivalence and the small size of the creatinine-rounding effect. Results are saved in `source-discrepancy.json`.

Hold constant: postnatal age 35 years; PMA 35 + 40/52 years; weight 70 kg; SCr 0.83 mg/dL; all ETA values zero; study 10 and 13 indicators off. The following are our independent arithmetic results, not additional clinical observations:

| Representation or controlled change | CL, L/h |
|---|---:|
| Article Table 3, unnormalized, decline consistent with narrative | 4.102382 |
| Same table coefficients, add only reference normalization | 5.316556 |
| Official supplementary NONMEM final-iteration coefficients and normalization | 5.303352 |
| Same supplementary coefficients, remove only normalization (counterfactual) | 4.082530 |
| Chorus documented normalized coefficients | 5.316990 |
| Article, convert rounded 73.4 µmol/L using 88.4 | 4.101538 |
| Article, change only SCr-standard coefficient precision | 4.101174 |
| Article, substitute 35 for PMA (incorrect-age sensitivity test) | 4.133254 |
| Article, apply literal displayed Eq 12 sign pattern | 0.000000173 |

The last two rows are diagnostic counterfactuals and must not be used as implementation choices.

## Algebraic cause

With the table coefficients, the reference maturation factor is 0.999976701 and the reference decline factor is 0.771641863. Dividing by their product multiplies CL by **1.295968178**. This accounts for the large difference. Small coefficient changes explain why the literal supplementary final-iteration result is 5.303 rather than 5.317.

For exact equivalence, converting an unnormalized coefficient of 5.31 to the normalized parameterization requires a coefficient of **4.097322828**, not 5.31. Conversely, retaining 5.31 in the normalized form corresponds to **6.881591025** in the unnormalized form. These are algebraic conversions only, not proposed corrected model estimates.

Creatinine conversion, coefficient rounding and a 40-week age offset do not bridge the difference. Using matching units for PMA and PMA50 makes maturation in weeks versus years algebraically identical. An mg/dL input must never be passed directly as µmol/L. Study indicators are held off, so malignancy or heel-prick effects cannot explain this reference comparison. ETA=0 compares typical parameters, not posterior estimates or arithmetic means over random effects.

## Source hierarchy and external check

The [primary article](https://link.springer.com/article/10.1007/s40262-018-0727-5), [PubMed record](https://pubmed.ncbi.nlm.nih.gov/30656565/) and [institutional PDF](https://pure.strath.ac.uk/ws/portalfiles/portal/85243155/Colin_etal_CP_2018_Vancomycin_pharmacokinetics_throughout_life.pdf) give the 4.10 L/h reference. The article’s Eq 6 lacks reference-factor division. Its displayed Eq 12 has mismatched exponent signs; the decline function used in the first row follows the narrative and the supplementary sign convention.

The [official MOESM2 NONMEM output](https://media.springernature.com/original/springer-static/esm/art%3A10.1007%2Fs40262-018-0727-5/MediaObjects/40262_2018_727_MOESM2_ESM.txt) explicitly divides by Fmat_R and Fage_R. At PMA_R those ratios are one. The executable representation supports the 5.303 result, using final iteration log-CL 1.6674 and log-renal coefficient −0.43280. This is the clearest primary evidence for what that supplied control stream computes, but does not prove that it supersedes the article.

[Chorus documentation](https://vanc.app/model-library/colin-2019/) independently shows the same normalization structure, with coefficient 5.312. It is first-party evidence of Chorus’s implementation choice, not an official correction, author endorsement, or pediatric validation. No patient scenario was submitted to Chorus; only its published equations were inspected.

The local Tucuxi crosscheck is not an independently sourced model definition: `run_tucuxi.py` generates a model from Vancomyzer’s article-based equations. It is useful for solver verification, but cannot adjudicate this normalization conflict.

The [2021 external obesity evaluation by Colin and colleagues](https://pmc.ncbi.nlm.nih.gov/articles/PMC7803436/) reports NONMEM simulations but the inspected text does not provide an equation-level resolution. Its performance findings cannot decide between these two implementations without the actual model code used.

## Correction search and limits

Checked the publisher article and three supplementary links, the PubMed record, the institutional PDF, and targeted web/Firecrawl searches combining the DOI or exact title with correction, erratum and corrigendum. No correction to this article resolving normalization was found in those sources. Some search hits concerned corrections to other papers citing Colin; these were not treated as corrections to Colin. MOESM1 contains diagnostic figures and MOESM3 contains dosing tables, not an explicit reconciliation. Crossref metadata could not be retrieved with the available web tool; therefore the search is not proof that no correction exists.

## Recommendation and exact decision needed

Do not describe either variant as definitively corrected. Preserve both source identities and numerical probes. For reproducing the supplied NONMEM control stream, the normalized form is faithful; for reproducing the abstract’s reference and narrative/table calculation, the unnormalized form is faithful. These distinct goals must not be conflated.

Before selecting a deployment formulation, obtain a documented author/publisher clarification or a provenance-verified author implementation with reference outputs. Ask which normalization and CL coefficient should be paired, whether Eq 12 has a missing negative sign, and which representation generated the published validation and dosing simulations. No message has been sent. Then pin the resolved manifest, reproduce independent fixtures and separately assess pediatric scope and external validation. Admin-only access alone does not resolve scientific uncertainty.

## Outcome (2026-10-29, follow-up)

Assessed as a probable transcription conflict and taken forward as a labelled research candidate, not as a resolution; see MODEL-RESOLUTION.md. The owner has since sent the author query recommended above (no reply yet); no further contact is to be made from this work. New evidence beyond this investigation: (1) the article's two Discussion worked examples (2.55 L/h; 0.0756 L/h) reproduce only under the unnormalised Eq. 6 (2.551; 0.0758) and not under the fitted model (3.289; 0.0980); (2) Table 3 is exp() of the printed estimates of the normalised run and its η-shrinkages match that run to three figures, so Table 3 reports the normalised run; (3) the Table 4 optimised adult doses (3000 mg/day FDA; 43 mg/kg/day SmPC) reach the 400-700 target only with the fitted clearance (AUC24 566-568) and overshoot with the article value (731-734), and the Methods state those simulations used NONMEM post hoc clearances. The pediatric preview computes with the supplementary (normalised) parameterisation as a candidate pending the author's answer and shows the transcription as a sensitivity row. `source-discrepancy.py` now asserts all three findings.
