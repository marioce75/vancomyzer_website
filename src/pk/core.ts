/**
 * Vancomycin Pharmacokinetic Core Calculations
 * 
 * Implementation of standard one-compartment IV infusion model
 * with published pharmacokinetic equations for clinical use.
 * 
 * References:
 * - Cockcroft-Gault equation for creatinine clearance
 * - One-compartment model with first-order elimination
 * - Standard vancomycin population pharmacokinetics
 */

export interface Patient {
  age: number; // years
  sex: 'M' | 'F';
  weight: number; // kg (TBW)
  height: number; // cm
  scr: number; // mg/dL
}

export interface Regimen {
  dose: number; // mg
  interval: number; // hours
  infusionTime: number; // minutes
}

export interface PKOptions {
  weightStrategy: 'TBW' | 'IBW' | 'AdjBW' | 'Auto';
  scrPolicy: 'none' | 'floor';
  scrFloor: number; // mg/dL, typically 0.7-0.8
  aucMethod: 'doseCL' | 'trapezoid';
  vdPerKg: number; // L/kg, typically 0.7
  clOffset: number; // L/h
  clScale: number; // typically 1.0
}

export interface PKMetrics {
  crcl: number; // mL/min
  vd: number; // L
  cl: number; // L/h
  k: number; // h⁻¹
  weightUsed: number; // kg
  peak: number; // mg/L (end-of-infusion)
  trough: number; // mg/L (pre-dose)
  auc24: number; // mg*h/L
}

export interface TimeConcentrationPoint {
  time: number; // hours
  concentration: number; // mg/L
}

export interface PKResult {
  metrics: PKMetrics;
  timeCourse: TimeConcentrationPoint[];
}

/**
 * Calculate creatinine clearance using Cockcroft-Gault equation
 */
export function crclCG(
  age: number,
  sex: 'M' | 'F',
  scr: number,
  weightKg: number,
  scrPolicy: 'none' | 'floor' = 'none',
  scrFloor: number = 0.7
): number {
  let adjustedScr = scr;
  
  if (scrPolicy === 'floor' && scr < scrFloor) {
    adjustedScr = scrFloor;
  }
  
  const sexFactor = sex === 'F' ? 0.85 : 1.0;
  const crcl = ((140 - age) * weightKg * sexFactor) / (72 * adjustedScr);
  
  return Math.max(crcl, 10); // Minimum 10 mL/min
}

/**
 * Calculate ideal body weight (IBW) in kg
 */
export function calculateIBW(heightCm: number, sex: 'M' | 'F'): number {
  const heightInches = heightCm / 2.54;
  const baseWeight = sex === 'M' ? 50 : 45.5;
  const factor = sex === 'M' ? 2.3 : 2.3;
  
  return baseWeight + factor * Math.max(0, heightInches - 60);
}

/**
 * Calculate adjusted body weight (AdjBW)
 */
export function calculateAdjBW(tbw: number, ibw: number): number {
  return ibw + 0.4 * (tbw - ibw);
}

/**
 * Get weight based on strategy
 */
export function getWeight(
  patient: Patient,
  strategy: 'TBW' | 'IBW' | 'AdjBW' | 'Auto'
): number {
  const ibw = calculateIBW(patient.height, patient.sex);
  const adjBw = calculateAdjBW(patient.weight, ibw);
  const bmi = patient.weight / Math.pow(patient.height / 100, 2);
  
  switch (strategy) {
    case 'TBW':
      return patient.weight;
    case 'IBW':
      return ibw;
    case 'AdjBW':
      return adjBw;
    case 'Auto':
      if (patient.weight < ibw) return patient.weight; // TBW
      if (bmi >= 30) return adjBw; // AdjBW for obesity
      return ibw; // IBW for normal weight
    default:
      return patient.weight;
  }
}

/**
 * Calculate volume of distribution
 */
export function calculateVd(weightKg: number, vdPerKg: number = 0.7): number {
  return vdPerKg * weightKg;
}

/**
 * Calculate clearance from creatinine clearance
 */
export function calculateCL(
  crcl: number,
  offset: number = 0,
  scale: number = 1.0
): number {
  return offset + scale * (crcl / 60); // Convert mL/min to L/h reference
}

/**
 * Calculate elimination rate constant
 */
export function calculateK(cl: number, vd: number): number {
  return cl / vd;
}

/**
 * One-compartment IV infusion model at steady state
 * Accounts for elimination during infusion
 */
export function concentrationAtTime(
  dose: number, // mg
  vd: number, // L
  k: number, // h⁻¹
  tInf: number, // infusion time in hours
  interval: number, // dosing interval in hours
  t: number // time since start of current dose
): number {
  // Dose rate during infusion
  const r0 = dose / tInf; // mg/h
  
  let conc = 0;
  
  if (t <= tInf) {
    // During infusion: first-order input, first-order elimination
    conc = (r0 / (k * vd)) * (1 - Math.exp(-k * t));
  } else {
    // After infusion: first-order elimination only
    const concEndInf = (r0 / (k * vd)) * (1 - Math.exp(-k * tInf));
    conc = concEndInf * Math.exp(-k * (t - tInf));
  }
  
  return conc;
}

