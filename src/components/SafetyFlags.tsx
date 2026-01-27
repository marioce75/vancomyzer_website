import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PkCalculateResponse } from "@/lib/api";

export default function SafetyFlags({ safety }: { safety: PkCalculateResponse["safety"] }) {
  if (!safety) return null;
  const items: string[] = [];
  if (safety.aucWarning800) items.push("AUC > 800: high nephrotoxicity risk.");
  else if (safety.aucWarning600) items.push("AUC > 600: consider reduction.");
  if (safety.crclLow) items.push("Low CrCl: dose cautiously and monitor Scr.");
  items.push(...(safety.messages || []));

  if (items.length === 0) return null;

  return (
    <Alert className="border-warning bg-warning/10 text-warning-foreground">
      <AlertDescription className="text-sm">
        {items.map((m, i) => (
          <div key={i}>• {m}</div>
        ))}
      </AlertDescription>
    </Alert>
  );
}
