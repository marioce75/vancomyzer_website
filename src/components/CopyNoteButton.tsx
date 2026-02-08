import { Button } from "@/components/ui/button";
import type { PkCalculateResponse } from "@/lib/api";

export default function CopyNoteButton({ result }: { result: PkCalculateResponse }) {
  function buildNote() {
    const lines = [
      `Vancomycin AUC dosing recommendation:`,
      `Loading: ${result.loadingDoseMg ? Math.round(result.loadingDoseMg) + " mg" : "not indicated"}`,
      `Maintenance: ${Math.round(result.maintenanceDoseMg)} mg q${result.intervalHr}h`,
      `Predicted AUC24: ${Math.round(result.auc24)}`,
      result.troughPredicted ? `Predicted trough: ${Math.round(result.troughPredicted.low)}–${Math.round(result.troughPredicted.high)} mg/L` : undefined,
      `Safety: ${[result.safety.aucWarning800 ? "high risk" : undefined, result.safety.aucWarning600 ? "above 600" : undefined, result.safety.crclLow ? "low CrCl" : undefined].filter(Boolean).join(", ") || "none"}`,
      `Next: recheck levels after 3–4 doses; monitor renal function.`,
      `Note: Clinical decision support only; verify with institutional protocols.`
    ].filter(Boolean).join("\n");
    return lines;
  }

  async function onCopy() {
    const text = buildNote();
    await navigator.clipboard.writeText(text);
  }

  return (
    <Button onClick={onCopy} variant="outline">Copy for Note</Button>
  );
}
