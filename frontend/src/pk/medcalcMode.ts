// Deterministic "MedCalc/ClinCalc-compatible" mode
// Uses published equations only. Configurable to match external calculators within tolerance.

import { aucTrapz, clFromCrcl, crclCG, kFromCLV, superpose, vd, WeightStrategy } from './core';

export const medcalcConfig = {
  vdPerKg: 0.7, // L/kg (tunable)
  clScale: 1.0,
  clOffset: 0.0,
  weightStrategy: 'Auto' as WeightStrategy,
  scrPolicy: { floor: null as number|null, round: 'none' as const },
  defaultMIC: 1.0,
  aucMethod: 'doseOverCL' as 'doseOverCL'|'trapezoid',
};

export type DeterministicOpts = {
  vdPerKg?: number;
  clScale?: number;
  clOffset?: number;
  weightStrategy?: WeightStrategy;
  scrPolicy?: { floor?: number|null; round?: 'none'|'floor0.1'|'round0.1' };
  aucMethod?: 'doseOverCL'|'trapezoid';
  horizonH?: number;
  dtH?: number;
  overrideCL?: number;
  overrideV?: number;
};

export function deterministicSummary(
  patient: { ageY:number; sex:'Male'|'Female'; weightKg:number; heightCm?:number; scrMgDl:number; mic?:number },
  regimen: { doseMg:number; intervalH:number; infusionMin:number },
  opts: DeterministicOpts = {}
){
  const cfg = { ...medcalcConfig, ...opts };
  const mic = patient.mic ?? cfg.defaultMIC;
  const crcl = crclCG({
    ageY: patient.ageY,
    sex: patient.sex,
    weightKg: patient.weightKg,
    heightCm: patient.heightCm,
    scrMgDl: patient.scrMgDl,
    weightStrategy: cfg.weightStrategy,
    scrPolicy: cfg.scrPolicy,
  });

  let V = cfg.overrideV ?? vd(patient.weightKg, cfg.vdPerKg);
  let CL = cfg.overrideCL ?? clFromCrcl(crcl, cfg.clScale, cfg.clOffset);
  let k = kFromCLV(CL, V);

  const tinfH = regimen.infusionMin / 60;

  const horizonH = cfg.horizonH ?? 48;
  const dtH = cfg.dtH ?? 0.1;
  // time grid
  const times: number[] = [];
  for (let t = 0; t <= horizonH + 1e-9; t += dtH) times.push(+t.toFixed(10));
  const conc = superpose(times, regimen.doseMg, regimen.intervalH, tinfH, V, k);

  // AUC
  const dailyDose = regimen.doseMg * (24 / regimen.intervalH);
  const auc24 = cfg.aucMethod === 'doseOverCL' && CL > 0 ? (dailyDose / CL) : aucTrapz(times, conc, 0, 24);

  // Peak/trough from series at EoIP and pre-dose
  let peak = 0; let trough = Infinity;
  const tau = regimen.intervalH;
  const eps = 1e-6;
  for (let i = 1; i < times.length; i++) {
    const t = times[i];
    const nTau = Math.round((t - tinfH) / tau);
    const tPeak = nTau * tau + tinfH;
    if (Math.abs(t - tPeak) < eps) peak = Math.max(peak, conc[i]);
    const nTau2 = Math.round(t / tau);
    const tTrough = nTau2 * tau;
    if (Math.abs(t - tTrough) < eps) trough = Math.min(trough, conc[i-1]);
  }
  if (!Number.isFinite(trough)) trough = conc[0] ?? 0;

  return {
    metrics: { auc_24: auc24, predicted_peak: peak, predicted_trough: trough, CL, V, k, crcl, mic },
    series: { time_hours: times, concentration_mg_L: conc }
  } as const;
}

export { deterministicSummary as default };
