import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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

export type CalculatorFormHandle = {
  adjustDose: (delta: { doseMg?: number; intervalHr?: number }) => void;
  recompute: (next: { doseMg: number; intervalHr: number; infusionHr: number }) => void;
};

export type CalculatorFormProps = {
  onResult: (result: BasicCalculateResponse | BayesianCalculateResponse | undefined, mode: "basic" | "bayesian") => void;
  onLoadingChange?: (loading: boolean) => void;
  onInputsChange?: (payload: {
    mode: "basic" | "bayesian";
    regimen?: { doseMg: number; intervalHr: number; infusionHr: number };
    levels?: Array<{ time_hr: number; concentration_mg_l: number }>;
    dose_history?: Array<{ dose_mg: number; start_time_hr: number; infusion_hr: number }>;
  }) => void;
};

type UiError = { message: string; issues?: Array<{ path: string; message: string }> };

function formatValidationLoc(loc: Array<string | number>): string {
  // FastAPI locs look like ["body", "fieldName", 0, "subField"]
  return loc.filter((p) => p !== "body").join(".");
}

const CalculatorForm = forwardRef<CalculatorFormHandle, CalculatorFormProps>(({ onResult, onLoadingChange, onInputsChange }, ref) => {
  const [age, setAge] = useState(60);
  const [sex, setSex] = useState<"male" | "female">("male");
  const [height, setHeight] = useState(175);
  const [heightUnit, setHeightUnit] = useState<"cm" | "in">("cm");
  const [weight, setWeight] = useState(80);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [scr, setScr] = useState(1.0);
  const [mic, setMic] = useState(1.0);
  const [aucLow, setAucLow] = useState(400);
  const [aucHigh, setAucHigh] = useState(600);
  const [mode, setMode] = useState<"basic" | "bayesian">("basic");
  const [doseMg, setDoseMg] = useState(1000);
  const [intervalHr, setIntervalHr] = useState(12);
  const [infusionHr, setInfusionHr] = useState(1.0);
  const [levels, setLevels] = useState<Array<{ timeHr: number; concentration: number }>>([{ timeHr: 2, concentration: 0 }]);
  const [doseHistory, setDoseHistory] = useState<Array<{ timeHr: number; doseMg: number; infusionHr: number }>>([
    { timeHr: 0, doseMg: 1000, infusionHr: 1.0 },
  ]);
  const [error, setError] = useState<UiError | null>(null);

  const isBayesian = mode === "bayesian";

  const heightCm = useMemo(() => (heightUnit === "cm" ? height : Math.round(height * 2.54)), [height, heightUnit]);
  const weightKg = useMemo(() => (weightUnit === "kg" ? weight : Math.round(weight * 0.453592)), [weight, weightUnit]);

  const levelHasValue = levels.some((lv) => Number.isFinite(lv.concentration) && lv.concentration > 0);
  const doseHasValue = doseHistory.some((d) => Number.isFinite(d.doseMg) && d.doseMg > 0);
  const micValid = Number.isFinite(mic) && mic >= 0.5 && mic <= 2;
  const intervalValid = Number.isFinite(intervalHr) && intervalHr >= 6 && intervalHr <= 48;
  const infusionValid = Number.isFinite(infusionHr) && infusionHr > 0 && infusionHr <= 6;
  const patientValid =
    Number.isFinite(age) &&
    age > 0 &&
    Number.isFinite(weightKg) &&
    weightKg > 0 &&
    Number.isFinite(heightCm) &&
    heightCm > 0 &&
    Number.isFinite(scr) &&
    scr > 0;
  const bayesValid = !isBayesian || (levelHasValue && doseHasValue);
  const formValid = patientValid && micValid && intervalValid && infusionValid && bayesValid;

  function updateLevelRow(idx: number, field: "timeHr" | "concentration", value: number) {
    setLevels((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }

  function addLevelRow() {
    setLevels((prev) => [...prev, { timeHr: 6, concentration: 0 }]);
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
      onInputsChange?.({
        mode,
        regimen: { doseMg: effectiveDose, intervalHr: effectiveInterval, infusionHr: effectiveInfusion },
      });
      if (mode === "basic") {
        const result = await calculateBasic({
          patient: {
            age: Number(age),
            sex,
            height_cm: Number(heightCm),
            weight_kg: Number(weightKg),
            serum_creatinine: Number(scr),
          },
          regimen: {
            dose_mg: Number(effectiveDose),
            interval_hr: Number(effectiveInterval),
            infusion_hr: Number(effectiveInfusion),
          },
          mic: Number(mic),
        });
        onResult(result, "basic");
      } else {
        const levelsPayload = levels
          .filter((lv) => Number.isFinite(lv.concentration) && Number.isFinite(lv.timeHr) && lv.concentration > 0)
          .map((lv) => ({ time_hr: Number(lv.timeHr), concentration_mg_l: Number(lv.concentration) }));
        if (levelsPayload.length < 1) {
          throw new Error("Enter at least one vancomycin level for Bayesian mode.");
        }
        const historyPayload = doseHistory.length
          ? doseHistory
              .filter((d) => Number.isFinite(d.doseMg) && d.doseMg > 0)
              .map((d) => ({ dose_mg: Number(d.doseMg), start_time_hr: Number(d.timeHr), infusion_hr: Number(d.infusionHr) }))
          : [{ dose_mg: Number(effectiveDose), start_time_hr: 0, infusion_hr: Number(effectiveInfusion) }];
        onInputsChange?.({ mode: "bayesian", levels: levelsPayload, dose_history: historyPayload });
        const result = await calculateBayesian({
          patient: {
            age_yr: Number(age),
            sex,
            weight_kg: Number(weightKg),
            serum_creatinine_mg_dl: Number(scr),
          },
          mic: Number(mic),
          dose_history: historyPayload,
          levels: levelsPayload,
          target_low: Number(aucLow),
          target_high: Number(aucHigh),
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
    onSubmit(next);
  }

  function adjustDose(delta: { doseMg?: number; intervalHr?: number }) {
    const nextDose = Math.max(250, (delta.doseMg ?? 0) + doseMg);
    const nextInterval = Math.max(4, (delta.intervalHr ?? 0) + intervalHr);
    recompute({ doseMg: nextDose, intervalHr: nextInterval, infusionHr });
  }

  useImperativeHandle(ref, () => ({ adjustDose, recompute }));

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {!formValid && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Please correct the highlighted fields before calculating.
          </div>
        )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Mode</Label>
          <Select value={mode} onValueChange={(v: "basic" | "bayesian") => setMode(v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">Basic Calculator</SelectItem>
              <SelectItem value="bayesian">Bayesian AUC Engine</SelectItem>
            </SelectContent>
          </Select>
          {isBayesian && (
            <div className="text-xs text-muted-foreground mt-1">
              AUC-guided dosing target 400–600 (MIC=1). Trough-only targets are no longer recommended.
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="age">Age (years)</Label>
          <Input
            id="age"
            type="number"
            min={1}
            max={120}
            className={!patientValid && (!Number.isFinite(age) || age <= 0) ? "border-destructive" : ""}
            value={age}
            onChange={e => setAge(Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Sex</Label>
          <Select value={sex} onValueChange={(v: "male" | "female") => setSex(v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
              type="number"
              className={!patientValid && (!Number.isFinite(heightCm) || heightCm <= 0) ? "border-destructive" : ""}
              value={height}
              onChange={e => setHeight(Number(e.target.value))}
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
              type="number"
              className={!patientValid && (!Number.isFinite(weightKg) || weightKg <= 0) ? "border-destructive" : ""}
              value={weight}
              onChange={e => setWeight(Number(e.target.value))}
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
            type="number"
            step="0.1"
            min={0.2}
            max={10}
            className={!patientValid && (!Number.isFinite(scr) || scr <= 0) ? "border-destructive" : ""}
            value={scr}
            onChange={e => setScr(Number(e.target.value))}
          />
        </div>
        <div>
          <LabelHelp label="MIC assumption" help="Assume MIC=1 mg/L unless known. Targets are based on MIC=1." />
          <Input
            id="mic"
            type="number"
            step="0.1"
            min={0.5}
            max={2}
            className={!micValid ? "border-destructive" : ""}
            value={mic}
            onChange={e => setMic(Number(e.target.value))}
          />
        </div>
        {isBayesian && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <LabelHelp label="AUC target low" help="Guideline target AUC/MIC 400–600 for serious MRSA." />
              <Input id="aucl" type="number" value={aucLow} onChange={e => setAucLow(Number(e.target.value))} />
            </div>
            <div>
              <LabelHelp label="AUC target high" help="Upper bound for AUC/MIC target range." />
              <Input id="auch" type="number" value={aucHigh} onChange={e => setAucHigh(Number(e.target.value))} />
            </div>
          </div>
        )}
        <div>
          <Label htmlFor="dose">Dose (mg)</Label>
          <Input id="dose" type="number" step="250" value={doseMg} onChange={e => setDoseMg(Number(e.target.value))} />
        </div>
        <div>
          <Label htmlFor="interval">Interval (hours)</Label>
          <Input
            id="interval"
            type="number"
            step="1"
            className={!intervalValid ? "border-destructive" : ""}
            value={intervalHr}
            onChange={e => setIntervalHr(Number(e.target.value))}
          />
        </div>
        <div>
          <LabelHelp label="Infusion (hours)" help="Typical infusion: 1 hr per 1000 mg (10–15 mg/min)." />
          <Input
            id="infusion"
            type="number"
            step="0.1"
            className={!infusionValid ? "border-destructive" : ""}
            value={infusionHr}
            onChange={e => setInfusionHr(Number(e.target.value))}
          />
        </div>
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="levels">
          <AccordionTrigger>{isBayesian ? "Bayesian levels & dosing history" : "Optional inputs"}</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-sm font-medium">Observed levels</div>
                  <Button variant="secondary" size="sm" onClick={addLevelRow}>Add level</Button>
                </div>
                <div className="space-y-2">
                  {levels.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-5 gap-2 items-center">
                      <Input
                        className={isBayesian && !levelHasValue ? "border-destructive" : ""}
                        placeholder="Concentration (mg/L)"
                        type="number"
                        value={row.concentration}
                        onChange={(e) => updateLevelRow(idx, "concentration", Number(e.target.value))}
                      />
                      <Input
                        className={isBayesian && !levelHasValue ? "border-destructive" : ""}
                        placeholder="Time (hr)"
                        type="number"
                        value={row.timeHr}
                        onChange={(e) => updateLevelRow(idx, "timeHr", Number(e.target.value))}
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
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-sm font-medium">Dosing history</div>
                  <Button variant="secondary" size="sm" onClick={addDoseRow}>Add dose</Button>
                </div>
                <div className="space-y-2">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>

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

      <Button className="w-full" onClick={() => onSubmit()} disabled={!formValid}>Compute PK estimates</Button>
      </div>
    </TooltipProvider>
  );
});

CalculatorForm.displayName = "CalculatorForm";

export default CalculatorForm;
