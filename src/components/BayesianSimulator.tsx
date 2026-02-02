import { useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ConcentrationTimeChart from "@/components/ConcentrationTimeChart";
import { bayesSimulate, type BayesSimulateResponse, type PriorParam } from "@/lib/api";

type LevelRow = { timeHr: number; concentration: number };
type RegimenState = { doseMg: number; intervalHr: number; infusionHr: number };
type PriorState = { cl: PriorParam; v: PriorParam; sigma: PriorParam };

const DEFAULT_PRIORS: PriorState = {
  cl: { mean: 3.5, variance: 1.0, distribution: "lognormal" },
  v: { mean: 50, variance: 100, distribution: "lognormal" },
  sigma: { mean: 0.25, variance: 0.04, distribution: "normal" },
};

export default function BayesianSimulator() {
  const [age, setAge] = useState(60);
  const [weight, setWeight] = useState(80);
  const [sex, setSex] = useState<"male" | "female" | "unspecified">("male");
  const [scr, setScr] = useState(1.0);
  const [regimen, setRegimen] = useState<RegimenState>({
    doseMg: 1000,
    intervalHr: 12,
    infusionHr: 1,
  });
  const [levels, setLevels] = useState<LevelRow[]>([
    { timeHr: 2, concentration: 20 },
  ]);
  const [priors, setPriors] = useState<PriorState>(DEFAULT_PRIORS);
  const [result, setResult] = useState<BayesSimulateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const chartLevels = useMemo(
    () =>
      levels
        .filter(
          (lvl) =>
            Number.isFinite(lvl.timeHr) &&
            Number.isFinite(lvl.concentration) &&
            lvl.timeHr >= 0 &&
            lvl.concentration > 0,
        )
        .map((lvl) => ({ timeHr: lvl.timeHr, concentration: lvl.concentration })),
    [levels],
  );

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = {
          age: Number(age),
          weight: Number(weight),
          sex: sex === "unspecified" ? undefined : sex,
          scr: Number(scr),
          regimen: {
            dose_mg: Number(regimen.doseMg),
            interval_hr: Number(regimen.intervalHr),
            infusion_hr: Number(regimen.infusionHr),
          },
          levels: levels.map((lvl) => ({
            time_hr_from_start: Number(lvl.timeHr),
            concentration_mg_l: Number(lvl.concentration),
          })),
          priors: {
            cl: priors.cl,
            v: priors.v,
            sigma: priors.sigma,
          },
        };
        const response = await bayesSimulate(payload);
        setResult(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Simulation failed";
        setError(message);
        setResult(null);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [age, weight, sex, scr, regimen, levels, priors]);

  const chartCurve = useMemo(
    () =>
      result?.curve?.map((pt) => ({
        t: pt.time_hr,
        c: pt.concentration_mg_l,
      })) ?? [],
    [result],
  );

  const posterior = result?.posterior;
  const metrics = result?.metrics;

  const updatePrior = <K extends keyof PriorParam>(
    key: keyof PriorState,
    field: K,
    value: PriorParam[K],
  ) => {
    setPriors((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const addLevel = () => {
    setLevels((prev) => [...prev, { timeHr: 4 + prev.length * 2, concentration: 10 }]);
  };

  const updateLevel = (index: number, field: keyof LevelRow, value: number) => {
    setLevels((prev) => prev.map((lvl, i) => (i === index ? { ...lvl, [field]: value } : lvl)));
  };

  const removeLevel = (index: number) => {
    setLevels((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <Alert className="border-warning bg-warning/10 text-warning-foreground">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <div className="text-xs">
          Educational Bayesian simulation only. Not for clinical decision making.
        </div>
      </Alert>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Patient and regimen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="bayes-age">Age (years)</Label>
                  <Input id="bayes-age" type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Sex</Label>
                  <Select value={sex} onValueChange={(v) => setSex(v as "male" | "female" | "unspecified")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="unspecified">Unspecified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bayes-weight">Weight (kg)</Label>
                  <Input id="bayes-weight" type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
                </div>
                <div>
                  <Label htmlFor="bayes-scr">Serum creatinine (mg/dL)</Label>
                  <Input id="bayes-scr" type="number" step="0.1" value={scr} onChange={(e) => setScr(Number(e.target.value))} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="bayes-dose">Dose (mg)</Label>
                  <Input id="bayes-dose" type="number" value={regimen.doseMg} onChange={(e) => setRegimen({ ...regimen, doseMg: Number(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="bayes-interval">Interval (h)</Label>
                  <Input id="bayes-interval" type="number" value={regimen.intervalHr} onChange={(e) => setRegimen({ ...regimen, intervalHr: Number(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="bayes-infusion">Infusion (h)</Label>
                  <Input id="bayes-infusion" type="number" step="0.1" value={regimen.infusionHr} onChange={(e) => setRegimen({ ...regimen, infusionHr: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Dose slider</Label>
                  <Slider
                    value={[regimen.doseMg]}
                    min={250}
                    max={6000}
                    step={250}
                    onValueChange={([value]) => setRegimen({ ...regimen, doseMg: value })}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Interval slider</Label>
                  <Slider
                    value={[regimen.intervalHr]}
                    min={6}
                    max={24}
                    step={1}
                    onValueChange={([value]) => setRegimen({ ...regimen, intervalHr: value })}
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Typical intervals: 6, 8, 12, or 24 hours. Infusion range 0.5 to 4 hours.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Observed levels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {levels.length === 0 && (
                <div className="text-sm text-muted-foreground">No levels added.</div>
              )}
              {levels.map((lvl, idx) => (
                <div key={`lvl-${idx}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <div>
                    <Label>Time (h from start)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={lvl.timeHr}
                      onChange={(e) => updateLevel(idx, "timeHr", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Concentration (mg/L)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={lvl.concentration}
                      onChange={(e) => updateLevel(idx, "concentration", Number(e.target.value))}
                    />
                  </div>
                  <Button variant="outline" onClick={() => removeLevel(idx)}>
                    Remove
                  </Button>
                </div>
              ))}
              <Button variant="secondary" onClick={addLevel}>Add level</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prior parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-1 font-medium">CL prior</div>
                <div className="col-span-2 text-xs text-muted-foreground">Clearance (L/h)</div>
                <div>
                  <Label>Mean</Label>
                  <Input type="number" step="0.1" value={priors.cl.mean} onChange={(e) => updatePrior("cl", "mean", Number(e.target.value))} />
                </div>
                <div>
                  <Label>Variance</Label>
                  <Input type="number" step="0.1" value={priors.cl.variance} onChange={(e) => updatePrior("cl", "variance", Number(e.target.value))} />
                </div>
                <div>
                  <Label>Distribution</Label>
                  <Select
                    value={priors.cl.distribution}
                    onValueChange={(v) => updatePrior("cl", "distribution", v as PriorParam["distribution"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lognormal">Lognormal</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-1 font-medium">V prior</div>
                <div className="col-span-2 text-xs text-muted-foreground">Volume (L)</div>
                <div>
                  <Label>Mean</Label>
                  <Input type="number" step="0.1" value={priors.v.mean} onChange={(e) => updatePrior("v", "mean", Number(e.target.value))} />
                </div>
                <div>
                  <Label>Variance</Label>
                  <Input type="number" step="0.1" value={priors.v.variance} onChange={(e) => updatePrior("v", "variance", Number(e.target.value))} />
                </div>
                <div>
                  <Label>Distribution</Label>
                  <Select
                    value={priors.v.distribution}
                    onValueChange={(v) => updatePrior("v", "distribution", v as PriorParam["distribution"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lognormal">Lognormal</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-1 font-medium">Sigma</div>
                <div className="col-span-2 text-xs text-muted-foreground">Observation noise (log scale)</div>
                <div>
                  <Label>Mean</Label>
                  <Input type="number" step="0.01" value={priors.sigma.mean} onChange={(e) => updatePrior("sigma", "mean", Number(e.target.value))} />
                </div>
                <div>
                  <Label>Variance</Label>
                  <Input type="number" step="0.01" value={priors.sigma.variance} onChange={(e) => updatePrior("sigma", "variance", Number(e.target.value))} />
                </div>
                <div>
                  <Label>Distribution</Label>
                  <Select
                    value={priors.sigma.distribution}
                    onValueChange={(v) => updatePrior("sigma", "distribution", v as PriorParam["distribution"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="lognormal">Lognormal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Posterior estimates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TooltipProvider>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      CL mean (L/h)
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Posterior clearance after combining priors with observed levels.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="text-lg font-semibold">{posterior ? posterior.cl_mean.toFixed(2) : "--"}</div>
                    <div className="text-xs text-muted-foreground">SD {posterior ? posterior.cl_sd.toFixed(2) : "--"}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      V mean (L)
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Posterior volume of distribution after Bayesian update.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="text-lg font-semibold">{posterior ? posterior.v_mean.toFixed(1) : "--"}</div>
                    <div className="text-xs text-muted-foreground">SD {posterior ? posterior.v_sd.toFixed(1) : "--"}</div>
                  </div>
                </div>
              </TooltipProvider>
              <div className="text-xs text-muted-foreground">
                {result?.educational_note ?? "Educational demonstration only."}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Simulation results</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">AUC24</div>
                <div className="font-medium">{metrics ? Math.round(metrics.auc24_mg_h_l) : "--"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Cmax</div>
                <div className="font-medium">{metrics ? metrics.cmax_mg_l.toFixed(1) : "--"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Cmin</div>
                <div className="font-medium">{metrics ? metrics.cmin_mg_l.toFixed(1) : "--"}</div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <ConcentrationTimeChart curve={chartCurve} levels={chartLevels} showBand={false} />
            {loading && <div className="text-xs text-muted-foreground">Updating curve...</div>}
            {error && <div className="text-xs text-red-600">{error}</div>}
          </div>

          {result?.warnings && result.warnings.length > 0 && (
            <Alert className="border-warning bg-warning/10 text-warning-foreground">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <ul className="text-xs list-disc ml-4 space-y-1">
                {result.warnings.map((w, i) => (
                  <li key={`warn-${i}`}>{w}</li>
                ))}
              </ul>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Learn more</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Bayesian mode blends population priors with observed levels to update CL and V.
                Larger disagreement between observed and predicted levels shifts the posterior.
              </p>
              <p>
                Adjust dose, interval, or infusion to see how the simulated curve and AUC respond.
                This is a teaching visualization, not clinical guidance.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
