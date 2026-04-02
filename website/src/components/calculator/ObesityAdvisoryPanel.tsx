"use client";

interface ObesityAdvisoryPanelProps {
  bmi: number;
  ffm_kg: number;
  sex: "male" | "female";
}

export default function ObesityAdvisoryPanel({ bmi, ffm_kg, sex }: ObesityAdvisoryPanelProps) {
  const ffmEquation = sex === "male"
    ? "(9270 \u00d7 TBW) / (6680 + 216 \u00d7 BMI)"
    : "(9270 \u00d7 TBW) / (8780 + 244 \u00d7 BMI)";

  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: "#fcd34d", background: "#fffbeb" }}>
      <p className="text-sm font-bold" style={{ color: "#92400e", margin: 0 }}>
        CLASS III OBESITY DETECTED
      </p>
      <div className="mt-2 space-y-1.5 text-xs" style={{ color: "#78350f" }}>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span><strong>BMI:</strong> {bmi.toFixed(1)} kg/m\u00b2</span>
          <span><strong>Fat-Free Mass:</strong> {ffm_kg.toFixed(1)} kg <span className="text-[10px]" style={{ color: "#92400e" }}>(Janmahasatian 2005)</span></span>
        </div>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          V1 and V2 calculated using FFM ({ffmEquation}) &mdash; vancomycin is hydrophilic and distributes poorly into adipose tissue.
          CL uses TBW-based CrCl (Cockcroft-Gault) as renal elimination scales with total body weight.
        </p>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          <strong>Recommendation:</strong> Two-point sampling (peak + trough) per 2020 ASHP/IDSA guidelines for AUC-guided dosing in obesity.
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1" style={{ fontSize: 10 }}>
          <a
            href="https://doi.org/10.1111/bcp.14144"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
            style={{ color: "#92400e" }}
          >
            Smit 2020 (10.1111/bcp.14144) &nearr;
          </a>
          <a
            href="https://doi.org/10.1007/s40262-023-01324-5"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
            style={{ color: "#92400e" }}
          >
            Zhang 2023 (10.1007/s40262-023-01324-5) &nearr;
          </a>
        </div>
      </div>
    </div>
  );
}
