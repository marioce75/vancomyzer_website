import { vd } from './core';
import { medcalcConfig } from './medcalcMode';

// Fit elimination rate k from one or two levels, accounting for infusion EoIP
export function fitFromLevels({ level1, level2, regimen, patient, prior }: {
  level1: { time_hr: number; concentration_mg_L: number };
  level2?: { time_hr: number; concentration_mg_L: number };
  regimen: { doseMg: number; intervalH: number; infusionMin: number };
  patient: { weightKg: number };
  prior?: { vdPerKg?: number; clScale?: number };
}): { CL: number; V: number; k: number } {
  const vdPerKg = prior?.vdPerKg ?? medcalcConfig.vdPerKg;
  const Vpop = vd(patient.weightKg, vdPerKg);

  if (level1 && level2) {
    // Fit k from slope assuming both after EoIP at steady state
    const t1 = level1.time_hr, c1 = level1.concentration_mg_L;
    const t2 = level2.time_hr, c2 = level2.concentration_mg_L;
    const dt = (t2 - t1);
    const k = dt !== 0 && c1 > 0 && c2 > 0 ? Math.max(1e-6, Math.log(c1 / c2) / dt) : 0.15;
    const CL = k * Vpop;
    return { CL, V: Vpop, k };
  }

  // One level: use population V and a reasonable k; refine later by anchoring to EoIP decay
  if (level1) {
    const kGuess = 0.12; // typical adult
    const CL = kGuess * Vpop;
    return { CL, V: Vpop, k: kGuess };
  }

  return { CL: 0, V: Vpop, k: 0 };
}
