import { deterministicSummary } from '../pk/medcalcMode';

describe('MedCalc-compatible deterministic mode (smoke)', () => {
  it('computes reasonable AUC/peak/trough', () => {
    const patient = { ageY: 60, sex: 'Male', weightKg: 80, scrMgDl: 1.0 };
    const regimen = { doseMg: 1000, intervalH: 12, infusionMin: 60 };
    const res = deterministicSummary(patient, regimen);
    expect(res.metrics.auc_24).toBeGreaterThan(200);
    expect(res.metrics.auc_24).toBeLessThan(1200);
    expect(res.metrics.predicted_peak).toBeGreaterThan(1);
    expect(res.metrics.predicted_trough).toBeGreaterThan(0);
  });
});
