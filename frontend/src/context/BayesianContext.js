import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { calculateDosing, bayesianOptimization, pkSimulation } from '../api';
import { normalizePatientFields } from '../services/normalizePatient';

const BayesianContext = createContext(null);

export function BayesianProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [source, setSource] = useState(null); // "population" | "bayesian" | null

  const calculatePopulation = useCallback(async (patientLike) => {
    setLoading(true); setError(null);
    try {
      const normalized = normalizePatientFields(patientLike);
      const data = await calculateDosing(normalized);
      setResult({ ...data, meta: { source: 'population' } });
      setSource('population');
      return data;
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
      const normalized = normalizePatientFields(patientLike);
      const data = await bayesianOptimization({ patient: normalized, levels });
      setResult({ ...data, meta: { source: 'bayesian', levels_count: Array.isArray(levels) ? levels.length : 0 } });
      setSource('bayesian');
      return data;
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

  // Interactive: allow regimen changes (still delegate to bayesian if levels present)
  const calculateInteractive = useCallback(async (patientLike) => {
    const normalized = normalizePatientFields(patientLike);
    const levels = Array.isArray(patientLike?.levels) ? patientLike.levels : [];
    // Attach regimen passthrough if backend supports in future; currently unused by API
    const data = levels.length > 0
      ? await bayesianOptimization({ patient: normalized, levels })
      : await calculateDosing(normalized);
    setResult({ ...data, meta: { source: levels.length > 0 ? 'bayesian' : 'population', levels_count: levels.length } });
    return data;
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
    calculate, calculatePopulation, calculateBayesian, calculateInteractive, simulate,
    lastResult: result, isLoading: loading
  }), [loading, error, result, source, calculate, calculatePopulation, calculateBayesian, calculateInteractive, simulate]);

  return <BayesianContext.Provider value={value}>{children}</BayesianContext.Provider>;
}

export function useBayesian() {
  const ctx = useContext(BayesianContext);
  if (!ctx) throw new Error('useBayesian must be used within a BayesianProvider');
  return ctx;
}
