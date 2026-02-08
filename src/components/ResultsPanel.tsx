import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BasicCalculateResponse, BayesianCalculateResponse, CalculateResponse } from "@/lib/api";
import { AUC_TARGET, REGIMEN_LIMITS } from "@/lib/constraints";
import { formatNumber } from "@/lib/format";

type Mode = "basic" | "bayesian" | "educational";

function ResultsPanel({
  mode,
  result,
  onAdjustDose,
  regimen,
  onRegimenChange,
}: {
  mode: Mode;
  result?: BasicCalculateResponse | BayesianCalculateResponse | CalculateResponse;
  onAdjustDose?: (delta: { doseMg?: number; intervalHr?: number }) => void;
  regimen?: { doseMg: number; intervalHr: number; infusionHr: number };
  onRegimenChange?: (next: { doseMg: number; intervalHr: number; infusionHr: number }) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopySummary(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function buildSummary() {
    if (mode === "basic" && "predicted" in result) {
      return [
        "Vancomyzer Basic Calculator",
        `AUC24: ${formatNumber(result.predicted.auc24 ?? 0, 0)} mg·h/L`,
        `Peak: ${formatNumber(result.predicted.peak ?? 0, 1)} mg/L`,
        `Trough: ${formatNumber(result.predicted.trough ?? 0, 1)} mg/L`,
        `Recommended regimen: ${formatNumber(result.regimen.recommended_dose_mg ?? 0, 0)} mg q${formatNumber(result.regimen.recommended_interval_hr ?? 0, 0)}h`,
      ].join("\n");
    }
    if (mode === "bayesian" && "auc24" in result) {
      return [
        "Vancomyzer Bayesian AUC Engine",
        `AUC24: ${formatNumber(result.auc24, 0)} (95% CI ${formatNumber(result.auc24_ci_low, 0)}–${formatNumber(result.auc24_ci_high, 0)}) mg·h/L`,
        `CL: ${formatNumber(result.cl_l_hr, 2)} L/hr`,
        `V: ${formatNumber(result.v_l, 1)} L`,
        `Suggested regimen: ${formatNumber(result.recommendation.per_dose_mg, 0)} mg q${formatNumber(result.recommendation.interval_hr, 0)}h`,
      ].join("\n");
    }
    const edu = result as CalculateResponse;
    return [
      "Vancomyzer Educational PK Estimates",
      `AUC24: ${formatNumber(edu.auc24_mg_h_l, 0)} mg·h/L`,
      `Peak: ${formatNumber(edu.peak_mg_l, 1)} mg/L`,
      `Trough: ${formatNumber(edu.trough_mg_l, 1)} mg/L`,
    ].join("\n");
  }

  const intervalOptions = REGIMEN_LIMITS.allowedIntervalsHr;
  const safeInterval = regimen
    ? intervalOptions.reduce(
        (closest, val) => (Math.abs(val - regimen.intervalHr) < Math.abs(closest - regimen.intervalHr) ? val : closest),
        intervalOptions[0],
      )
    : null;

  useEffect(() => {
    if (mode !== "basic" || !regimen || !onRegimenChange || safeInterval === null) return;
    if (regimen.intervalHr !== safeInterval) {
      onRegimenChange({ ...regimen, intervalHr: safeInterval });
    }
  }, [mode, regimen, onRegimenChange, safeInterval]);

  if (!result) {
    return <div className="text-sm text-muted-foreground">No results yet.</div>;
  }

  if (mode === "basic" && "predicted" in result) {
    const auc24 = result.predicted.auc24 ?? 0;
    const outsideTarget = auc24 < AUC_TARGET.low || auc24 > AUC_TARGET.high;
    const chosenDose = result.regimen.chosen_dose_mg ?? regimen?.doseMg;
    const chosenInterval = result.regimen.chosen_interval_hr ?? regimen?.intervalHr;
    const chosenDoseNum = Number(chosenDose ?? 0);
    const chosenIntervalNum = Number(chosenInterval ?? 0);
    const dailyDose = chosenIntervalNum > 0 ? chosenDoseNum * (24 / chosenIntervalNum) : 0;
    const guardrailWarnings: string[] = [];
    if (chosenDoseNum > REGIMEN_LIMITS.maxSingleDoseMg) {
      guardrailWarnings.push(`Chosen dose exceeds max single dose (${REGIMEN_LIMITS.maxSingleDoseMg} mg).`);
    }
    if (dailyDose > REGIMEN_LIMITS.maxDailyDoseMg) {
      guardrailWarnings.push(`Chosen daily dose exceeds cap (${REGIMEN_LIMITS.maxDailyDoseMg} mg/day).`);
    }
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Basic Calculator Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3 mb-3 print-hidden">
              <div className="text-xs text-muted-foreground">Deterministic results</div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => onCopySummary(buildSummary())}>
                  {copied ? "Copied" : "Copy summary"}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => window.print()}>
                  Print
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">AUC₍0–24₎ (mg·h/L)</div>
                <div className="font-medium">{formatNumber(auc24, 0)}</div>
                {outsideTarget && (
                  <div className="text-xs text-warning-foreground mt-1">
                    Outside target {AUC_TARGET.low}-{AUC_TARGET.high} mg·h/L
                  </div>
                )}
              </div>
              <div>
                <div className="text-muted-foreground">Predicted trough (mg/L)</div>
                <div className="font-medium">{formatNumber(result.predicted.trough ?? 0, 1)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Predicted peak (mg/L)</div>
                <div className="font-medium">{formatNumber(result.predicted.peak ?? 0, 1)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Half-life (hr)</div>
                <div className="font-medium">{formatNumber(result.predicted.half_life_hr ?? 0, 1)}</div>
              </div>
            </div>
            <div className="mt-4 text-sm">
              <div className="text-muted-foreground">Recommended regimen</div>
              <div className="font-medium">
                {formatNumber(result.regimen.recommended_dose_mg ?? 0, 0)} mg q{formatNumber(result.regimen.recommended_interval_hr ?? 0, 0)}h
              </div>
              {result.regimen.recommended_loading_dose_mg && (
                <div className="text-muted-foreground">
                  Loading dose: {formatNumber(result.regimen.recommended_loading_dose_mg, 0)} mg
                </div>
              )}
            </div>
            {(chosenDose || chosenInterval) && (
              <div className="mt-4 text-sm">
                <div className="text-muted-foreground">Chosen regimen</div>
                <div className="font-medium">
                  {formatNumber(chosenDose ?? 0, 0)} mg q{formatNumber(chosenInterval ?? 0, 0)}h
                </div>
              </div>
            )}
            {guardrailWarnings.length > 0 && (
              <div className="mt-3 space-y-1">
                {guardrailWarnings.map((warning, idx) => (
                  <div key={idx} className="text-xs rounded px-2 py-1 bg-warning/10 text-warning-foreground border border-warning/30">
                    {warning}
                  </div>
                ))}
              </div>
            )}
            {regimen && onRegimenChange && (
              <div className="mt-4 rounded-md border bg-muted/30 p-3">
                <div className="text-sm font-medium mb-2">Adjust dose and interval</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Dose (mg)</div>
                    <Input
                      type="number"
                      step="50"
                      value={regimen.doseMg}
                      onChange={(e) =>
                        onRegimenChange({
                          ...regimen,
                          doseMg: Math.max(REGIMEN_LIMITS.minDoseMg, Number(e.target.value)),
                        })
                      }
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Interval (hr)</div>
                    <Select
                      value={String(safeInterval ?? 12)}
                      onValueChange={(value) =>
                        onRegimenChange({
                          ...regimen,
                          intervalHr: Number(value),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {intervalOptions.map((hr) => (
                          <SelectItem key={hr} value={String(hr)}>
                            {hr}h
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Allowed: {REGIMEN_LIMITS.allowedIntervalsHr.join(", ")}h
                    </div>
                  </div>
                </div>
              </div>
            )}
            {onAdjustDose && (
              <div className="flex flex-wrap gap-2 mt-4">
                <Button variant="secondary" onClick={() => onAdjustDose({ doseMg: 250 })}>+250 mg</Button>
                <Button variant="secondary" onClick={() => onAdjustDose({ doseMg: -250 })}>-250 mg</Button>
                <Button variant="secondary" onClick={() => onAdjustDose({ intervalHr: 2 })}>+2h interval</Button>
                <Button variant="secondary" onClick={() => onAdjustDose({ intervalHr: -2 })}>-2h interval</Button>
              </div>
            )}
          <div className="print-summary">
            <pre className="whitespace-pre-wrap text-sm">{buildSummary()}</pre>
          </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "bayesian" && "auc24" in result) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Bayesian AUC Engine</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3 mb-3 print-hidden">
              <div className="text-xs text-muted-foreground">AUC-guided Bayesian MAP</div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => onCopySummary(buildSummary())}>
                  {copied ? "Copied" : "Copy summary"}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => window.print()}>
                  Print
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">AUC₍0–24₎ (mg·h/L)</div>
                <div className="font-medium">{formatNumber(result.auc24, 0)}</div>
                <div className="text-xs text-muted-foreground">
                  95% CI {formatNumber(result.auc24_ci_low, 0)}–{formatNumber(result.auc24_ci_high, 0)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">CL / V</div>
                <div className="font-medium">
                  {formatNumber(result.cl_l_hr, 2)} L/hr · {formatNumber(result.v_l, 1)} L
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm">
              <div className="text-muted-foreground">Suggested dosing to target AUC</div>
              <div className="font-medium">
                {formatNumber(result.recommendation.per_dose_mg, 0)} mg q{formatNumber(result.recommendation.interval_hr, 0)}h
              </div>
              {(result.recommendation.max_loading_mg || result.recommendation.max_daily_mg) && (
                <div className="text-xs text-muted-foreground mt-1">
                  Guardrails: max loading {formatNumber(result.recommendation.max_loading_mg ?? 0, 0)} mg · max daily {formatNumber(result.recommendation.max_daily_mg ?? 0, 0)} mg
                </div>
              )}
            </div>
            {result.warnings.length > 0 && (
              <div className="mt-4 space-y-1">
                {result.warnings.map((m, i) => (
                  <div key={i} className="text-xs rounded px-2 py-1 bg-warning/10 text-warning-foreground border border-warning/30">
                    {m}
                  </div>
                ))}
              </div>
            )}
            <div className="print-summary">
              <pre className="whitespace-pre-wrap text-sm">{buildSummary()}</pre>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Educational PK Estimates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3 mb-3 print-hidden">
            <div className="text-xs text-muted-foreground">Educational PK model</div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => onCopySummary(buildSummary())}>
                {copied ? "Copied" : "Copy summary"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                Print
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">AUC₍0–24₎ (mg·h/L)</div>
              <div className="font-medium">{formatNumber((result as CalculateResponse).auc24_mg_h_l, 0)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Estimated trough (mg/L)</div>
              <div className="font-medium">{formatNumber((result as CalculateResponse).trough_mg_l, 1)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Estimated peak (mg/L)</div>
              <div className="font-medium">{formatNumber((result as CalculateResponse).peak_mg_l, 1)}</div>
            </div>
            {(result as CalculateResponse).bayes_demo && (
              <div>
                <div className="text-muted-foreground">Model fit (RMSE)</div>
                <div className="font-medium">{formatNumber((result as CalculateResponse).bayes_demo?.rmse_mg_l ?? 0, 2)} mg/L</div>
              </div>
            )}
          </div>
          {(result as CalculateResponse).safety?.length > 0 && (
            <div className="mt-4 space-y-1">
              {(result as CalculateResponse).safety.map((m, i) => (
                <div
                  key={i}
                  className={
                    "text-xs rounded px-2 py-1 " +
                    (m.kind === "warning" ? "bg-warning/10 text-warning-foreground border border-warning/30" : "bg-muted text-muted-foreground")
                  }
                >
                  {m.message}
                </div>
              ))}
            </div>
          )}
          <div className="print-summary">
            <pre className="whitespace-pre-wrap text-sm">{buildSummary()}</pre>
          </div>
        </CardContent>
      </Card>

      {(result as CalculateResponse).bayes_demo && (
        <Card>
          <CardHeader>
            <CardTitle>Bayesian MAP-fit demo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="text-muted-foreground mb-2">{(result as CalculateResponse).bayes_demo?.label}</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-muted-foreground">CL</div>
                <div className="font-medium">{formatNumber((result as CalculateResponse).bayes_demo?.cl_l_hr ?? 0, 2)} L/hr</div>
              </div>
              <div>
                <div className="text-muted-foreground">V</div>
                <div className="font-medium">{formatNumber((result as CalculateResponse).bayes_demo?.v_l ?? 0, 1)} L</div>
              </div>
              <div>
                <div className="text-muted-foreground">k</div>
                <div className="font-medium">{formatNumber((result as CalculateResponse).bayes_demo?.ke_hr ?? 0, 3)} hr⁻¹</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ResultsPanel;