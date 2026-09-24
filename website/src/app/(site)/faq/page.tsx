import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Record, INK, INK2 } from "@/components/site/Record";
import {
  COLIN_2019,
  COLIN_2021_OBESE_EVALUATION,
  HIGH_BMI_THRESHOLD_KG_M2,
} from "@/lib/pk/modelRegistry";

export const metadata: Metadata = {
  title: "FAQ — Vancomyzer™",
  description: "Why Vancomyzer uses the Colin 2019 model, how it treats serum creatinine and body weight, and what has and has not been validated.",
  alternates: { canonical: "https://vancomyzer.com/faq" },
};

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

/* ── Model registry helpers ─────────────────────────────────────
 * Model names, citations, equations and model status are read from
 * src/lib/pk/modelRegistry.ts so this page cannot drift from the engine. */

const COLIN = COLIN_2019;



function pubmedUrl(citation: string): string {
  const pmid = citation.match(/PMID:\s*(\d+)/)?.[1];
  return pmid
    ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
    : `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(citation)}`;
}

const doiUrl = (doi: string) => `https://doi.org/${doi}`;
const bullets = (items: readonly string[]) => items.map((item) => `• ${item}`).join("\n");

const BMI_40 = `BMI ≥ ${HIGH_BMI_THRESHOLD_KG_M2} kg/m²`;
const COLIN_2021_NOTE = `Colin 2021: ${COLIN_2021_OBESE_EVALUATION.summary}`;
const VALIDATION_STATUS =
  "Vancomyzer has not yet been validated in real patients. Its equations are checked against published values and synthetic test cases; external validation with patient data is planned.";

/* ── References ────────────────────────────────────────────────── */

