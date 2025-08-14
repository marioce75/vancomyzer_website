import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { submitDosing, calculateDosing, bayesianOptimization, pkSimulation } from '../api';
// submitDosing intentionally imported for potential future advanced workflows
void submitDosing;

const BayesianContext = createContext(null);

export function BayesianProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [source, setSource] = useState(null); // "population" | "bayesian" | null

  const calculatePopulation = useCallback(async (patient) => {
    setLoading(true); setError(null);
    try {
      const data = await calculateDosing(patient);
      setResult(data);
      setSource('population');
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateBayesian = useCallback(async (patient, levels) => {
    setLoading(true); setError(null);
    try {
      const data = await bayesianOptimization({ patient, levels });
      setResult(data);
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
  const calculate = useCallback(async (patient, levels = []) => {
    const hasLevels = Array.isArray(levels) && levels.length > 0;
    if (hasLevels) return calculateBayesian(patient, levels);
    return calculatePopulation(patient);
  }, [calculateBayesian, calculatePopulation]);

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
    calculate, calculatePopulation, calculateBayesian, simulate,
  }), [loading, error, result, source, calculate, calculatePopulation, calculateBayesian, simulate]);

  return <BayesianContext.Provider value={value}>{children}</BayesianContext.Provider>;
}

export function useBayesian() {
  const ctx = useContext(BayesianContext);
  if (!ctx) throw new Error('useBayesian must be used within a BayesianProvider');
  return ctx;
}
