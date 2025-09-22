// Core PK Functions
// Published equations; no proprietary code

// Enhanced Creatinine clearance (Cockcroft–Gault) with weight strategy support
export function crclCG(params: {
  ageY: number; 
  sex: 'Male'|'Female'; 
  weightKg: number; 
  scrMgDl: number;
  heightCm?: number; 
  weightStrategy?: 'TBW'|'IBW'|'AdjBW';
  scrRounding?: 'none'|'floor0.7';
}): number {
  const { ageY, sex, weightKg, scrMgDl, heightCm, weightStrategy = 'TBW', scrRounding = 'none' } = params;

  // Calculate IBW using inches-based Devine formula (per spec)
  let weightForCG = weightKg; // Default TBW
  
  if (heightCm && (weightStrategy === 'IBW' || weightStrategy === 'AdjBW')) {
    const heightInches = heightCm / 2.54;
    const inchesOver60 = Math.max(0, heightInches - 60);
    
    const ibw = sex === 'Male' 
      ? 50 + 2.3 * inchesOver60
      : 45.5 + 2.3 * inchesOver60;
    
    if (weightStrategy === 'IBW') {
      weightForCG = ibw;
    } else if (weightStrategy === 'AdjBW') {
      // Calculate BMI to determine if AdjBW should be used
      const bmi = weightKg / ((heightCm / 100) ** 2);
      if (bmi >= 30) {
        weightForCG = ibw + 0.4 * (weightKg - ibw);
      } else {
        weightForCG = weightKg; // Use TBW if BMI < 30
      }
    }
  }

  // Apply SCr rounding if specified (optional floor for frail patients)
  let adjustedScr = scrMgDl;
  if (scrRounding === 'floor0.7') {
    adjustedScr = Math.max(scrMgDl, 0.7);
  }

  // Cockcroft-Gault calculation
  let crcl = ((140 - ageY) * weightForCG) / (72 * adjustedScr);
  if (sex === 'Female') crcl *= 0.85;
  
  return Math.max(crcl, 10); // Minimum physiological limit
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
