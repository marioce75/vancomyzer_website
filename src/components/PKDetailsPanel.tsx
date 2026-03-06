import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVancomyzerStore } from "@/store/vancomyzerStore";
import { formatNumber } from "@/lib/format";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function PKDetailsPanel() {
  const [open, setOpen] = useState(false);
  const { result, mode } = useVancomyzerStore();

  const details = result && "calculation_details" in result ? result.calculation_details : null;
  const params = details && typeof details === "object" && "parameters" in details ? (details.parameters as Record<string, number>) : null;
  const crcl = result && "crcl" in result && result.crcl?.selected_ml_min != null ? result.crcl.selected_ml_min : params?.crcl_ml_min;
  const cl = params?.cl_l_hr ?? (result && "cl_l_hr" in result ? (result as { cl_l_hr: number }).cl_l_hr : null);
  const vd = params?.vd_l ?? (result && "v_l" in result ? (result as { v_l: number }).v_l : null);
  const ke = params?.k_e ?? null;
  const halfLife = params?.half_life_hr ?? (result && "predicted" in result ? (result as { predicted?: { half_life_hr?: number } }).predicted?.half_life_hr : null);
  const model = details && typeof details === "object" && "model" in details ? String(details.model) : mode === "bayesian" ? "Bayesian MAP" : "Population (Cockcroft-Gault)";
  const method = details && typeof details === "object" && "method" in details ? String(details.method) : mode === "bayesian" ? "MAP fit" : "Deterministic";
  const aucMethod = details && typeof details === "object" && "auc_method" in details ? String(details.auc_method) : "—";
  const fitDiag = result && "fit_diagnostics" in result ? (result as { fit_diagnostics?: unknown }).fit_diagnostics : null;
  const levelPreds = fitDiag && typeof fitDiag === "object" && "level_predictions" in fitDiag
    ? (fitDiag as { level_predictions?: Array<{ observed: number; predicted: number; residual: number }> }).level_predictions
    : null;
  const rSquared = fitDiag && typeof fitDiag === "object" && "r_squared" in fitDiag
    ? (fitDiag as { r_squared?: number }).r_squared
    : null;

  if (!result) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="py-4">
          <p className="text-sm text-gray-500">Run a calculation to view PK model details.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-gray-50/50 rounded-t-lg transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-gray-900">PK Model Details</CardTitle>
              {open ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <span className="text-gray-500">Clearance (CL)</span>
                <div className="font-medium text-gray-900">
                  {cl != null ? `${formatNumber(cl, 2)} L/hr` : "—"}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Volume of distribution (Vd)</span>
                <div className="font-medium text-gray-900">
                  {vd != null ? `${formatNumber(vd, 1)} L` : "—"}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Elimination constant (kₑ)</span>
                <div className="font-medium text-gray-900">
                  {ke != null ? `${formatNumber(ke, 3)} hr⁻¹` : "—"}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Half-life (t½)</span>
                <div className="font-medium text-gray-900">
                  {halfLife != null ? `${formatNumber(halfLife, 1)} hr` : "—"}
                </div>
              </div>
              <div>
                <span className="text-gray-500">CrCl (used)</span>
                <div className="font-medium text-gray-900">
                  {crcl != null ? `${formatNumber(crcl, 0)} mL/min` : "—"}
                </div>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-2">
              <div className="text-gray-500">PK model</div>
              <div className="font-medium text-gray-900">{model}</div>
            </div>
            <div>
              <div className="text-gray-500">Calculation method</div>
              <div className="font-medium text-gray-900">{method}</div>
            </div>
            {aucMethod !== "—" && (
              <div>
                <div className="text-gray-500">AUC method</div>
                <div className="font-medium text-gray-900">{aucMethod}</div>
              </div>
            )}
            {rSquared != null && (
              <div>
                <div className="text-gray-500">Bayesian model fit (R²)</div>
                <div className="font-medium text-gray-900">{formatNumber(rSquared, 3)}</div>
              </div>
            )}
            {levelPreds && levelPreds.length > 0 && (
              <div>
                <div className="text-gray-500 mb-1">Observed vs predicted</div>
                <div className="text-xs text-gray-600 space-y-0.5">
                  {levelPreds.slice(0, 5).map((row, i) => (
                    <div key={i}>
                      obs {formatNumber(row.observed, 1)} · pred {formatNumber(row.predicted, 1)} · resid {formatNumber(row.residual, 1)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
