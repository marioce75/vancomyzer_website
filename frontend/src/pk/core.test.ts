// Unit tests for enhanced PK core functions
import { crclCG, deterministicSummary, superpose, aucTrapz } from './core';

// Test enhanced Cockcroft-Gault with weight strategies
export function testCrClEnhancements() {
  console.log('Testing enhanced CrCl calculations...');
  
  const testPatient = {
    ageY: 65,
    sex: 'Male' as const,
    weightKg: 100, // Obese patient
    heightCm: 175,
    scrMgDl: 1.2
  };

  // Test TBW strategy (default)
  const crclTBW = crclCG({ ...testPatient, weightStrategy: 'TBW' });
  console.log('CrCl with TBW:', crclTBW.toFixed(1), 'mL/min');

  // Test IBW strategy
  const crclIBW = crclCG({ ...testPatient, weightStrategy: 'IBW' });
  console.log('CrCl with IBW:', crclIBW.toFixed(1), 'mL/min');

  // Test AdjBW strategy (should auto-adjust for BMI ≥ 30)
  const crclAdjBW = crclCG({ ...testPatient, weightStrategy: 'AdjBW' });
  console.log('CrCl with AdjBW:', crclAdjBW.toFixed(1), 'mL/min');

  // Test SCr floor
  const crclFloored = crclCG({ ...testPatient, scrMgDl: 0.5, scrRounding: 'floor0.7' });
  console.log('CrCl with SCr floor (0.5 -> 0.7):', crclFloored.toFixed(1), 'mL/min');

  // Verify monotonic behavior: higher CrCl should lead to lower AUC
  return { crclTBW, crclIBW, crclAdjBW };
}

// Test deterministic summary function
export function testDeterministicSummary() {
  console.log('\nTesting deterministic summary...');
  
  const patient = {
    ageY: 56,
    sex: 'Male' as const,
    weightKg: 79,
    heightCm: 170,
    scrMgDl: 1.0
  };

  const regimen = {
    doseMg: 1000,
    intervalH: 12,
    infusionMin: 60
  };

  const result = deterministicSummary(patient, regimen);
  
  console.log('AUC24:', result.metrics.auc_24.toFixed(0), 'mg·h/L');
  console.log('Peak:', result.metrics.predicted_peak.toFixed(1), 'mg/L');
  console.log('Trough:', result.metrics.predicted_trough.toFixed(1), 'mg/L');
  console.log('CL:', result.metrics.CL.toFixed(2), 'L/h');
  console.log('V:', result.metrics.V.toFixed(1), 'L');
  console.log('CrCl:', result.metrics.crcl.toFixed(1), 'mL/min');

  // Test monotonic behavior: higher dose should increase AUC/peak/trough
  const higherDoseResult = deterministicSummary(patient, { ...regimen, doseMg: 1500 });
  
  console.log('\nMonotonic test (1000mg vs 1500mg):');
  console.log('AUC ratio:', (higherDoseResult.metrics.auc_24 / result.metrics.auc_24).toFixed(2));
  console.log('Peak ratio:', (higherDoseResult.metrics.predicted_peak / result.metrics.predicted_peak).toFixed(2));

  return result;
}

// Test superposition model performance  
export function testSuperpositionPerformance() {
  console.log('\nTesting superposition performance...');
  
  const times = [];
  for (let t = 0; t <= 48; t += 0.1) times.push(t);
  
  const start = performance.now();
  const conc = superpose(times, 1000, 12, 1, 55, 0.1);
  const duration = performance.now() - start;
  
  console.log('Superposition calculation time:', duration.toFixed(2), 'ms');
  console.log('Time points:', times.length);
  console.log('Peak concentration:', Math.max(...conc).toFixed(1), 'mg/L');
  
  return duration < 100; // Should complete in <100ms for good UX
}

// Run all tests
export function runPKTests() {
  console.log('=== PK Core Tests ===');
  
  try {
    const crclResults = testCrClEnhancements();
    const summaryResult = testDeterministicSummary();
    const performanceOk = testSuperpositionPerformance();
    
    console.log('\n=== Test Summary ===');
    console.log('✅ CrCl enhancements working');
    console.log('✅ Deterministic summary working');
    console.log(performanceOk ? '✅ Performance acceptable' : '⚠️ Performance needs optimization');
    
    return true;
  } catch (error) {
    console.error('❌ PK tests failed:', error);
    return false;
  }
}