"use client";

import { useEffect, useCallback } from "react";

interface DisclaimerModalProps {
  open: boolean;
  onClose: () => void;
}

const FONT: React.CSSProperties = { fontFamily: "'Share Tech Mono', monospace" };

const SECTIONS = [
  {
    heading: "INTENDED USE",
    body: `D\u014Dsys\u2122 provides Vancomyzer\u2122 \u2014 a Vancomycin Dosage Calculator using Bayesian modeling and pharmacokinetics \u2014 to support the care of patients with bacterial infections. This tool is provided to licensed healthcare professionals free of charge.

D\u014Dsys\u2122 makes no representations or warranties regarding the accuracy, quality, completeness, timeliness, appropriateness, or suitability of this tool. D\u014Dsys\u2122 assumes no obligation to update the tool or advise on further developments concerning vancomycin dosage. Medical information changes rapidly. YOU AS THE USER (\u201CUSER\u201D) ACKNOWLEDGE THAT THE TOOL IS PROVIDED ON AN \u201CAS IS\u201D BASIS AND THAT ANY USE OF OR RELIANCE ON THE TOOL SHALL BE AT YOUR SOLE RISK.`,
  },
  {
    heading: "NOT MEDICAL ADVICE",
    body: `The tool is for informational purposes only and intended for use only by licensed healthcare professionals. THE TOOL IS NOT INTENDED TO BE A SUBSTITUTE FOR PROFESSIONAL MEDICAL ADVICE, DOSING, DIAGNOSIS OR TREATMENT. D\u014Dsys\u2122 does not guarantee the accuracy or benefits of using this tool. Healthcare professionals who use this tool must exercise their own independent clinical judgment as to vancomycin dosage. Non-health professionals should always seek the immediate advice of their physician or qualified healthcare provider.`,
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
          background: "#000",
          border: "1px solid var(--color-primary)",
          maxWidth: 600,
          width: "90vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
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
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "var(--color-primary)",
              ...FONT,
            }}
          >
            VANCOMYZER{"\u2122"} LEGAL DISCLAIMER
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--color-border)",
              color: "var(--color-secondary)",
              padding: "4px 12px",
              fontSize: 11,
              cursor: "pointer",
              ...FONT,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary-a40)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
            }}
          >
            [ CLOSE ]
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", padding: "20px", flex: 1 }}>
          {SECTIONS.map((section) => (
            <div key={section.heading} style={{ marginBottom: 24 }}>
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "var(--color-primary)",
                  marginBottom: 8,
                  ...FONT,
                }}
              >
                {section.heading}
              </h3>
              <p
                style={{
                  fontSize: 11,
                  lineHeight: 1.7,
                  color: "var(--color-secondary)",
                  margin: 0,
                  whiteSpace: "pre-line",
                  ...FONT,
                }}
              >
                {section.body}
              </p>
            </div>
          ))}

          <p
            style={{
              fontSize: 11,
              color: "var(--color-dim)",
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
