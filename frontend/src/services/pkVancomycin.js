// One-compartment IV infusion superposition model for vancomycin
// Units: dose mg, time h, concentration mg/L, CL L/h, V L

export function simulateConcentrationCurve({
  dose_mg,           // e.g., 1000
  interval_hours,    // tau, e.g., 12
  infusion_minutes,  // e.g., 60
  CL_L_per_h,        // clearance (L/h)
  V_L,               // volume of distribution (L)
  horizon_h = 48,
  dt_h = 0.05,
  doses_to_simulate = 8 // enough to show accumulation
}) {
  const Tinf = Math.max(0.25, (infusion_minutes || 60) / 60); // hours
  const R0 = dose_mg / Tinf; // mg/h
  const k = CL_L_per_h / V_L; // 1/h
  const times = [];
  const conc = [];
  const nSteps = Math.round(horizon_h / dt_h);
  // Dose times at 0, tau, 2*tau, ...
  const tau = interval_hours;
  const doseTimes = Array.from({ length: doses_to_simulate }, (_, i) => i * tau).filter(t => t <= horizon_h + Tinf);

  for (let i = 0; i <= nSteps; i++) {
    const t = i * dt_h;
    let c = 0;
    for (const tDose of doseTimes) {
      const td = t - tDose;
      if (td < 0) continue;
      if (td <= Tinf) {
        // during infusion
        c += (R0 / (k * V_L)) * (1 - Math.exp(-k * td));
      } else {
        // after infusion
        c += (R0 / (k * V_L)) * (1 - Math.exp(-k * Tinf)) * Math.exp(-k * (td - Tinf));
      }
    }
    times.push(t);
    conc.push(c);
  }
  return { times, conc, doseTimes, Tinf, k };
}

// Trapezoidal AUC between t0 and t1 (h)
export function aucTrapezoid(times, conc, t0 = 0, t1 = 24) {
  let auc = 0;
  for (let i = 1; i < times.length; i++) {
    const a = times[i - 1], b = times[i];
    if (b <= t0) continue;
    if (a >= t1) break;
    const clampedA = Math.max(a, t0);
    const clampedB = Math.min(b, t1);
    const ya = interpConc(times, conc, clampedA);
    const yb = interpConc(times, conc, clampedB);
    auc += 0.5 * (yb + ya) * (clampedB - clampedA);
  }
  return auc;
}

function interpConc(times, conc, t) {
  // linear interpolation
  let lo = 0, hi = times.length - 1;
  while (hi - lo > 1) {
    const mid = (hi + lo) >> 1;
    if (times[mid] < t) lo = mid; else hi = mid;
  }
  const t0 = times[lo], t1 = times[hi];
  const y0 = conc[lo], y1 = conc[hi];
  if (t1 === t0) return y0;
  const f = (t - t0) / (t1 - t0);
  return y0 + f * (y1 - y0);
}

// Simple summaries from a simulated curve
export function summarizePK({ times, conc, doseTimes, Tinf, k, interval_hours, dose_mg, CL_L_per_h }) {
  // peak near end of infusion of first interval
  const tPeak = Math.min(Tinf + 1, interval_hours); // ~1h post-inf end
  const predicted_peak = interpConc(times, conc, tPeak);
  const tTrough = Math.max(interval_hours - 0.01, 0); // just before next dose
  const predicted_trough = interpConc(times, conc, tTrough);
  const auc_24 = aucTrapezoid(times, conc, 0, 24);
  const daily_dose_mg = (24 / interval_hours) * dose_mg;
  return { predicted_peak, predicted_trough, auc_24, daily_dose_mg };
}

// Helper to estimate CL & V if backend doesn’t return them (very rough fallback)
export function estimateCL_V_fromPatient(patient) {
  const weight = Number(patient?.weight_kg) || Number(patient?.tbw_kg) || 70;
  const clcr = Number(patient?.creatinine_clearance) || Number(patient?.clcr) || Number(patient?.estimated_crcl) || 70; // mL/min
  // Vancomycin CL ≈ 0.75 * CLcr (L/h), with unit conversion mL/min -> L/h is *0.06
  const CL_L_per_h = Math.max(1.5, 0.75 * clcr * 0.06); // ensure sensible floor
  const V_L = Math.max(10, 0.7 * weight); // 0.7 L/kg
  return { CL_L_per_h, V_L };
}

// Build measured levels payload given UI inputs
export function buildMeasuredLevels(levelMode, inputs, regimen) {
  const levels = [];
  const Tinf = (Number(regimen?.infusion_minutes) || 60) / 60;
  if (levelMode === 'one' && inputs?.peak) {
    const { conc, after_end_h } = inputs.peak;
    if (isFinite(conc) && isFinite(after_end_h)) {
      const time_hr = Tinf + after_end_h;
      levels.push({ time_hr, concentration_mg_L: Number(conc), tag: 'random' });
    }
  } else if (levelMode === 'two') {
    if (inputs?.peak) {
      const { conc, after_end_h } = inputs.peak;
      if (isFinite(conc) && isFinite(after_end_h)) {
        const time_hr = Tinf + after_end_h;
        levels.push({ time_hr, concentration_mg_L: Number(conc), tag: 'peak' });
      }
    }
    if (inputs?.trough) {
      const { conc } = inputs.trough;
      if (isFinite(conc)) {
        const time_hr = Number(regimen?.interval_hours) || 12; // just before next dose
        levels.push({ time_hr, concentration_mg_L: Number(conc), tag: 'trough' });
      }
    }
  }
  return levels;
}

// High-level helper used by InteractiveAUC fallback
export function computeAll(patient, regimen, pk) {
  const provided = pk && typeof pk === 'object' ? pk : {};
  const hasProvided = Number.isFinite(provided.CL_L_per_h) && Number.isFinite(provided.V_L);
  const { CL_L_per_h, V_L } = hasProvided ? provided : estimateCL_V_fromPatient(patient);
  const sim = simulateConcentrationCurve({
    dose_mg: Number(regimen?.dose_mg) || 1000,
    interval_hours: Number(regimen?.interval_hours) || 12,
    infusion_minutes: Number(regimen?.infusion_minutes) || 60,
    CL_L_per_h: Number(CL_L_per_h) || 4,
    V_L: Number(V_L) || 50,
    horizon_h: 48,
    dt_h: 0.05,
    doses_to_simulate: 16,
  });
  const summary = summarizePK({ ...sim, interval_hours: Number(regimen?.interval_hours) || 12, dose_mg: Number(regimen?.dose_mg) || 1000, CL_L_per_h: Number(CL_L_per_h) || 4 });
  const series = { time_hours: sim.times, concentration_mg_L: sim.conc, lower: undefined, upper: undefined };
  return { series, summary, CL_L_per_h, V_L };
}
