import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from 'react';
import * as vancomyzerAPI from '../services/api';

/**
 * Shared Bayesian dosing context
 * Keeps a single source of truth for patient, levels, current regimen & bayesian result.
 */
const BayesianContext = createContext(null);

export function BayesianProvider({ children }) {
  const [patient, setPatient] = useState({});
  const [levels, setLevels] = useState([]);
  const [regimen, setRegimen] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef();

  const calculate = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vancomyzerAPI.calculateDosingSmart(patient, levels);
      setResult(data);
    } finally {
      setLoading(false);
    }
  }, [patient, levels]);

  const interactive = useCallback(async () => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await vancomyzerAPI.interactiveUpdate(patient, levels, regimen);
        setResult(data);
      } catch (e) {
        console.error(e);
      }
    }, 400);
  }, [patient, levels, regimen]);

  const value = useMemo(
    () => ({
      patient, setPatient,
      levels, setLevels,
      regimen, setRegimen,
      result, setResult,
      loading,
      calculate,
      interactive,
    }),
    [patient, levels, regimen, result, loading, calculate, interactive]
  );

  return <BayesianContext.Provider value={value}>{children}</BayesianContext.Provider>;
}

export function useBayesian() {
  const ctx = useContext(BayesianContext);
  if (!ctx) throw new Error('useBayesian must be used within BayesianProvider');
  return ctx;
}

export default useBayesian;
