/* eslint-env jest */
import { applyClinParity } from '../../src/pk/parity.config';

describe('ClinCalc-parity harness', () => {
  const cases = [
    {
      name: 'Adult 1: 60y M 80kg SCr 1.0, 1000 q12 60min',
      patient: { ageY: 60, sex: 'Male', weightKg: 80, scrMgDl: 1.0 },
      regimen: { doseMg: 1000, intervalH: 12, infusionMin: 60 },
      expected: { auc24: 500, peak: 25, trough: 10 }, // placeholders; tune later
    },
  ];

  it.each(cases.map(c => [c.name, c]))('%s', (_, c) => {
    const out = applyClinParity(c.patient, c.regimen);
    expect(out && out.metrics).toBeTruthy();
    const m = out.metrics;
    expect(Number.isFinite(m.auc_24)).toBeTruthy();
    expect(Number.isFinite(m.predicted_peak)).toBeTruthy();
    expect(Number.isFinite(m.predicted_trough)).toBeTruthy();
    expect(m.auc_24).toBeGreaterThan(100);
  });
});
