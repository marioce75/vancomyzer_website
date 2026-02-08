import { createPortal } from "react-dom";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import {
  calculateBasic,
  calculateBayesian,
  type BasicCalculateResponse,
  type BayesianCalculateResponse,
  ApiError,
} from "@/lib/api";
import { REGIMEN_LIMITS } from "@/lib/constraints";

export type CalculatorFormHandle = {
  adjustDose: (delta: { doseMg?: number; intervalHr?: number }) => void;
  recompute: (next: { doseMg: number; intervalHr: number; infusionHr: number }) => void;
};

export type CalculatorFormProps = {
  onResult: (result: BasicCalculateResponse | BayesianCalculateResponse | undefined, mode: "basic" | "bayesian") => void;
  onLoadingChange?: (loading: boolean) => void;
  onReset?: () => void;
  onInputsChange?: (payload: {
    mode: "basic" | "bayesian";
    regimen?: { doseMg: number; intervalHr: number; infusionHr: number };
    patient?: { age_yr: number; sex: "male" | "female"; height_cm: number; weight_kg: number; serum_creatinine: number };
    levels?: Array<{ time_hr: number; concentration_mg_l: number }>;
    dose_history?: Array<{ dose_mg: number; start_time_hr: number; infusion_hr: number }>;
  }) => void;
};

type UiError = { message: string; issues?: Array<{ path: string; message: string }> };

function formatValidationLoc(loc: Array<string | number>): string {
  // FastAPI locs look like ["body", "fieldName", 0, "subField"]
  return loc.filter((p) => p !== "body").join(".");
}

type PatientStorage = {
  age: string;
  sex: "male" | "female" | "";
  height: string;
  heightUnit: "cm" | "in";
  weight: string;
  weightUnit: "kg" | "lb";
  scr: string;
  mic: string;
  aucLow: string;
  aucHigh: string;
};

const PATIENT_STORAGE_KEY = "vancomyzer.patient.v1";
const DEFAULT_PATIENT: PatientStorage = {
  age: "",
  sex: "",
  height: "",
  heightUnit: "cm",
  weight: "",
  weightUnit: "kg",
  scr: "",
  mic: "",
  aucLow: "",
  aucHigh: "",
};

