"use client";

import { Fragment, useEffect, useCallback } from "react";
import { COLIN_2019 } from "@/lib/pk/modelRegistry";

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
export function linkifyDosys(text: string): React.ReactNode {
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

/** Copyright line shown beneath the disclaimer text. */
export const DISCLAIMER_COPYRIGHT = "© 2026 Dōsys™. All Rights Reserved.";

/** One heading + body block of the legal disclaimer. */
export interface DisclaimerSection {
  heading: string;
  body: string;
}

/**
 * The full legal disclaimer — single source of truth. Rendered by this
 * informational modal and by the blocking DisclaimerGate shown before the
 * calculator. If any wording here changes, bump DISCLAIMER_VERSION in
 * src/lib/disclaimer.ts so every visitor accepts the new terms.
 */
export const SECTIONS: readonly DisclaimerSection[] = [
  {
    heading: "INTENDED USE",
    body: `D\u014Dsys\u2122 provides Vancomyzer\u2122, a vancomycin dosing calculator, for review by licensed healthcare professionals. It is not for use in patient care decisions without independent clinical review. The core calculator is free permanently. Paid plans (Individual Pro and Hospital Site) add account features such as calculation history and email support; during the launch period, PDF export, clinical-note copy and result interpretation are free for everyone. The pharmacokinetic model, equations, and clinical safety checks are identical across all plans.

D\u014Dsys\u2122 makes no representations or warranties regarding the accuracy, quality, completeness, timeliness, appropriateness, or suitability of this tool. D\u014Dsys\u2122 assumes no obligation to update the tool or advise on further developments concerning vancomycin dosage. Medical information changes rapidly. YOU AS THE USER (\u201CUSER\u201D) ACKNOWLEDGE THAT THE TOOL IS PROVIDED ON AN \u201CAS IS\u201D BASIS AND THAT ANY USE OF OR RELIANCE ON THE TOOL SHALL BE AT YOUR SOLE RISK.`,
  },
  {
    heading: "NOT MEDICAL ADVICE",
    body: `Vancomyzer\u2122 is intended to support, not replace, clinical judgment. Every recommendation produced by the tool must be independently evaluated by a qualified clinician against the patient\u2019s clinical status, institutional protocols, product labeling, and current therapeutic drug monitoring before any change to therapy is initiated. Healthcare professionals who use this tool retain full responsibility for the clinical decisions they make. This tool is not designed for, and should not be used by, patients, caregivers, or other non-clinical users \u2014 they should consult their physician or pharmacist for medication guidance.`,
  },
  {
    heading: "REGULATORY STATUS",
    body: `Vancomyzer\u2122 is designed to meet the criteria for non-device clinical decision support in section 520(o)(1)(E) of the Federal Food, Drug, and Cosmetic Act (added by section 3060 of the 21st Century Cures Act). It has not been cleared, approved or otherwise reviewed by the FDA. It is intended for licensed healthcare professionals, who must independently review the basis for each recommendation.`,
  },
  {
    heading: "SCOPE",
    body: `This tool is scoped to adult intermittent intravenous vancomycin only. It is not designed for pediatric patients, continuous infusion, renal replacement therapy, or conditions outside the stated assumptions. Vancomyzer has not yet been validated in real patients. Its equations are checked against published values and synthetic test cases; external validation with patient data is planned.`,
  },
  {
    heading: "COPYRIGHT LICENSE",
    body: `D\u014Dsys\u2122 owns all copyright in the tool including its text, graphics, images, and other material. Your use of the tool does not transfer any ownership rights to you. Users are granted a limited, non-exclusive, non-transferable, non-sublicensable licence to use, display, or print the tool for lawful professional clinical, educational, and quality-improvement purposes, individually or under an institutional subscription, provided the tool is not modified, is not resold or operated as a service bureau, and all copyright notices are retained.`,
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
    body: `All dosing calculations use the ${COLIN_2019.displayName}, for every adult at every body size. ${COLIN_2019.citation} DOI: ${COLIN_2019.doi}. Fat-free mass and alternative creatinine-clearance estimates are shown for information only and do not change the calculation. Published equations are used with attribution.`,
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
              color: "#1f5e96",
              ...FONT,
            }}
          >
            VANCOMYZER{"\u2122"} LEGAL DISCLAIMER
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#1f5e96",
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
                  color: "#1f5e96",
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
              color: "#546471",
              textAlign: "center",
              marginTop: 16,
              ...FONT,
            }}
          >
            {DISCLAIMER_COPYRIGHT}
          </p>
        </div>
      </div>
    </div>
  );
}
