/**
 * Prediction-error metrics for the predictive-performance harness
 * (developer-run synthetic analysis, not real patients).
 *
 * For n prediction pairs, Cpred is Vancomyzer's posterior prediction and
 * Cref is the reference it is compared with. The harness reports two
 * references separately: the synthetic observation (truth plus residual
 * error) and the noise-free truth.
 *
 *   Bias  (mg/L) = mean(Cpred − Cref)                           signed mean error
 *   rBias (%)    = mean((Cpred − Cref) / Cref) × 100            signed relative mean error
 *   RMSE  (mg/L) = sqrt(mean((Cpred − Cref)²))
 *   rRMSE (%)    = sqrt(mean(((Cpred − Cref) / Cref)²)) × 100
 *
 * Bias and precision as measures of predictive performance follow
 * Sheiner LB, Beal SL. J Pharmacokinet Biopharm. 1981;9(4):503–512.
 * A ±20% rBias acceptability threshold is a convention used by some later
 * studies (Bai et al. 2025 describe rBias within ±20% as "generally
 * considered clinically acceptable"); it was not set by Sheiner and Beal,
 * and no acceptance threshold was prespecified for this analysis.
 *
 * BAI_2025_A_POSTERIORI holds published results from a real-patient study
 * with a different cohort, sampling design and truth definition (measured
 * concentrations). They are shown on the page for context only and are not
 * numerically comparable with this synthetic analysis.
 */

export interface PredictionPair {
  /** mg/L: Vancomyzer's posterior-predicted concentration. */
  predicted: number;
  /** mg/L: the value the prediction is compared with (synthetic observation or noise-free truth). */
  reference: number;
}

export interface PerformanceMetrics {
  n: number;
  /** Signed mean error, mg/L. */
  bias_mg_l: number;
  /** Signed relative mean error, %. */
  rbias_pct: number;
  rmse_mg_l: number;
  rrmse_pct: number;
}

export function computeMetrics(pairs: PredictionPair[]): PerformanceMetrics {
  const n = pairs.length;
  if (n === 0) {
    return { n: 0, bias_mg_l: NaN, rbias_pct: NaN, rmse_mg_l: NaN, rrmse_pct: NaN };
  }
  let sum_diff = 0;
  let sum_rel = 0;
  let sum_sq = 0;
  let sum_rel_sq = 0;
  for (const { predicted, reference } of pairs) {
    const diff = predicted - reference;
    sum_diff += diff;
    sum_sq   += diff * diff;
    const rel = diff / reference;
    sum_rel    += rel;
    sum_rel_sq += rel * rel;
  }
  return {
    n,
    bias_mg_l: sum_diff / n,
    rbias_pct: (sum_rel / n) * 100,
    rmse_mg_l: Math.sqrt(sum_sq / n),
    rrmse_pct: Math.sqrt(sum_rel_sq / n) * 100,
  };
}

/** Formula text rendered on the page. Keep in sync with computeMetrics above. */
export const METRIC_DEFINITIONS = [
  { key: "bias", label: "Bias (mg/L)", formula: "mean(Cpred − Cref)", note: "Signed mean error. Negative values mean predictions were lower than the reference on average." },
  { key: "rbias", label: "rBias (%)", formula: "mean((Cpred − Cref) / Cref) × 100", note: "Signed relative mean error." },
  { key: "rmse", label: "RMSE (mg/L)", formula: "√ mean((Cpred − Cref)²)", note: "Root mean squared error." },
  { key: "rrmse", label: "rRMSE (%)", formula: "√ mean(((Cpred − Cref) / Cref)²) × 100", note: "Relative root mean squared error. Lower means less scatter." },
] as const;

export interface PublishedProgramResult {
  program: string;
  bias_mg_l: number;
  rbias_pct: number;
  rmse_mg_l: number;
  rrmse_pct: number;
}

/**
 * Bai et al. 2025, Table 3, a posteriori rows (real ICU patients).
 * Verified against the open-access full text (PMC12422620).
 */
export const BAI_2025_A_POSTERIORI: PublishedProgramResult[] = [
  { program: "SmartDose (He model)",       bias_mg_l: -1.54, rbias_pct: -8.73,  rmse_mg_l: 4.73, rrmse_pct: 37.64 },
  { program: "Pharmado (Yasuhara model)",  bias_mg_l: -1.15, rbias_pct: -6.60,  rmse_mg_l: 3.81, rrmse_pct: 27.69 },
  { program: "PrecisePK (Rodvold model)",  bias_mg_l: -2.03, rbias_pct: -16.03, rmse_mg_l: 4.48, rrmse_pct: 34.84 },
  { program: "PrecisePK (Goti model)",     bias_mg_l: -0.55, rbias_pct: 0.10,   rmse_mg_l: 3.87, rrmse_pct: 34.56 },
];

export const BAI_2025_REFERENCE = {
  rbias_pct_range: [-16.03, 0.10] as const, // PrecisePK Rodvold to PrecisePK Goti
  rrmse_pct_range: [27.69, 37.64] as const, // Pharmado Yasuhara to SmartDose He
  source: "Bai G, et al. Predictive performance of Bayesian dosing software for vancomycin in intensive care unit patients. Ther Drug Monit. 2025;47(5):594–602, Table 3 (a posteriori).",
  doi: "10.1097/FTD.0000000000001310",
  cohort:
    "Retrospective, single center (Beijing). 139 adult ICU patients with 284 measured vancomycin concentrations, mostly troughs; patients on blood purification or ECMO were excluded. Predictions were compared with measured concentrations from routine clinical dosing and monitoring.",
} as const;
