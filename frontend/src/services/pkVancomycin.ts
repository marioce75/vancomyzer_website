// One-compartment IV infusion superposition model for vancomycin
// Units:
// - dose_mg: mg
// - interval_hours (tau): hours
// - infusion_minutes: minutes
// - CL_L_per_h (CL): L/h
// - V_L (V): L
// - Output concentration: mg/L

export interface Regimen {
  dose_mg: number;
  interval_hours: number; // tau
  infusion_minutes: number; // Tinf (min)
}

export interface PKParams extends Regimen {
  CL_L_per_h: number;
  V_L: number;
}

export interface Series {
  time_hours: number[];
  concentration_mg_L: number[];
}

export interface Summaries {
  auc_24: number | null;
  predicted_peak: number | null;
  predicted_trough: number | null;
  cmax_ss?: number | null;
  cmin_ss?: number | null;
}

function aucTrapezoid(times: number[], conc: number[], end = 24): number {
  let auc = 0;
  for (let i = 1; i < times.length; i++) {
    const t0 = times[i - 1];
    const t1 = times[i];
    if (t1 > end) break;
    auc += ((conc[i - 1] + conc[i]) / 2) * (t1 - t0);
  }
  return auc;
}

function c1Infusion(t: number, k: number, V: number, R0: number, Tinf: number): number {
  // During infusion 0 <= t <= Tinf
  if (t <= Tinf + 1e-12) {
    return (R0 / (k * V)) * (1 - Math.exp(-k * t));
  }
  // After infusion t > Tinf
  const term = (R0 / (k * V)) * (1 - Math.exp(-k * Tinf));
  return term * Math.exp(-k * (t - Tinf));
}

export function simulatePK({ dose_mg, interval_hours, infusion_minutes, CL_L_per_h, V_L }: PKParams, horizonH = 48, dt = 0.05): Series {
  const tau = Math.max(0.1, Number(interval_hours) || 12);
  const Tinf = Math.max(0.01, (Number(infusion_minutes) || 60) / 60);
  const CL = Math.max(0.01, Number(CL_L_per_h) || 4);
  const V = Math.max(0.01, Number(V_L) || 50);
  const k = CL / V; // 1/h
  const R0 = dose_mg / Tinf; // mg/h

  const time_hours: number[] = [];
  const concentration_mg_L: number[] = [];

  for (let t = 0; t <= horizonH + 1e-12; t = Number((t + dt).toFixed(10))) {
    let c = 0;
    // Sum contributions from each prior dose n where t - n*tau >= 0
    const nMax = Math.floor(t / tau);
    for (let n = 0; n <= nMax; n++) {
      const tRel = t - n * tau;
      c += c1Infusion(tRel, k, V, R0, Tinf);
    }
    time_hours.push(Number(t.toFixed(5)));
    concentration_mg_L.push(Math.max(0, c));
  }

  return { time_hours, concentration_mg_L };
}

