/**
 * Colin 2019 pediatric manifest — the single source of parameter values,
 * source identities and scope limits for the admin-only pediatric research
 * preview. Nothing here is imported by the adult engine (src/lib/pk), whose
 * Colin 2019 implementation (modelRegistry.ts / buildPriorParameters.ts) is
 * unchanged.
 *
 * Primary sources
 *  - Article: Colin PJ, et al. Clin Pharmacokinet. 2019;58(6):767-780.
 *    DOI 10.1007/s40262-018-0727-5 (CC BY-NC 4.0; no correction indexed by
 *    Crossref or PubMed as of 2026-10-29).
 *  - Electronic supplementary material 2 (MOESM2): NONMEM 7.3 control stream
 *    and output of the final model (run "Remove IIV_Q2", 20 Sep 2018,
 *    OFV 33837.646, MINIMIZATION SUCCESSFUL).
 *
 * Two representations of the same fit exist and they are NOT numerically
 * equivalent for clearance (docs/pediatric/MODEL-RESOLUTION.md):
 *
 *  "fitted_nonmem"          TVCL = e^θ1 · (V1/e^θ2)^0.75 · Fmat/Fmat_R · Fage/Fage_R · Fscr
 *                           (θ1 is the clearance of the reference individual,
 *                           35 y + 40 wk PMA, 70 kg, SCr = SCRstd ≈ 0.83 mg/dL.)
 *  "article_transcription"  CL   = 5.31 · (V1/42.9)^0.75 · Fmat · Fage · Fscr
 *                           (Article Eq. 6; omits the division by the reference
 *                           factors, so every clearance is 0.7698× the fitted
 *                           model's, e.g. 4.10 instead of 5.31 L/h at the
 *                           reference individual.)
 *
 * Table 3 of the article is exp() of the printed final estimates of the
 * supplementary run (5.31 = e^1.67, 42.9 = e^3.76, 61.6 = e^4.12, …) and the
 * η-shrinkages match that run exactly (29.8 / 42.7 / 47.0 %), so the fitted
 * model is the normalised one. The article's reference value 4.10 L/h, its
 * worked examples (2.55 L/h; 0.0756 L/h) and Fig. 1 were derived from Eq. 6 as
 * printed and are therefore 23 % below the fitted model. The optimised adult
 * daily dose in Table 4 (3000 mg/day → AUC24 565 with CL 5.31; 732 with
 * CL 4.10) shows the published dosing simulations used the fitted clearance.
 *
 * The preview computes with "fitted_nonmem" as a clearly labelled RESEARCH
 * CANDIDATE and reports the "article_transcription" value beside it as a
 * sensitivity row. The discrepancy is NOT treated as definitively resolved:
 * the evidence above is our reading of the published material, a message to
 * the corresponding author is outstanding (sent 2026-10-29; no reply at the
 * time of writing), and the status below must stay "candidate" until the
 * authors clarify which parameterisation produced Table 3 and Table 4.
 */

export const PEDIATRIC_MODEL_MANIFEST_VERSION = "2026-10-29.2";

export type Colin2019Formulation = "fitted_nonmem" | "article_transcription";

/** Formulation the research preview computes with. */
export const ACTIVE_FORMULATION: Colin2019Formulation = "fitted_nonmem";

/**
 * Evidential status of the active formulation. "candidate_pending_author_clarification"
 * means: chosen from the published evidence (MODEL-RESOLUTION.md), labelled as
 * such in every result, awaiting the corresponding author's answer.
 */
export const FORMULATION_STATUS = "candidate_pending_author_clarification" as const;
export const FORMULATION_STATEMENT =
  "The supplementary NONMEM control stream (reference-adult clearance 5.31 L/h, maturation and decline normalised to a 35-year-old) " +
  "is used as a research candidate. The published article's Eq. 6 omits that normalisation (4.10 L/h); which representation the authors " +
  "intend has been put to the corresponding author and is not treated as resolved. The article value is shown as a sensitivity row.";

export const COLIN_2019_SOURCES = {
  article: "https://doi.org/10.1007/s40262-018-0727-5",
  articlePubMed: "https://pubmed.ncbi.nlm.nih.gov/30656565/",
  acceptedManuscript:
    "https://strathprints.strath.ac.uk/66504/10/Colin_etal_CP_2018_Vancomycin_pharmacokinetics_throughout_life.pdf",
  supplementNonmem:
    "https://media.springernature.com/original/springer-static/esm/art%3A10.1007%2Fs40262-018-0727-5/MediaObjects/40262_2018_727_MOESM2_ESM.txt",
  supplementDosingTables:
    "https://media.springernature.com/original/springer-static/esm/art%3A10.1007%2Fs40262-018-0727-5/MediaObjects/40262_2018_727_MOESM3_ESM.pdf",
  guideline2020: "https://doi.org/10.1093/ajhp/zxaa036",
} as const;

