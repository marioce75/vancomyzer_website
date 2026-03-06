import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useVancomyzerStore } from "@/store/vancomyzerStore";
import { formatNumber } from "@/lib/format";
import { derivePeakTroughFromCurve, formatConcentration } from "@/lib/pkCurve";
import type { BasicCalculateResponse, BayesianCalculateResponse } from "@/lib/api";
import { AUC_TARGET, REGIMEN_LIMITS } from "@/lib/constraints";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Result = BasicCalculateResponse | BayesianCalculateResponse;

function StatusIcon({ status }: { status: "green" | "yellow" | "red" }) {
  if (status === "green") return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (status === "yellow") return <AlertTriangle className="h-5 w-5 text-amber-600" />;
  return <XCircle className="h-5 w-5 text-red-600" />;
}

function aucStatus(auc: number): "green" | "yellow" | "red" {
  if (auc >= AUC_TARGET.low && auc <= AUC_TARGET.high) return "green";
  if (auc >= 350 && auc <= 650) return "yellow";
  return "red";
}

function peakStatus(peak: number): "green" | "yellow" | "red" {
  if (peak > 50) return "red";
  if (peak > 40) return "yellow";
  return "green";
}

function troughStatus(trough: number): "green" | "yellow" | "red" {
  if (trough >= 10 && trough <= 20) return "green";
  if (trough >= 15 && trough <= 20) return "green";
  if (trough < 10) return "yellow";
  if (trough > 20) return "yellow";
  return "green";
}

export default function DoseRecommendationCard() {
  const { result, dosing, mode, loading, error } = useVancomyzerStore();

  const data = useMemo(() => {
    if (!result) return null;
    if (mode === "basic" && "predicted" in result) {
      const r = result as BasicCalculateResponse;
      const curve = r.curve ?? [];
      const derived =
        curve.length > 0
          ? derivePeakTroughFromCurve(
              curve.map((p) => ({ t_hr: p.t_hr, conc_mg_l: p.conc_mg_l })),
              { intervalHr: dosing.intervalHr, infusionHr: dosing.infusionHr }
            )
          : null;
      const peak = derived ? derived.peak : r.predicted?.peak ?? 0;
      const trough = derived ? derived.trough : r.predicted?.trough ?? 0;
      const auc = r.predicted?.auc24 ?? 0;
      const recommendedDose = r.regimen?.recommended_dose_mg ?? dosing.doseMg;
      const recommendedInterval = r.regimen?.recommended_interval_hr ?? dosing.intervalHr;
      const targetProb = auc >= AUC_TARGET.low && auc <= AUC_TARGET.high ? 1 : 0;
      return {
        suggestedDoseMg: recommendedDose,
        suggestedIntervalHr: recommendedInterval,
        estimatedAuc24: auc,
        predictedPeak: peak,
        predictedTrough: trough,
        probabilityTarget: targetProb,
        isBayesian: false,
      };
    }
    if (mode === "bayesian" && "auc24" in result) {
      const r = result as BayesianCalculateResponse;
      const rec = r.recommendation;
      const curve = r.curve ?? [];
      const derived =
        curve.length > 0
          ? derivePeakTroughFromCurve(
              curve.map((p) => ({ t_hr: p.t_hr, conc_mg_l: p.conc_mg_l })),
              { intervalHr: rec.interval_hr, infusionHr: r.infusion_hr ?? dosing.infusionHr }
            )
          : null;
      return {
        suggestedDoseMg: rec.per_dose_mg,
        suggestedIntervalHr: rec.interval_hr,
        estimatedAuc24: r.auc24,
        predictedPeak: derived?.peak ?? 0,
        predictedTrough: derived?.trough ?? 0,
        probabilityTarget: r.auc24 >= AUC_TARGET.low && r.auc24 <= AUC_TARGET.high ? 1 : 0,
        isBayesian: true,
      };
    }
    return null;
  }, [result, dosing, mode]);

  if (error) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="py-6">
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="py-8">
          <p className="text-sm text-gray-500 text-center">Calculating…</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900">Recommended Dose</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Enter patient data to see recommendations.</p>
        </CardContent>
      </Card>
    );
  }

  const aucStat = aucStatus(data.estimatedAuc24);
  const peakStat = peakStatus(data.predictedPeak);
  const troughStat = troughStatus(data.predictedTrough);

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900">
          Recommended Dose {data.isBayesian ? "(Bayesian)" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Suggested dose</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(data.suggestedDoseMg, 0)} mg
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Interval</div>
            <div className="text-2xl font-bold text-gray-900">
              q{formatNumber(data.suggestedIntervalHr, 0)}h
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3">
            <StatusIcon status={aucStat} />
            <div>
              <div className="text-xs text-gray-500">Estimated AUC₂₄</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatNumber(data.estimatedAuc24, 0)}
              </div>
              <div className="text-[10px] text-gray-500">target 400–600</div>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3">
            <StatusIcon status={peakStat} />
            <div>
              <div className="text-xs text-gray-500">Predicted peak</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatConcentration(data.predictedPeak, 1)} mg/L
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3">
            <StatusIcon status={troughStat} />
            <div>
              <div className="text-xs text-gray-500">Predicted trough</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatConcentration(data.predictedTrough, 1)} mg/L
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <StatusIcon status={data.probabilityTarget === 1 ? "green" : "yellow"} />
          <span className="text-gray-700">
            Probability of target attainment:{" "}
            <strong>{data.probabilityTarget === 1 ? "Within target" : "Outside target"}</strong>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