function readPatientStorage(): PatientStorage | null {
  try {
    const raw = window.localStorage.getItem(PATIENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PatientStorage>;
    return {
      ...DEFAULT_PATIENT,
      ...parsed,
      sex: parsed.sex === "female" || parsed.sex === "male" ? parsed.sex : "",
      heightUnit: parsed.heightUnit === "in" ? "in" : "cm",
      weightUnit: parsed.weightUnit === "lb" ? "lb" : "kg",
    };
  } catch {
    return null;
  }
}

function writePatientStorage(next: PatientStorage) {
  try {
    window.localStorage.setItem(PATIENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function normalizeNumericInput(value: string): string {
  if (value === "") return "";
  const trimmed = value.trim();
  if (trimmed === ".") return "0.";
  const negative = trimmed.startsWith("-");
  const raw = negative ? trimmed.slice(1) : trimmed;
  if (raw === "") return "";
  if (raw.includes(".")) {
    const [intPart, fracPart = ""] = raw.split(".");
    const intClean = intPart.replace(/^0+(?=\d)/, "");
    const intFinal = intClean === "" ? "0" : intClean;
    return `${negative ? "-" : ""}${intFinal}.${fracPart}`;
  }
  const intClean = raw.replace(/^0+(?=\d)/, "");
  const intFinal = intClean === "" ? "0" : intClean;
  return `${negative ? "-" : ""}${intFinal}`;
}

const CalculatorForm = forwardRef<CalculatorFormHandle, CalculatorFormProps>(({ onResult, onLoadingChange, onReset, onInputsChange }, ref) => {
  const initialPatient = useMemo(() => readPatientStorage() ?? DEFAULT_PATIENT, []);
  const [age, setAge] = useState(initialPatient.age);
  const [sex, setSex] = useState<"male" | "female" | "">(initialPatient.sex);
  const [height, setHeight] = useState(initialPatient.height);
  const [heightUnit, setHeightUnit] = useState<"cm" | "in">(initialPatient.heightUnit);
  const [weight, setWeight] = useState(initialPatient.weight);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">(initialPatient.weightUnit);
  const [scr, setScr] = useState(initialPatient.scr);
  const [mic, setMic] = useState(initialPatient.mic);
  const [aucLow, setAucLow] = useState(initialPatient.aucLow);
  const [aucHigh, setAucHigh] = useState(initialPatient.aucHigh);
  const [mode, setMode] = useState<"basic" | "bayesian">("basic");
  const [doseMg, setDoseMg] = useState(1000);
  const [intervalHr, setIntervalHr] = useState(12);
  const [infusionHr, setInfusionHr] = useState(1.0);
  const [levels, setLevels] = useState<Array<{ timeHr: string; concentration: string }>>([]);
  const [doseHistory, setDoseHistory] = useState<Array<{ timeHr: number; doseMg: number; infusionHr: number }>>([]);
  const [error, setError] = useState<UiError | null>(null);
  const [dosingHost, setDosingHost] = useState<HTMLElement | null>(null);
  const submitTimer = useRef<number | null>(null);

  const isBayesian = mode === "bayesian";

  const ageNum = useMemo(() => Number.parseFloat(age), [age]);
  const heightNum = useMemo(() => Number.parseFloat(height), [height]);
  const weightNum = useMemo(() => Number.parseFloat(weight), [weight]);
  const scrNum = useMemo(() => Number.parseFloat(scr), [scr]);
  const micNum = useMemo(() => Number.parseFloat(mic), [mic]);
  const aucLowNum = useMemo(() => Number.parseFloat(aucLow), [aucLow]);
  const aucHighNum = useMemo(() => Number.parseFloat(aucHigh), [aucHigh]);

  const heightCm = useMemo(() => (heightUnit === "cm" ? heightNum : Math.round(heightNum * 2.54)), [heightNum, heightUnit]);
  const weightKg = useMemo(() => (weightUnit === "kg" ? weightNum : Math.round(weightNum * 0.453592)), [weightNum, weightUnit]);

  useEffect(() => {
    writePatientStorage({
      age,
      sex,
      height,
      heightUnit,
      weight,
      weightUnit,
      scr,
      mic,
      aucLow,
      aucHigh,
    });
  }, [age, sex, height, heightUnit, weight, weightUnit, scr, mic, aucLow, aucHigh]);

  useEffect(() => {
    setDosingHost(document.getElementById("dosing-panel-host"));
  }, []);

  function parseNumericInput(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }

  function normalizeNumericInputStrict(value: string): string {
    const num = parseNumericInput(value);
    if (num === null) return "";
    return String(num);
  }

  const levelHasValue = levels.some((lv) => {
    const conc = parseNumericInput(lv.concentration);
    return conc !== null && conc > 0;
  });
  const doseHasValue = doseHistory.some((d) => Number.isFinite(d.doseMg) && d.doseMg > 0);
  const micValid = Number.isFinite(micNum) && micNum >= 0.5 && micNum <= 2;
  const intervalValid =
    Number.isFinite(intervalHr) &&
    intervalHr >= REGIMEN_LIMITS.minIntervalHr &&
    intervalHr <= REGIMEN_LIMITS.maxIntervalHr;
  const infusionValid =
    Number.isFinite(infusionHr) &&
    infusionHr >= REGIMEN_LIMITS.minInfusionHr &&
    infusionHr <= REGIMEN_LIMITS.maxInfusionHr;
  const patientValid =
    sex !== "" &&
    Number.isFinite(ageNum) &&
    ageNum > 0 &&
    Number.isFinite(weightKg) &&
    weightKg > 0 &&
    Number.isFinite(heightCm) &&
    heightCm > 0 &&
    Number.isFinite(scrNum) &&
    scrNum > 0;
  const bayesValid = !isBayesian || (levelHasValue && doseHasValue);
  const formValid = patientValid && micValid && intervalValid && infusionValid && bayesValid;
  const bayesMissing = isBayesian && (!levelHasValue || !doseHasValue);

  function updateLevelRow(idx: number, field: "timeHr" | "concentration", value: string) {
    setLevels((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }

  function addLevelRow() {
    setLevels((prev) => [...prev, { timeHr: "", concentration: "" }]);
  }

  function removeLevelRow(idx: number) {
    setLevels((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateDoseRow(idx: number, field: "timeHr" | "doseMg" | "infusionHr", value: number) {
    setDoseHistory((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }

  function addDoseRow() {
    setDoseHistory((prev) => [...prev, { timeHr: (prev.at(-1)?.timeHr ?? 0) + intervalHr, doseMg, infusionHr }]);
  }

  function removeDoseRow(idx: number) {
    setDoseHistory((prev) => prev.filter((_, i) => i !== idx));
  }

  function LabelHelp({ label, help }: { label: string; help: string }) {
    return (
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground">
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{help}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  async function onSubmit(overrides?: { doseMg?: number; intervalHr?: number; infusionHr?: number }) {
    onLoadingChange?.(true);
    setError(null);
    try {
      const effectiveDose = overrides?.doseMg ?? doseMg;
      const effectiveInterval = overrides?.intervalHr ?? intervalHr;
      const effectiveInfusion = overrides?.infusionHr ?? infusionHr;
    if (sex !== "" && patientValid) {
      onInputsChange?.({
        mode,
        regimen: { doseMg: effectiveDose, intervalHr: effectiveInterval, infusionHr: effectiveInfusion },
        patient: {
          age_yr: Number(ageNum),
          sex,
          height_cm: Number(heightCm),
          weight_kg: Number(weightKg),
          serum_creatinine: Number(scrNum),
        },
      });
    } else {
      onInputsChange?.({
        mode,
        regimen: { doseMg: effectiveDose, intervalHr: effectiveInterval, infusionHr: effectiveInfusion },
      });
    }
      if (mode === "basic") {
        const result = await calculateBasic({
          patient: {
            age: Number(ageNum),
            sex,
            height_cm: Number(heightCm),
            weight_kg: Number(weightKg),
            serum_creatinine: Number(scrNum),
          },
          regimen: {
            dose_mg: Number(effectiveDose),
            interval_hr: Number(effectiveInterval),
            infusion_hr: Number(effectiveInfusion),
          },
          mic: Number(micNum),
        });
        onResult(result, "basic");
      } else {
        const levelsPayload = levels
          .map((lv) => ({
            time: parseNumericInput(lv.timeHr),
            concentration: parseNumericInput(lv.concentration),
          }))
          .filter((lv) => lv.concentration !== null && lv.time !== null && lv.concentration > 0)
          .map((lv) => ({ time_hr: Number(lv.time), concentration_mg_l: Number(lv.concentration) }));
        if (levelsPayload.length < 1) {
          throw new Error("Enter at least one vancomycin level for Bayesian mode.");
        }
        const historyPayload = doseHistory
          .filter((d) => Number.isFinite(d.doseMg) && d.doseMg > 0)
          .map((d) => ({ dose_mg: Number(d.doseMg), start_time_hr: Number(d.timeHr), infusion_hr: Number(d.infusionHr) }));
        if (historyPayload.length < 1) {
          throw new Error("Enter at least one dose event for Bayesian mode.");
        }
        onInputsChange?.({ mode: "bayesian", levels: levelsPayload, dose_history: historyPayload });
        const result = await calculateBayesian({
          patient: {
            age_yr: Number(ageNum),
            sex,
            weight_kg: Number(weightKg),
            serum_creatinine_mg_dl: Number(scrNum),
          },
          mic: Number(micNum),
          dose_history: historyPayload,
          levels: levelsPayload,
          target_low: Number.isFinite(aucLowNum) ? Number(aucLowNum) : undefined,
          target_high: Number.isFinite(aucHighNum) ? Number(aucHighNum) : undefined,
        });
        onResult(result, "bayesian");
      }
    } catch (e) {
      console.error(e);
      const err = e as unknown;
      if (err instanceof ApiError) {
        const issues = err.errors?.map((x) => ({ path: formatValidationLoc(x.loc), message: x.msg }));
        setError({ message: err.detail || err.message, issues });
      } else if (err instanceof Error) {
        setError({ message: err.message });
      } else {
        setError({ message: "Request failed" });
      }
      onResult(undefined, mode);
    } finally {
      onLoadingChange?.(false);
    }
  }

  function queueSubmit(next: { doseMg?: number; intervalHr?: number; infusionHr?: number }) {
    if (submitTimer.current) {
      window.clearTimeout(submitTimer.current);
    }
    submitTimer.current = window.setTimeout(() => {
      onSubmit(next);
    }, 200);
  }

  function recompute(next: { doseMg: number; intervalHr: number; infusionHr: number }) {
    setDoseMg(next.doseMg);
    setIntervalHr(next.intervalHr);
    setInfusionHr(next.infusionHr);
    setDoseHistory((prev) => {
      if (prev.length === 0) {
        return [{ timeHr: 0, doseMg: next.doseMg, infusionHr: next.infusionHr }];
      }
      const firstTime = prev[0].timeHr;
      return prev.map((row, idx) => ({
        ...row,
        timeHr: idx === 0 ? firstTime : firstTime + idx * next.intervalHr,
        doseMg: next.doseMg,
        infusionHr: next.infusionHr,
      }));
    });
    queueSubmit(next);
  }

  function updateRegimen(next: Partial<{ doseMg: number; intervalHr: number; infusionHr: number }>) {
    recompute({
      doseMg: next.doseMg ?? doseMg,
      intervalHr: next.intervalHr ?? intervalHr,
      infusionHr: next.infusionHr ?? infusionHr,
    });
  }

  function adjustDose(delta: { doseMg?: number; intervalHr?: number }) {
    const nextDose = Math.min(
      REGIMEN_LIMITS.maxSingleDoseMg,
      Math.max(REGIMEN_LIMITS.minDoseMg, (delta.doseMg ?? 0) + doseMg),
    );
    const nextInterval = Math.min(
      REGIMEN_LIMITS.maxIntervalHr,
      Math.max(REGIMEN_LIMITS.minIntervalHr, (delta.intervalHr ?? 0) + intervalHr),
    );
    recompute({ doseMg: nextDose, intervalHr: nextInterval, infusionHr });
  }

  function resetAll() {
    if (submitTimer.current) {
      window.clearTimeout(submitTimer.current);
    }
    try {
      window.localStorage.removeItem(PATIENT_STORAGE_KEY);
    } catch {
      // ignore
    }
    try {
      window.sessionStorage.removeItem(PATIENT_STORAGE_KEY);
    } catch {
      // ignore
    }
    setAge(DEFAULT_PATIENT.age);
    setSex(DEFAULT_PATIENT.sex);
    setHeight(DEFAULT_PATIENT.height);
    setHeightUnit(DEFAULT_PATIENT.heightUnit);
    setWeight(DEFAULT_PATIENT.weight);
    setWeightUnit(DEFAULT_PATIENT.weightUnit);
    setScr(DEFAULT_PATIENT.scr);
    setMic(DEFAULT_PATIENT.mic);
    setAucLow(DEFAULT_PATIENT.aucLow);
    setAucHigh(DEFAULT_PATIENT.aucHigh);
    setMode("basic");
    setDoseMg(1000);
    setIntervalHr(12);
    setInfusionHr(1.0);
    setLevels([]);
    setDoseHistory([]);
    setError(null);
    onReset?.();
  }

  useImperativeHandle(ref, () => ({ adjustDose, recompute }));

  const dosingPanel = dosingHost
    ? createPortal(
        <div className="space-y-4">
          <div className={"rounded-md border p-4 " + (bayesMissing ? "border-destructive/40 bg-destructive/5" : "bg-card")}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Bayesian inputs</div>
              <div className="text-xs text-muted-foreground">
                {isBayesian ? "Required for MAP-fit" : "Optional unless Bayesian mode"}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Bayesian AUC uses population PK + 1-2 measured levels. Exact timing matters.
            </div>
            <div className="mt-3 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground mb-1">What you need</div>
              <ul className="list-disc ml-4 space-y-1">
                <li>Dosing history with dose amount, start time, and infusion duration.</li>
                <li>At least one level with exact draw time relative to dose start.</li>
                <li>Two levels (peak + trough) improves accuracy when available.</li>
              </ul>
            </div>
            <div className="mt-3 rounded-md border bg-card p-3 text-xs text-muted-foreground">
              <div className="font-medium text-foreground mb-1">Accuracy guidance</div>
              <div>Best accuracy: full dosing history + exact infusion duration + 2 levels.</div>
              <div>Minimum viable: one timed level + most recent dose details.</div>
              <div>Trough-only estimates are limited; add a second level when possible.</div>
            </div>
            <div className="space-y-4 mt-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-sm font-medium">Observed levels</div>
                  <Button variant="secondary" size="sm" onClick={addLevelRow}>Add level</Button>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  Provide concentration and exact draw time (hours from dose start or timestamp).
                </div>
                <div className="space-y-2">
                  {levels.length === 0 && (
                    <div className="text-xs text-muted-foreground">No levels yet. Add a level to begin.</div>
                  )}
                  {levels.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-2 items-center">
                      <Input
                        className={isBayesian && !levelHasValue ? "border-destructive" : ""}
                        placeholder="Concentration (mg/L)"
                        type="number"
                        step="0.1"
                        value={row.concentration}
                        onChange={(e) => updateLevelRow(idx, "concentration", e.target.value)}
                        onBlur={(e) => updateLevelRow(idx, "concentration", normalizeNumericInputStrict(e.target.value))}
                      />
                      <Input
                        className={isBayesian && !levelHasValue ? "border-destructive" : ""}
                        placeholder="Draw time (hr)"
                        type="number"
                        step="0.1"
                        value={row.timeHr}
                        onChange={(e) => updateLevelRow(idx, "timeHr", e.target.value)}
                        onBlur={(e) => updateLevelRow(idx, "timeHr", normalizeNumericInputStrict(e.target.value))}
                      />
                      <div className="col-span-3 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => removeLevelRow(idx)} disabled={levels.length <= 1}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {isBayesian && !levelHasValue && (
                  <div className="text-xs text-destructive mt-1">At least one level is required for Bayesian mode.</div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-sm font-medium">Dosing history</div>
                  <Button variant="secondary" size="sm" onClick={addDoseRow}>Add dose</Button>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  Include dose amount, start time, and infusion duration for each dose.
                </div>
                <div className="space-y-2">
                  {doseHistory.length === 0 && (
                    <div className="text-xs text-muted-foreground">No doses yet. Add the most recent dose first.</div>
                  )}
                  {doseHistory.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-2 items-center">
                      <Input
                        className={isBayesian && !doseHasValue ? "border-destructive" : ""}
                        placeholder="Dose mg"
                        type="number"
                        value={row.doseMg}
                        onChange={(e) => updateDoseRow(idx, "doseMg", Number(e.target.value))}
                      />
                      <Input
                        className={isBayesian && !doseHasValue ? "border-destructive" : ""}
                        placeholder="Start time (hr)"
                        type="number"
                        value={row.timeHr}
                        onChange={(e) => updateDoseRow(idx, "timeHr", Number(e.target.value))}
                      />
                      <Input
                        className={isBayesian && !doseHasValue ? "border-destructive" : ""}
                        placeholder="Infusion (hr)"
                        type="number"
                        step="0.1"
                        value={row.infusionHr}
                        onChange={(e) => updateDoseRow(idx, "infusionHr", Number(e.target.value))}
                      />
                      <div className="col-span-2 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => removeDoseRow(idx)} disabled={doseHistory.length <= 1}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {isBayesian && !doseHasValue && (
                  <div className="text-xs text-destructive mt-1">At least one dose is required for Bayesian mode.</div>
                )}
              </div>
            </div>
          </div>
        </div>,
        dosingHost,
      )
    : null;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {!formValid && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {bayesMissing
              ? "Bayesian mode requires at least one level and one dose event."
              : "Please correct the highlighted fields before calculating."}
          </div>
        )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={(v: "basic" | "bayesian") => setMode(v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">Basic Calculator</SelectItem>
              <SelectItem value="bayesian">Bayesian (MAP-fit using levels)</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground mt-1">
            {isBayesian
              ? "Bayesian MAP-fit uses measured levels to estimate AUC more precisely."
              : "Basic Calculator uses covariates only; no measured levels required."}
          </div>
        </div>
        <div>
          <Label htmlFor="age">Age (years)</Label>
          <Input
            id="age"
            type="text"
            inputMode="numeric"
            className={!patientValid && (!Number.isFinite(ageNum) || ageNum <= 0) ? "border-destructive" : ""}
            value={age}
            onChange={e => setAge(e.target.value)}
            onBlur={(e) => setAge(normalizeNumericInput(e.target.value))}
          />
        </div>
        <div>
          <Label>Sex</Label>
          <Select value={sex} onValueChange={(v: "male" | "female" | "") => setSex(v)}>
            <SelectTrigger className={!patientValid && sex === "" ? "w-full border-destructive" : "w-full"}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="height">Height</Label>
          <div className="flex gap-2">
            <Input
              id="height"
              type="text"
              inputMode="decimal"
              className={!patientValid && (!Number.isFinite(heightCm) || heightCm <= 0) ? "border-destructive" : ""}
              value={height}
              onChange={e => setHeight(e.target.value)}
              onBlur={(e) => setHeight(normalizeNumericInput(e.target.value))}
            />
            <Select value={heightUnit} onValueChange={(v: "cm" | "in") => setHeightUnit(v)}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cm">cm</SelectItem>
                <SelectItem value="in">in</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="weight">Weight</Label>
          <div className="flex gap-2">
            <Input
              id="weight"
              type="text"
              inputMode="decimal"
              className={!patientValid && (!Number.isFinite(weightKg) || weightKg <= 0) ? "border-destructive" : ""}
              value={weight}
              onChange={e => setWeight(e.target.value)}
              onBlur={(e) => setWeight(normalizeNumericInput(e.target.value))}
            />
            <Select value={weightUnit} onValueChange={(v: "kg" | "lb") => setWeightUnit(v)}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="lb">lb</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="scr">Serum creatinine (mg/dL)</Label>
          <Input
            id="scr"
            type="text"
            inputMode="decimal"
            className={!patientValid && (!Number.isFinite(scrNum) || scrNum <= 0) ? "border-destructive" : ""}
            value={scr}
            onChange={e => setScr(e.target.value)}
            onBlur={(e) => setScr(normalizeNumericInput(e.target.value))}
          />
        </div>
        <div>
          <LabelHelp label="MIC assumption" help="Assume MIC=1 mg/L unless known. Targets are based on MIC=1." />
          <Input
            id="mic"
            type="text"
            inputMode="decimal"
            className={!micValid ? "border-destructive" : ""}
            value={mic}
            onChange={e => setMic(e.target.value)}
            onBlur={(e) => setMic(normalizeNumericInput(e.target.value))}
          />
        </div>
        {isBayesian && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <LabelHelp label="AUC target low" help="Guideline target AUC/MIC 400-600 for serious MRSA." />
              <Input
                id="aucl"
                type="text"
                inputMode="decimal"
                value={aucLow}
                onChange={e => setAucLow(e.target.value)}
                onBlur={(e) => setAucLow(normalizeNumericInput(e.target.value))}
              />
            </div>
            <div>
              <LabelHelp label="AUC target high" help="Upper bound for AUC/MIC target range." />
              <Input
                id="auch"
                type="text"
                inputMode="decimal"
                value={aucHigh}
                onChange={e => setAucHigh(e.target.value)}
                onBlur={(e) => setAucHigh(normalizeNumericInput(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600" role="alert">
          <div className="font-medium">{error.message}</div>
          {error.issues && error.issues.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-medium">Validation issues</div>
              <ul className="list-disc ml-5 text-xs space-y-1">
                {error.issues.slice(0, 10).map((iss, i) => (
                  <li key={i}>
                    <span className="font-mono">{iss.path || "(body)"}</span>: {iss.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button className="w-full" onClick={() => onSubmit()} disabled={!formValid}>Compute PK estimates</Button>
        <Button className="w-full" variant="secondary" onClick={resetAll}>Reset</Button>
      </div>
      </div>
      {dosingPanel}
    </TooltipProvider>
  );
});

CalculatorForm.displayName = "CalculatorForm";

export default CalculatorForm;
