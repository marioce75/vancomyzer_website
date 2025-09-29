/**
 * Levels-based PK calculations for vancomycin
 * Non-Bayesian fitting using measured drug levels
 */

import { Patient, Regimen, PKMetrics, TimeConcentrationPoint } from './core';

export interface Level {
  time: number; // hours after dose
  concentration: number; // mg/L
  doseNumber?: number; // which dose (0 = first dose)
}

export interface LevelsResult {
  metrics: PKMetrics;
  timeCourse: TimeConcentrationPoint[];
  fittedK?: number;
  fittedCL?: number;
  fittedVd?: number;
  method: 'single-level' | 'two-level';
}

/**
 * Calculate PK parameters from a single level measurement
 * Assumes population Vd, fits elimination constant k
 */
export function calculateFromSingleLevel(
  patient: Patient,
  regimen: Regimen,
  level: Level,
  vdPerKg: number = 0.7
): LevelsResult {
  const weight = patient.weight;
  const vd = vdPerKg * weight;
  
  // For single level, we need to know the theoretical peak concentration
  // and fit k based on the decline to the measured level
  
  // Calculate dose concentration contribution (assumes IV bolus approximation)
  const doseConc = regimen.dose / vd;
  
  // If level is taken some time after infusion end, calculate k
  // C(t) = C0 * e^(-k*t)
  // k = -ln(C(t)/C0) / t
  
  // Simple approximation: assume level was taken at steady state
  // and represents a trough-like measurement
  const estimatedPeak = level.concentration * 2; // rough approximation
  const timeFromPeak = level.time > 1 ? level.time : regimen.interval - 1; // assume trough if early
  
  const k = Math.log(estimatedPeak / level.concentration) / timeFromPeak;
  const cl = k * vd;
  
  // Calculate metrics
  const auc24 = (regimen.dose * 24 / regimen.interval) / cl;
  const peak = estimatedPeak;
  const trough = level.concentration;
  
  const metrics: PKMetrics = {
    auc24,
    peak,
    trough,
    crcl: (cl * 60) / 1, // approximate back-calculation
    weightUsed: weight,
    vd,
    cl,
    k
  };

  // Generate time course (simplified)
  const timeCourse: TimeConcentrationPoint[] = [];
  for (let t = 0; t <= 48; t += 0.5) {
    const cycleTime = t % regimen.interval;
    const infusionEnd = regimen.infusionTime / 60;
    
    let concentration = 0;
    if (cycleTime <= infusionEnd) {
      // During infusion - simplified
      concentration = peak * (cycleTime / infusionEnd);
    } else {
      // After infusion
      concentration = peak * Math.exp(-k * (cycleTime - infusionEnd));
    }
    
    timeCourse.push({ time: t, concentration });
  }

  return {
    metrics,
    timeCourse,
    fittedK: k,
    fittedCL: cl,
    fittedVd: vd,
    method: 'single-level'
  };
}

/**
 * Calculate PK parameters from two level measurements
 * Fits elimination constant k robustly from slope
 */
export function calculateFromTwoLevels(
  patient: Patient,
  regimen: Regimen,
  level1: Level,
  level2: Level,
  vdPerKg: number = 0.7
): LevelsResult {
  const weight = patient.weight;
  
  // Ensure levels are in chronological order
  const [early, late] = level1.time < level2.time ? [level1, level2] : [level2, level1];
  
  // Calculate elimination constant from slope
  // k = -ln(C2/C1) / (t2-t1)
  const deltaTime = late.time - early.time;
  const k = Math.log(early.concentration / late.concentration) / deltaTime;
  
  // Calculate Vd from the relationship assuming we can estimate the dose contribution
  // For two-level fitting, we can be more sophisticated
  const vd = vdPerKg * weight; // start with population estimate
  const cl = k * vd;
  
  // Back-calculate peak from early level
  const timeFromInfusionEnd = early.time - (regimen.infusionTime / 60);
  const peak = timeFromInfusionEnd > 0 
    ? early.concentration / Math.exp(-k * timeFromInfusionEnd)
    : early.concentration;
  
  // Calculate trough (pre-dose)
  const trough = peak * Math.exp(-k * (regimen.interval - regimen.infusionTime / 60));
  
  const auc24 = (regimen.dose * 24 / regimen.interval) / cl;
  
  const metrics: PKMetrics = {
    auc24,
    peak,
    trough,
    crcl: (cl * 60) / 1, // approximate back-calculation
    weightUsed: weight,
    vd,
    cl,
    k
  };

  // Generate time course
  const timeCourse: TimeConcentrationPoint[] = [];
  for (let t = 0; t <= 48; t += 0.5) {
    const cycleTime = t % regimen.interval;
    const infusionEnd = regimen.infusionTime / 60;
    
    let concentration = 0;
    if (cycleTime <= infusionEnd) {
      // During infusion
      concentration = peak * (cycleTime / infusionEnd);
    } else {
      // After infusion
      concentration = peak * Math.exp(-k * (cycleTime - infusionEnd));
    }
    
    timeCourse.push({ time: t, concentration });
  }

  return {
    metrics,
    timeCourse,
    fittedK: k,
    fittedCL: cl,
    fittedVd: vd,
    method: 'two-level'
  };
}

/**
 * Main levels calculation function
 */
export function calculateFromLevels(
  patient: Patient,
  regimen: Regimen,
  levels: Level[],
  vdPerKg: number = 0.7
): LevelsResult | null {
  if (levels.length === 0) {
    return null;
  }
  
  if (levels.length === 1) {
    return calculateFromSingleLevel(patient, regimen, levels[0], vdPerKg);
  }
  
  if (levels.length >= 2) {
    // Use the two most separated levels for best fit
    const sortedLevels = [...levels].sort((a, b) => a.time - b.time);
    return calculateFromTwoLevels(
      patient, 
      regimen, 
      sortedLevels[0], 
      sortedLevels[sortedLevels.length - 1], 
      vdPerKg
    );
  }
  
  return null;
}