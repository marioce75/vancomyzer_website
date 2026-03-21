"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceDot,
} from "recharts";
import type {
  CalculateRequestLevel,
  CalculateRequestPatient,
  CalculateRequestRegimen,
  CalculatorMode,
} from "@/types/calculator";

interface LivePreviewGraphProps {
  mode: CalculatorMode;
  patient: CalculateRequestPatient;
  regimen: CalculateRequestRegimen;
  levels: CalculateRequestLevel[];
  hasCalculatedResult: boolean;
}

interface PreviewPoint {
  time_hours: number;
  concentration: number;
}

function roundedDose(weightKg: number): number {
  if (!weightKg || weightKg <= 0) return 1000;
  return weightKg >= 100 ? 1750 : weightKg >= 80 ? 1500 : weightKg >= 60 ? 1000 : 750;
}

function idealBodyWeightKg(patient: Pick<CalculateRequestPatient, "sex" | "height_cm">): number {
  const heightInches = (patient.height_cm || 170) / 2.54;
  const inchesOverFiveFeet = Math.max(0, heightInches - 60);
  const sex = (patient.sex || "male").toLowerCase();
  const base = sex === "female" ? 45.5 : 50;
  return Math.max(30, base + 2.3 * inchesOverFiveFeet);
}

function adjustedBodyWeightKg(actualWeightKg: number, idealWeightKg: number): number {
  return idealWeightKg + 0.4 * Math.max(0, actualWeightKg - idealWeightKg);
}

function cockcroftGaultWeightKg(patient: CalculateRequestPatient): number {
  const actualWeightKg = Math.max(patient.weight_kg || 80, 30);
  const idealWeightKg = idealBodyWeightKg(patient);

  if (actualWeightKg < idealWeightKg) {
    return actualWeightKg;
  }
  if (actualWeightKg > idealWeightKg * 1.2) {
    return adjustedBodyWeightKg(actualWeightKg, idealWeightKg);
  }
  return idealWeightKg;
}

function creatinineClearance(patient: CalculateRequestPatient): number {
  const scr = Math.max(patient.serum_creatinine_mg_dl || 1.0, 0.4);
  const weightKg = cockcroftGaultWeightKg(patient);
  const age = patient.age || 50;
  let crcl = ((140 - age) * weightKg) / (72 * scr);
  if ((patient.sex || "male").toLowerCase() === "female") crcl *= 0.85;
  return Math.max(0, Math.round(crcl * 10) / 10);
}

function previewCurve(mode: CalculatorMode, patient: CalculateRequestPatient, regimen: CalculateRequestRegimen): PreviewPoint[] {
  const dose = regimen.dose_mg > 0 ? regimen.dose_mg : roundedDose(patient.weight_kg);
  const t_inf = regimen.infusion_duration_hours > 0 ? regimen.infusion_duration_hours : 1;
  const interval = regimen.interval_hours > 0 ? regimen.interval_hours : (patient.serum_creatinine_mg_dl > 1.2 ? 24 : 12);
  
  const crcl = creatinineClearance(patient);
  const ibwKg = idealBodyWeightKg(patient);
  const vd = 0.69 * ibwKg; 
  
  const clMlMin = 0.771 * Math.max(0, crcl) + 18.9;
  const clearanceLPerHour = (clMlMin * 60) / 1000;
  let ke = 0.002;
  if (clearanceLPerHour > 0 && vd > 0) {
    ke = Math.min(Math.max(clearanceLPerHour / vd, 0.002), 0.2);
  }

  const accumulation = 1 / (1 - Math.exp(-ke * interval));
  const peak = (dose / (vd * ke * t_inf)) * (1 - Math.exp(-ke * t_inf)) * accumulation;
  const trough = peak * Math.exp(-ke * (interval - t_inf));

  const points: PreviewPoint[] = [];
  const timeHorizonHours = 48;
  const timeStep = 0.25;

  for (let t = 0; t <= timeHorizonHours; t += timeStep) {
    const doseNumber = Math.floor(t / interval);
    const timeInInterval = t - (doseNumber * interval);

    let concentration;
    const c_inf_end = (dose / (vd * ke * t_inf)) * (1 - Math.exp(-ke * t_inf));

    if (timeInInterval <= t_inf) {
      // During infusion
      const conc_infusion = (dose / (vd * ke * t_inf)) * (1 - Math.exp(-ke * timeInInterval));
      const conc_elimination = trough * Math.exp(-ke * timeInInterval);
      concentration = conc_infusion + conc_elimination;
    } else {
      // Post-infusion elimination phase
      concentration = peak * Math.exp(-ke * (timeInInterval - t_inf));
    }
    
    points.push({ time_hours: t, concentration: Math.max(0, Number(concentration.toFixed(1))) });
  }

  return points;
}

function previewMeasured(levels: CalculateRequestLevel[]): PreviewPoint[] {
  return levels
    .filter((level) => level.value_mcg_ml > 0 || level.time_since_last_dose_hours > 0)
    .map((level) => ({
      time_hours: level.time_since_last_dose_hours || 0,
      concentration: level.value_mcg_ml || 0,
    }));
}

export default function LivePreviewGraph({ mode, patient, regimen, levels, hasCalculatedResult }: LivePreviewGraphProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const curve = previewCurve(mode, patient, regimen);
  const measured = previewMeasured(levels);

  if (!mounted) {
    return <div className="h-[320px] rounded-xl border border-dashed border-slate-300 bg-slate-50" />;
  }

  return (
    <div className="h-full w-full min-w-0 flex flex-col gap-2" aria-label="Live preview graph">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 font-medium">
        48-hour steady-state preview only. Recalculate for exact PK fit.
      </div>
      <div className="flex-1 min-h-[250px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={320}>
          <LineChart data={curve} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <ReferenceArea y1={400 / 24} y2={600 / 24} fill="#dcfce7" fillOpacity={0.35} ifOverflow="extendDomain" />
            <XAxis dataKey="time_hours" type="number" domain={[0, 48]} tickFormatter={(v) => `${v}h`} tick={{ fontSize: 11 }} stroke="#64748b" />
            <YAxis dataKey="concentration" type="number" domain={[0, 'dataMax + 10']} tick={{ fontSize: 11 }} stroke="#64748b" label={{ value: "mcg/mL", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(1)} mcg/mL`, hasCalculatedResult ? "Preview overlay" : "Preview"]}
              labelFormatter={(label) => `Time ${label} h`}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            />
            <Line
              type="monotone"
              dataKey="concentration"
              stroke="#0f172a"
              strokeWidth={2.25}
              dot={false}
              strokeDasharray={hasCalculatedResult ? "4 4" : "0"}
              activeDot={{ r: 4, fill: "#0f172a" }}
              isAnimationActive={false}
            />
            {measured.map((point, index) => (
              <ReferenceDot key={index} x={point.time_hours} y={point.concentration} r={5} fill="#dc2626" stroke="#fff" strokeWidth={1} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

