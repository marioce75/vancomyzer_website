/**
 * Independent numerical reference for tests only. Restates Colin 2019 adult
 * covariate equations (article Eq. 6 / Table 3 values, as shipped) and
 * integrates the two-compartment ODEs with RK4. Imports no production module.
 */
export interface RefDose { start: number; mg: number; minutes: number }
export interface RefPatient { age: number; weight: number; scr: number }

export function refParams(p: RefPatient) {
  const PMA = Math.max(18, p.age) + 40 / 52;
  const PMAwk = PMA * 52;
  const wt = Math.max(30, p.weight);
  const fmat = PMAwk ** 2.89 / (PMAwk ** 2.89 + 46.4 ** 2.89);
  const fdec = 1 / (1 + (PMA / 61.6) ** 2.24);
  const scrStd = Math.exp(-1.228 + 0.672 * Math.log10(PMA) + 6.27 * Math.exp(-3.11 * PMA));
  const fscr = Math.exp(-0.649 * (p.scr - scrStd));
  return {
    CL: 5.31 * (wt / 70) ** 0.75 * fmat * fdec * fscr,
    V1: 42.9 * (wt / 70),
    V2: 41.7 * (wt / 70),
    Q: 3.22 * (wt / 70) ** 0.75,
  };
}

/** Central concentration (mg/L) at time t (h). Doses at or after t contribute nothing. */
export function refConcentration(p: RefPatient, doses: RefDose[], t: number, maxStep = 0.0005): number {
  const { CL, V1, V2, Q } = refParams(p);
  const rate = (s: number) => doses.reduce((r, d) => (s >= d.start && s < d.start + d.minutes / 60 ? r + d.mg / (d.minutes / 60) : r), 0);
  const t0 = Math.min(...doses.map((d) => d.start));
  const bps = new Set<number>([t0, t]);
  for (const d of doses) for (const b of [d.start, d.start + d.minutes / 60]) if (b > t0 && b < t) bps.add(b);
  const pts = Array.from(bps).sort((a, b) => a - b);
  let a1 = 0, a2 = 0;
  const f = (r: number, x1: number, x2: number): [number, number] => [r - (CL / V1) * x1 - (Q / V1) * x1 + (Q / V2) * x2, (Q / V1) * x1 - (Q / V2) * x2];
  for (let i = 0; i + 1 < pts.length; i++) {
    const lo = pts[i], hi = pts[i + 1];
    const r = rate((lo + hi) / 2); // constant within a segment
    const n = Math.max(1, Math.ceil((hi - lo) / maxStep));
    const h = (hi - lo) / n;
    for (let k = 0; k < n; k++) {
      const k1 = f(r, a1, a2);
      const k2 = f(r, a1 + (h / 2) * k1[0], a2 + (h / 2) * k1[1]);
      const k3 = f(r, a1 + (h / 2) * k2[0], a2 + (h / 2) * k2[1]);
      const k4 = f(r, a1 + h * k3[0], a2 + h * k3[1]);
      a1 += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      a2 += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    }
  }
  return a1 / V1;
}
