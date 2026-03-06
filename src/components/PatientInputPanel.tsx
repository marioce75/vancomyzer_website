import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useVancomyzerStore } from "@/store/vancomyzerStore";
import { REGIMEN_LIMITS } from "@/lib/constraints";
import { Plus, Trash2 } from "lucide-react";

function nanToEmpty(n: number): string {
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

export default function PatientInputPanel() {
  const {
    patient,
    renal,
    infection,
    dosing,
    serumLevels,
    doseHistory,
    mode,
    ibw,
    abw,
    crclCalculated,
    setPatient,
    setInfection,
    setDosing,
    setSerumLevels,
    setDoseHistory,
    setMode,
    reset,
  } = useVancomyzerStore();

  const crclDisplay = renal.crclMlMin ?? crclCalculated;

  const addLevel = useCallback(() => {
    setSerumLevels((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        concentration: "",
        timeHours: "",
        levelType: "other",
      },
    ]);
  }, [setSerumLevels]);

  const updateLevel = useCallback(
    (id: string, field: "concentration" | "timeHours" | "levelType", value: string | "peak" | "trough" | "other") => {
      setSerumLevels((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      );
    },
    [setSerumLevels]
  );

  const removeLevel = useCallback(
    (id: string) => setSerumLevels((prev) => prev.filter((r) => r.id !== id)),
    [setSerumLevels]
  );

  const addDose = useCallback(() => {
    const last = doseHistory[doseHistory.length - 1];
    const nextTime = last ? last.startTimeHr + dosing.intervalHr : 0;
    setDoseHistory((prev) => [
      ...prev,
      { id: crypto.randomUUID(), doseMg: dosing.doseMg, startTimeHr: nextTime, infusionHr: dosing.infusionHr },
    ]);
  }, [doseHistory, dosing.intervalHr, dosing.doseMg, dosing.infusionHr, setDoseHistory]);

  const updateDose = useCallback(
    (id: string, field: "doseMg" | "startTimeHr" | "infusionHr", value: number) => {
      setDoseHistory((prev) =>
        prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
      );
    },
    [setDoseHistory]
  );

  const removeDose = useCallback(
    (id: string) => setDoseHistory((prev) => prev.filter((d) => d.id !== id)),
    [setDoseHistory]
  );

  return (
    <div className="space-y-4 h-full overflow-y-auto">
      {/* Patient Profile */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">Patient Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600">Age (years)</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={patient.age || ""}
                onChange={(e) => setPatient({ age: Number(e.target.value) || 0 })}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sex</Label>
              <ToggleGroup
                type="single"
                value={patient.sex}
                onValueChange={(v) => v && setPatient({ sex: v as "male" | "female" })}
                className="mt-1.5 flex rounded-lg border border-input bg-muted/30 p-0.5"
              >
                <ToggleGroupItem value="male" className="flex-1 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" aria-label="Male">Male</ToggleGroupItem>
                <ToggleGroupItem value="female" className="flex-1 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" aria-label="Female">Female</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Height (cm)</Label>
              <Input
                type="number"
                min={1}
                value={patient.heightCm || ""}
                onChange={(e) => setPatient({ heightCm: Number(e.target.value) || 0 })}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Weight (kg)</Label>
              <Input
                type="number"
                min={1}
                value={patient.weightKg || ""}
                onChange={(e) => setPatient({ weightKg: Number(e.target.value) || 0 })}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Ideal Body Wt (kg)</Label>
              <div className="mt-1 h-9 flex items-center text-sm text-gray-700 bg-gray-50 rounded-md px-3 border border-gray-200">
                {ibw != null ? `${ibw.toFixed(1)}` : "—"}
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Adjusted Body Wt (kg)</Label>
              <div className="mt-1 h-9 flex items-center text-sm text-gray-700 bg-gray-50 rounded-md px-3 border border-gray-200">
                {abw != null ? `${abw.toFixed(1)}` : "—"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Renal Function */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">Renal Function</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Serum Creatinine (mg/dL)</Label>
            <Input
              type="number"
              step="0.1"
              min={0.1}
              value={nanToEmpty(patient.serumCreatinine)}
              onChange={(e) => setPatient({ serumCreatinine: Number(e.target.value) || 0 })}
              className="mt-1 h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Creatinine Clearance (mL/min)</Label>
            <div className="mt-1 h-9 flex items-center text-sm font-medium text-gray-800 bg-gray-50 rounded-md px-3 border border-gray-200">
              {crclDisplay != null ? `${Math.round(crclDisplay)}` : "—"}
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-600">Renal trend</Label>
            <Select
              value={renal.trend ?? "stable"}
              onValueChange={(v: "stable" | "improving" | "declining") =>
                useVancomyzerStore.getState().setRenalTrend(v)
              }
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stable">Stable</SelectItem>
                <SelectItem value="improving">Improving</SelectItem>
                <SelectItem value="declining">Declining</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Infection Data */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">Infection Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Infection type</Label>
            <Select
              value={infection.infectionType}
              onValueChange={(v) => setInfection({ infectionType: v })}
            >
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="serious_mrsa">Serious MRSA</SelectItem>
                <SelectItem value="bacteremia">Bacteremia</SelectItem>
                <SelectItem value="pneumonia">Pneumonia</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600">Target AUC low</Label>
              <Input
                type="number"
                value={infection.aucTargetLow}
                onChange={(e) => setInfection({ aucTargetLow: Number(e.target.value) || 400 })}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Target AUC high</Label>
              <Input
                type="number"
                value={infection.aucTargetHigh}
                onChange={(e) => setInfection({ aucTargetHigh: Number(e.target.value) || 600 })}
                className="mt-1 h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dosing Inputs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">Dosing Inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-gray-600">Dose (mg)</Label>
              <Input
                type="number"
                min={REGIMEN_LIMITS.minDoseMg}
                max={REGIMEN_LIMITS.maxSingleDoseMg}
                value={dosing.doseMg}
                onChange={(e) => setDosing({ doseMg: Number(e.target.value) })}
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Interval (hr)</Label>
              <Select
                value={String(dosing.intervalHr)}
                onValueChange={(v) => setDosing({ intervalHr: Number(v) })}
              >
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIMEN_LIMITS.allowedIntervalsHr.map((hr) => (
                    <SelectItem key={hr} value={String(hr)}>
                      {hr}h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Infusion (hr)</Label>
              <Input
                type="number"
                step="0.1"
                min={REGIMEN_LIMITS.minInfusionHr}
                max={REGIMEN_LIMITS.maxInfusionHr}
                value={dosing.infusionHr}
                onChange={(e) => setDosing({ infusionHr: Number(e.target.value) })}
                className="mt-1 h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Serum Levels */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">Serum Levels</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLevel} className="h-8">
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {serumLevels.length === 0 ? (
            <p className="text-xs text-gray-500">Add levels for Bayesian mode.</p>
          ) : (
            serumLevels.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                <Input
                  placeholder="Conc (mg/L)"
                  type="number"
                  step="0.1"
                  className="w-24 h-8 text-sm"
                  value={row.concentration}
                  onChange={(e) => updateLevel(row.id, "concentration", e.target.value)}
                />
                <Input
                  placeholder="Time (hr)"
                  type="number"
                  step="0.1"
                  className="w-20 h-8 text-sm"
                  value={row.timeHours}
                  onChange={(e) => updateLevel(row.id, "timeHours", e.target.value)}
                />
                <Select
                  value={row.levelType}
                  onValueChange={(v: "peak" | "trough" | "other") => updateLevel(row.id, "levelType", v)}
                >
                  <SelectTrigger className="w-24 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="peak">Peak</SelectItem>
                    <SelectItem value="trough">Trough</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-500"
                  onClick={() => removeLevel(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Dose History (Bayesian) */}
      {mode === "bayesian" && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground">Dose History</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addDose} className="h-8">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {doseHistory.length === 0 ? (
              <p className="text-xs text-gray-500">Add dose events for Bayesian fit.</p>
            ) : (
              doseHistory.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                  <Input
                    placeholder="Dose mg"
                    type="number"
                    className="w-20 h-8 text-sm"
                    value={row.doseMg || ""}
                    onChange={(e) => updateDose(row.id, "doseMg", Number(e.target.value))}
                  />
                  <Input
                    placeholder="Start (hr)"
                    type="number"
                    className="w-20 h-8 text-sm"
                    value={row.startTimeHr}
                    onChange={(e) => updateDose(row.id, "startTimeHr", Number(e.target.value))}
                  />
                  <Input
                    placeholder="Inf (hr)"
                    type="number"
                    step="0.1"
                    className="w-16 h-8 text-sm"
                    value={row.infusionHr}
                    onChange={(e) => updateDose(row.id, "infusionHr", Number(e.target.value))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-500"
                    onClick={() => removeDose(row.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Mode toggle + Reset */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Calculation mode</Label>
            <Select value={mode} onValueChange={(v: "basic" | "bayesian") => setMode(v)}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic (covariates only)</SelectItem>
                <SelectItem value="bayesian">Bayesian (with levels)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={reset}>
            Reset all
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
