/**
 * Sheiner–Beal predictive-performance metrics for Bayesian dosing
 * software validation. Exact formulas as defined in:
 *
 *   Sheiner LB, Beal SL. "Some suggestions for measuring predictive
 *   performance." J Pharmacokinet Biopharm. 1981;9:503–512.
 *
 * Matched to the Bai et al. 2025 table-3 reporting convention so the
 * numbers we publish are directly comparable to the SmartDose /
 * Pharmado / PrecisePK columns.
 *
 *   Bias    = mean(Cpred − Cobs)               (mg/L)
 *   rBias   = mean((Cpred − Cobs) / Cobs)      × 100 %   — accuracy
 *   RMSE    = sqrt(mean((Cpred − Cobs)^2))     (mg/L)
 *   rRMSE   = sqrt(mean(((Cpred − Cobs)/Cobs)^2)) × 100 % — precision
 *
 * Clinical acceptance threshold:
 *   |rBias|  ≤ 20 %   (Sheiner–Beal 1981; reaffirmed Bai 2025)
 *   rRMSE    — no fixed threshold; lower is better. Bai's three
 *              programs landed in 27.69 % – 37.64 % a posteriori.
 */

export interface PredictionPair {
  predicted: number; // mg/L — Vancomyzer's posterior-predicted concentration
  observed:  number; // mg/L — Goti "truth" simulated concentration at the same time
}

export interface PerformanceMetrics {
  n: number;
  bias_mg_l: number;
  rbias_pct: number;
  rmse_mg_l: number;
  rrmse_pct: number;
  /** Sheiner–Beal acceptance: clinically acceptable accuracy. */
  rbias_acceptable: boolean;
}

export function computeMetrics(pairs: PredictionPair[]): PerformanceMetrics {
  const n = pairs.length;
  if (n === 0) {
    return { n: 0, bias_mg_l: NaN, rbias_pct: NaN, rmse_mg_l: NaN, rrmse_pct: NaN, rbias_acceptable: false };
  }
  let sum_diff = 0;
  let sum_rel = 0;
  let sum_sq = 0;
  let sum_rel_sq = 0;
  for (const { predicted, observed } of pairs) {
    const diff = predicted - observed;
    sum_diff += diff;
    sum_sq   += diff * diff;
    const rel = diff / observed;
    sum_rel    += rel;
    sum_rel_sq += rel * rel;
  }
  const bias_mg_l = sum_diff / n;
  const rbias_pct = (sum_rel / n) * 100;
  const rmse_mg_l = Math.sqrt(sum_sq / n);
  const rrmse_pct = Math.sqrt(sum_rel_sq / n) * 100;
  return {
    n,
    bias_mg_l,
    rbias_pct,
    rmse_mg_l,
    rrmse_pct,
    rbias_acceptable: Math.abs(rbias_pct) <= 20,
  };
}

/** Bai 2025 a posteriori reference range, for direct comparison on the page. */
export const BAI_2025_REFERENCE = {
  rbias_pct_range: [-16.03, 0.10] as const,  // PrecisePK Rodvold to PrecisePK Goti
  rrmse_pct_range: [27.69, 37.64] as const,  // Pharmado Yasuhara to SmartDose He
  source: "Bai et al. Ther Drug Monit. 2025;47:594–602, Table 3 (a posteriori).",
};
