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

export const COMPETITOR_URLS = [
  { name: "InsightRX", url: "https://www.insight-rx.com/blog/" },
  { name: "DoseMeRx", url: "https://doseme-rx.com/vancomycin/articles" },
  { name: "VancoCalc", url: "https://www.vancocalc.com" },
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
