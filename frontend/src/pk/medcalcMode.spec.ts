/// <reference types="jest" />
import { deterministicSummary, medcalcConfig } from './medcalcMode';

describe('MedCalc-compatible deterministic mode', () => {
  it('Case 1: 60y male, 80 kg, SCr 1.0, 1000 mg q12, tinf 60', () => {
    const patient = { ageY: 60, sex: 'Male' as const, weightKg: 80, scrMgDl: 1.0 };
    const regimen = { doseMg: 1000, intervalH: 12, infusionMin: 60 };
    const res = deterministicSummary(patient, regimen);
    expect(res.metrics.auc_24).toBeGreaterThan(200);
    expect(res.metrics.auc_24).toBeLessThan(1000);
    expect(res.metrics.predicted_peak).toBeGreaterThan(5);
    expect(res.metrics.predicted_trough).toBeGreaterThan(0);
  });

  it('Case 2: female lower CrCl', () => {
    const patient = { ageY: 70, sex: 'Female' as const, weightKg: 60, scrMgDl: 2.0 };
    const regimen = { doseMg: 750, intervalH: 24, infusionMin: 90 };
    const res = deterministicSummary(patient, regimen);
    expect(res.metrics.auc_24).toBeGreaterThan(100);
    expect(res.metrics.predicted_trough).toBeGreaterThan(0);
  });

  it('Case 3: higher Vd per kg reduces peaks', () => {
    const patient = { ageY: 50, sex: 'Male' as const, weightKg: 100, scrMgDl: 1.2 };
    const regimen = { doseMg: 1500, intervalH: 12, infusionMin: 120 };
    const base = deterministicSummary(patient, regimen);
    const saved = medcalcConfig.vdPerKg;
    medcalcConfig.vdPerKg = 0.8;
    const higherVd = deterministicSummary(patient, regimen);
    medcalcConfig.vdPerKg = saved;
    expect(higherVd.metrics.predicted_peak).toBeLessThan(base.metrics.predicted_peak);
  });
});
