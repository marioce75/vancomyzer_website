import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/shareLink";
import type { CalculateRequest, CalculateResponse } from "@/lib/api";

function formatTimestamp(ts: Date): string {
  return ts.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RoundsSummaryCard({
  inputs,
  result,
  infusionHr = 1,
}: {
  inputs?: CalculateRequest;
  result?: CalculateResponse;
  infusionHr?: number;
}) {
  const [copied, setCopied] = useState(false);

  const timestamp = useMemo(() => new Date(), []);

  const summary = useMemo(() => {
    if (!inputs || !result) return null;
    // No PHI: only regimen + AUC estimate + timestamp + mode label.
    const r = inputs.regimen;
    const trough = result.trough_mg_l;
    return [
      `Vancomyzer® Rounds Summary (educational estimate)`,
      `Time: ${formatTimestamp(timestamp)}`,
      `Regimen: ${Math.round(r.dose_mg)} mg q${Math.round(r.interval_hr)}h (infusion ${infusionHr.toFixed(1)}h)`,
      `AUC0–24: ~${Math.round(result.auc24_mg_h_l)} mg·h/L`,
      `Trough: ~${trough.toFixed(1)} mg/L`,
      `Note: Educational PK estimates only — not medical advice. Verify with institutional protocols.`,
      `No PHI stored.`,
    ].join("\n");
  }, [inputs, result, infusionHr, timestamp]);

  async function onCopy() {
    if (!summary) return;
    const ok = await copyToClipboard(summary);
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 1200);
  }

  if (!inputs || !inputs.regimen || !result) return null;

  return (
    <Card className="border-sky-200 bg-sky-50/40">
      <CardHeader>
        <CardTitle>Rounds Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Copy-friendly, non-PHI summary for sign-out. Includes regimen + AUC estimate + timestamp.
        </div>
        <pre className="text-xs whitespace-pre-wrap rounded-md border bg-background p-3 leading-relaxed">
          {summary}
        </pre>
        <div className="flex justify-end">
          <Button size="sm" onClick={onCopy}>{copied ? "Copied" : "Copy"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