const REF_COLIN_2019: FaqRef = { label: COLIN.citation, url: doiUrl(COLIN.doi) };
const REF_COLIN_2021: FaqRef = {
  label: COLIN_2021_OBESE_EVALUATION.citation,
  url: pubmedUrl(COLIN_2021_OBESE_EVALUATION.citation),
};
const REF_COCKCROFT_GAULT: FaqRef = {
  label: "Cockcroft DW, Gault MH. Prediction of creatinine clearance from serum creatinine. Nephron. 1976;16(1):31-41.",
  url: "https://pubmed.ncbi.nlm.nih.gov/1244564/",
};
const REF_NKF_CG: FaqRef = {
  label: "National Kidney Foundation. Cockcroft-Gault formula (professional resource, web page).",
  url: "https://www.kidney.org/professionals/gfr_calculatorCoc",
};
const REF_RYBAK_2020: FaqRef = {
  label: "Rybak MJ, et al. Therapeutic monitoring of vancomycin for serious MRSA infections: a revised consensus guideline (ASHP/IDSA/PIDS/SIDP). Am J Health Syst Pharm. 2020;77(11):835-864.",
  url: "https://pubmed.ncbi.nlm.nih.gov/32191793/",
};
const REF_JANMAHASATIAN_2005: FaqRef = {
  label: "Janmahasatian S, et al. Quantification of lean bodyweight. Clin Pharmacokinet. 2005;44(10):1051-1065.",
  url: "https://doi.org/10.2165/00003088-200544100-00004",
};
const REF_BUKHARI_2024: FaqRef = {
  label: "Bukhari R, et al. Comparing actual and rounded serum creatinine concentration for assessing the accuracy of vancomycin dosing in elderly patients. Healthcare (Basel). 2024;12(11):1144.",
  url: "https://doi.org/10.3390/healthcare12111144",
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Where does Vancomyzer’s pharmacokinetic data come from?",
    answer: [
      `Vancomyzer uses one population pharmacokinetic model for every adult: the ${COLIN.displayName}. Its inputs are age, total body weight and serum creatinine.`,
      `Source data: ${COLIN.sourcePopulation}`,
      `Scope in Vancomyzer: ${COLIN.vancomyzerScope}`,
      "Equations, parameter values and Vancomyzer’s own settings (such as the Bayesian prior widths) are published on the Equations & derivations page.",
    ],
    refs: [REF_COLIN_2019],
  },
  {
    question: "Why doesn’t Vancomyzer use Cockcroft-Gault to estimate vancomycin clearance?",
    answer: [
      `Because ${COLIN.shortName} was built with serum creatinine itself as the renal covariate. SCr enters clearance directly:`,
      { formula: COLIN.equations.FSCR },
      "SCRstd is an age-standardized reference creatinine. Substituting a Cockcroft-Gault CrCl would mean running a different model from the one that was published and evaluated.",
      "This is a property of the model, not evidence that one renal estimate is better for every patient. Cockcroft-Gault remains widely used for drug dosing, and all creatinine-based estimates share the same weakness when muscle mass is low (see “What about muscle mass?”).",
    ],
    refs: [REF_COLIN_2019, REF_COCKCROFT_GAULT],
  },
  {
    question: "What are the limitations of Cockcroft-Gault for vancomycin dosing?",
    answer: [
      "Cockcroft-Gault was published in 1976 to estimate creatinine clearance in adult men (derivation data from 249 patients). It was not developed to predict vancomycin pharmacokinetics.",
      "Like other creatinine-based estimates, it can mislead when muscle mass is low (older, sarcopenic or bedbound patients), when renal function is changing, and in critical illness. In obesity, the result depends heavily on which body weight is entered. It was also derived before creatinine assays were standardized (see the next question).",
      "For assessing chronic kidney disease, KDIGO and the National Kidney Foundation favor eGFR equations such as CKD-EPI. That guidance is about CKD assessment: Cockcroft-Gault remains widely used for drug dosing.",
    ],
    refs: [REF_COCKCROFT_GAULT, REF_NKF_CG],
  },
  {
    question: "How serum creatinine is measured matters — and it has changed",
    answer: [
      "Clinical laboratories measure creatinine with two main methods:",
      "Jaffe (alkaline picrate) method, first described in 1886: a colorimetric reaction that is less specific. Glucose, bilirubin, acetoacetate and some cephalosporins can interfere. In one single-analyser method comparison (Küme et al.; 230 serum samples), Jaffe results were higher than enzymatic results, especially at low creatinine concentrations.",
      "Enzymatic method: more specific, with fewer interferences, and it performed better at low creatinine concentrations in that comparison. Many laboratories now use enzymatic assays calibrated to isotope dilution mass spectrometry (IDMS) reference methods.",
      "How much the method matters varies. In an outpatient comparison (Schmidt 2015; 529 paired results), 5.5% of eGFR results fell on different sides of a clinical decision limit depending on the method, and the authors judged the risk from assay bias to be much smaller than the risk from biological variation.",
      `Why it matters for dosing: Cockcroft-Gault was derived before creatinine measurement was standardized, and renal-function equations are not interchangeable. In a population PK study of 78 elderly patients (Glatard 2015), vancomycin models built on different renal-function equations gave different parameter and AUC estimates, and using an equation other than the one a model was built with could significantly alter predictive performance. Vancomyzer uses the ${COLIN.shortName} serum-creatinine covariate as published rather than substituting another renal estimate.`,
    ],
    refs: [
      { label: "Küme T, et al. Evaluation and comparison of Abbott Jaffe and enzymatic creatinine methods: could the old method meet the new requirements? J Clin Lab Anal. 2018;32(1):e22168.", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6816857/" },
      { label: "Schmidt RL, et al. A risk assessment of the Jaffe vs enzymatic method for creatinine measurement in an outpatient population. PLoS One. 2015;10(11):e0143205.", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4657986/" },
      { label: "Glatard A, et al. Influence of renal function estimation on pharmacokinetic modeling of vancomycin in elderly patients. Antimicrob Agents Chemother. 2015;59(6):2986-2994.", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4432143/" },
    ],
  },
  {
    question: "What about muscle mass?",
    answer: [
      `Serum creatinine comes from muscle, so it reflects muscle mass as well as kidney function. In older, sarcopenic or bedbound patients, a low SCr can overstate renal function whichever equation is used: Cockcroft-Gault, CKD-EPI or the ${COLIN.shortName} SCr covariate. No creatinine-based equation corrects for this in an individual patient.`,
      `${COLIN.shortName} includes age (through an age-standardized reference creatinine and an age-decline factor on clearance), but that describes the average effect of age, not an individual patient’s muscle mass. When the renal estimate is doubtful, measured vancomycin levels entered into the Bayesian fit let the estimate move away from the population prediction.`,
      "Vancomyzer uses the SCr you enter and does not round low values up (accepted range 0.1–10 mg/dL). In a single-center retrospective study of 245 patients aged 65 and older (Bukhari 2024), dosing with SCr rounded up to 1 mg/dL was less accurate than dosing with the actual SCr.",
      "The calculator shows an enhanced-monitoring advisory for patients older than 65 and, when the bedbound option is selected, a warning when SCr is below 0.7 mg/dL. Review any renal estimate you consider unreliable, and obtain levels early.",
    ],
    refs: [REF_COLIN_2019, REF_BUKHARI_2024],
  },
  {
    question: `What does ${COLIN.shortName} use instead of Cockcroft-Gault?`,
    answer: [
      "Age, total body weight and serum creatinine, as direct covariates in a two-compartment model, with no intermediate CrCl calculation. FDecline describes the fall in clearance with age; FSCR describes the effect of serum creatinine relative to an age-standardized reference:",
      { formula: [COLIN.equations.CL, COLIN.equations.FDecline, COLIN.equations.FSCR].join("\n") },
      `Source data: ${COLIN.sourcePopulation}`,
      `Covariates in the published final model that Vancomyzer does not apply:\n${bullets(COLIN.omittedCovariates)}`,
      "Full equations, parameter values and a typical-adult reference check are on the Equations & derivations page.",
    ],
    refs: [REF_COLIN_2019],
  },
  {
    question: "What about IBW — why does traditional dosing require it and why does Vancomyzer not?",
    answer: [
      "In traditional vancomycin dosing, determining the dose requires answering a question that has no single correct answer: which body weight do you use?",
      "Three options are used in clinical practice, each requiring its own calculation:",
      "Total body weight (TBW): the patient’s actual weight. Simple, but TBW-based dosing in traditional (non-model) protocols can produce supratherapeutic levels in obese patients.",
      "Ideal body weight (IBW), Devine formula: the weight a patient “should” be, based on height and sex.",
      { formula: "Males:   50 kg + 2.3 kg per inch over 60 inches\nFemales: 45.5 kg + 2.3 kg per inch over 60 inches" },
      "This requires height, which Cockcroft-Gault does not use, and IBW alone can underestimate dose requirements in obese patients.",
      "Adjusted body weight (AdjBW): IBW + 0.4 × (TBW − IBW). Some institutional protocols use it when actual body weight exceeds IBW by more than 30%.",
      "The practical problem: which weight to use varies between institutions, depends on a reliably documented height, and adds a manual step on top of the CrCl estimate. For obese adults, the 2020 ASHP/IDSA/PIDS/SIDP guideline suggests loading doses of 20–25 mg/kg actual body weight (maximum 3,000 mg), maintenance doses usually no higher than 4,500 mg/day, and early monitoring of levels.",
      `How Vancomyzer handles body size: ${COLIN.shortName} uses total body weight directly for every adult at every BMI (CL and Q scale with (weight/70)^0.75; V1 and V2 with weight/70). No IBW, AdjBW or height is needed for the calculation, and no other model takes over at any BMI. Measured levels, when entered, individualize the estimate through the Bayesian fit.`,
      `Height is still worth entering so BMI can be assessed. At ${BMI_40}, an advisory notes that published evaluation of ${COLIN.shortName} at that body size is limited and recommends early vancomycin levels; fat-free mass and alternative creatinine-clearance estimates are shown for information only and do not change the calculation.`,
    ],
    refs: [
      { label: "Pai MP, Paloucek FP. The origin of the “ideal” body weight equations (Devine formula). Ann Pharmacother. 2000;34(9):1066-1069.", url: "https://doi.org/10.1345/aph.19381" },
      { label: "UC Davis Health. Adult IV vancomycin dosing guidelines (example institutional protocol, PDF).", url: "https://health.ucdavis.edu/media-resources/antibiotic-stewardship/documents/pdfs/guidelines/vanc_dosing.pdf" },
      REF_RYBAK_2020,
      REF_JANMAHASATIAN_2005,
    ],
  },
  {
    question: `How has ${COLIN.shortName} performed in independent evaluations?`,
    answer: [
      `${VALIDATION_STATUS} The studies below evaluated the published ${COLIN.shortName} model, not Vancomyzer’s implementation of it.`,
      bullets([
        `Heus 2022 (three Belgian hospitals; 169 non-ICU general-ward patients on continuous-infusion vancomycin; 923 samples): ${COLIN.shortName} had the second-best predictive performance of 23 published models, after the Okada model. Vancomyzer models intermittent infusion, not continuous infusion.`,
        `Aljutayli 2022 (McGill University Health Centre; single-center retrospective data from 116 adults): transferability diagnostics suggested ${COLIN.shortName} and a model by Yamamoto et al. were the two of seven literature models best suited to the local data. The authors note that these diagnostics were not strong predictors of predictive performance.`,
        COLIN_2021_NOTE,
        `Patanwala 2022 (188 critically ill adults; 466 AUC estimates): ${COLIN.shortName}, Goti 2018 and Thomson 2009 placed the AUC in the same category (below, within or above 400–600 mg·h/L) for 48% of estimates, so model choice can change dosing decisions in the ICU.`,
      ]),
      "Results depend on the population, infusion method and sampling design, and none of these studies establishes accuracy for every patient. Use measured levels to individualize dosing.",
    ],
    refs: [
      { label: "Heus A, et al. Model-informed precision dosing of vancomycin via continuous infusion: a clinical fit-for-purpose evaluation of published PK models. Int J Antimicrob Agents. 2022;59(5):106579.", url: "https://pubmed.ncbi.nlm.nih.gov/35341931/" },
      { label: "Aljutayli A, et al. Pharmacokinetic equations versus Bayesian guided vancomycin monitoring: pharmacokinetic model and model-informed precision dosing trial simulations. Clin Transl Sci. 2022;15(4):942-953.", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9010252/" },
      REF_COLIN_2021,
      { label: "Patanwala AE, et al. Discrepancies between Bayesian vancomycin models can affect clinical decisions in the critically ill. Crit Care Res Pract. 2022;2022:7011376.", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9767744/" },
    ],
  },
  {
    question: "Has Vancomyzer itself been validated in patients?",
    answer: [
      VALIDATION_STATUS,
      "Evidence to date is developer-run: reproduction of published literature cases, synthetic simulation, and a synthetic cross-check against Tucuxi. These checks test whether the equations are implemented as intended; they do not show how accurately Vancomyzer predicts levels in real patients.",
      "The shaded band around the predicted curve on the concentration–time graph is a 90% credible band. The calculator draws 400 sets of PK parameters from the posterior (or, before any level, from the population prior), simulates each on the same regimen, and shades the 5th to 95th percentile at each time. It reflects parameter uncertainty only, so it is not a prediction interval for a new measured level (assay error is excluded), and it depends on the calculator's prior variances and residual error model. When the posterior cannot be estimated reliably, no band is drawn and the graph says why. The band is model-based and not yet validated: whether 90% of real patients' concentrations fall inside it has not been measured, and will be checked in the validation studies.",
      "Vancomyzer™ is designed to meet the criteria for non-device clinical decision support in section 520(o)(1)(E) of the Federal Food, Drug, and Cosmetic Act (added by section 3060 of the 21st Century Cures Act). It has not been cleared, approved or otherwise reviewed by the FDA. It is intended for licensed healthcare professionals, who must independently review the basis for each recommendation.",
    ],
    refs: [
      { label: "Literature reproducibility cases", url: "/transparent-dosing/cases" },
      { label: "Comparison with Tucuxi (developer-run, synthetic)", url: "/transparent-dosing/engine-crosscheck" },
      { label: "Medical disclaimer", url: "/disclaimer" },
    ],
  },
  {
    question: "Does Vancomyzer calculate CrCl anywhere?",
    answer: [
      `Not for the dosing calculation. ${COLIN.renalCovariate}`,
      `Cockcroft-Gault estimates appear only in advisories: one can flag possible augmented renal clearance, and at ${BMI_40} fat-free mass and alternative creatinine-clearance estimates are shown for information only. None of these changes the clearance estimate.`,
    ],
    refs: [REF_COLIN_2019, REF_COCKCROFT_GAULT],
  },
  {
    question: "What is fat-free mass (FFM), and does Vancomyzer use it?",
    answer: [
      "Fat-free mass is the part of body weight that is not adipose tissue: muscle, bone, organs and water. The Janmahasatian 2005 equations estimate it from weight, height and sex:",
      { formula: "FFM (male)   = (9270 × TBW) / (6680 + 216 × BMI)\nFFM (female) = (9270 × TBW) / (8780 + 244 × BMI)" },
      `Vancomyzer does not use FFM in its calculation. ${COLIN.shortName} scales clearance and volumes with total body weight at every BMI. At ${BMI_40}, FFM is shown for information only.`,
    ],
    refs: [REF_JANMAHASATIAN_2005, REF_COLIN_2021],
  },
];

/* ── Item ──────────────────────────────────────────────────────── */

function FaqEntry({ item, index }: { item: FaqItem; index: number }) {
  return (
    <details id={`q${index + 1}`}>
      <summary>
        <span>{item.question}</span>
      </summary>
      <div className="vz-faq-body">
        {item.answer.map((block, i) => {
          if (typeof block === "object" && "formula" in block) {
            return (
              <pre key={i} className="vz-code" style={{ marginTop: 10 }}>
                {block.formula}
              </pre>
            );
          }
          return (
            <p key={i} className="max-w-[70ch] text-[15.5px] leading-[1.6]" style={{ color: INK2, marginTop: i === 0 ? 0 : 12, whiteSpace: "pre-line" }}>
              {block}
            </p>
          );
        })}
        {item.refs.length > 0 && (
          <ol className="vz-refs" style={{ listStyle: "decimal", paddingLeft: 20 }}>
            {item.refs.map((ref, i) => (
              <li key={i}>
                <a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.label}</a>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function FAQPage() {
  return (
    <div style={{ color: INK }}>
      <PageHeader
        kicker="Frequently asked questions"
        title="Why Vancomyzer is built the way it is."
        lede="The model, the renal covariate, body weight, and what has and has not been validated. Each answer cites its sources."
        compact
      />
      <Record label="Questions" note={`${FAQ_ITEMS.length} answers. Open any question; the references are listed under each answer.`} last>
        <div className="vz-faq">
          {FAQ_ITEMS.map((item, index) => (
            <FaqEntry key={index} item={item} index={index} />
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/calculator" className="vz-mbtn vz-mbtn--primary">Open the calculator</Link>
          <Link href="/transparent-dosing" className="vz-mbtn vz-mbtn--outline">Evidence and methods</Link>
        </div>
      </Record>
    </div>
  );
}