/**
 * Final-iteration estimates (iteration 29, NPARAMETR line) of the official
 * supplementary NONMEM output. Log-scale THETA as estimated; variances for
 * OMEGA/SIGMA. These are the values the engine computes with.
 */
export const COLIN_2019_NONMEM_FINAL = {
  theta: {
    lnCLref: 1.6674, // THETA(1): ln CL (L/h) of the reference individual
    lnV1: 3.7555, // THETA(2): ln V1 (L) per 70 kg
    lnV2: 3.7343, // THETA(3): ln V2 (L) per 70 kg
    lnQ: 1.1665, // THETA(4): ln Q (L/h) per 70 kg
    lnDEG50: 4.1159, // THETA(5): ln PMA (years) at 50 % age decline
    lnMAT50: -0.11302, // THETA(6): ln PMA (years) at 50 % maturation
    lnGAM: 1.0611, // THETA(7): ln maturation Hill coefficient
    lnGAM2: 0.80677, // THETA(8): ln decline Hill coefficient (GAM2 = −e^θ8)
    lnEXPO2: -0.4328, // THETA(9): ln SCr coefficient (per mg/dL)
    heelV1: 0.31217, // THETA(10): fractional V1 reduction, heel-prick study (STDY 13)
    heelQ: 0.59679, // THETA(11): fractional Q reduction, heel-prick study (STDY 13)
    cancerCL: 0.29422, // THETA(12): fractional CL increase, haematological malignancy study (STDY 10)
  },
  /** Variances of η (diagonal OMEGA). Q has no η (fixed 0). */
  omega: { CL: 0.074619, V1: 0.071637, V2: 0.68444, Q: 0 },
  /** Y = IPRED·(1 + ε1) + ε2; variances of ε. */
  sigma: { proportionalVariance: 0.045986, additiveVariance: 1.5166 },
  /** ln SCRstd = a + b·log10(PMA_y) + c·exp(d·PMA_y), SCRstd in mg/dL. */
  scrStd: { a: -1.22839, b: 0.6719, c: 6.27017, d: -3.1094 },
  pmaReferenceYears: 35 + 40 / 52,
  objectiveFunctionValue: 33837.646,
  etaShrinkagePercent: { CL: 29.8, V1: 42.7, V2: 47.0 },
} as const;

/** Article Table 3 (rounded) and Eq. 5, used only for the sensitivity row. */
export const COLIN_2019_ARTICLE_TABLE3 = {
  thetaCL: 5.31,
  thetaV1: 42.9,
  thetaV2: 41.7,
  thetaQ: 3.22,
  pma50Weeks: 46.4,
  gamma1: 2.89,
  age50Years: 61.6,
  gamma2: 2.24,
  thetaSCr: 0.649,
  thetaStdy10: 0.294,
  thetaStdy13V1: 0.312,
  thetaStdy13Q2: 0.597,
  scrStd: { a: -1.228, b: 0.672, c: 6.27, d: -3.11 },
  iivCvPercent: { CL: 27.9, V1: 27.3, V2: 97.9 },
  residual: { proportionalCv: 0.215, additiveSdMgL: 1.23 },
} as const;

/**
 * Covariate support of the pooled dataset (article Table 1, at inclusion).
 * Used to warn or block; these are not eligibility criteria chosen by us.
 */
