import { create } from "zustand";
import {
  calculateBasic,
  calculateBayesian,
  type BasicCalculateResponse,
  type BayesianCalculateResponse,
  type DoseRequest,
} from "@/lib/api";
import { REGIMEN_LIMITS } from "@/lib/constraints";

export type CalcMode = "basic" | "bayesian";
export type ResultUnion = BasicCalculateResponse | BayesianCalculateResponse | undefined;

export type PatientProfile = {
  age: number;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  serumCreatinine: number;
};
export type RenalState = {
  crclMlMin: number | null;
  trend: "stable" | "improving" | "declining" | null;
};
export type InfectionState = {
  infectionType: string;
  aucTargetLow: number;
  aucTargetHigh: number;
};
export type DosingInputs = {
  doseMg: number;
  intervalHr: number;
  infusionHr: number;
};
export type SerumLevelRow = {
  id: string;
  concentration: string;
  timeHours: string;
  levelType: "peak" | "trough" | "other";
  doseTimeHours?: string;
};
export type DoseHistoryRow = {
  id: string;
  doseMg: number;
  startTimeHr: number;
  infusionHr: number;
};

function computeIBW(heightCm: number, sex: "male" | "female"): number {
  const heightIn = heightCm / 2.54;
  if (sex === "male") return 50 + 2.3 * Math.max(0, heightIn - 60);
  return 45.5 + 2.3 * Math.max(0, heightIn - 60);
}
function computeABW(weightKg: number, ibw: number): number {
  if (weightKg <= ibw) return weightKg;
  return ibw + 0.4 * (weightKg - ibw);
}
function computeCrClCockcroft(age: number, weightKg: number, scr: number, sex: "male" | "female"): number {
  if (!scr || scr <= 0) return 0;
  const factor = sex === "female" ? 0.85 : 1;
  return ((140 - age) * weightKg * factor) / (72 * scr);
}

type VancomyzerState = {
  // Patient
  patient: Partial<PatientProfile> & { age: number; sex: "male" | "female"; heightCm: number; weightKg: number; serumCreatinine: number };
  renal: RenalState;
  infection: InfectionState;
  dosing: DosingInputs;
  serumLevels: SerumLevelRow[];
  doseHistory: DoseHistoryRow[];
  mode: CalcMode;

  // Computed (derived on set)
  ibw: number | null;
  abw: number | null;
  crclCalculated: number | null;

  // Result
  result: ResultUnion;
  loading: boolean;
  error: string | null;

  // Actions
  setPatient: (p: Partial<PatientProfile>) => void;
  setRenal: (r: Partial<RenalState>) => void;
  setRenalTrend: (trend: "stable" | "improving" | "declining") => void;
  setInfection: (i: Partial<InfectionState>) => void;
  setDosing: (d: Partial<DosingInputs>) => void;
  setSerumLevels: (levels: SerumLevelRow[] | ((prev: SerumLevelRow[]) => SerumLevelRow[])) => void;
  setDoseHistory: (history: DoseHistoryRow[] | ((prev: DoseHistoryRow[]) => DoseHistoryRow[])) => void;
  setMode: (m: CalcMode) => void;
  runCalculation: () => Promise<void>;
  reset: () => void;
};

const defaultPatient = {
  age: 0,
  sex: "male" as const,
  heightCm: 0,
  weightKg: 0,
  serumCreatinine: 0,
};
const defaultDosing: DosingInputs = {
  doseMg: 1000,
  intervalHr: 12,
  infusionHr: 1,
};

function clampDose(d: number) {
  return Math.max(REGIMEN_LIMITS.minDoseMg, Math.min(REGIMEN_LIMITS.maxSingleDoseMg, d));
}
function snapInterval(hr: number) {
  return REGIMEN_LIMITS.allowedIntervalsHr.reduce(
    (best, val) => (Math.abs(val - hr) < Math.abs(best - hr) ? val : best),
    REGIMEN_LIMITS.allowedIntervalsHr[0]
  );
}

let recalcTimeout: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 180;

