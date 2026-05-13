"use client";

import { useState } from "react";

/* ── FAQ Data ──────────────────────────────────────────────────── */

interface FaqRef {
  label: string;
  url: string;
}

interface FaqItem {
  question: string;
  answer: (string | { formula: string })[];  // paragraphs or indented formula blocks
  refs: FaqRef[];
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Where does Vancomyzer\u2019s pharmacokinetic data come from?",
    answer: [
      "Vancomyzer\u2019s default adult prior is the Colin 2019 two-compartment population PK model, which itself is a pooled analysis of 14 published vancomycin studies covering patients from neonates through the elderly. Covariates: postmenstrual age, weight, and serum creatinine. The full source-study table is in Table 1 of the paper (open-access, CC BY-NC).",
      "For patients with BMI \u2265 40, Vancomyzer switches to an obesity model derived from Smit 2020 (morbid-obesity vancomycin PK) and Zhang 2024 (external validation), with Fat-Free Mass calculated from the Janmahasatian 2005 equations.",
      "All four references are linked below \u2014 nothing in the calculator is built on undisclosed or proprietary data.",
    ],
    refs: [
      { label: "Colin PJ et al. Vancomycin Pharmacokinetics Throughout Life \u2014 Pooled Population Analysis (14 studies). Clin Pharmacokinet. 2019;58(6):767-780.", url: "https://doi.org/10.1007/s40262-018-0727-5" },
      { label: "Smit C et al. Vancomycin PK in morbid obesity. Br J Clin Pharmacol. 2020;86(2):303-317.", url: "https://doi.org/10.1111/bcp.14144" },
      { label: "Zhang T et al. External validation of the obesity vancomycin model. Clin Pharmacokinet. 2024;63:79-91.", url: "https://doi.org/10.1007/s40262-023-01324-5" },
      { label: "Janmahasatian S et al. Quantification of lean bodyweight (FFM equations). Clin Pharmacokinet. 2005;44(10):1051-1065.", url: "https://doi.org/10.2165/00003088-200544100-00004" },
    ],
  },
  {
    question: "Why doesn\u2019t the Colin 2019 model use Cockcroft-Gault?",
    answer: [
      "Cockcroft-Gault estimates kidney function from age, weight, sex, and serum creatinine \u2014 then feeds that estimate into a separate vancomycin equation. It introduces two layers of estimation before you even get a PK prediction. For non-obese patients (BMI < 40), Vancomyzer uses the Colin 2019 model, which takes serum creatinine directly as a covariate \u2014 no intermediate CrCl calculation required.",
      "For patients with BMI \u2265 40, Vancomyzer activates a separate obesity model (Smit 2020 + Zhang 2023) that does use Cockcroft-Gault CrCl for clearance estimation. This is clinically appropriate because vancomycin clearance in obesity scales with total body weight via renal elimination, and CG with TBW is the established method in the obesity PK literature. The key difference: the obesity model uses CG intentionally for CL only, while volumes of distribution are scaled to Fat-Free Mass (FFM) \u2014 not total body weight.",
    ],
    refs: [
      {
        label: "Cockcroft DW, Gault MH. Prediction of creatinine clearance from serum creatinine. Nephron. 1976;16(1):31-41.",
        url: "https://pubmed.ncbi.nlm.nih.gov/1244564/",
      },
      {
        label: "Smit C et al. Vancomycin PK in morbid obesity. Br J Clin Pharmacol. 2020;86(2):303-317.",
        url: "https://doi.org/10.1111/bcp.14144",
      },
    ],
  },
  {
    question: "Why is Cockcroft-Gault considered outdated for vancomycin dosing?",
    answer: [
      "It was developed in 1976 on 249 male patients to estimate creatinine clearance \u2014 not to predict vancomycin pharmacokinetics. It systematically underperforms in elderly patients, low muscle mass, obesity, and critical illness. The National Kidney Foundation no longer recommends it for clinical use because it was not expressed using standardized creatinine values \u2014 the assay used in its derivation was likely 10\u201320% higher than current methods, meaning CG-based calculations lead to higher drug dosing recommendations than originally intended.",
    ],
    refs: [
      {
        label: "Rybak MJ et al. Therapeutic monitoring of vancomycin for serious MRSA infections. ASHP/IDSA/SIDP 2020 Revised Consensus Guidelines.",
        url: "https://pubmed.ncbi.nlm.nih.gov/32191793/",
      },
      {
        label: "National Kidney Foundation \u2014 Cockcroft-Gault Formula.",
        url: "https://www.kidney.org/professionals/gfr_calculatorCoc",
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
    question: "What about IBW \u2014 why does traditional dosing require it and why does Vancomyzer not?",
    answer: [
      "In traditional vancomycin dosing, determining the right dose requires answering a question that has no single correct answer: which body weight do you use?",
      "Three options exist in clinical practice, each requiring its own calculation:",
      "Total body weight (TBW): The patient\u2019s actual weight. Simple \u2014 but in obese patients, dosing on TBW can produce dangerously supratherapeutic levels. In one study of patients receiving TBW-based vancomycin dosing, 48% of patients with a BMI \u226535 were supratherapeutic on their first trough level.",
      "Ideal body weight (IBW) \u2014 Devine formula: The weight a patient \u201cshould\u201d be based on height and sex.",
      { formula: "Males:   50 kg + 2.3 kg per inch over 60 inches\nFemales: 45.5 kg + 2.3 kg per inch over 60 inches" },
      "This requires height \u2014 a variable Cockcroft-Gault does not even include \u2014 adding yet another manual calculation step. And IBW alone can underestimate dose requirements in obese patients.",
      "Adjusted body weight (AdjBW): IBW + 0.4 \u00d7 (TBW \u2212 IBW). Used when TBW exceeds IBW by more than 30%. Standard clinical dosing guidelines apply this formula when actual body weight is more than 30% above IBW.",
      "The problem: This weight selection step \u2014 TBW vs IBW vs AdjBW \u2014 is debated, inconsistently applied between institutions, requires height that may not be reliably documented, and adds a third manual calculation on top of the CG estimate already in progress. The 2020 ASHP/IDSA guidelines moved toward recommending TBW for empiric dosing precisely because the IBW debate had no clear resolution.",
      "How Vancomyzer handles body size: For non-obese patients (BMI < 40), the Colin 2019 model takes actual body weight directly as a covariate \u2014 no IBW, no AdjBW, no height required. The Bayesian model handles body size effects through its mathematical structure. When a measured level is entered, the posterior update further refines the individual PK estimate regardless of body composition.",
      "For patients with BMI \u2265 40, Vancomyzer activates an obesity-specific model that uses a more physiologically appropriate metric: Fat-Free Mass (FFM). FFM is calculated from height, weight, and sex using the Janmahasatian 2005 equations. Volumes of distribution are scaled to FFM because vancomycin is hydrophilic and distributes poorly into adipose tissue. This is more precise than IBW/AdjBW approximations \u2014 it uses a validated pharmacometric equation rather than a height-based rule of thumb.",
    ],
    refs: [
      { label: "IBW Devine formula: Devine BJ. Drug Intell Clin Pharm. 1974;8:650-655", url: "https://pubmed.ncbi.nlm.nih.gov/1244564/" },
      { label: "AdjBW and obesity dosing guidelines: UC Davis Adult IV Vancomycin Dosing Guidelines.", url: "https://health.ucdavis.edu/media-resources/antibiotic-stewardship/documents/pdfs/guidelines/vanc_dosing.pdf" },
      { label: "Supratherapeutic levels with TBW dosing in obesity", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3764551/" },
      { label: "Janmahasatian S et al. Quantification of lean bodyweight. Clin Pharmacokinet. 2005;44(10):1051-1065.", url: "https://doi.org/10.2165/00003088-200544100-00004" },
    ],
  },
  {
    question: "How accurate is Colin 2019 compared to older methods?",
    answer: [
      "Independent evaluations consistently rank it among the top performers:",
      "\u2022 Outperformed 6 of 7 literature models in a McGill University Health Centre validation\n\u2022 Second best in a Belgian multicenter study of 169 patients and 923 TDM samples\n\u2022 Identified as one of two best-transferable models in a head-to-head comparison of 7 vancomycin PopPK models\n\u2022 Validated across ICU, general ward, and outpatient settings in multiple countries\n\u2022 For patients with BMI \u2265 40, Vancomyzer supplements Colin 2019 with an FFM-based obesity model (Smit 2020 + Zhang 2023) that scales V\u2081 and V\u2082 to fat-free mass for more accurate volume estimation in morbid obesity",
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
      "For non-obese patients (BMI < 40): No. The Colin 2019 model takes age, weight, and SCr directly as covariates \u2014 no CrCl, no IBW, no AdjBW. This removes multiple sources of estimation error and keeps the input set minimal.",
      "For patients with BMI \u2265 40: Yes. The obesity model uses Cockcroft-Gault with total body weight to estimate CrCl for the clearance equation (CL = 0.0571 \u00d7 CrCl + 0.0158 \u00d7 TBW). This is standard practice in the obesity PK literature \u2014 renal elimination of vancomycin scales with total body weight, and CG-TBW is the established estimator in this population. The CrCl value is shown in the clinical advisory panel when the obesity model activates.",
      "Volumes of distribution in the obesity model are NOT based on CrCl or TBW \u2014 they use Fat-Free Mass (FFM) from the Janmahasatian 2005 equations, because vancomycin distributes into lean tissue, not adipose.",
    ],
    refs: [
      {
        label: "Colin PJ et al. Clin Pharmacokinet. 2019.",
        url: "https://doi.org/10.1007/s40262-018-0727-5",
      },
      {
        label: "Smit C et al. Br J Clin Pharmacol. 2020;86(2):303-317.",
        url: "https://doi.org/10.1111/bcp.14144",
      },
    ],
  },
  {
    question: "What is Fat-Free Mass (FFM) and why does the obesity model use it?",
    answer: [
      "Fat-Free Mass is the portion of body weight that is not adipose tissue \u2014 it includes muscle, bone, organs, and water. FFM is calculated using the Janmahasatian 2005 equations, which require weight, height, and sex:",
      { formula: "FFM (male)   = (9270 \u00d7 TBW) / (6680 + 216 \u00d7 BMI)\nFFM (female) = (9270 \u00d7 TBW) / (8780 + 244 \u00d7 BMI)" },
      "Vancomycin is a hydrophilic glycopeptide \u2014 it distributes into plasma and interstitial fluid but poorly penetrates adipose tissue. In patients with BMI \u2265 40, total body weight dramatically overestimates the volume available for drug distribution. Scaling V\u2081 and V\u2082 to FFM instead of TBW produces more accurate volume estimates and prevents overdosing.",
      "The Vancomyzer obesity model (derived from Smit 2020 and Zhang 2023) uses FFM for volumes of distribution while retaining TBW-based CrCl for clearance \u2014 reflecting the physiological reality that drug distribution is lean-tissue-limited but renal elimination scales with total body mass.",
    ],
    refs: [
      { label: "Janmahasatian S et al. Quantification of lean bodyweight. Clin Pharmacokinet. 2005;44(10):1051-1065.", url: "https://doi.org/10.2165/00003088-200544100-00004" },
      { label: "Smit C et al. Br J Clin Pharmacol. 2020;86(2):303-317.", url: "https://doi.org/10.1111/bcp.14144" },
      { label: "Zhang T et al. Clin Pharmacokinet. 2024;63:79-91.", url: "https://doi.org/10.1007/s40262-023-01324-5" },
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
        background: open ? "var(--color-card)" : "#f4f7fa",
        transition: "background 0.15s, border-color 0.2s",
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
          transition: "background 0.15s",
          fontFamily: "'Share Tech Mono', monospace",
        }}
        onMouseEnter={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "#dbeafe";
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = "transparent";
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
          {item.answer.map((block, i) => {
            if (typeof block === "object" && "formula" in block) {
              return (
                <pre
                  key={i}
                  style={{
                    color: "var(--color-primary)",
                    fontSize: 12,
                    lineHeight: 1.6,
                    fontFamily: "'Share Tech Mono', monospace",
                    marginTop: 8,
                    marginBottom: 4,
                    padding: "10px 14px",
                    borderLeft: "2px solid var(--color-border)",
                    background: "var(--color-highlight)",
                    whiteSpace: "pre-wrap",
                    overflowX: "auto",
                  }}
                >
                  {block.formula}
                </pre>
              );
            }
            return (
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
                {block}
              </p>
            );
          })}

          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
            {item.refs.map((ref, i) => (
              <a
                key={i}
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 11,
                  color: "var(--color-primary)",
                  textDecoration: "none",
                  letterSpacing: "0.02em",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.textDecoration = "underline";
                }}
                onMouseLeave={(e) => {
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
            background: "var(--color-card)",
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
              fontSize: 13,
              color: "var(--color-card, #ffffff)",
              textDecoration: "none",
              border: "1px solid var(--color-primary)",
              background: "var(--color-primary)",
              padding: "10px 20px",
              fontWeight: 600,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "0.85";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "1";
            }}
          >
            Open Calculator
          </a>
          <a
            href="/transparent-dosing"
            style={{
              fontSize: 13,
              color: "var(--color-secondary)",
              textDecoration: "none",
              border: "1px solid var(--color-border)",
              background: "var(--color-card, #ffffff)",
              padding: "10px 20px",
              fontWeight: 500,
              transition: "background 0.15s, border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--color-primary)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-card, #ffffff)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--color-card, #ffffff)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
              (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)";
            }}
          >
            References
          </a>
        </div>
      </div>
    </div>
  );
}
