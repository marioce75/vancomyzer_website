import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SafetyFlags from "./SafetyFlags";
import CopyNoteButton from "./CopyNoteButton";
import type { PkCalculateResponse } from "@/lib/api";
import ShareButtons from "./ShareButtons";

function ResultsPanel({
  result,
  onAdjustDose,
}: {
  result?: PkCalculateResponse;
  onAdjustDose?: (delta: { dose?: number; interval?: number }) => void;
}) {
  if (!result) {
    return (
      <div className="text-sm text-muted-foreground">No results yet.</div>
    );
  }
  const maintenance = `${Math.round(result.maintenanceDoseMg)} mg q${result.intervalHr}h`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Suggested Regimen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Loading dose</div>
              <div className="font-medium">{result?.loadingDoseMg ? `${Math.round(result.loadingDoseMg)} mg` : "Not indicated"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Maintenance</div>
              <div className="font-medium">{maintenance}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Predicted AUC24</div>
              <div className="font-medium">{result ? Math.round(result.auc24) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Predicted trough</div>
              <div className="font-medium">{result?.troughPredicted ? `${Math.round(result.troughPredicted.low)}–${Math.round(result.troughPredicted.high)} mg/L` : "—"}</div>
            </div>
          </div>
          {onAdjustDose && (
            <div className="flex gap-2 mt-3">
              <Button variant="secondary" onClick={() => onAdjustDose({ dose: (result?.maintenanceDoseMg || 0) + 250 })}>+250 mg</Button>
              <Button variant="secondary" onClick={() => onAdjustDose({ dose: (result?.maintenanceDoseMg || 0) - 250 })}>-250 mg</Button>
              <Button variant="secondary" onClick={() => onAdjustDose({ interval: (result?.intervalHr || 12) + 2 })}>+2h interval</Button>
              <Button variant="secondary" onClick={() => onAdjustDose({ interval: (result?.intervalHr || 12) - 2 })}>-2h interval</Button>
            </div>
          )}
          <div className="mt-3">
            <ShareButtons result={result} />
          </div>
        </CardContent>
      </Card>

      {result && <SafetyFlags safety={result.safety} />}

      {result && (
        <Card>
          <CardHeader><CardTitle>Next steps</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <ul className="list-disc ml-5 space-y-1">
              <li>Recheck levels after 3–4 doses or sooner if renal function changes.</li>
              <li>Aim for AUC/MIC 400–600; adjust dose or interval to stay in band.</li>
              <li>Monitor Scr daily in ICU; watch for nephrotoxicity signals.</li>
            </ul>
            <div className="mt-3">
              <CopyNoteButton result={result} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ResultsPanel;