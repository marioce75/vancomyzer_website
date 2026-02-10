// Configurable safety guardrails for deterministic dosing UI.
// TODO: Verify deterministic endpoint matches Excel parity logic; adjust if backend differs.
// Adjust values here to reflect institutional policy.
export const AUC_TARGET = {
  low: 400,
  high: 600,
};

export const REGIMEN_LIMITS = {
  minDoseMg: 0,
  maxSingleDoseMg: 2000,
  maxDailyDoseMg: 4500,
  minIntervalHr: 6,
  maxIntervalHr: 48,
  allowedIntervalsHr: [6, 8, 12, 24, 48],
  minInfusionHr: 0.1,
  maxInfusionHr: 6,
};