export const useVancomyzerStore = create<VancomyzerState>((set, get) => ({
  patient: defaultPatient,
  renal: { crclMlMin: null, trend: null },
  infection: { infectionType: "serious_mrsa", aucTargetLow: 400, aucTargetHigh: 600 },
  dosing: defaultDosing,
  serumLevels: [],
  doseHistory: [],
  mode: "basic",
  ibw: null,
  abw: null,
  crclCalculated: null,
  result: undefined,
  loading: false,
  error: null,

  setPatient: (p) => {
    set((s) => {
      const next = { ...s.patient, ...p } as VancomyzerState["patient"];
      const age = next.age ?? 0;
      const sex = next.sex ?? "male";
      const heightCm = next.heightCm ?? 0;
      const weightKg = next.weightKg ?? 0;
      const scr = next.serumCreatinine ?? 0;
      const ibw = heightCm > 0 && sex ? computeIBW(heightCm, sex) : null;
      const abw = weightKg > 0 && ibw != null ? computeABW(weightKg, ibw) : null;
      const crclCalculated =
        age > 0 && weightKg > 0 && scr > 0 ? computeCrClCockcroft(age, weightKg, scr, sex) : null;
      return {
        patient: next,
        ibw,
        abw,
        crclCalculated,
      };
    });
    scheduleRecalc();
  },

  setRenal: (r) => set((s) => ({ renal: { ...s.renal, ...r } })),
  setRenalTrend: (trend: "stable" | "improving" | "declining") =>
    set((s) => ({ renal: { ...s.renal, trend } })),
  setInfection: (i) => set((s) => ({ infection: { ...s.infection, ...i } })),

  setDosing: (d) => {
    set((s) => {
      const next = {
        doseMg: d.doseMg ?? s.dosing.doseMg,
        intervalHr: d.intervalHr ?? s.dosing.intervalHr,
        infusionHr: d.infusionHr ?? s.dosing.infusionHr,
      };
      return {
        dosing: {
          doseMg: clampDose(next.doseMg),
          intervalHr: snapInterval(Math.max(REGIMEN_LIMITS.minIntervalHr, Math.min(REGIMEN_LIMITS.maxIntervalHr, next.intervalHr))),
          infusionHr: Math.max(REGIMEN_LIMITS.minInfusionHr, Math.min(REGIMEN_LIMITS.maxInfusionHr, next.infusionHr)),
        },
      };
    });
    scheduleRecalc();
  },

  setSerumLevels: (levels) =>
    set((s) => ({
      serumLevels: typeof levels === "function" ? levels(s.serumLevels) : levels,
    })),
  setDoseHistory: (history) =>
    set((s) => ({
      doseHistory: typeof history === "function" ? history(s.doseHistory) : history,
    })),
  setMode: (m) => {
    set({ mode: m });
    scheduleRecalc();
  },

  runCalculation: async () => {
    const { patient, dosing, mode, serumLevels, doseHistory, infection } = get();
    if (
      !patient.sex ||
      !patient.age ||
      patient.age <= 0 ||
      !patient.weightKg ||
      patient.weightKg <= 0 ||
      !patient.heightCm ||
      patient.heightCm <= 0 ||
      !patient.serumCreatinine ||
      patient.serumCreatinine <= 0
    ) {
      set({ result: undefined, error: "Complete patient profile (age, sex, height, weight, serum creatinine)." });
      return;
    }

    set({ loading: true, error: null });
    try {
      if (mode === "basic") {
        const result = await calculateBasic({
          patient: {
            age: patient.age,
            sex: patient.sex,
            height_cm: patient.heightCm,
            weight_kg: patient.weightKg,
            serum_creatinine: patient.serumCreatinine,
          },
          regimen: {
            dose_mg: dosing.doseMg,
            interval_hr: dosing.intervalHr,
            infusion_hr: dosing.infusionHr,
          },
        });
        set({ result, loading: false });
      } else {
        const levelsPayload = serumLevels
          .map((row) => ({
            time: parseFloat(row.timeHours),
            concentration: parseFloat(row.concentration),
          }))
          .filter((l) => Number.isFinite(l.time) && Number.isFinite(l.concentration) && l.concentration > 0 && l.time >= 0);
        const historyPayload = doseHistory
          .filter((d) => d.doseMg > 0 && d.infusionHr > 0)
          .map((d) => ({ dose_mg: d.doseMg, start_time_hr: d.startTimeHr, infusion_hr: d.infusionHr }));

        if (levelsPayload.length < 1 || historyPayload.length < 1) {
          set({
            result: undefined,
            loading: false,
            error: "Bayesian mode requires at least one serum level and one dose in history.",
          });
          return;
        }

        const payload: DoseRequest = {
          patient: {
            age_years: patient.age,
            weight_kg: patient.weightKg,
            height_cm: patient.heightCm > 0 ? patient.heightCm : null,
            sex: patient.sex,
            serum_creatinine: patient.serumCreatinine,
            serious_infection: false,
          },
          regimen: {
            dose_mg: dosing.doseMg,
            interval_hr: dosing.intervalHr,
            infusion_hr: dosing.infusionHr,
          },
          dose_history: historyPayload,
          levels: levelsPayload.map((l) => ({
            level_mg_l: l.concentration,
            time_hours: l.time,
            level_type: null,
            dose_mg: historyPayload[0]?.dose_mg ?? null,
            infusion_hours: historyPayload[0]?.infusion_hr ?? null,
          })),
        };
        const result = await calculateBayesian(payload);
        set({ result, loading: false });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Calculation failed.";
      set({ result: undefined, error: message, loading: false });
    }
  },

  reset: () =>
    set({
      patient: defaultPatient,
      renal: { crclMlMin: null, trend: null },
      infection: { infectionType: "serious_mrsa", aucTargetLow: 400, aucTargetHigh: 600 },
      dosing: defaultDosing,
      serumLevels: [],
      doseHistory: [],
      mode: "basic",
      ibw: null,
      abw: null,
      crclCalculated: null,
      result: undefined,
      loading: false,
      error: null,
    }),
}));

function scheduleRecalc() {
  if (recalcTimeout) clearTimeout(recalcTimeout);
  recalcTimeout = setTimeout(() => {
    recalcTimeout = null;
    useVancomyzerStore.getState().runCalculation();
  }, DEBOUNCE_MS);
}
