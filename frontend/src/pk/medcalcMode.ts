// Deterministic "MedCalc-compatible" mode
// Uses published equations only. Not affiliated with MedCalc. No proprietary code.

import { aucTrapz, clFromCrcl, crclCG, kFromCLV, superpose, vd } from './core.ts';
import type { Patient, Regimen } from './types';

export const medcalcConfig = {
  vdPerKg: 0.7, // L/kg (tunable)
  clFromCrcl: { a: 0.0, b: 1.0, scale: 1.0 },
  scrRounding: 'none' as const,
  defaultMIC: 1.0,
  useDoseOverCL: true,
};

export function deterministicSummary(
  patient: { ageY:number; sex:'Male'|'Female'; weightKg:number; heightCm?:number; scrMgDl:number; mic?:number },
  regimen: { doseMg:number; intervalH:number; infusionMin:number },
  horizonH = 48,
  dtH = 0.1
){
  const mic = patient.mic ?? medcalcConfig.defaultMIC;
  const crcl = crclCG({ ageY: patient.ageY, sex: patient.sex, weightKg: patient.weightKg, scrMgDl: patient.scrMgDl, heightCm: patient.heightCm, rounding: medcalcConfig.scrRounding });
  const V = vd(patient.weightKg, medcalcConfig.vdPerKg);
  const CL = clFromCrcl(crcl, medcalcConfig.clFromCrcl);
  const k = kFromCLV(CL, V);
  const tinfH = regimen.infusionMin / 60;

  // time grid
  const times: number[] = [];
  for (let t = 0; t <= horizonH + 1e-9; t += dtH) times.push(+t.toFixed(10));
  const conc = superpose(times, regimen.doseMg, regimen.intervalH, tinfH, V, k);

  // AUC
  const dailyDose = regimen.doseMg * (24 / regimen.intervalH);
  const auc24 = medcalcConfig.useDoseOverCL && CL > 0 ? (dailyDose / CL) : aucTrapz(times, conc, 0, 24);

  // peak/trough from series
  let peak = 0; let trough = Infinity;
  const tau = regimen.intervalH;
  for (let i = 1; i < times.length; i++) {
    const t = times[i];
    if (Math.abs(t - Math.round(t / tau) * tau) < 1e-9) {
      peak = Math.max(peak, conc[i]);
      trough = Math.min(trough, conc[i-1]);
    }
  }
  if (!Number.isFinite(trough)) trough = conc[0] ?? 0;

  return {
    metrics: { auc_24: auc24, predicted_peak: peak, predicted_trough: trough, CL, V, k, crcl, mic },
    series: { time_hours: times, concentration_mg_L: conc }
  } as const;
}
