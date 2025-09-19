// Core PK Functions
// Published equations; no proprietary code

// Creatinine clearance (Cockcroft–Gault; round choices configurable)
export function crclCG(params: {
  ageY: number; sex: 'Male'|'Female'; weightKg: number; scrMgDl: number;
  useAdjBW?: boolean; heightCm?: number; rounding?: 'none'|'floor0.1'|'round0.1';
}): number {
  const { ageY, sex, weightKg, scrMgDl, heightCm, useAdjBW, rounding } = params;

  let adjustedWeight = weightKg;
  if (useAdjBW && heightCm) {
    const ibw = sex === 'Male'
      ? 50 + 0.91 * (heightCm - 152.4)
      : 45.5 + 0.91 * (heightCm - 152.4);
    adjustedWeight = ibw + 0.4 * (weightKg - ibw);
  }

  let crcl = ((140 - ageY) * adjustedWeight) / (72 * scrMgDl);
  if (sex === 'Female') crcl *= 0.85;
  if (rounding === 'floor0.1') return Math.floor(crcl * 10) / 10;
  if (rounding === 'round0.1') return Math.round(crcl * 10) / 10;
  return crcl;
}

// Volume of distribution (Vd) and elimination rate constant (k)
export function vd(weightKg: number, vdPerKg: number): number {
  return vdPerKg * weightKg;
}

export function kFromCLV(CL_L_h: number, V_L: number): number {
  return CL_L_h / V_L;
}

export function clFromCrcl(crcl_mL_min: number, theta: { a: number; b: number; scale?: number }): number {
  const { a, b, scale = 1 } = theta;
  return a + b * (crcl_mL_min / 60) * scale;
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
    for (let n = 0; n <= Math.floor(t / tauH); n++) {
      const tn = t - n * tauH;
      if (tn <= tinfH) {
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
    if (timesH[i] > b) break;
    if (timesH[i - 1] >= a) {
      auc += 0.5 * (conc[i] + conc[i - 1]) * (timesH[i] - timesH[i - 1]);
    }
  }
  return auc;
}

// Peak and trough calculations
export function peakTroughFromSeries(timesH: number[], conc: number[], tauH: number): { peak: number; trough: number } {
  const peaks: number[] = [];
  const troughs: number[] = [];
  for (let t = 0; t < timesH.length; t++) {
    if (t > 0 && timesH[t] % tauH < 1e-9) {
      peaks.push(conc[t]);
      troughs.push(conc[t - 1]);
    }
  }
  return { peak: Math.max(...peaks), trough: Math.min(...troughs) };
}
