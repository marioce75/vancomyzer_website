"use client";

import { useState } from "react";

/* ── FAQ Data ──────────────────────────────────────────────────── */

interface FaqRef {
  label: string;
  url: string;
}

interface FaqItem {
  question: string;
  answer: string[];        // paragraphs
  refs: FaqRef[];
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Why doesn\u2019t Vancomyzer use Cockcroft-Gault?",
    answer: [
      "Cockcroft-Gault estimates kidney function from age, weight, and creatinine \u2014 then feeds that estimate into a separate vancomycin equation. It introduces two layers of estimation before you even get a PK prediction. Vancomyzer skips that entirely by using serum creatinine directly as a covariate in the Colin 2019 model.",
    ],
    refs: [
      {
        label: "Cockcroft DW, Gault MH. Prediction of creatinine clearance from serum creatinine. Nephron. 1976;16(1):31-41.",
        url: "https://pubmed.ncbi.nlm.nih.gov/1244564/",
      },
    ],
  },
  {
    question: "Why is Cockcroft-Gault considered outdated for vancomycin dosing?",
    answer: [
      "It was developed in 1976 on 249 mostly male patients to estimate creatinine clearance \u2014 not to predict vancomycin pharmacokinetics. It systematically underperforms in elderly patients, low muscle mass, obesity, and critical illness. For a precision dosing tool, building on a 50-year-old renal estimate adds unnecessary error at the foundation.",
    ],
    refs: [
      {
        label: "Rybak MJ et al. Therapeutic monitoring of vancomycin for serious MRSA infections. ASHP/IDSA/SIDP 2020 Revised Consensus Guidelines.",
        url: "https://pubmed.ncbi.nlm.nih.gov/32191793/",
      },
    ],
  },
  {
    question: "How serum creatinine is measured matters \u2014 and it has changed",
    answer: [
      "Creatinine has been measured two ways in clinical labs:",
      "The old way \u2014 Jaffe method (picric acid reaction, since 1886): A colorimetric reaction that measures creatinine but is non-specific. Glucose, bilirubin, acetoacetate, and certain drugs like cephalosporins all interfere and falsely elevate the result. At low creatinine concentrations \u2014 below 1.0 mg/dL \u2014 the Jaffe method reads approximately 7% higher than the enzymatic method, exceeding the acceptable bias threshold. This matters most in elderly, cachectic, and low-muscle-mass patients \u2014 exactly the populations most likely to receive vancomycin.",
      "The current standard \u2014 Enzymatic method (IDMS-traceable): Modern labs use an enzymatic assay traceable to isotope dilution mass spectrometry (IDMS), the international gold standard. The enzymatic method is more specific \u2014 glucose, acetoacetate, and cephalosporins do not interfere \u2014 giving it better accuracy especially at lower creatinine concentrations.",
      "Why this gap matters for dosing: Cockcroft-Gault was derived using Jaffe-measured creatinine. When you plug an enzymatic creatinine value into it \u2014 which is what modern labs report \u2014 you are using a number the equation was never calibrated for. Converting enzymatic SCr values back into Jaffe-equivalent values has been shown to significantly improve the performance of the Cockcroft-Gault equation for predicting vancomycin concentrations. That conversion step is rarely done at the bedside, creating a systematic mismatch baked silently into every Cockcroft-Gault-based vancomycin calculation in a modern hospital.",
    ],
    refs: [
      { label: "Jaffe assay vs enzymatic bias", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6816857/" },
      { label: "Clinical risk of Jaffe vs enzymatic misclassification", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4657986/" },
      { label: "Impact on vancomycin dosing", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4432143/" },
    ],
  },
  {
    question: "What about muscle mass?",
    answer: [
      "Serum creatinine is a byproduct of muscle metabolism \u2014 so it reflects muscle mass as much as kidney function. A frail 80-year-old with a creatinine of 0.8 mg/dL may have severely reduced kidney function masked by low muscle mass. Cockcroft-Gault partially adjusts for this using age and a sex factor, but it was not built for patients with sarcopenia, critical illness, or extreme body compositions.",
      "Colin 2019 uses serum creatinine directly as a continuous covariate within a Bayesian framework \u2014 not to estimate CrCl, but to inform the model\u2019s prediction of individual PK parameters. Combined with age and weight, the model accounts for muscle mass effects implicitly through the posterior update when a measured vancomycin level is entered. A bedbound geriatric patient\u2019s low creatinine and low weight together shift the posterior estimate in a way Cockcroft-Gault cannot replicate.",
    ],
    refs: [
      {
        label: "Colin PJ et al. Vancomycin Pharmacokinetics Throughout Life. Clin Pharmacokinet. 2019;58(6):767-780.",
        url: "https://doi.org/10.1007/s40262-018-0727-5",
      },
    ],
  },
  {
    question: "What does Colin 2019 use instead of Cockcroft-Gault?",
    answer: [
      "Colin 2019 uses age, weight, and serum creatinine directly as covariates in a two-compartment Bayesian model \u2014 no intermediate CrCl calculation. It was built from pooled data across 14 studies and multiple patient populations from neonates to elderly, making it one of the most broadly validated vancomycin PK models published. The model includes a specific age-decline function (FDecline) that captures the natural reduction in vancomycin clearance after peak adulthood \u2014 something Cockcroft-Gault approximates crudely through age alone.",
    ],
    refs: [
      {
        label: "Colin PJ et al. Clin Pharmacokinet. 2019.",
        url: "https://doi.org/10.1007/s40262-018-0727-5",
      },
    ],
  },
  {
    question: "How accurate is Colin 2019 compared to older methods?",
    answer: [
      "Independent evaluations consistently rank it among the top performers:",
      "\u2022 Outperformed 6 of 7 literature models in a McGill University Health Centre validation\n\u2022 Second best in a Belgian multicenter study of 169 patients and 923 TDM samples\n\u2022 Identified as one of two best-transferable models in a head-to-head comparison of 7 vancomycin PopPK models\n\u2022 Validated across ICU, general ward, and outpatient settings in multiple countries\n\u2022 Performs comparably or better than obesity-specific models even in obese patients, without requiring a separate model",
    ],
    refs: [
      { label: "Belgian multicenter validation", url: "https://pubmed.ncbi.nlm.nih.gov/35341931/" },
      { label: "McGill head-to-head comparison", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9010252/" },
      { label: "Obesity validation", url: "https://pubmed.ncbi.nlm.nih.gov/33278242/" },
      { label: "Discrepancies between Bayesian models in ICU", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9767744/" },
    ],
  },
  {
    question: "Does Vancomyzer calculate CrCl anywhere?",
    answer: [
      "No. CrCl is not calculated, displayed, or used internally anywhere in Vancomyzer. The Colin 2019 model takes age, weight, and SCr directly. This removes one source of estimation error and keeps the input set minimal and fast at bedside.",
    ],
    refs: [
      {
        label: "Colin PJ et al. Clin Pharmacokinet. 2019.",
        url: "https://doi.org/10.1007/s40262-018-0727-5",
      },
    ],
  },
];

/* ── Accordion Item ────────────────────────────────────────────── */

function AccordionItem({ item, index }: { item: FaqItem; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        borderLeft: open ? "2px solid var(--color-primary)" : "2px solid transparent",
        background: open ? "var(--color-card)" : "transparent",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: "16px 20px",
          cursor: "pointer",
          background: "transparent",
          border: "none",
          fontFamily: "'Share Tech Mono', monospace",
        }}
      >
        <span
          style={{
            color: "var(--color-primary)",
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "'Share Tech Mono', monospace",
            lineHeight: 1.5,
          }}
        >
          {">"} Q{index + 1}: {item.question}
        </span>
        <span
          style={{
            color: "var(--color-dim)",
            fontSize: 16,
            flexShrink: 0,
            transition: "transform 0.2s",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          {"\u25B6"}
        </span>
      </button>

      <div
        style={{
          maxHeight: open ? 2000 : 0,
          overflow: "hidden",
          transition: "max-height 0.35s ease",
        }}
      >
        <div style={{ padding: "0 20px 20px 20px" }}>
          {item.answer.map((paragraph, i) => (
            <p
              key={i}
              style={{
                color: "var(--color-secondary)",
                fontSize: 13,
                lineHeight: 1.7,
                fontFamily: "'Share Tech Mono', monospace",
                marginTop: i === 0 ? 0 : 12,
                whiteSpace: "pre-line",
              }}
            >
              {paragraph}
            </p>
          ))}

          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
            {item.refs.map((ref, i) => (
              <a
                key={i}
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 11,
                  color: "#007722",
                  fontFamily: "'Share Tech Mono', monospace",
                  textDecoration: "none",
                  letterSpacing: "0.02em",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "var(--color-primary)";
                  (e.currentTarget as HTMLElement).style.textDecoration = "underline";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#007722";
                  (e.currentTarget as HTMLElement).style.textDecoration = "none";
                }}
              >
                [REF{item.refs.length > 1 ? ` ${i + 1}` : ""}] {ref.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function FAQPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
        padding: "48px 16px 80px",
      }}
    >
      <div style={{ maxWidth: 840, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "var(--color-primary)",
              fontFamily: "'Share Tech Mono', monospace",
              textShadow: "0 0 10px var(--color-glow)",
            }}
          >
            {">"} FAQ — METHODOLOGY & DESIGN DECISIONS
          </h1>
          <p
            style={{
              marginTop: 8,
              fontSize: 13,
              color: "var(--color-dim)",
              fontFamily: "'Share Tech Mono', monospace",
            }}
          >
            {">"} Why Vancomyzer is built the way it is
          </p>
        </div>

        {/* Accordion list */}
        <div
          style={{
            border: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {FAQ_ITEMS.map((item, index) => (
            <div
              key={index}
              style={{
                borderTop: index === 0 ? "none" : "1px solid var(--color-border)",
              }}
            >
              <AccordionItem item={item} index={index} />
            </div>
          ))}
        </div>

        {/* Footer nav */}
        <div
          style={{
            marginTop: 40,
            paddingTop: 24,
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            gap: 20,
          }}
        >
          <a
            href="/calculator"
            style={{
              fontSize: 12,
              color: "var(--color-secondary)",
              fontFamily: "'Share Tech Mono', monospace",
              textDecoration: "none",
              border: "1px solid var(--color-border)",
              padding: "8px 16px",
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
            [ OPEN CALCULATOR ]
          </a>
          <a
            href="/trust-evidence"
            style={{
              fontSize: 12,
              color: "var(--color-secondary)",
              fontFamily: "'Share Tech Mono', monospace",
              textDecoration: "none",
              border: "1px solid var(--color-border)",
              padding: "8px 16px",
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
            [ TRUST & EVIDENCE ]
          </a>
        </div>
      </div>
    </div>
  );
}