/**
 * Calculate steady-state concentrations with superposition
 */
export function calculateSteadyState(
  dose: number,
  vd: number,
  k: number,
  tInf: number,
  interval: number,
  maxTime: number = 48
): TimeConcentrationPoint[] {
  const dt = 0.1; // Time step in hours
  const points: TimeConcentrationPoint[] = [];
  
  for (let t = 0; t <= maxTime; t += dt) {
    let totalConc = 0;
    
    // Superposition: sum contributions from all previous doses
    const nDoses = Math.floor(t / interval) + 1;
    
    for (let i = 0; i < nDoses; i++) {
      const doseTime = i * interval;
      if (t >= doseTime) {
        const timeSinceDose = t - doseTime;
        totalConc += concentrationAtTime(dose, vd, k, tInf, interval, timeSinceDose);
      }
    }
    
    points.push({ time: t, concentration: totalConc });
  }
  
  return points;
}

/**
 * Calculate AUC using trapezoidal rule
 */
export function aucTrapz(
  points: TimeConcentrationPoint[],
  startTime: number = 0,
  endTime: number = 24
): number {
  let auc = 0;
  
  for (let i = 1; i < points.length; i++) {
    const t1 = points[i - 1].time;
    const t2 = points[i].time;
    const c1 = points[i - 1].concentration;
    const c2 = points[i].concentration;
    
    if (t1 >= startTime && t2 <= endTime) {
      auc += (t2 - t1) * (c1 + c2) / 2;
    } else if (t1 < startTime && t2 > startTime && t2 <= endTime) {
      // Interpolate at start time
      const cStart = c1 + (c2 - c1) * (startTime - t1) / (t2 - t1);
      auc += (t2 - startTime) * (cStart + c2) / 2;
    } else if (t1 >= startTime && t1 < endTime && t2 > endTime) {
      // Interpolate at end time
      const cEnd = c1 + (c2 - c1) * (endTime - t1) / (t2 - t1);
      auc += (endTime - t1) * (c1 + cEnd) / 2;
    }
  }
  
  return auc;
}

/**
 * Find peak and trough from time series
 */
export function findPeakTrough(
  points: TimeConcentrationPoint[],
  interval: number,
  tInf: number
): { peak: number; trough: number } {
  // Find steady-state cycle (last complete interval)
  const lastCycleStart = Math.floor((points[points.length - 1].time) / interval) * interval;
  const cyclePoints = points.filter(p => 
    p.time >= lastCycleStart && p.time < lastCycleStart + interval
  );
  
  if (cyclePoints.length === 0) return { peak: 0, trough: 0 };
  
  // Peak is at end of infusion
  const endInfTime = lastCycleStart + tInf;
  const peakPoint = cyclePoints.reduce((closest, point) => 
    Math.abs(point.time - endInfTime) < Math.abs(closest.time - endInfTime) ? point : closest
  );
  
  // Trough is just before next dose
  const troughPoint = cyclePoints.reduce((min, point) => 
    point.concentration < min.concentration ? point : min
  );
  
  return { 
    peak: peakPoint.concentration, 
    trough: troughPoint.concentration 
  };
}

/**
 * Main calculation function
 */
export function calculatePK(
  patient: Patient,
  regimen: Regimen,
  options: PKOptions = {
    weightStrategy: 'Auto',
    scrPolicy: 'none',
    scrFloor: 0.7,
    aucMethod: 'doseCL',
    vdPerKg: 0.7,
    clOffset: 0,
    clScale: 1.0
  }
): PKResult {
  // Calculate derived patient parameters
  const weightUsed = getWeight(patient, options.weightStrategy);
  const crcl = crclCG(
    patient.age,
    patient.sex,
    patient.scr,
    weightUsed,
    options.scrPolicy,
    options.scrFloor
  );
  
  // Calculate PK parameters
  const vd = calculateVd(weightUsed, options.vdPerKg);
  const cl = calculateCL(crcl, options.clOffset, options.clScale);
  const k = calculateK(cl, vd);
  const tInf = regimen.infusionTime / 60; // Convert minutes to hours
  
  // Calculate time course
  const timeCourse = calculateSteadyState(
    regimen.dose,
    vd,
    k,
    tInf,
    regimen.interval
  );
  
  // Find peak and trough
  const { peak, trough } = findPeakTrough(timeCourse, regimen.interval, tInf);
  
  // Calculate AUC24
  let auc24: number;
  if (options.aucMethod === 'doseCL') {
    // Simple dose/CL method for 24h AUC
    const dailyDose = (regimen.dose * 24) / regimen.interval;
    auc24 = dailyDose / cl;
  } else {
    // Trapezoidal integration
    auc24 = aucTrapz(timeCourse, 0, 24);
  }
  
  const metrics: PKMetrics = {
    crcl,
    vd,
    cl,
    k,
    weightUsed,
    peak,
    trough,
    auc24
  };
  
  return { metrics, timeCourse };
}

/**
 * Calculate loading dose suggestion
 */
export function calculateLoadingDose(
  patient: Patient,
  mgPerKg: number = 22.5
): number {
  const dose = patient.weight * mgPerKg;
  // Round to nearest 250 mg
  return Math.round(dose / 250) * 250;
}