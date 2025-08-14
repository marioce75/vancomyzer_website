import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { calculateDose, interactiveUpdate } from '../services/api';

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
  const debounceRef = useRef(null);

  /** Debounced regimen update (Bayesian if levels else population with regimen overlay) */
  const updateRegimenDebounced = useCallback((dose_mg, interval_h) => {
    setRegimen({ dose_mg, interval_h });
    if (!patient) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true); setError(null);
        const updated = await interactiveUpdate(patient, levels, { dose_mg, interval_h });
        setBayesResult(updated);
      } catch (e) { setError(e.message || 'Update failed'); }
      finally { setLoading(false); }
    }, 400);
  }, [patient, levels]);

  /** Perform initial dosing submission (Bayesian if levels else population) */
  const submitInitial = useCallback(async (patientData, levelsInput = [], maybeRegimen = null) => {
    setError(null);
    setLoading(true);
    try {
      setPatient(patientData);
      setLevels(levelsInput || null);
      const result = await calculateDose(patientData, levelsInput);
      setBayesResult(result);
      // Seed regimen from explicit param > recommendation > maybeRegimen fallback
      const recReg = maybeRegimen || result?.recommendation?.regimen || null;
      setRegimen(recReg);
      setLoading(false);
      return result;
    } catch (e) {
      setLoading(false);
      setError(e.message || 'Calculation failed');
      throw e;
    }
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