export const COLIN_2019_DATASET_SUPPORT = {
  pmaYearsMin: 0.45, // Lo et al. premature neonates (≈23.4 weeks)
  pmaYearsMax: 101,
  neonatalPnaDaysMin: 1,
  neonatalPnaDaysMax: 95, // Oudin et al.
  /**
   * No component study enrolled individuals with PMA strictly inside this
   * interval (article Table 1, covariates at inclusion; see DATASET-COVERAGE.md).
   * Upper end of the neonatal/infant data: Oudin et al. [21] PMA 0.52-0.88 y
   * (PNA 4-95 d); lower end of the paediatric data: van der Meer et al. [13]
   * PMA 2.58-97.8 y (weight ≥ 8.70 kg). Requests inside the open interval are
   * refused; nothing can override the refusal.
   */
  pediatricPmaGapYears: {
    from: 0.88,
    fromEvidence: "Oudin et al. [21], neonates and paediatric patients, PMA 0.52-0.88 years at inclusion",
    to: 2.58,
    toEvidence: "van der Meer et al. [13], paediatric/adult/elderly patients, PMA 2.58-97.8 years at inclusion",
  },
  /** Inclusion-time PMA range of every component dataset contributing children (Table 1). */
  pediatricDatasets: [
    { study: "Allegaert et al. [11]", n: 247, population: "premature neonates", pmaYears: [0.46, 0.71], pnaDays: [1, 27], weightKg: [0.42, 2.63] },
    { study: "de Hoog et al. [15]", n: 130, population: "premature neonates", pmaYears: [0.51, 0.84], pnaDays: [3, 27], weightKg: [0.51, 4.41] },
    { study: "Oudin et al. [21]", n: 67, population: "neonates and paediatric patients", pmaYears: [0.52, 0.88], pnaDays: [4, 95], weightKg: [0.68, 4.45] },
    { study: "Lo et al. [23]", n: 116, population: "premature Malaysian neonates", pmaYears: [0.45, 0.65], pnaDays: [1, 39], weightKg: [0.5, 2.0] },
    { study: "van der Meer et al. [13]", n: 389, population: "paediatric, adult and elderly patients (118 children/adolescents in the pooled set)", pmaYears: [2.58, 97.8], pnaDays: null, weightKg: [8.7, 160] },
  ],
  weightKgMin: 0.42,
  weightKgMax: 282,
  pediatricWeightKgMax: 160,
  scrMgDlMin: 0.15,
  scrMgDlMax: 9.75,
  individuals: 2554,
  newborns: 559,
  childrenAdolescents: 118,
  excludedByDesign: [
    "renal replacement therapy (haemodialysis, haemodiafiltration, CRRT)",
    "extracorporeal membrane oxygenation",
    "non-intravenous administration",
  ],
} as const;

/** Preview input domain (hard limits; everything outside is refused). */
export const PEDIATRIC_SCOPE = {
  postnatalAgeMaxYears: 18, // exclusive: 18 years and older use the adult calculator
  pmaWeeksMin: 23.4,
  gestationalAgeWeeksMin: 22,
  gestationalAgeWeeksMax: 44,
  /** Gestational age is required below this postnatal age (prematurity shifts PMA materially). */
  gestationalAgeRequiredBelowYears: 1,
  /** Hard floor: below the smallest documented surviving birth weight (212 g); see engine HARD_LIMITS. */
  weightKgMin: 0.2,
  /** Upper limit of the preview: a research scope limit; van der Meer is a mixed-age dataset. */
  weightKgMax: 160,
  scrMgDlMin: 0.1,
  scrMgDlMax: 10,
  umolPerMgDl: 88.4,
  doseMgMin: 1,
  doseMgMax: 4000,
  infusionMinutesMin: 15,
  infusionMinutesMax: 1440,
  intervalHoursMin: 4,
  intervalHoursMax: 48,
  concentrationMgLMin: 0.1,
  concentrationMgLMax: 200,
  maxDoses: 60,
  maxLevels: 12,
  historyMaxDays: 21,
  /** Conventional MRSA exposure target, assuming MIC 1 mg/L. */
  targetAuc24: { low: 400, high: 600 },
  /** Infusion rate ceiling used to lengthen candidate infusions (mg/min). */
  maxInfusionRateMgPerMin: 10,
  candidateDosesMgPerKg: [10, 12.5, 15, 17.5, 20],
  candidateIntervalsHours: [6, 8, 12, 24],
} as const;

/**
 * Per-session research acknowledgement. The server refuses calculations until
 * the signed-in administrator has acknowledged THIS statement version in the
 * current login session (src/lib/pediatric/acknowledgement.ts).
 */
export const PEDIATRIC_ACK_STATEMENT_VERSION = "2026-10-29.2";
export const PEDIATRIC_ACK_STATEMENT =
  "I understand that the pediatric calculator is a research preview of the Colin 2019 model on a candidate parameterisation, " +
  "that it has not been independently clinically validated, that nothing it produces may be used for patient care, " +
  "and that I will not enter identifiable patient data.";

export const PEDIATRIC_RESEARCH_NOTICE =
  "Research preview only. Not independently clinically validated and not for patient care. " +
  "Exposure targets of AUC24 400-600 mg·h/L apply to serious MRSA infection assuming MIC 1 mg/L; " +
  "pediatric efficacy evidence for this target is largely extrapolated from adults (2020 ASHP/IDSA/PIDS/SIDP consensus guideline).";
