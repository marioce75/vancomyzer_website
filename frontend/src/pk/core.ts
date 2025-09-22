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

// Enhanced volume and clearance calculations
export function vd(weightKg: number, vdPerKg: number = 0.7): number {
  return vdPerKg * weightKg;
}

export function kFromCLV(CL_L_h: number, V_L: number): number {
  return CL_L_h / V_L;
}

// Enhanced clearance from CrCl with configurable scale factor
export function clFromCrcl(crcl_mL_min: number, opts: { scale?: number } = {}): number {
  const { scale = 1.0 } = opts;
  // Default formula: CL (L/h) = scale * (CrCl_mL_min / 60)
  return scale * (crcl_mL_min / 60);
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

// Peak and trough calculations - enhanced to work with steady-state superposition
export function peakTroughFromSeries(timesH: number[], conc: number[], tauH: number): { peak: number; trough: number } {
  let peak = 0;
  let trough = Infinity;
  
  // Look for peaks just after infusion ends (t = n*τ + tinf) and troughs just before next dose (t = n*τ - ε)
  for (let i = 0; i < timesH.length; i++) {
    const t = timesH[i];
    const cyclePos = t % tauH;
    
    // Peak: look for concentrations shortly after infusion end (assuming 1h infusion typically)
    if (cyclePos >= 1.0 && cyclePos <= 2.0) {
      peak = Math.max(peak, conc[i]);
    }
    
    // Trough: look for concentrations just before next dose (last 10% of interval)
    if (cyclePos >= tauH * 0.9) {
      trough = Math.min(trough, conc[i]);
    }
  }
  
  // Fallback if no valid points found
  if (!Number.isFinite(trough)) {
    trough = conc[conc.length - 1] || 0;
  }
  
  return { peak, trough };
}

// Enhanced deterministic summary function
export function deterministicSummary(
  patient: { 
    ageY: number; 
    sex: 'Male'|'Female'; 
    weightKg: number; 
    heightCm?: number; 
    scrMgDl: number; 
    mic?: number 
  },
  regimen: { 
    doseMg: number; 
    intervalH: number; 
    infusionMin: number 
  },
  opts: {
    vdPerKg?: number;
    clScale?: number;
    useDoseOverCL?: boolean;
    weightStrategy?: 'TBW'|'IBW'|'AdjBW';
    scrRounding?: 'none'|'floor0.7';
  } = {}
): {
  metrics: {
    auc_24: number;
    predicted_peak: number;
    predicted_trough: number;
    CL: number;
    V: number;
    k: number;
    crcl: number;
  };
  series: {
    time_hours: number[];
    concentration_mg_L: number[];
  };
} {
  const { 
    vdPerKg = 0.7, 
    clScale = 1.0, 
    useDoseOverCL = true,
    weightStrategy = 'TBW',
    scrRounding = 'none'
  } = opts;

  // Calculate patient-specific parameters
  const crcl = crclCG({ 
    ageY: patient.ageY, 
    sex: patient.sex, 
    weightKg: patient.weightKg, 
    scrMgDl: patient.scrMgDl, 
    heightCm: patient.heightCm,
    weightStrategy,
    scrRounding
  });
  
  const V = vd(patient.weightKg, vdPerKg);
  const CL = clFromCrcl(crcl, { scale: clScale });
  const k = kFromCLV(CL, V);
  const tinfH = regimen.infusionMin / 60;

  // Generate time series (48h horizon, 0.1h steps as specified)
  const times: number[] = [];
  for (let t = 0; t <= 48; t += 0.1) {
    times.push(+t.toFixed(1));
  }
  
  // Calculate concentrations using superposition
  const conc = superpose(times, regimen.doseMg, regimen.intervalH, tinfH, V, k);

  // Calculate AUC24 
  const dailyDose = regimen.doseMg * (24 / regimen.intervalH);
  const auc_24 = useDoseOverCL && CL > 0 
    ? (dailyDose / CL) 
    : aucTrapz(times, conc, 0, 24);

  // Calculate peak and trough
  const { peak, trough } = peakTroughFromSeries(times, conc, regimen.intervalH);

  return {
    metrics: {
      auc_24,
      predicted_peak: peak,
      predicted_trough: trough,
      CL,
      V,
      k,
      crcl
    },
    series: {
      time_hours: times,
      concentration_mg_L: conc
    }
  };
}
