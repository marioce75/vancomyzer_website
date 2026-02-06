import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CalculateResponse } from "@/lib/api";

function ResultsPanel({
  result,
  onAdjustDose,
  updating,
}: {
  result?: PkCalculateResponse;
  onAdjustDose: (delta: { dose?: number; interval?: number }) => void;
  updating?: boolean;
}) {
  if (!result) {
    return <div className="text-sm text-muted-foreground">No results yet.</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>PK Estimates {updating ? "(Updating…)" : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">AUC₍0–24₎ (mg·h/L)</div>
              <div className="font-medium">{Math.round(result.auc24_mg_h_l)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Estimated trough (mg/L)</div>
              <div className="font-medium">{result.trough_mg_l.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Estimated peak (mg/L)</div>
              <div className="font-medium">{result.peak_mg_l.toFixed(1)}</div>
            </div>
            {result.bayes_demo && (
              <div>
                <div className="text-muted-foreground">Model fit (RMSE)</div>
                <div className="font-medium">{result.bayes_demo.rmse_mg_l.toFixed(2)} mg/L</div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button variant="secondary" onClick={() => onAdjustDose({ dose: 250 })} disabled={updating}>+250 mg</Button>
            <Button variant="secondary" onClick={() => onAdjustDose({ dose: -250 })} disabled={updating}>-250 mg</Button>
            <Button variant="secondary" onClick={() => onAdjustDose({ interval: 2 })} disabled={updating}>+2h interval</Button>
            <Button variant="secondary" onClick={() => onAdjustDose({ interval: -2 })} disabled={updating}>-2h interval</Button>
            {updating && <div className="text-xs text-muted-foreground self-center">Updating…</div>}
          </div>
          <div className="mt-3">
            <ShareButtons result={result} />
          </div>

          {result.safety?.length > 0 && (
            <div className="mt-4 space-y-1">
              {result.safety.map((m, i) => (
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
        </CardContent>
      </Card>

      {result.bayes_demo && (
        <Card>
          <CardHeader>
            <CardTitle>Bayesian MAP-fit demo</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="text-muted-foreground mb-2">{result.bayes_demo.label}</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-muted-foreground">CL</div>
                <div className="font-medium">{result.bayes_demo.cl_l_hr.toFixed(2)} L/hr</div>
              </div>
              <div>
                <div className="text-muted-foreground">V</div>
                <div className="font-medium">{result.bayes_demo.v_l.toFixed(1)} L</div>
              </div>
              <div>
                <div className="text-muted-foreground">k</div>
                <div className="font-medium">{result.bayes_demo.ke_hr.toFixed(3)} hr⁻¹</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ResultsPanel;