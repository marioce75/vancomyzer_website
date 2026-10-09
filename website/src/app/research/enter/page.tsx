"use client";
import NumericTextInput from "@/components/calculator/NumericTextInput";
import { parseCanonicalClinicalNumber, INVALID_NUMBER } from "@/lib/parseClinicalNumber";
const numeric = (raw: string) => parseCanonicalClinicalNumber(raw) ?? NaN;
import { LocalizedText } from "@/localization/LanguageProvider";


import { useState, useMemo } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Style constants                                                   */
/* ------------------------------------------------------------------ */

const NAVY = "#1e4d8c";
const GREEN = "#047857";
const RED = "#991b1b";
const AMBER = "#b45309";
const GRAY = "#718096";
const LIGHT_BORDER = "#e2e8f0";

const card: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${LIGHT_BORDER}`,
  borderRadius: 8,
  padding: "20px 24px",
  marginBottom: 20,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: NAVY,
  marginBottom: 12,
  marginTop: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#2d3748",
  display: "block",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 13,
  border: `1px solid ${LIGHT_BORDER}`,
  borderRadius: 4,
  boxSizing: "border-box",
  fontFamily: "system-ui, sans-serif",
};

const selectStyle: React.CSSProperties = { ...inputStyle, background: "#fff" };

const readOnlyStyle: React.CSSProperties = {
  ...inputStyle,
  background: "#f7fafc",
  color: NAVY,
  fontWeight: 600,
  cursor: "default",
};

const toggleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
};

const addBtn: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: 12,
  fontWeight: 600,
  border: `1px solid ${LIGHT_BORDER}`,
  cursor: "pointer",
  borderRadius: 4,
  color: NAVY,
  background: "#fff",
  marginTop: 6,
};

const removeBtn: React.CSSProperties = {
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
  borderRadius: 4,
  color: "#fff",
  background: RED,
};

const submitBtn: React.CSSProperties = {
  padding: "12px 32px",
  fontSize: 14,
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
  borderRadius: 6,
  color: "#fff",
  background: NAVY,
};

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface DoseRow {
  dose_mg: string;
  infusion_duration_min: string;
  time_hours: string;
  is_loading_dose: boolean;
}

interface LevelRow {
  concentration_mcg_ml: string;
  time_hours: string;
}

interface ScrRow {
  scr_mg_dl: string;
  time_hours: string;
}

/* ------------------------------------------------------------------ */
/*  PK calculation helpers                                            */
/* ------------------------------------------------------------------ */

function calcBMI(w: number, h: number) {
  if (!w || !h) return 0;
  return w / ((h / 100) ** 2);
}

function calcIBW(sex: string, h: number) {
  if (!h) return 0;
  const inches = h / 2.54;
  if (sex === "male") return 50 + 2.3 * (inches - 60);
  return 45.5 + 2.3 * (inches - 60);
}

function calcAdjBW(ibw: number, w: number) {
  if (!ibw || !w) return 0;
  return ibw + 0.4 * (w - ibw);
}

function calcFFM(sex: string, w: number, h: number) {
  if (!w || !h) return 0;
  const bmi = calcBMI(w, h);
  if (sex === "male") return (9270 * w) / (6680 + 216 * bmi);
  return (9270 * w) / (8780 + 244 * bmi);
}

function calcCrCl(age: number, w: number, scr: number, sex: string) {
  if (!age || !w || !scr) return 0;
  let cl = ((140 - age) * w) / (72 * scr);
  if (sex === "female") cl *= 0.85;
  return cl;
}

/* ------------------------------------------------------------------ */
/*  Nephrotoxin vocabulary                                            */
/* ------------------------------------------------------------------ */

const NEPHROTOXINS = [
  "NSAIDs",
  "Aminoglycosides",
  "Amphotericin B",
  "IV Contrast",
  "Acyclovir",
  "Tacrolimus",
  "Cisplatin",
  "Colistin",
  "Piperacillin-Tazobactam",
];

const INDICATIONS = [
  "MRSA Bacteremia",
  "MRSA Pneumonia",
  "SSTI",
  "Osteomyelitis",
  "Empiric",
  "Other",
];

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function ResearchEntryForm() {
  /* -- Demographics -- */
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("male");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [scrBaseline, setScrBaseline] = useState("");
  const [siteId, setSiteId] = useState("HCA-GC-01");
  const [ethnicity, setEthnicity] = useState("unknown");
  const [enrollmentDate, setEnrollmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [icuAdmission, setIcuAdmission] = useState(false);
  const [bedbound, setBedbound] = useState(false);
  const [rrt, setRrt] = useState(false);
  const [indication, setIndication] = useState("Empiric");

  /* -- Dosing -- */
  const [doses, setDoses] = useState<DoseRow[]>([
    { dose_mg: "", infusion_duration_min: "60", time_hours: "0", is_loading_dose: false },
  ]);

  /* -- Levels -- */
  const [levels, setLevels] = useState<LevelRow[]>([
    { concentration_mcg_ml: "", time_hours: "" },
  ]);

  /* -- SCr Trajectory -- */
  const [scrPoints, setScrPoints] = useState<ScrRow[]>([]);

  /* -- Nephrotoxins -- */
  const [selectedNephrotoxins, setSelectedNephrotoxins] = useState<Record<string, boolean>>({});
  const [vasopressorUse, setVasopressorUse] = useState(false);

  /* -- Clinical Outcomes -- */
  const [hospitalLos, setHospitalLos] = useState("");
  const [vancDiscontinued, setVancDiscontinued] = useState(false);
  const [discontinuationReason, setDiscontinuationReason] = useState("");
  const [microOutcome, setMicroOutcome] = useState("");

  /* -- UI state -- */
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ study_id: string; eligible: boolean; exclusion_reasons: string[] } | null>(null);
  const [error, setError] = useState("");

  /* ---- Computed fields ---- */
  const w = numeric(weightKg) || 0;
  const h = numeric(heightCm) || 0;
  const a = numeric(age) || 0;
  const scr = numeric(scrBaseline) || 0;

  const computed = useMemo(() => {
    const bmi = calcBMI(w, h);
    const ibw = calcIBW(sex, h);
    const adjbw = calcAdjBW(ibw, w);
    const ffm = calcFFM(sex, w, h);
    const crcl = calcCrCl(a, w, scr, sex);
    return { bmi, ibw, adjbw, ffm, crcl };
  }, [w, h, a, scr, sex]);

  /* ---- Dose helpers ---- */
  const addDose = () => setDoses([...doses, { dose_mg: "", infusion_duration_min: "60", time_hours: "", is_loading_dose: false }]);
  const removeDose = (i: number) => setDoses(doses.filter((_, idx) => idx !== i));
  const updateDose = (i: number, field: keyof DoseRow, value: string | boolean) => {
    const copy = [...doses];
    (copy[i] as unknown as Record<string, string | boolean>)[field] = value;
    setDoses(copy);
  };

  /* ---- Level helpers ---- */
  const addLevel = () => setLevels([...levels, { concentration_mcg_ml: "", time_hours: "" }]);
  const removeLevel = (i: number) => setLevels(levels.filter((_, idx) => idx !== i));
  const updateLevel = (i: number, field: keyof LevelRow, value: string) => {
    const copy = [...levels];
    copy[i][field] = value;
    setLevels(copy);
  };

  /* ---- SCr helpers ---- */
  const addScr = () => setScrPoints([...scrPoints, { scr_mg_dl: "", time_hours: "" }]);
  const removeScr = (i: number) => setScrPoints(scrPoints.filter((_, idx) => idx !== i));
  const updateScr = (i: number, field: keyof ScrRow, value: string) => {
    const copy = [...scrPoints];
    copy[i][field] = value;
    setScrPoints(copy);
  };

  /* ---- Level timing flags ---- */
  const levelFlags = useMemo(() => {
    return levels.map((lvl) => {
      const t = numeric(lvl.time_hours);
      if (isNaN(t)) return { during_infusion: false, in_distribution: false };
      let during = false;
      let distribution = false;
      for (const d of doses) {
        const doseTime = numeric(d.time_hours);
        const dur = numeric(d.infusion_duration_min);
        if (isNaN(doseTime) || isNaN(dur)) continue;
        const endInfusion = doseTime + dur / 60;
        if (t >= doseTime && t <= endInfusion) during = true;
        if (t > endInfusion && t <= endInfusion + 1) distribution = true;
      }
      return { during_infusion: during, in_distribution: distribution };
    });
  }, [levels, doses]);

  /* ---- Submit ---- */
  const handleSubmit = async () => {
    setError("");
    setResult(null);
    const malformed = document.querySelector<HTMLInputElement>('input[data-clinical-number="true"]:invalid');
    if (malformed) { setError(INVALID_NUMBER); malformed.reportValidity(); malformed.focus(); return; }
    setSubmitting(true);

    try {
      // Step 1: create patient
      const patientRes = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: a,
          sex,
          weight_kg: w,
          height_cm: h,
          scr_baseline: scr,
          site_id: siteId,
          ethnicity,
          enrollment_date: enrollmentDate,
          icu_admission: icuAdmission,
          bedbound,
          rrt,
          indication,
        }),
      });

      if (!patientRes.ok) {
        const d = await patientRes.json().catch(() => ({}));
        throw new Error(d.error || `Patient creation failed (${patientRes.status}).`);
      }

      const patientData = await patientRes.json();
      const studyId = patientData.study_id;

      // Step 2: dosing records
      for (const dose of doses) {
        if (!dose.dose_mg) continue;
        await fetch(`/api/research/${studyId}/dosing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dose_mg: numeric(dose.dose_mg),
            infusion_duration_min: numeric(dose.infusion_duration_min),
            time_hours: numeric(dose.time_hours),
            is_loading_dose: dose.is_loading_dose,
          }),
        });
      }

      // Step 3: level records
      for (const lvl of levels) {
        if (!lvl.concentration_mcg_ml) continue;
        await fetch(`/api/research/${studyId}/levels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            concentration_mcg_ml: numeric(lvl.concentration_mcg_ml),
            time_hours: numeric(lvl.time_hours),
          }),
        });
      }

      // Step 4: SCr trajectory
      for (const s of scrPoints) {
        if (!s.scr_mg_dl) continue;
        await fetch(`/api/research/${studyId}/scr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scr_mg_dl: numeric(s.scr_mg_dl),
            time_hours: numeric(s.time_hours),
          }),
        });
      }

      // Step 5: nephrotoxins
      const checkedDrugs = Object.entries(selectedNephrotoxins).filter(([, v]) => v).map(([k]) => k);
      for (const drug of checkedDrugs) {
        await fetch(`/api/research/${studyId}/nephrotoxins`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ drug_name: drug, vasopressor_use: vasopressorUse }),
        });
      }
      // If vasopressor but no drugs checked, still record it
      if (vasopressorUse && checkedDrugs.length === 0) {
        await fetch(`/api/research/${studyId}/nephrotoxins`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ drug_name: "Vasopressor", vasopressor_use: true }),
        });
      }

      // Step 6: clinical outcomes
      const hasOutcomes = hospitalLos || vancDiscontinued || microOutcome;
      if (hasOutcomes) {
        await fetch(`/api/research/${studyId}/outcomes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hospital_los_days: hospitalLos ? numeric(hospitalLos) : null,
            vanc_discontinued_early: vancDiscontinued,
            discontinuation_reason: discontinuationReason || null,
            microbiological_outcome: microOutcome || null,
          }),
        });
      }

      setResult({
        study_id: studyId,
        eligible: patientData.eligibility?.eligible ?? false,
        exclusion_reasons: patientData.eligibility?.exclusion_reasons ?? [],
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- Field grid helper ---- */
  const FieldGrid = ({ children, cols = 3 }: { children: React.ReactNode; cols?: number }) => (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, marginBottom: 12 }}>
      {children}
    </div>
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label style={labelStyle}><LocalizedText text={label} /></label>
      {children}
    </div>
  );

  /* ============================================================== */
  /*  RENDER                                                        */
  /* ============================================================== */

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 16px 80px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <Link href="/research" style={{ fontSize: 13, color: NAVY, textDecoration: "none", fontWeight: 600 }}><LocalizedText text={"Back to Dashboard"} /></Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: NAVY, margin: "12px 0 4px" }}><LocalizedText text={"New Research Record"} /></h1>
      <p style={{ fontSize: 13, color: GRAY, marginBottom: 24 }}><LocalizedText text={"Enter de-identified patient data. No name, MRN, or DOB."} /></p>

      {/* Success result */}
      {result && (
        <div style={{ ...card, background: "#ecfdf5", border: `1px solid #6ee7b7` }}>
          <h2 style={{ ...sectionTitle, color: GREEN }}><LocalizedText text={"Record Created Successfully"} /></h2>
          <div style={{ fontSize: 20, fontWeight: 700, color: NAVY, marginBottom: 8 }}><LocalizedText text={"Study ID:"} />{" "}{result.study_id}
          </div>
          <div style={{ fontSize: 13, marginBottom: 4 }}><LocalizedText text={"Eligibility:"} />{" "}
            <span style={{ fontWeight: 700, color: result.eligible ? GREEN : RED }}>
              <LocalizedText text={result.eligible ? "ELIGIBLE" : "EXCLUDED"} />
            </span>
          </div>
          {result.exclusion_reasons.length > 0 && (
            <div style={{ fontSize: 12, color: GRAY }}><LocalizedText text={"Reasons:"} />{" "}{result.exclusion_reasons.map((reason, i) => <span key={i}>{i > 0 ? ", " : ""}<LocalizedText text={reason} /></span>)}
            </div>
          )}
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <Link href="/research" style={{ ...addBtn, textDecoration: "none", display: "inline-block" }}><LocalizedText text={"Back to Dashboard"} /></Link>
            <button style={addBtn} onClick={() => { setResult(null); window.scrollTo(0, 0); }}><LocalizedText text={"Enter Another Record"} /></button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "10px 14px", marginBottom: 16, background: "#fef2f2", border: `1px solid #fca5a5`, color: RED, fontSize: 13, borderRadius: 4 }}>
          <LocalizedText text={error} />
        </div>
      )}

      {!result && (
        <>
          {/* ---- Section 1: Demographics ---- */}
          <div style={card}>
            <h2 style={sectionTitle}><LocalizedText text={"Demographics"} /></h2>
            <FieldGrid>
              <Field label="Age (years)">
                <NumericTextInput  min={18} value={age} onValueChange={(canonical) => setAge(canonical)} style={inputStyle} />
              </Field>
              <Field label="Sex">
                <select value={sex} onChange={(e) => setSex(e.target.value)} style={selectStyle}>
                  <option value="male"><LocalizedText text="Male" /></option>
                  <option value="female"><LocalizedText text="Female" /></option>
                </select>
              </Field>
              <Field label="Ethnicity">
                <select value={ethnicity} onChange={(e) => setEthnicity(e.target.value)} style={selectStyle}>
                  <option value="Hispanic"><LocalizedText text={"Hispanic"} /></option>
                  <option value="Non-Hispanic"><LocalizedText text={"Non-Hispanic"} /></option>
                  <option value="unknown"><LocalizedText text={"Unknown"} /></option>
                </select>
              </Field>
            </FieldGrid>
            <FieldGrid>
              <Field label="Weight (kg)">
                <NumericTextInput  min={30} step="0.1" value={weightKg} onValueChange={(canonical) => setWeightKg(canonical)} style={inputStyle} />
              </Field>
              <Field label="Height (cm)">
                <NumericTextInput  min={100} step="0.1" value={heightCm} onValueChange={(canonical) => setHeightCm(canonical)} style={inputStyle} />
              </Field>
              <Field label="SCr Baseline (mg/dL)">
                <NumericTextInput  min={0.1} step="0.01" value={scrBaseline} onValueChange={(canonical) => setScrBaseline(canonical)} style={inputStyle} />
              </Field>
            </FieldGrid>
            <FieldGrid>
              <Field label="Site ID">
                <input type="text" value={siteId} onChange={(e) => setSiteId(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Enrollment Date">
                <input type="date" value={enrollmentDate} onChange={(e) => setEnrollmentDate(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Indication">
                <select value={indication} onChange={(e) => setIndication(e.target.value)} style={selectStyle}>
                  {INDICATIONS.map((ind) => (
                    <option key={ind} value={ind}><LocalizedText text={ind} /></option>
                  ))}
                </select>
              </Field>
            </FieldGrid>

            {/* Toggles */}
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
              <label style={toggleRow}>
                <input type="checkbox" checked={icuAdmission} onChange={(e) => setIcuAdmission(e.target.checked)} />
                <span style={{ fontSize: 12 }}><LocalizedText text={"ICU Admission"} /></span>
              </label>
              <label style={toggleRow}>
                <input type="checkbox" checked={bedbound} onChange={(e) => setBedbound(e.target.checked)} />
                <span style={{ fontSize: 12 }}><LocalizedText text={"Bedbound"} /></span>
              </label>
              <label style={toggleRow}>
                <input type="checkbox" checked={rrt} onChange={(e) => setRrt(e.target.checked)} />
                <span style={{ fontSize: 12 }}>RRT</span>
              </label>
            </div>

            {/* Computed fields */}
            <div style={{ fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}><LocalizedText text={"Calculated Fields"} /></div>
            <FieldGrid cols={5}>
              <Field label="BMI (kg/m2)">
                <input readOnly value={computed.bmi ? computed.bmi.toFixed(1) : "---"} style={readOnlyStyle} />
              </Field>
              <Field label="FFM (kg)">
                <input readOnly value={computed.ffm ? computed.ffm.toFixed(1) : "---"} style={readOnlyStyle} />
              </Field>
              <Field label="IBW (kg)">
                <input readOnly value={computed.ibw ? computed.ibw.toFixed(1) : "---"} style={readOnlyStyle} />
              </Field>
              <Field label="AdjBW (kg)">
                <input readOnly value={computed.adjbw ? computed.adjbw.toFixed(1) : "---"} style={readOnlyStyle} />
              </Field>
              <Field label="CrCl (mL/min)">
                <input readOnly value={computed.crcl ? computed.crcl.toFixed(1) : "---"} style={readOnlyStyle} />
              </Field>
            </FieldGrid>
          </div>

          {/* ---- Section 2: Dosing History ---- */}
          <div style={card}>
            <h2 style={sectionTitle}><LocalizedText text={"Dosing History"} /></h2>
            {doses.map((dose, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8, flexWrap: "wrap" }}>
                <Field label="Dose (mg)">
                  <NumericTextInput  min={0} value={dose.dose_mg} onValueChange={(canonical) => updateDose(i, "dose_mg", canonical)} style={{ ...inputStyle, width: 100 }} />
                </Field>
                <Field label="Infusion (min)">
                  <NumericTextInput  min={1} value={dose.infusion_duration_min} onValueChange={(canonical) => updateDose(i, "infusion_duration_min", canonical)} style={{ ...inputStyle, width: 90 }} />
                </Field>
                <Field label="Time from 1st Dose (h)">
                  <NumericTextInput  min={0} step="0.1" value={dose.time_hours} onValueChange={(canonical) => updateDose(i, "time_hours", canonical)} style={{ ...inputStyle, width: 120 }} />
                </Field>
                <Field label="Rate (mg/h)">
                  <input
                    readOnly
                    value={
                      numeric(dose.dose_mg) && numeric(dose.infusion_duration_min)
                        ? (numeric(dose.dose_mg) / (numeric(dose.infusion_duration_min) / 60)).toFixed(0)
                        : "---"
                    }
                    style={{ ...readOnlyStyle, width: 80 }}
                  />
                </Field>
                <label style={{ ...toggleRow, marginBottom: 0, paddingBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={dose.is_loading_dose}
                    onChange={(e) => updateDose(i, "is_loading_dose", e.target.checked)}
                  />
                  <span style={{ fontSize: 11 }}>LD</span>
                </label>
                {doses.length > 1 && (
                  <button style={{ ...removeBtn, marginBottom: 8 }} onClick={() => removeDose(i)}><LocalizedText text={"Remove"} /></button>
                )}
              </div>
            ))}
            <button style={addBtn} onClick={addDose}><LocalizedText text={"+ Add Dose"} /></button>
          </div>

          {/* ---- Section 3: Observed Levels ---- */}
          <div style={card}>
            <h2 style={sectionTitle}><LocalizedText text={"Observed Levels"} /></h2>
            {levels.map((lvl, i) => {
              const flags = levelFlags[i];
              return (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8, flexWrap: "wrap" }}>
                  <Field label="Concentration (mcg/mL)">
                    <NumericTextInput  min={0} step="0.1" value={lvl.concentration_mcg_ml} onValueChange={(canonical) => updateLevel(i, "concentration_mcg_ml", canonical)} style={{ ...inputStyle, width: 140 }} />
                  </Field>
                  <Field label="Time from 1st Dose (h)">
                    <NumericTextInput  min={0} step="0.1" value={lvl.time_hours} onValueChange={(canonical) => updateLevel(i, "time_hours", canonical)} style={{ ...inputStyle, width: 140 }} />
                  </Field>
                  {flags?.during_infusion && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: RED, paddingBottom: 10 }}><LocalizedText text={"DURING INFUSION"} /></span>
                  )}
                  {flags?.in_distribution && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: AMBER, paddingBottom: 10 }}><LocalizedText text={"DISTRIBUTION PHASE"} /></span>
                  )}
                  {levels.length > 1 && (
                    <button style={{ ...removeBtn, marginBottom: 8 }} onClick={() => removeLevel(i)}><LocalizedText text={"Remove"} /></button>
                  )}
                </div>
              );
            })}
            <button style={addBtn} onClick={addLevel}><LocalizedText text={"+ Add Level"} /></button>
          </div>

          {/* ---- Section 4: SCr Trajectory ---- */}
          <div style={card}>
            <h2 style={sectionTitle}><LocalizedText text={"SCr Trajectory"} /></h2>
            {scrPoints.length === 0 && (
              <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}><LocalizedText text={"No additional SCr values added."} /></div>
            )}
            {scrPoints.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8 }}>
                <Field label="SCr (mg/dL)">
                  <NumericTextInput  min={0} step="0.01" value={s.scr_mg_dl} onValueChange={(canonical) => updateScr(i, "scr_mg_dl", canonical)} style={{ ...inputStyle, width: 120 }} />
                </Field>
                <Field label="Time from 1st Dose (h)">
                  <NumericTextInput  min={0} step="0.1" value={s.time_hours} onValueChange={(canonical) => updateScr(i, "time_hours", canonical)} style={{ ...inputStyle, width: 140 }} />
                </Field>
                <button style={{ ...removeBtn, marginBottom: 8 }} onClick={() => removeScr(i)}><LocalizedText text={"Remove"} /></button>
              </div>
            ))}
            <button style={addBtn} onClick={addScr}><LocalizedText text={"+ Add SCr"} /></button>
          </div>

          {/* ---- Section 5: Concomitant Nephrotoxins ---- */}
          <div style={card}>
            <h2 style={sectionTitle}><LocalizedText text={"Concomitant Nephrotoxins"} /></h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginBottom: 12 }}>
              {NEPHROTOXINS.map((drug) => (
                <label key={drug} style={{ ...toggleRow, marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={!!selectedNephrotoxins[drug]}
                    onChange={(e) =>
                      setSelectedNephrotoxins({ ...selectedNephrotoxins, [drug]: e.target.checked })
                    }
                  />
                  <span style={{ fontSize: 12 }}><LocalizedText text={drug} /></span>
                </label>
              ))}
            </div>
            <label style={toggleRow}>
              <input type="checkbox" checked={vasopressorUse} onChange={(e) => setVasopressorUse(e.target.checked)} />
              <span style={{ fontSize: 12, fontWeight: 600 }}><LocalizedText text={"Vasopressor Use"} /></span>
            </label>
          </div>

          {/* ---- Section 6: Clinical Outcomes (optional) ---- */}
          <div style={card}>
            <h2 style={sectionTitle}><LocalizedText text={"Clinical Outcomes (optional)"} /></h2>
            <FieldGrid>
              <Field label="Hospital LOS (days)">
                <NumericTextInput  min={0} value={hospitalLos} onValueChange={(canonical) => setHospitalLos(canonical)} style={inputStyle} />
              </Field>
              <Field label="Microbiological Outcome">
                <select value={microOutcome} onChange={(e) => setMicroOutcome(e.target.value)} style={selectStyle}>
                  <option value=""><LocalizedText text={"-- Select --"} /></option>
                  <option value="Eradicated"><LocalizedText text={"Eradicated"} /></option>
                  <option value="Persistent"><LocalizedText text={"Persistent"} /></option>
                  <option value="Unknown"><LocalizedText text={"Unknown"} /></option>
                </select>
              </Field>
              <div />
            </FieldGrid>
            <label style={toggleRow}>
              <input type="checkbox" checked={vancDiscontinued} onChange={(e) => setVancDiscontinued(e.target.checked)} />
              <span style={{ fontSize: 12 }}><LocalizedText text={"Vancomycin Discontinued Early"} /></span>
            </label>
            {vancDiscontinued && (
              <Field label="Discontinuation Reason">
                <input type="text" value={discontinuationReason} onChange={(e) => setDiscontinuationReason(e.target.value)} style={inputStyle} />
              </Field>
            )}
          </div>

          {/* ---- Submit ---- */}
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button style={{ ...submitBtn, opacity: submitting ? 0.6 : 1 }} disabled={submitting} onClick={handleSubmit}>
              <LocalizedText text={submitting ? "Submitting..." : "Submit Research Record"} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
