// Core PK Functions
// Published equations; no proprietary code

// Types for toggles
export type WeightStrategy = 'TBW'|'IBW'|'AdjBW'|'Auto';
export type ScrRoundPolicy = 'none'|'floor0.1'|'round0.1';

// Utility: height cm -> inches
function cmToIn(cm?: number) { return (Number(cm) || 0) / 2.54; }

// Ideal body weight (kg) using Devine: M=50+2.3*(in-60), F=45.5+2.3*(in-60)
export function ibwKg(sex: 'Male'|'Female', heightCm?: number): number {
  const inches = cmToIn(heightCm);
  const base = sex === 'Male' ? 50 : 45.5;
  const over60 = Math.max(0, inches - 60);
  return base + 2.3 * over60;
}

// Adjusted body weight when obese
export function adjbwKg(tbwKg: number, ibw: number): number {
  return ibw + 0.4 * (tbwKg - ibw);
}

// Choose weight per strategy
export function chooseWeightKg(tbwKg: number, sex: 'Male'|'Female', heightCm?: number, strategy: WeightStrategy = 'Auto'): number {
  const ibw = ibwKg(sex, heightCm);
  if (strategy === 'TBW') return tbwKg;
  if (strategy === 'IBW') return ibw;
  if (strategy === 'AdjBW') return adjbwKg(tbwKg, ibw);
  // Auto: TBW if TBW < IBW; AdjBW if BMI ≥ 30; else IBW
  const hM = (Number(heightCm) || 0) / 100;
  const bmi = hM > 0 ? tbwKg / (hM * hM) : NaN;
  if (tbwKg < ibw) return tbwKg;
  if (Number.isFinite(bmi) && bmi >= 30) return adjbwKg(tbwKg, ibw);
  return ibw;
}

// SCr policy application
function applyScrPolicy(scr: number, policy?: { floor?: number|null, round?: ScrRoundPolicy }) {
  let x = Number(scr) || 0;
  const floorVal = policy?.floor;
  if (typeof floorVal === 'number' && Number.isFinite(floorVal)) x = Math.max(x, floorVal);
  const round = policy?.round || 'none';
  if (round === 'floor0.1') x = Math.floor(x * 10) / 10;
  if (round === 'round0.1') x = Math.round(x * 10) / 10;
  return x;
}

// Creatinine clearance (Cockcroft–Gault)
export function crclCG(params: {
  ageY: number; sex: 'Male'|'Female'; weightKg: number; heightCm?: number; scrMgDl: number;
  weightStrategy?: WeightStrategy; scrPolicy?: { floor?: number|null, round?: ScrRoundPolicy };
}): number {
  const { ageY, sex, weightKg, heightCm, scrMgDl } = params;
  const wt = chooseWeightKg(weightKg, sex, heightCm, params.weightStrategy || 'Auto');
  const scr = applyScrPolicy(scrMgDl, params.scrPolicy);
  let crcl = ((140 - Number(ageY)) * wt) / (72 * scr);
  if (sex === 'Female') crcl *= 0.85;
  return crcl; // mL/min
}

// Enhanced volume and clearance calculations
export function vd(weightKg: number, vdPerKg: number = 0.7): number {
  return vdPerKg * weightKg;
}

export function kFromCLV(CL_L_h: number, V_L: number): number {
  return CL_L_h / V_L;
}

// Convenience clearance mapping from CrCl (mL/min) to CL (L/h): CL = offset + scale*(CrCl/60)
export function clFromCrcl(crcl_mL_min: number, scale = 1.0, offset = 0): number {
  return offset + scale * (crcl_mL_min / 60);
}

// Infusion model (one compartment, zero-order in, first-order out)
export function concDuringInfusion(t: number, doseMg: number, tinfH: number, V_L: number, k_h: number): number {
  const rateIn = doseMg / tinfH;
  return (rateIn / (V_L * k_h)) * (1 - Math.exp(-k_h * t));
}

export function concAfterInfusion(t: number, doseMg: number, tinfH: number, V_L: number, k_h: number): number {
  const rateIn = doseMg / tinfH;
  const concAtEnd = (rateIn / (V_L * k_h)) * (1 - Math.exp(-k_h * tinfH));
  return concAtEnd * Math.exp(-k_h * (t - tinfH));
}

// Superposition for multiple doses
export function superpose(timesH: number[], doseMg: number, tauH: number, tinfH: number, V_L: number, k_h: number): number[] {
  return timesH.map(t => {
    let conc = 0;
    const nMax = Math.floor(t / tauH);
    for (let n = 0; n <= nMax; n++) {
      const tn = t - n * tauH;
      if (tn <= tinfH + 1e-12) {
        conc += concDuringInfusion(tn, doseMg, tinfH, V_L, k_h);
      } else {
        conc += concAfterInfusion(tn, doseMg, tinfH, V_L, k_h);
      }
    }
    return conc;
  });
}

// AUC via trapezoid
export function aucTrapz(timesH: number[], conc: number[], a=0, b=24): number {
  let auc = 0;
  for (let i = 1; i < timesH.length; i++) {
    const t0 = timesH[i - 1];
    const t1 = timesH[i];
    if (t1 <= a) continue;
    if (t0 >= b) break;
    const dt = Math.min(t1, b) - Math.max(t0, a);
    if (dt > 0) auc += 0.5 * (conc[i] + conc[i - 1]) * dt;
  }
  return auc;
}

// Peak and trough calculations at EoIP and just before next dose
export function peakTroughFromSeries(timesH: number[], conc: number[], tauH: number, tinfH: number): { peak: number; trough: number } {
  let peak = 0;
  let trough = Number.POSITIVE_INFINITY;
  const eps = 1e-6;
  for (let i = 1; i < timesH.length; i++) {
    const t = timesH[i];
    const nTau = Math.round((t - tinfH) / tauH);
    const tPeak = nTau * tauH + tinfH;
    if (Math.abs(t - tPeak) < eps) {
      peak = Math.max(peak, conc[i]);
    }
    const nTau2 = Math.round(t / tauH);
    const tTrough = nTau2 * tauH;
    if (Math.abs(t - tTrough) < eps) {
      trough = Math.min(trough, conc[i - 1]); // just before next dose starts
    }
  }
  if (!Number.isFinite(trough)) trough = conc[0] ?? 0;
  return { peak, trough };
}
