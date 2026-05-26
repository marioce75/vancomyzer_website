"use client";

import { Fragment, useEffect, useCallback } from "react";

interface DisclaimerModalProps {
  open: boolean;
  onClose: () => void;
}

const FONT: React.CSSProperties = { fontFamily: "'Share Tech Mono', monospace" };

/**
 * Replace each occurrence of "Dōsys™" / "DŌSYS™" inside a legal body
 * paragraph with a clickable link to dosys.health. Match-preserving — the
 * exact original text (including ™ and any case) is rendered inside the
 * anchor so the legal copy reads identically.
 */
function linkifyDosys(text: string): React.ReactNode {
  // Cover both casings of the brand mark used in the legal copy:
  //   "Dōsys™" (mixed case) and "DŌSYS™" (all caps in the liability section).
  const re = /(D[Ōō](?:SYS|sys)™)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <a
        key={`d-${m.index}`}
        href="https://dosys.health"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "inherit", textDecoration: "underline" }}
      >
        {m[0]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}

const SECTIONS = [
  {
    heading: "INTENDED USE",
    body: `D\u014Dsys\u2122 provides Vancomyzer\u2122 \u2014 a Vancomycin Dosage Calculator using Bayesian modeling and pharmacokinetics \u2014 to support the care of patients with bacterial infections. Vancomyzer is offered to licensed healthcare professionals across multiple tiers: a free tier with the full Bayesian engine for individual clinicians, and paid Individual Pro and Hospital tiers that add features such as clinical-note export, calculation history, EMR integration, audit logging, and Business Associate Agreements. The pharmacokinetic models, equations, and clinical safety guardrails are identical across all tiers.

D\u014Dsys\u2122 makes no representations or warranties regarding the accuracy, quality, completeness, timeliness, appropriateness, or suitability of this tool. D\u014Dsys\u2122 assumes no obligation to update the tool or advise on further developments concerning vancomycin dosage. Medical information changes rapidly. YOU AS THE USER (\u201CUSER\u201D) ACKNOWLEDGE THAT THE TOOL IS PROVIDED ON AN \u201CAS IS\u201D BASIS AND THAT ANY USE OF OR RELIANCE ON THE TOOL SHALL BE AT YOUR SOLE RISK.`,
  },
  {
    heading: "NOT MEDICAL ADVICE",
    body: `Vancomyzer\u2122 is intended to support, not replace, clinical judgment. Every recommendation produced by the tool must be independently evaluated by a qualified clinician against the patient\u2019s clinical status, institutional protocols, product labeling, and current therapeutic drug monitoring before any change to therapy is initiated. Healthcare professionals who use this tool retain full responsibility for the clinical decisions they make. This tool is not designed for, and should not be used by, patients, caregivers, or other non-clinical users \u2014 they should consult their physician or pharmacist for medication guidance.`,
  },
  {
    heading: "REGULATORY STATUS",
    body: `Vancomyzer\u2122 has not been cleared or approved by the U.S. Food and Drug Administration as a medical device. It is provided as non-device clinical decision support software under Section 520(o)(1)(E) of the Federal Food, Drug and Cosmetic Act as amended by the 21st Century Cures Act.`,
  },
  {
    heading: "SCOPE",
    body: `This tool is scoped to adult intermittent intravenous vancomycin only. It is not validated for pediatric use, continuous infusion, renal replacement therapy, or conditions outside the stated assumptions.`,
  },
  {
    heading: "COPYRIGHT LICENSE",
    body: `D\u014Dsys\u2122 owns all copyright in the tool including its text, graphics, images, and other material. Your use of the tool does not transfer any ownership rights to you. Users are granted a limited non-exclusive, non-transferable licence to use, display, or print the tool for lawful non-commercial clinical use only, provided the tool is not modified and all copyright notices are retained.`,
  },
  {
    heading: "LIMITATION OF LIABILITY",
    body: `IN NO EVENT SHALL D\u014CSYS\u2122, ITS DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO ANY USER OR THIRD PARTY FOR ANY DAMAGES ARISING OUT OF THE USE OF THIS TOOL INCLUDING WITHOUT LIMITATION CONSEQUENTIAL, INCIDENTAL, INDIRECT, SPECIAL, OR PUNITIVE DAMAGES.`,
  },
  {
    heading: "INDEMNIFICATION",
    body: `As a condition of using this tool, you release D\u014Dsys\u2122 and its directors, employees, and agents from any liability in connection with your use of the tool and you agree to defend and indemnify D\u014Dsys\u2122 from any and all claims and damages arising from: (a) your use of the tool; (b) your violation of these terms; or (c) any clinical decision made in reliance on tool outputs.`,
  },
  {
    heading: "PHARMACOKINETIC MODEL",
    body: `All calculations use the Colin 2019 two-compartment population pharmacokinetic model. Colin PJ et al. Clin Pharmacokinet. 2019;58(6):767-780. DOI: 10.1007/s40262-018-0727-5. Mathematical equations are in the public domain and used with attribution.`,
  },
];

export default function DisclaimerModal({ open, onClose }: DisclaimerModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.85)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          maxWidth: 600,
          width: "90vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
          ...FONT,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "#00d4aa",
              ...FONT,
            }}
          >
            VANCOMYZER{"\u2122"} LEGAL DISCLAIMER
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#1e4d8c",
              border: "none",
              color: "#ffffff",
              padding: "6px 16px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              borderRadius: 4,
              ...FONT,
            }}
          >
            [ CLOSE ]
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", padding: "20px", flex: 1, background: "#ffffff" }}>
          {SECTIONS.map((section) => (
            <div key={section.heading} style={{ marginBottom: 24 }}>
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "#00d4aa",
                  marginBottom: 8,
                  ...FONT,
                }}
              >
                {section.heading}
              </h3>
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: "#1a1a1a",
                  margin: 0,
                  whiteSpace: "pre-line",
                  ...FONT,
                }}
              >
                {linkifyDosys(section.body)}
              </p>
            </div>
          ))}

          <p
            style={{
              fontSize: 11,
              color: "#718096",
              textAlign: "center",
              marginTop: 16,
              ...FONT,
            }}
          >
            {"\u00A9"} 2026 D{"\u014D"}sys{"\u2122"}. All Rights Reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
