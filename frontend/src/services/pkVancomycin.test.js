// Basic unit tests for ssPeakTrough against simulated curve (rough tolerance)
import { ssPeakTrough, simulateConcentrationCurve } from './pkVancomycin';

function approx(a, b, rel = 0.03) {
  if (a === 0 && b === 0) return true;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-9) <= rel;
}

test('ssPeakTrough matches simulated superposition within 3%', () => {
  const CL = 4.0; // L/h
  const V = 60.0; // L
  const dose_mg = 1000;
  const tau_h = 12;
  const tinf_min = 60;
  const { Cmax, Cmin } = ssPeakTrough({ CL, V, dose_mg, tau_h, tinf_min });

  const sim = simulateConcentrationCurve({ dose_mg, interval_hours: tau_h, infusion_minutes: tinf_min, CL_L_per_h: CL, V_L: V, horizon_h: 48, dt_h: 0.01, doses_to_simulate: 16 });
  const Tinf = Math.max(0.25, tinf_min/60);
  const tEOI = 36 - tau_h + Tinf; // end-of-infusion in last interval between 24-36h
  const tTrough = 36 - 1e-2; // just before next dose at 36h
  // interp helper
  const interp = (times, conc, t) => {
    let lo = 0, hi = times.length - 1;
    while (hi - lo > 1) {
      const mid = (hi + lo) >> 1;
      if (times[mid] < t) lo = mid; else hi = mid;
    }
    const t0 = times[lo], t1 = times[hi];
    const y0 = conc[lo], y1 = conc[hi];
    const f = (t - t0) / (t1 - t0);
    return y0 + f * (y1 - y0);
  };
  const cEOI = interp(sim.times, sim.conc, tEOI);
  const cTrough = interp(sim.times, sim.conc, tTrough);

  expect(approx(cEOI, Cmax, 0.03)).toBe(true);
  expect(approx(cTrough, Cmin, 0.03)).toBe(true);
});
