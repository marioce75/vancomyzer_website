// Pediatric & Neonate PK helpers and local fallback engine
// One-compartment IV infusion with superposition. Units: mg, h, mg/L.

import priorsPeds from './priorsPeds.json';
import priorsNeo from './priorsNeo.json';

function lnN(mean, sigmaFrac) {
  // For log-normal with mean M and fractional sigma s (CV), approximate parameters
  const variance = Math.pow(sigmaFrac * mean, 2);
  const mu = Math.log(Math.pow(mean, 2) / Math.sqrt(variance + Math.pow(mean, 2)));
  const sigma = Math.sqrt(Math.log(variance / Math.pow(mean, 2) + 1));
  return { mu, sigma };
}

export function maturationFactorPNA(pnaDays) {
  // Simple sigmoid maturation vs PNA; center 14d, slope 0.2
  const x = Math.max(0, Number(pnaDays) || 0);
  const m = 1 / (1 + Math.exp(-(x - 14) * 0.2));
  return 0.2 + 0.8 * m; // floor 0.2, asymptote 1.0
}

export function renalFactorScr(scr_mg_dl) {
  const scr = Math.max(0.2, Number(scr_mg_dl) || 0.8);
  // Higher sCr reduces CL, anchor at 0.8 mg/dL
  return Math.min(1.5, Math.max(0.4, 0.8 / scr));
}

export function eGFRfromSCrPeds(ageYears, scrLike) {
  // Very rough bedside Schwartz: eGFR ≈ 0.413 * height_cm / sCr, fallback by age if no height
  // We do not have height here; use age-based nominal eGFR bands
  const age = Number(ageYears) || 10;
  const scr = Math.max(0.2, Number(scrLike) || 0.6);
  let eGFR = 120; // mL/min/1.73m2
  if (age < 1) eGFR = 80; else if (age < 5) eGFR = 110; else if (age < 12) eGFR = 120; else eGFR = 130;
  // Adjust by sCr (inverse)
  eGFR *= 0.8 / scr;
  return Math.max(30, Math.min(180, eGFR));
}

function simulateIVInfusion({ dose_mg, tau_h, tinf_min, CL_L_h, V_L, horizon_h = 48, dt_h = 0.1 }){
  const Tinf = Math.max(0.25, (Number(tinf_min)||60)/60);
  const R0 = dose_mg / Tinf;
  const k = CL_L_h / V_L;
  const times = [];
  const conc = [];
  const doseTimes = [];
  for (let t = 0; t <= horizon_h + 1e-9; t += dt_h) {
    times.push(Number(t.toFixed(5)));
  }
  for (let t = 0; t <= horizon_h + 1e-9; t += tau_h) doseTimes.push(Number(t.toFixed(5)));
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    let c = 0;
    for (const tDose of doseTimes) {
      const td = t - tDose;
      if (td < 0) continue;
      if (td <= Tinf) {
        c += (R0 / (k * V_L)) * (1 - Math.exp(-k * td));
      } else {
        c += (R0 / (k * V_L)) * (1 - Math.exp(-k * Tinf)) * Math.exp(-k * (td - Tinf));
      }
    }
    conc.push(c);
  }
  return { time_hours: times, concentration_mg_L: conc, Tinf, k };
}

export function aucTrapezoid(times, conc, t0 = 0, t1 = 24) {
  let auc = 0;
  for (let i = 1; i < times.length; i++) {
    const a = times[i - 1], b = times[i];
    if (b <= t0) continue;
    if (a >= t1) break;
    const clA = Math.max(a, t0); const clB = Math.min(b, t1);
    const yA = interp(times, conc, clA); const yB = interp(times, conc, clB);
    auc += 0.5 * (yA + yB) * (clB - clA);
  }
  return auc;
}

function interp(xs, ys, x) {
  let lo = 0, hi = xs.length - 1;
  if (x <= xs[lo]) return ys[lo];
  if (x >= xs[hi]) return ys[hi];
  while (hi - lo > 1) {
    const mid = (hi + lo) >> 1;
    if (xs[mid] < x) lo = mid; else hi = mid;
  }
  const x0 = xs[lo], x1 = xs[hi];
  const y0 = ys[lo], y1 = ys[hi];
  const f = (x - x0) / (x1 - x0);
  return y0 + f * (y1 - y0);
}

export function peakTrough({ CL_L_h, V_L, dose_mg, tau_h, tinf_min }){
  const k = CL_L_h / V_L;
  const Tinf = Math.max(0.25, (tinf_min||60)/60);
  const R0 = dose_mg / Tinf;
  const denom = 1 - Math.exp(-k * tau_h);
  const safe = Math.abs(denom) > 1e-12 ? denom : 1e-12;
  const Cmax = (R0 / (k * V_L)) * (1 - Math.exp(-k * Tinf)) / safe;
  const Cmin = Cmax * Math.exp(-k * (tau_h - Tinf));
  return { peak: Cmax, trough: Cmin };
}

