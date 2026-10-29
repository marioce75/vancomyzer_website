# Colin 2019: assessment of the article/supplement clearance discrepancy (candidate formulation, pending author clarification)

Date: 2026-10-29 (status wording revised the same day). Scope: which formulation of the Colin 2019 vancomycin model the pediatric research preview computes with, and why. **Status: not resolved.** The evidence below is our reading of the published material; the owner has put the question to the corresponding author and no reply had been received when this was written. Until that reply arrives the supplementary formulation is a labelled research candidate, and the article transcription is carried as a sensitivity row in every result. All numbers below are reproducible with `python3 scripts/pediatric/source-discrepancy.py` and `python3 scripts/pediatric/reference-cases.py` (standard library only) from `website/`.

## 1. Sources inspected

| Source | What it contains | Where |
|---|---|---|
| Article (Clin Pharmacokinet 2019;58:767-780, DOI 10.1007/s40262-018-0727-5, CC BY-NC) | Abstract, Methods, Eqs. 1-13, Tables 1-4, Fig. 1-3, Discussion worked examples | publisher HTML (blocked by login wall for automated fetch); accepted manuscript PDF at Strathprints (20 pages, text extracted) |
| ESM MOESM2 (text) | NONMEM 7.3 control stream and full output of the final run ("Remove IIV_Q2", 20 Sep 2018, OFV 33837.646, MINIMIZATION SUCCESSFUL, 2544 individuals, 8253 observations) | Springer static media |
| ESM MOESM3 (PDF) | SmPC/FDA posologies and Tables S3-S4 (fraction of patients with AUC24 <400 / 400-700 / >700 under original and optimised doses) | Springer static media |
| ESM MOESM1 (PDF) | Diagnostic figures only; no equations | Springer static media |
| Crossref record, PubMed record (efetch XML) | No correction, erratum or retraction linked (checked 2026-10-29) | api.crossref.org, eutils |
| Colin et al. 2021, Ther Drug Monit (PMC7803436) | External evaluation in obese adults; "Simulations were conducted using NONMEM"; no equations restated | Europe PMC full text |
| Chorus (vanc.app) model page | Independent implementation using the normalised form with 5.312 | vendor documentation |

## 2. The two representations

Supplementary control stream (`$PK`), verbatim structure:

```
PMA_R = 35+(40/52)
LnSCRstd = -1.22839 + LOG10(PMA)*0.67190 + 6.27017*EXP(-3.10940*PMA)
Fmat   = PMA**GAM/(PMA**GAM+MAT50**GAM)          Fmat_R = PMA_R**GAM/(PMA_R**GAM+MAT50**GAM)
Fage   = PMA**GAM2/(PMA**GAM2+DEG50**GAM2)       Fage_R = PMA_R**GAM2/(PMA_R**GAM2+DEG50**GAM2)   (GAM2 = -EXP(THETA(8)))
Fscr   = EXP(-EXPO2*(SCR-SCRstd))
TVV1 = EXP(THETA(2)) * Fsize * (1-HEEL*THETA(10));  V1 = TVV1*EXP(ETA(2))
TVV2 = EXP(THETA(3)) * Fsize;                       V2 = TVV2*EXP(ETA(3))
TVCL = EXP(THETA(1)) * (V1/RV1)**0.75 * Fmat/Fmat_R * Fage/Fage_R * Fscr * (1+CANCER*THETA(12));  CL = TVCL*EXP(ETA(1))
TVQ  = EXP(THETA(4)) * (V2/RV2)**0.75 * (1-HEEL*THETA(11));  Q = TVQ
```

Article Eq. 6 (as printed): `CL = θCL × (V1/θV1)^0.75 × FMat × FDecline × FSCR × (1 + θSTDY10) × e^η1` — no division by reference factors. Eqs. 7-13 otherwise match the control stream (Eq. 12 is printed with an inconsistent exponent sign; the narrative "50% at 61.6 years" and the control stream agree on the decline form used here).

Final estimates (iteration 29, full precision from the output):

| θ | value | natural scale | Table 3 (article) |
|---|---|---|---|
| THETA(1) ln CL | 1.6674 | 5.298 L/h | 5.31 (= e^1.67) |
| THETA(2) ln V1 | 3.7555 | 42.76 L | 42.9 (= e^3.76) |
| THETA(3) ln V2 | 3.7343 | 41.86 L | 41.7 (= e^3.73) |
| THETA(4) ln Q | 1.1665 | 3.211 L/h | 3.22 (= e^1.17) |
| THETA(5) ln DEG50 | 4.1159 | 61.31 y | 61.6 (= e^4.12) |
| THETA(6) ln MAT50 | -0.11302 | 0.8931 y = 46.44 wk | 46.4 (= e^-0.113 × 52) |
| THETA(7) ln GAM | 1.0611 | 2.890 | 2.89 |
| THETA(8) ln GAM2 | 0.80677 | 2.241 | 2.24 |
| THETA(9) ln EXPO2 | -0.43280 | 0.6487 /(mg/dL) | 0.649 |
| THETA(10-12) | 0.31217 / 0.59679 / 0.29422 | | 0.312 / 0.597 / 0.294 |
| OMEGA | 0.074619 / 0.071637 / 0.68444 / 0 FIX | CV 27.8 / 27.2 / 99.1 % | 27.9 / 27.3 / 97.9 % |
| SIGMA | 0.045986 (prop. var) / 1.5166 (add. var) | SD 0.2145 / 1.233 mg/L | 21.5 % / 1.23 mg/L |
| η shrinkage | 29.832 / 42.674 / 47.015 % | | 29.8 / 42.7 / 47.0 % |

