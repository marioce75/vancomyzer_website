/**
 * Deterministic PRNG for the predictive-performance harness.
 *
 * Mulberry32 — short, fast, statistically adequate for Monte Carlo
 * pharmacometric sampling at n=200–1000 patient scale. NOT cryptographic.
 *
 * Seeded explicitly so that:
 *   (a) `npm test` produces the same rBias/rRMSE every run
 *   (b) the disclosed seed on the public page is reproducible by
 *       any third party who downloads this repo.
 *
 * If anyone changes the seed without updating the public page, the
 * test:predictive script will print a banner pointing them at the page
 * copy so the disclosure stays honest.
 */

export interface Rng {
  /** Uniform on [0, 1). */
  next(): number;
  /** Standard normal via Box–Muller. */
  normal(): number;
  /** Log-normal with given mu/sigma on the log scale. */
  logNormal(mu: number, sigma: number): number;
  /** Uniform integer in [min, max]. */
  intBetween(min: number, max: number): number;
}

export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Cached spare from Box–Muller — avoids wasting half the normals.
  let spare: number | null = null;
  const normal = (): number => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u1 = 0, u2 = 0;
    while (u1 === 0) u1 = next();
    while (u2 === 0) u2 = next();
    const mag = Math.sqrt(-2.0 * Math.log(u1));
    const z0 = mag * Math.cos(2.0 * Math.PI * u2);
    const z1 = mag * Math.sin(2.0 * Math.PI * u2);
    spare = z1;
    return z0;
  };

  return {
    next,
    normal,
    logNormal: (mu, sigma) => Math.exp(mu + sigma * normal()),
    intBetween: (min, max) => min + Math.floor(next() * (max - min + 1)),
  };
}
