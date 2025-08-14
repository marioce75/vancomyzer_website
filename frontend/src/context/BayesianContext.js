import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from 'react';
// Replace legacy services/api import with new unified helper
import { submitDosing, bayesianOptimization, calculateDosing } from '../api';

/**
 * Shared Bayesian dosing context
 * Keeps a single source of truth for patient, levels, current regimen & bayesian result.
 */
const BayesianContext = createContext(null);

export function BayesianProvider({ children }) {
  const [patient, setPatient] = useState({});
  const [levels, setLevels] = useState([]); // array of level objects (will be normalized by api helper)
  const [regimen, setRegimen] = useState(null);
  const [result, setResult] = useState(null); // Stores either population DosingResult or BayesianResult
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef();

  // Core calculate: always route through submitDosing unless explicitly forced elsewhere
  const calculate = useCallback(async (patientOverride) => {
    setLoading(true); setError(null);
    try {
      const targetPatient = patientOverride || patient;
      if (!targetPatient) throw new Error('No patient data');
      const data = await submitDosing({ patient: targetPatient, levels });
      // If regimen was previously user-modified in population mode, re-attach
      if (regimen && data && data.recommendation) {
        data.recommendation.regimen = regimen;
      }
      setResult(data);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Calculation failed');
    } finally {
      setLoading(false);
    }
  }, [patient, levels, regimen]);

  // Debounced regimen update logic (client-side overlay only)
  const updateRegimenDebounced = useCallback((dose_mg, interval_h) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRegimen({ dose_mg, interval_h });
      setResult(prev => {
        if (!prev) return prev;
        // For population model responses, recommendation exists; for Bayesian it may not.
        const copy = { ...prev };
        if (!copy.recommendation) copy.recommendation = {};
        copy.recommendation.regimen = { dose_mg, interval_h };
        return copy;
      });
    }, 400);
  }, []);

  // Explicit re-fit (e.g., when levels added or changed) per spec C
  const refit = useCallback(async () => {
    if (!patient) return;
    setLoading(true); setError(null);
    try {
      let data;
      if (levels && levels.length > 0) {
        data = await bayesianOptimization({ patient, levels });
      } else {
        data = await calculateDosing(patient);
        if (regimen && data && data.recommendation) {
          data.recommendation.regimen = regimen;
        }
      }
      setResult(data);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Refit failed');
    } finally {
      setLoading(false);
    }
  }, [patient, levels, regimen]);

  const value = useMemo(() => ({
    patient, setPatient,
    levels, setLevels,
    regimen, setRegimen,
    result, setResult,
    loading, error,
    calculate, refit,
    updateRegimenDebounced,
    // Backwards compatibility for components expecting these names
    bayesResult: result,
    currentRegimen: regimen,
  }), [patient, levels, regimen, result, loading, error, calculate, refit, updateRegimenDebounced]);

  return <BayesianContext.Provider value={value}>{children}</BayesianContext.Provider>;
}

export function useBayesian() {
  const ctx = useContext(BayesianContext);
  if (!ctx) throw new Error('useBayesian must be used within BayesianProvider');
  return ctx;
}

export default useBayesian;