Every Table 3 entry is the exponential of the 3-significant-digit printed estimate of this run, and the η-shrinkages are identical to three figures. Table 3 therefore reports **this normalised run**. (The 97.9 % IIV on V2 corresponds to ω² = 0.672, the run's initial estimate, a transcription slip that does not affect the question.)

## 3. Numerical probes

Reference individual (PMA 35 + 40/52 y, 70 kg, SCr 0.83 mg/dL; SCRstd = 0.8314 mg/dL):

| Formulation | CL (L/h) |
|---|---|
| Fitted NONMEM, normalised, full-precision θ | 5.3034 |
| Article Table 3 coefficients + normalisation | 5.3166 |
| Article Eq. 6 as printed (no normalisation) | 4.1024 |
| Fmat_R × Fage_R | 0.76980 (fitted θ) / 0.77164 (Table 3 rounding) |

The article's own derived numbers reproduce **only** under the unnormalised transcription:

| Published statement | Article transcription | Fitted model |
|---|---|---|
| Abstract: reference individual CL 4.10 L/h | 4.102 | 5.303 |
| Discussion: 60 y, 65 kg, SCr 0.97 mg/dL → 2.55 L/h | 2.551 | 3.289 |
| Discussion: 32-wk PMA neonate, 1.5 kg, SCr 0.64 mg/dL → 0.0756 L/h | 0.0758 | 0.0980 |
| Abstract/Results: "maximal value 5.31 L/h/70 kg", "2.66 = 50 % of maximum" | max 5.26 | max 6.82, 50 % = 3.41 |
| Fig. 1 typical curve | peaks ≈ 5.3 | would peak ≈ 6.8 |

So the article text, abstract and Fig. 1 were produced from Eq. 6 as printed, which is 0.770× the fitted model everywhere.

The article's **dosing evaluation** was done "using the post hoc-predicted clearance for all patients" (Methods, Eq. 4), i.e. with NONMEM's individual CL from the fitted run. Table 4 confirms which clearance scale those simulations used:

| Regimen | Daily dose | AUC24 with fitted CL 5.30 | AUC24 with article CL 4.10 | Published target |
|---|---|---|---|---|
| FDA label adults, optimised | 3000 mg (from 2000) | 566 | 731 | 400-700 |
| SmPC adults eGFR ≥ 50, optimised | 43 mg/kg (3010 mg at 70 kg) | 568 | 734 | 400-700 |
| FDA label adults, original | 2000 mg | 377 (<400; Table S4: 69 % of adults <400) | 488 (in target) | — |

An optimisation targeting 400-700 could only have moved adults from 2000 to 3000 mg/day if the typical adult clearance was ≈5.3 L/h. With 4.10 L/h the original 2000 mg already sat in target and 3000 mg would overshoot. The published dosing recommendations are therefore consistent with the fitted (normalised) model and inconsistent with the transcription.

## 4. Working assessment (not a resolution)

On the published evidence this looks like a **real conflict**, not a units or convention misunderstanding: the article's Eq. 6 omits the reference normalisation that the fitted model contains, and the article's illustrative numbers (4.10, 2.55, 0.0756 L/h, Fig. 1, "5.31 = maximum") inherit that omission. The model actually estimated, and the model behind the article's Table 4 dosing recommendations and the authors' later NONMEM-based external evaluations, is the normalised control stream in which 5.31 L/h is the clearance of the reference 35-year-old and the childhood maximum is ≈6.8 L/h/70 kg.

Decision taken by the owner (2026-10-29) for the pediatric preview: compute with `fitted_nonmem` (full-precision final estimates, η-coupled compartmental allometry, published Ω and Σ) as a **clearly labelled research candidate**, display the `article_transcription` clearance and AUC as a sensitivity row in every result, record the status as `candidate_pending_author_clarification` in `src/lib/pediatric/colin2019/manifest.ts`, and do not describe the discrepancy as definitively resolved anywhere in the interface, API or documents. The owner's message to the corresponding author is outstanding; no further contact is to be made from this work.

Consequence for the existing adult engine (not changed in this work): `src/lib/pk/posterior/buildPriorParameters.ts` implements the article transcription (reference CL 4.10 L/h). Its population prior is therefore 23 % below the fitted Colin model for every adult; MAP fits to measured levels compensate partly, prior-only empiric doses do not. This is flagged for decision, not altered.

## 5. What would settle it

The authors' answer to: which parameterisation produced Table 3 and the Table 4 dosing simulations, whether Eq. 6 as printed is a transcription error, whether Eq. 12's exponent sign is a typographical error, and whether an erratum is planned. A statement that Table 3's θCL was re-estimated in an unnormalised run (which would also require their Table 4 doses to be recomputed), or a demonstration that the supplementary file is not the final model, would reverse the candidate choice; `ACTIVE_FORMULATION` is a single constant and the sensitivity row already shows the alternative.
