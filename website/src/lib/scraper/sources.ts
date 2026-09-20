/**
 * Source definitions for the market intelligence scraper.
 */

export const REDDIT_SOURCES = [
  {
    subreddit: "pharmacy",
    terms: ["vancomycin", "AUC dosing", "Bayesian dosing", "TDM software", "aminoglycoside",
            "tacrolimus dosing", "InsightRX", "DoseMeRx", "does anyone have a calculator",
            "no AUC software", "manual calculations"],
  },
  {
    subreddit: "medicine",
    terms: ["vancomycin dosing", "MRSA treatment", "antibiotic dosing", "therapeutic drug monitoring"],
  },
  {
    subreddit: "emergencymedicine",
    terms: ["vancomycin", "antibiotic dosing", "sepsis treatment"],
  },
  {
    subreddit: "criticalcare",
    terms: ["vancomycin AUC", "Bayesian dosing", "ICU antibiotics", "TDM"],
  },
  {
    subreddit: "clinicalpharmacology",
    terms: ["vancomycin", "population pharmacokinetics", "Bayesian", "AUC monitoring"],
  },
  {
    subreddit: "nursing",
    terms: ["vancomycin dosing", "antibiotic monitoring"],
  },
];

export const PUBMED_SEARCHES = [
  { query: "vancomycin AUC Bayesian dosing", minDate: "2023/01/01" },
  { query: "vancomycin population pharmacokinetics obesity", minDate: "2023/01/01" },
  { query: "aminoglycoside Bayesian dosing clinical", minDate: "2023/01/01" },
  { query: "tacrolimus therapeutic drug monitoring software", minDate: "2023/01/01" },
];

// Known competitors — monitor their pages for changes and new content
export const COMPETITOR_URLS = [
  { name: "InsightRX", url: "https://www.insight-rx.com/", productUrl: "https://www.insight-rx.com/provider/drug-modules" },
  { name: "DoseMeRx", url: "https://doseme-rx.com/vancomycin/articles", productUrl: "https://doseme-rx.com/why-dosemerx/vancomycin-models" },
  { name: "VancoCalc", url: "https://www.vancocalc.com", productUrl: "https://www.vancocalc.com" },
  { name: "MwPharm++", url: "https://www.mediware.cz/en/mwpharm-online/", productUrl: "https://www.mediware.cz/en/mwpharm-online/" },
  { name: "DosOpt", url: "https://dosopt.com", productUrl: "https://dosopt.com", disabledReason: "Domain did not resolve at September 2026 verification; reverify before enabling." },
  { name: "PrecisePK", url: "https://www.precisepk.com", productUrl: "https://www.precisepk.com" },
  { name: "ID-ODS", url: "https://www.id-ods.com", productUrl: "https://www.id-ods.com", disabledReason: "Redirects to an application sign-in surface; a public evidence page must be identified first." },
];

// Search terms specifically for discovering competitors and new TDM software
export const COMPETITOR_DISCOVERY_TERMS = [
  "TDM software", "dosing software", "vancomycin calculator", "AUC calculator",
  "Bayesian dosing tool", "drug dosing app", "pharmacokinetic software",
  "clinical pharmacology software", "dosing platform", "precision dosing",
  "model-informed precision dosing", "MIPD software", "PK software",
  "therapeutic drug monitoring app", "TDM tool", "dosing calculator",
  "InsightRX alternative", "DoseMe alternative", "vancomycin AUC tool",
  "best TDM software", "pharmacy dosing software", "PK/PD software",
];

export const TRACKED_DRUGS = [
  "vancomycin", "aminoglycosides", "gentamicin", "tobramycin", "tacrolimus",
  "cyclosporine", "busulfan", "methotrexate", "phenytoin", "digoxin",
  "lithium", "mycophenolate",
];

export const PAIN_POINT_PHRASES = [
  "too expensive", "can't afford", "no software", "black box", "can't verify",
  "manual calculation", "error prone", "no AUC", "no Bayesian", "no mobile",
  "bedside tool", "wish there was", "does anyone have", "how do you dose",
];

export const POSITIVE_WORDS = ["great", "accurate", "helpful", "love", "recommend", "excellent", "reliable", "fast"];
export const NEGATIVE_WORDS = ["expensive", "slow", "black box", "wrong", "complicated", "buggy", "inaccurate", "frustrating"];


// Country keywords describe article coverage, not the location or size of a market.
export const REGIONAL_SEARCHES = [
  { name: "Latin America", query: '(vancomycin OR vancomicina) AND (AUC OR Bayesian OR monitoring) AND (Brazil OR Brasil OR Mexico OR Argentina OR Chile OR Colombia OR "Latin America")' },
  { name: "Europe / Spain", query: '(vancomycin OR vancomicina) AND (AUC OR Bayesian OR monitoring) AND (Spain OR España OR Europe OR "United Kingdom")' },
  { name: "Asia", query: 'vancomycin AND (AUC OR Bayesian OR monitoring) AND (China OR Japan OR India OR Singapore OR Thailand OR Malaysia OR Korea)' },
  { name: "Africa", query: 'vancomycin AND (AUC OR Bayesian OR monitoring) AND (Africa OR Nigeria OR Kenya OR Egypt)' },
];
