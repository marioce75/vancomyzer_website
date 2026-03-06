import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVancomyzerStore } from "@/store/vancomyzerStore";
import { getVancoCoachSuggestions } from "@/ai/vancoCoach";
import { derivePeakTroughFromCurve } from "@/lib/pkCurve";
import { MessageCircle, X, ChevronUp } from "lucide-react";

export default function VancoCoachWidget() {
  const [open, setOpen] = useState(false);
  const {
    patient,
    dosing,
    mode,
    result,
    doseHistory,
    serumLevels,
    crclCalculated,
    ibw,
    abw,
  } = useVancomyzerStore();

  const suggestions = useMemo(() => {
    const crcl = crclCalculated ?? null;
    const profile = {
      age: patient.age ?? 0,
      sex: (patient.sex ?? "male") as "male" | "female",
      heightCm: patient.heightCm ?? 0,
      weightKg: patient.weightKg ?? 0,
      serumCreatinine: patient.serumCreatinine ?? 0,
      crclMlMin: crcl,
      ibw,
      abw,
    };
    let auc24: number | null = null;
    let predictedPeak: number | null = null;
    let predictedTrough: number | null = null;
    let halfLifeHr: number | null = null;
    if (result) {
      if ("predicted" in result) {
        auc24 = result.predicted?.auc24 ?? null;
        predictedPeak = result.predicted?.peak ?? null;
        predictedTrough = result.predicted?.trough ?? null;
        halfLifeHr = result.predicted?.half_life_hr ?? null;
      }
      if ("auc24" in result) {
        auc24 = result.auc24;
        const curve = result.curve ?? [];
        if (curve.length > 0 && result.recommendation) {
          const derived = derivePeakTroughFromCurve(
            curve.map((p: { t_hr: number; conc_mg_l: number }) => ({ t_hr: p.t_hr, conc_mg_l: p.conc_mg_l })),
            { intervalHr: result.recommendation.interval_hr, infusionHr: result.infusion_hr ?? dosing.infusionHr }
          );
          predictedPeak = derived?.peak ?? null;
          predictedTrough = derived?.trough ?? null;
        }
        const details = result.calculation_details as { parameters?: { half_life_hr?: number } } | undefined;
        halfLifeHr = details?.parameters?.half_life_hr ?? null;
      }
    }
    const dosingCtx = {
      doseMg: dosing.doseMg,
      intervalHr: dosing.intervalHr,
      infusionHr: dosing.infusionHr,
      auc24,
      predictedPeak,
      predictedTrough,
      mode,
    };
    const levels = serumLevels.map((r) => ({
      concentration: parseFloat(r.concentration) || 0,
      timeHours: parseFloat(r.timeHours) || 0,
      levelType: r.levelType,
    })).filter((l) => l.concentration > 0 && l.timeHours >= 0);
    const history = doseHistory.map((d) => ({
      doseMg: d.doseMg,
      startTimeHr: d.startTimeHr,
      infusionHr: d.infusionHr,
    }));
    return getVancoCoachSuggestions(profile, dosingCtx, levels, history, halfLifeHr);
  }, [
    patient,
    dosing,
    mode,
    result,
    doseHistory,
    serumLevels,
    crclCalculated,
    ibw,
    abw,
  ]);

  const hasSuggestions = suggestions.length > 0;
  const errorCount = suggestions.filter((s) => s.severity === "error").length;
  const warningCount = suggestions.filter((s) => s.severity === "warning").length;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <Card className="w-[360px] max-w-[calc(100vw-2rem)] shadow-lg">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Vanco Coach
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="max-h-[280px] overflow-y-auto">
            {suggestions.length === 0 ? (
              <p className="text-sm text-gray-500">No clinical suggestions at this time. Enter data and run a calculation for guidance.</p>
            ) : (
              <ul className="space-y-2">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    className={`text-sm rounded-lg px-3 py-2 border ${
                      s.severity === "error"
                        ? "bg-red-50 border-red-200 text-red-800"
                        : s.severity === "warning"
                        ? "bg-amber-50 border-amber-200 text-amber-900"
                        : "bg-gray-50 border-gray-200 text-gray-700"
                    }`}
                  >
                    {s.message}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
      <div className="relative">
        <Button
          onClick={() => setOpen((o) => !o)}
          className="rounded-full h-12 w-12 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center"
          title="Vanco Coach"
        >
          {open ? <ChevronUp className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        </Button>
        {!open && hasSuggestions && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
            {errorCount > 0 ? errorCount : warningCount}
          </span>
        )}
      </div>
    </div>
  );
}
