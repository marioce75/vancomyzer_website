import { computeInitialRegimen } from "@/lib/initialRegimen";

/** Rendered from the same calculation method as the application, not invented marketing data. */
export default function SyntheticExample() {
  const result = computeInitialRegimen({ age: 55, weight_kg: 70, height_cm: 170, sex: "male", serum_creatinine_mg_dl: 1 });
  const options = result.frequency_options.slice(0, 3);
  return <figure className="synthetic-example border bg-white p-5 sm:p-6" style={{ color: "#14232f", borderColor: "#cbd6e0" }}>
    <figcaption className="vz-serif text-[22px]" style={{ color: "#14232f" }}>A synthetic example</figcaption>
    <p className="mt-2 text-sm leading-relaxed">Age 55 · male · 70 kg · 170 cm<br />Serum creatinine 1 mg/dL · no measured levels</p>
    <p className="mt-4 text-sm">Starting-regimen comparisons from the current calculator:</p>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr className="border-b" style={{ borderColor: "#cbd6e0" }}><th scope="col" className="py-2 pr-3">Regimen</th><th scope="col" className="py-2">Predicted AUC₂₄<br /><span className="font-normal">mg·h/L</span></th></tr></thead>
      <tbody>{options.map(option => <tr key={option.interval_hours} className="border-b" style={{ borderColor: "#e3eaf0" }}><td className="py-3 pr-3">{option.dose_mg} mg every {option.interval_hours} h<br /><span className="text-xs">Infused over {option.infusion_duration_hours.toFixed(2)} h</span></td><td className="py-3">{option.auc24.toFixed(0)}</td></tr>)}</tbody>
    </table></div>
    <p className="mt-4 text-sm leading-relaxed">Population-model estimates at steady state, without level-based adjustment. This is fabricated example data, not a patient or evidence of clinical validation. Do not use these regimens for a patient.</p>
  </figure>;
}
