import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { calculateInteractiveAUC, pkSimulation } from '../api';
import { normalizePatientFields } from '../services/normalizePatient';

const BayesianContext = createContext(null);

export function BayesianProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [source, setSource] = useState(null); // "population" | "bayesian" | null

  // New shared state for app-level wiring
  const [lastPatient, setLastPatient] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [initialRegimen, setInitialRegimen] = useState(null);

  const calculatePopulation = useCallback(async (patientLike) => {
    setLoading(true); setError(null);
    try {
      const patient = normalizePatientFields(patientLike);
      const data = await calculateInteractiveAUC({ patient, regimen: {} });
      const withMeta = { ...data, meta: { source: 'population' } };
      setResult(withMeta);
      setSource('population');
      setLastPatient(patient);
      setLastResult(withMeta);
      return withMeta;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateBayesian = useCallback(async (patientLike, levels = []) => {
    setLoading(true); setError(null);
    try {
      const patient = normalizePatientFields(patientLike);
      const data = await calculateInteractiveAUC({ patient, regimen: {}, levels });
      const withMeta = { ...data, meta: { source: 'bayesian', levels_count: Array.isArray(levels) ? levels.length : 0 } };
      setResult(withMeta);
      setSource('bayesian');
      setLastPatient(patient);
      setLastResult(withMeta);
      return withMeta;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  // Smart wrapper: Bayesian if >=1 level else population
  const calculate = useCallback(async (patientLike) => {
    const hasLevels = Array.isArray(patientLike?.levels) && patientLike.levels.length > 0;
    if (hasLevels) return calculateBayesian(patientLike, patientLike.levels);
    return calculatePopulation(patientLike);
  }, [calculateBayesian, calculatePopulation]);

  // Interactive now uses calculateInteractiveAUC with nested payload
  const calculateInteractive = useCallback(async (patientLike, regimen) => {
    const patient = normalizePatientFields(patientLike);
    const levels = Array.isArray(patientLike?.levels) ? patientLike.levels : [];
    setLastPatient(patient);
    if (regimen) setInitialRegimen(regimen);
    const data = await calculateInteractiveAUC({ patient, regimen: regimen || {}, levels });
    const withMeta = { ...data, meta: { source: levels.length > 0 ? 'bayesian' : 'population', levels_count: levels.length } };
    setResult(withMeta);
    setLastResult(withMeta);
    return withMeta;
  }, []);

  const simulate = useCallback(async (payload) => {
    setLoading(true); setError(null);
    try {
      return await pkSimulation(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(() => ({
    loading, error, result, source,
    // exposed
    calculate, calculatePopulation, calculateBayesian, calculateInteractive, simulate,
    lastResult: result, isLoading: loading,
    // new shared state
    lastPatient, setLastPatient, lastResultState: lastResult, setLastResult,
    initialRegimen, setInitialRegimen,
  }), [loading, error, result, source, calculate, calculatePopulation, calculateBayesian, calculateInteractive, simulate, lastPatient, lastResult, initialRegimen]);

  return <BayesianContext.Provider value={value}>{children}</BayesianContext.Provider>;
}

export function useBayesian() {
  const ctx = useContext(BayesianContext);
  if (!ctx) throw new Error('useBayesian must be used within a BayesianProvider');
  return ctx;
}