export function buildPriorsPeds(patient){
  const { ageYears, weight_kg } = patient;
  const scr = patient.scr_mg_dl ?? patient.scr;
  const WT = Math.max(5, Number(weight_kg) || 20);
  const eGFR = eGFRfromSCrPeds(Number(ageYears)||10, scr);
  const thetaCL = Number(priorsPeds?.theta?.CL) || 4.5;
  const thetaV = Number(priorsPeds?.theta?.V) || 60;
  const thetaGFR = Number(priorsPeds?.theta?.thetaGFR) || 0.65;
  const CL = thetaCL * Math.pow(WT/70, 0.75) * Math.pow(eGFR/100, thetaGFR);
  const V = thetaV * Math.pow(WT/70, 1.0);
  const { sigma: s } = priorsPeds || {}; // fractional variability
  const lnCL = lnN(CL, Number(s?.CL)||0.25);
  const lnV = lnN(V, Number(s?.V)||0.20);
  return { CL_mean: CL, V_mean: V, lognorm: { CL: lnCL, V: lnV } };
}

export function buildPriorsNeo(patient){
  const { gestationalAge_wk, postnatalAge_d, postmenstrualAge_wk, weight_kg } = patient;
  const scr = patient.scr_mg_dl ?? patient.scr;
  const WT = Math.max(0.6, Number(weight_kg) || 3);
  const PMA = Number(postmenstrualAge_wk) || (Number(gestationalAge_wk)||28) + (Number(postnatalAge_d)||0)/7;
  const PNA = Number(postnatalAge_d) || 1;
  const thetaCL = Number(priorsNeo?.theta?.CL) || 1.5; // L/h baseline at 3.5kg, 40wk
  const thetaVkg = Number(priorsNeo?.theta?.V) || 0.7; // L/kg
  const thetaPMA = Number(priorsNeo?.maturation?.thetaPMA) || 1.2;
  const mPNA = maturationFactorPNA(PNA);
  const rScr = renalFactorScr(scr);
  const CL = thetaCL * Math.pow((Number(PMA)||40)/40, thetaPMA) * Math.pow(WT/3.5, 0.75) * mPNA * rScr;
  const V = thetaVkg * WT;
  const s = priorsNeo?.sigma || {};
  const lnCL = lnN(CL, Number(s?.CL)||0.35);
  const lnV = lnN(V, Number(s?.V)||0.25);
  return { CL_mean: CL, V_mean: V, lognorm: { CL: lnCL, V: lnV } };
}

export function computeSeriesPeds(patient, regimen){
  const pri = buildPriorsPeds(patient);
  const dose_mg = Math.round((Number(regimen?.dose_mg_per_kg)||15) * (Number(patient?.weight_kg)||20));
  const tau_h = Number(regimen?.interval_hours)||12;
  const tinf_min = Number(regimen?.infusion_minutes)||60;
  const sim = simulateIVInfusion({ dose_mg, tau_h, tinf_min, CL_L_h: pri.CL_mean, V_L: pri.V_mean, horizon_h: 48, dt_h: 0.1 });
  const auc_24 = (24/tau_h) * dose_mg / pri.CL_mean;
  const pt = peakTrough({ CL_L_h: pri.CL_mean, V_L: pri.V_mean, dose_mg, tau_h, tinf_min });
  return { series: sim, summary: { auc_24, predicted_peak: pt.peak, predicted_trough: pt.trough }, dose_mg };
}

export function computeSeriesNeo(patient, regimen){
  const pri = buildPriorsNeo(patient);
  const dose_mg = Math.round((Number(regimen?.dose_mg_per_kg)||12.5) * (Number(patient?.weight_kg)||3));
  const tau_h = Number(regimen?.interval_hours)||12;
  const tinf_min = Number(regimen?.infusion_minutes)||60;
  const sim = simulateIVInfusion({ dose_mg, tau_h, tinf_min, CL_L_h: pri.CL_mean, V_L: pri.V_mean, horizon_h: 48, dt_h: 0.1 });
  const auc_24 = (24/tau_h) * dose_mg / pri.CL_mean;
  const pt = peakTrough({ CL_L_h: pri.CL_mean, V_L: pri.V_mean, dose_mg, tau_h, tinf_min });
  return { series: sim, summary: { auc_24, predicted_peak: pt.peak, predicted_trough: pt.trough }, dose_mg };
}

export function utils(){
  return { aucTrapezoid, peakTrough };
}
