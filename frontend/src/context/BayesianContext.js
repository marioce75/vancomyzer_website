import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { BayesianAPI } from '../services/api';

/**
 * Shared Bayesian dosing context
 * Keeps a single source of truth for patient, levels, current regimen & bayesian result.
 */
const BayesianContext = createContext(null);

export function BayesianProvider({ children }) {
  const [patient, setPatient] = useState(null); // raw form patient
  const [levels, setLevels] = useState(null);   // optional levels array
  const [currentRegimen, setRegimen] = useState(null); // { dose_mg, interval_h }
  const [bayesResult, setBayesResult] = useState(null); // normalized result
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Debounce timer for interactive updates
  const debounceRef = useRef(null);

  /** Invoke interactive Bayesian update with debounce */
  const updateRegimenDebounced = useCallback((dose_mg, interval_h) => {
    setRegimen({ dose_mg, interval_h });
    if (!patient) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true); setError(null);
        const updated = await BayesianAPI.interactive(patient, levels, { dose_mg, interval_h });
        setBayesResult(updated);
      } catch (e) { console.error('[Bayes interactive] error', e); setError(e.message || 'Update failed'); }
      finally { setLoading(false); }
    }, 400); // 400ms debounce
  }, [patient, levels]);

  /** Perform initial Bayesian submission */
  const submitInitial = useCallback(async (patientData, levelsInput, maybeRegimen) => {
    try {
      setLoading(true); setError(null);
      setPatient(patientData);
      setLevels(levelsInput || null);
      const result = await BayesianAPI.initial(patientData, levelsInput || null, maybeRegimen || null);
      setBayesResult(result);
      // Seed regimen from explicit param > recommendation > maybeRegimen fallback
      const recReg = maybeRegimen || result?.recommendation?.regimen || null;
      setRegimen(recReg);
      return result;
    } catch (e) { setError(e.message || 'Bayesian optimization failed'); throw e; }
    finally { setLoading(false); }
  }, []);

  const value = {
    patient, levels, currentRegimen, bayesResult,
    setPatient, setLevels, setRegimen, setBayesResult,
    loading, error,
    submitInitial,
    updateRegimenDebounced,
  };

  return <BayesianContext.Provider value={value}>{children}</BayesianContext.Provider>;
}

export function useBayesian(){
  const ctx = useContext(BayesianContext);
  if(!ctx) throw new Error('useBayesian must be used within BayesianProvider');
  return ctx;
}

export default useBayesian;