export function summarizePK(series: Series, regimen: Regimen): Summaries {
  const { time_hours: times, concentration_mg_L: conc } = series;
  const { interval_hours: tau, infusion_minutes } = regimen;
  const Tinf = (Number(infusion_minutes) || 60) / 60;

  // AUC24
  const auc_24 = aucTrapezoid(times, conc, 24);

  // Predicted trough ~ just before next dose (tau^-)
  let predicted_trough: number | null = null;
  for (let i = times.length - 1; i >= 0; i--) {
    if (times[i] <= tau + 1e-9) {
      predicted_trough = conc[i];
      break;
    }
  }

  // Predicted peak ~ 1–2h after infusion end in first interval if available, else at end of infusion
  const targetPeakTime = Tinf + 1.5; // mid of 1–2 h window
  let predicted_peak: number | null = null;
  let bestIdx = -1;
  for (let i = 0; i < times.length; i++) {
    if (times[i] > tau + 1e-9) break;
    if (predicted_peak === null || Math.abs(times[i] - targetPeakTime) < Math.abs(times[bestIdx] - targetPeakTime)) {
      bestIdx = i;
      predicted_peak = conc[i];
    }
  }
  if (predicted_peak === null) {
    // fallback: end of infusion point
    let last = 0;
    for (let i = 0; i < times.length; i++) {
      if (times[i] <= Tinf + 1e-9) last = i; else break;
    }
    predicted_peak = conc[last] ?? null;
  }

  // Approx steady-state Cmax/Cmin from last full interval within horizon
  const lastStart = Math.max(0, Math.floor((times[times.length - 1] - 1e-9) / tau) * tau - tau);
  let cmax_ss: number | null = null;
  let cmin_ss: number | null = null;
  for (let i = 0; i < times.length; i++) {
    if (times[i] >= lastStart - 1e-9 && times[i] <= lastStart + tau + 1e-9) {
      const v = conc[i];
      cmax_ss = cmax_ss === null ? v : Math.max(cmax_ss, v);
      cmin_ss = cmin_ss === null ? v : Math.min(cmin_ss, v);
    }
  }

  return { auc_24, predicted_peak, predicted_trough, cmax_ss, cmin_ss };
}

// Heuristics for fallback when CL/V unknown
export function estimateCL_V_fromPatient(patient: any): { CL_L_per_h: number; V_L: number } {
  const weight = Number(patient?.weight_kg) || Number(patient?.tbw_kg) || 70;
  const clcr = Number(patient?.creatinine_clearance) || Number(patient?.clcr) || Number(patient?.estimated_crcl) || 70; // mL/min
  // Vancomycin CL ≈ 0.75 * CLcr (L/h), with unit conversion mL/min -> L/h is *0.06
  const CL_L_per_h = Math.max(1.5, 0.75 * clcr * 0.06); // ensure sensible floor
  const V_L = Math.max(10, 0.7 * weight); // 0.7 L/kg
  return { CL_L_per_h, V_L };
}

export function buildMeasuredLevels(levelMode: 'none' | 'one' | 'two', inputs: { peak?: { conc: number; after_end_h: number }; trough?: { conc: number; after_end_h?: number } }, regimen: Regimen) {
  const levels: Array<{ time_hr: number; concentration_mg_L: number; tag: 'peak' | 'trough' | 'random' }> = [];
  const Tinf = (Number(regimen?.infusion_minutes) || 60) / 60;
  if (levelMode === 'one' && inputs.peak) {
    const { conc, after_end_h } = inputs.peak;
    if (isFinite(conc) && isFinite(after_end_h)) {
      const time_hr = Tinf + after_end_h;
      levels.push({ time_hr, concentration_mg_L: conc, tag: 'random' });
    }
  } else if (levelMode === 'two') {
    if (inputs.peak) {
      const { conc, after_end_h } = inputs.peak;
      if (isFinite(conc) && isFinite(after_end_h)) {
        const time_hr = Tinf + after_end_h;
        levels.push({ time_hr, concentration_mg_L: conc, tag: 'peak' });
      }
    }
    if (inputs.trough) {
      const { conc } = inputs.trough;
      if (isFinite(conc)) {
        const time_hr = regimen.interval_hours; // just before next dose
        levels.push({ time_hr, concentration_mg_L: conc, tag: 'trough' });
      }
    }
  }
  return levels;
}

export function computeAll(patient: any, regimen: Regimen, pk?: { CL_L_per_h?: number; V_L?: number }) {
  const { CL_L_per_h, V_L } = pk?.CL_L_per_h && pk?.V_L ? { CL_L_per_h: pk.CL_L_per_h!, V_L: pk.V_L! } : estimateCL_V_fromPatient(patient);
  const series = simulatePK({ ...regimen, CL_L_per_h, V_L }, 48, 0.05);
  const summary = summarizePK(series, regimen);
  return { series, summary, CL_L_per_h, V_L };
}
