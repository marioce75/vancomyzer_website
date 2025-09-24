import { deterministicSummary } from './medcalcMode';
import type { WeightStrategy } from './core';

export const clinParity = {
  vdPerKg: 0.70,
  clScale: 1.00,
  clOffset: 0.00,
  weightStrategy: 'Auto' as WeightStrategy,
  scrPolicy: { floor: null as number|null, round: 'none' as const },
  aucMethod: 'doseOverCL' as 'doseOverCL'|'trapezoid',
  micDefault: 1.0,
};

export function applyClinParity(
  patient: { ageY:number; sex:'Male'|'Female'; weightKg:number; heightCm?:number; scrMgDl:number; mic?:number },
  regimen: { doseMg:number; intervalH:number; infusionMin:number }
){
  return deterministicSummary(patient, regimen, {
    vdPerKg: clinParity.vdPerKg,
    clScale: clinParity.clScale,
    clOffset: clinParity.clOffset,
    weightStrategy: clinParity.weightStrategy,
    scrPolicy: clinParity.scrPolicy,
    aucMethod: clinParity.aucMethod,
  });
}
