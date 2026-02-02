import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { calculateEducational, type CalculateRequest, type CalculateResponse, ApiError } from "@/lib/api";

export type CalculatorFormProps = {
  onResult: (result: CalculateResponse | undefined) => void;
  onLoadingChange?: (loading: boolean) => void;
  onInputsChange?: (inputs: { patient: CalculateRequest["patient"]; regimen: CalculateRequest["regimen"]; dose_history?: CalculateRequest["dose_history"]; levels?: CalculateRequest["levels"]; mode: CalculateRequest["mode"]; }) => void;
};

type UiError = { message: string; issues?: Array<{ path: string; message: string }> };

function formatValidationLoc(loc: Array<string | number>): string {
  // FastAPI locs look like ["body", "fieldName", 0, "subField"]
  return loc.filter((p) => p !== "body").join(".");
}

export default function CalculatorForm({ onResult, onLoadingChange, onInputsChange }: CalculatorFormProps) {
  const [age, setAge] = useState(60);
  const [sex, setSex] = useState<"male" | "female">("male");
  const [height, setHeight] = useState(175);
  const [heightUnit, setHeightUnit] = useState<"cm" | "in">("cm");
  const [weight, setWeight] = useState(80);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [scr, setScr] = useState(1.0);
  const [icu, setIcu] = useState(false);
  const [severity, setSeverity] = useState<"standard" | "serious">("standard");
  const [mic, setMic] = useState(1.0);
  const [aucLow, setAucLow] = useState(400);
  const [aucHigh, setAucHigh] = useState(600);
  const [haveLevels, setHaveLevels] = useState(false);
  const [levels, setLevels] = useState<Array<{ timeHr: number; concentration: number }>>([]);
  const [doseHistory, setDoseHistory] = useState<Array<{ timeHr: number; doseMg: number }>>([]);
  const [useBayesian, setUseBayesian] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    // Reset Bayesian when no levels
    if (!haveLevels) setUseBayesian(false);
  }, [haveLevels]);

  const heightCm = useMemo(() => (heightUnit === "cm" ? height : Math.round(height * 2.54)), [height, heightUnit]);
  const weightKg = useMemo(() => (weightUnit === "kg" ? weight : Math.round(weight * 0.453592)), [weight, weightUnit]);

  async function onSubmit() {
    const patient: CalculateRequest["patient"] = {
      age_yr: Number(age),
      sex,
      weight_kg: Number(weightKg),
      serum_creatinine_mg_dl: Number(scr),
    };

    // Provide simple regimen defaults; App can later treat these as controlled overrides.
    const regimen: CalculateRequest["regimen"] = {
      dose_mg: 1500,
      interval_hr: 12,
      infusion_hr: 1.5,
    };

    const mode: CalculateRequest["mode"] = haveLevels && useBayesian ? "bayes_demo" : "empiric";

    const levelsPayload = haveLevels
      ? levels
          .filter((lv) => Number.isFinite(lv.concentration) && Number.isFinite(lv.timeHr))
          .map((lv) => ({ time_hr: Number(lv.timeHr), concentration_mg_l: Number(lv.concentration) }))
      : undefined;

    const historyPayload = haveLevels
      ? doseHistory
          .filter((d) => Number.isFinite(d.doseMg) && Number.isFinite(d.timeHr))
          .map((d) => ({ dose_mg: Number(d.doseMg), start_time_hr: Number(d.timeHr), infusion_hr: 1.0 }))
      : undefined;

    const req: CalculateRequest = {
      mode,
      patient,
      regimen,
      levels: levelsPayload,
      dose_history: historyPayload,
    };

    onInputsChange?.({ patient, regimen, levels: levelsPayload, dose_history: historyPayload, mode });

    onLoadingChange?.(true);
    setError(null);
    try {
      const result = await calculateEducational(req);
      onResult(result);
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
      onResult(undefined);
    } finally {
      onLoadingChange?.(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="age">Age (years)</Label>
          <Input id="age" type="number" min={1} max={120} value={age} onChange={e => setAge(Number(e.target.value))} />
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
            <Input id="height" type="number" value={height} onChange={e => setHeight(Number(e.target.value))} />
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
            <Input id="weight" type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} />
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
          <Input id="scr" type="number" step="0.1" min={0.2} max={10} value={scr} onChange={e => setScr(Number(e.target.value))} />
        </div>
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <Label>ICU/Critical</Label>
            <Switch checked={icu} onCheckedChange={setIcu} />
          </div>
          <div className="space-y-1">
            <Label>Serious MRSA</Label>
            <Switch checked={severity === "serious"} onCheckedChange={(v) => setSeverity(v ? "serious" : "standard")} />
          </div>
        </div>
        <div>
          <Label htmlFor="mic">MIC assumption</Label>
          <Input id="mic" type="number" step="0.1" min={0.5} max={2} value={mic} onChange={e => setMic(Number(e.target.value))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="aucl">AUC target low</Label>
            <Input id="aucl" type="number" value={aucLow} onChange={e => setAucLow(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="auch">AUC target high</Label>
            <Input id="auch" type="number" value={aucHigh} onChange={e => setAucHigh(Number(e.target.value))} />
          </div>
        </div>
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="levels">
          <AccordionTrigger>I have levels</AccordionTrigger>
          <AccordionContent>
            <div className="flex items-center gap-3 mb-3">
              <Label>Enable levels</Label>
              <Switch checked={haveLevels} onCheckedChange={setHaveLevels} />
              {haveLevels && (
                <div className="flex items-center gap-3">
                  <Label>Use Bayesian</Label>
                  <Switch checked={useBayesian} onCheckedChange={setUseBayesian} />
                </div>
              )}
            </div>
            {haveLevels && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Level 1 (mg/L)" type="number" onChange={e => {
                    const v = Number(e.target.value);
                    setLevels(prev => [{ timeHr: 2, concentration: v }]);
                  }} />
                  <Input placeholder="Level 2 (mg/L) optional" type="number" onChange={e => {
                    const v = Number(e.target.value);
                    setLevels(prev => [{ timeHr: 2, concentration: prev[0]?.concentration ?? 0 }, { timeHr: 10, concentration: v }]);
                  }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Dose given at hr (e.g., 0)" type="number" onChange={e => {
                    const t = Number(e.target.value);
                    setDoseHistory([{ timeHr: t, doseMg: 1500 }]);
                  }} />
                  <Input placeholder="Dose mg (e.g., 1500)" type="number" onChange={e => {
                    const mg = Number(e.target.value);
                    setDoseHistory(prev => [{ timeHr: prev[0]?.timeHr ?? 0, doseMg: mg }]);
                  }} />
                </div>
              </div>
            )}
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

      <Button className="w-full" onClick={onSubmit}>Compute PK estimates</Button>
    </div>
  );
}
