import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { BasicCalculateResponse, BayesianCalculateResponse, CalculateResponse } from "@/lib/api";

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

  if (!result) {
    return <div className="text-sm text-muted-foreground">No results yet.</div>;
  }

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
        `AUC24: ${Math.round(result.predicted.auc24 ?? 0)} mg·h/L`,
        `Peak: ${(result.predicted.peak ?? 0).toFixed(1)} mg/L`,
        `Trough: ${(result.predicted.trough ?? 0).toFixed(1)} mg/L`,
        `Recommended regimen: ${Math.round(result.regimen.recommended_dose_mg ?? 0)} mg q${Math.round(result.regimen.recommended_interval_hr ?? 0)}h`,
      ].join("\n");
    }
    if (mode === "bayesian" && "auc24" in result) {
      return [
        "Vancomyzer Bayesian AUC Engine",
        `AUC24: ${Math.round(result.auc24)} (95% CI ${Math.round(result.auc24_ci_low)}–${Math.round(result.auc24_ci_high)}) mg·h/L`,
        `CL: ${result.cl_l_hr.toFixed(2)} L/hr`,
        `V: ${result.v_l.toFixed(1)} L`,
        `Suggested regimen: ${Math.round(result.recommendation.per_dose_mg)} mg q${Math.round(result.recommendation.interval_hr)}h`,
      ].join("\n");
    }
    const edu = result as CalculateResponse;
    return [
      "Vancomyzer Educational PK Estimates",
      `AUC24: ${Math.round(edu.auc24_mg_h_l)} mg·h/L`,
      `Peak: ${edu.peak_mg_l.toFixed(1)} mg/L`,
      `Trough: ${edu.trough_mg_l.toFixed(1)} mg/L`,
    ].join("\n");
  }

  if (mode === "basic" && "predicted" in result) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Basic Calculator Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3 mb-3 print-hidden">
              <div className="text-xs text-muted-foreground">Excel parity outputs</div>
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
                <div className="font-medium">{Math.round(result.predicted.auc24 ?? 0)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Predicted trough (mg/L)</div>
                <div className="font-medium">{(result.predicted.trough ?? 0).toFixed(1)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Predicted peak (mg/L)</div>
                <div className="font-medium">{(result.predicted.peak ?? 0).toFixed(1)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Half-life (hr)</div>
                <div className="font-medium">{(result.predicted.half_life_hr ?? 0).toFixed(1)}</div>
              </div>
            </div>
            <div className="mt-4 text-sm">
              <div className="text-muted-foreground">Recommended regimen</div>
              <div className="font-medium">
                {Math.round(result.regimen.recommended_dose_mg ?? 0)} mg q{Math.round(result.regimen.recommended_interval_hr ?? 0)}h
              </div>
              {result.regimen.recommended_loading_dose_mg && (
                <div className="text-muted-foreground">
                  Loading dose: {Math.round(result.regimen.recommended_loading_dose_mg)} mg
                </div>
              )}
            </div>
            {regimen && onRegimenChange && (
              <div className="mt-4 rounded-md border bg-muted/30 p-3">
                <div className="text-sm font-medium mb-2">Interactive regimen</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Dose (mg)</div>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      type="number"
                      step="250"
                      value={regimen.doseMg}
                      onChange={(e) => onRegimenChange({ ...regimen, doseMg: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Interval (hr)</div>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      type="number"
                      step="1"
                      value={regimen.intervalHr}
                      onChange={(e) => onRegimenChange({ ...regimen, intervalHr: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Infusion (hr)</div>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      type="number"
                      step="0.1"
                      value={regimen.infusionHr}
                      onChange={(e) => onRegimenChange({ ...regimen, infusionHr: Number(e.target.value) })}
                    />
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
                <div className="font-medium">{Math.round(result.auc24)}</div>
                <div className="text-xs text-muted-foreground">
                  95% CI {Math.round(result.auc24_ci_low)}–{Math.round(result.auc24_ci_high)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">CL / V</div>
                <div className="font-medium">
                  {result.cl_l_hr.toFixed(2)} L/hr · {result.v_l.toFixed(1)} L
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm">
              <div className="text-muted-foreground">Suggested dosing to target AUC</div>
              <div className="font-medium">
                {Math.round(result.recommendation.per_dose_mg)} mg q{Math.round(result.recommendation.interval_hr)}h
              </div>
              {(result.recommendation.max_loading_mg || result.recommendation.max_daily_mg) && (
                <div className="text-xs text-muted-foreground mt-1">
                  Guardrails: max loading {Math.round(result.recommendation.max_loading_mg ?? 0)} mg · max daily {Math.round(result.recommendation.max_daily_mg ?? 0)} mg
                </div>
              )}
            </div>
            {regimen && onRegimenChange && (
              <div className="mt-4 rounded-md border bg-muted/30 p-3">
                <div className="text-sm font-medium mb-2">Interactive regimen</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Dose (mg)</div>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      type="number"
                      step="250"
                      value={regimen.doseMg}
                      onChange={(e) => onRegimenChange({ ...regimen, doseMg: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Interval (hr)</div>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      type="number"
                      step="1"
                      value={regimen.intervalHr}
                      onChange={(e) => onRegimenChange({ ...regimen, intervalHr: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Infusion (hr)</div>
                    <input
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      type="number"
                      step="0.1"
                      value={regimen.infusionHr}
                      onChange={(e) => onRegimenChange({ ...regimen, infusionHr: Number(e.target.value) })}
                    />
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
              <div className="font-medium">{Math.round((result as CalculateResponse).auc24_mg_h_l)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Estimated trough (mg/L)</div>
              <div className="font-medium">{(result as CalculateResponse).trough_mg_l.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Estimated peak (mg/L)</div>
              <div className="font-medium">{(result as CalculateResponse).peak_mg_l.toFixed(1)}</div>
            </div>
            {(result as CalculateResponse).bayes_demo && (
              <div>
                <div className="text-muted-foreground">Model fit (RMSE)</div>
                <div className="font-medium">{(result as CalculateResponse).bayes_demo?.rmse_mg_l.toFixed(2)} mg/L</div>
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
                <div className="font-medium">{(result as CalculateResponse).bayes_demo?.cl_l_hr.toFixed(2)} L/hr</div>
              </div>
              <div>
                <div className="text-muted-foreground">V</div>
                <div className="font-medium">{(result as CalculateResponse).bayes_demo?.v_l.toFixed(1)} L</div>
              </div>
              <div>
                <div className="text-muted-foreground">k</div>
                <div className="font-medium">{(result as CalculateResponse).bayes_demo?.ke_hr.toFixed(3)} hr⁻¹</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ResultsPanel;