# Pediatric Vancomyzer research preview — clinical review package

Date: 2026-10-29 (revision 4). Prepared for a pediatric pharmacist or clinician. Purpose: decide which input rules the admin-only research preview should enforce, warn about, or leave to clinical judgement, and what evidence is still missing before any patient-care use. Nothing in this preview is clinically validated. No patient data were used; all performance figures are synthetic unless a published external study is cited.

## 1. Model and population

Model: Colin PJ et al. *Vancomycin pharmacokinetics throughout life: results from a pooled population analysis and evaluation of current dosing recommendations.* Clin Pharmacokinet 2019;58:767-780 (DOI 10.1007/s40262-018-0727-5). Two-compartment, covariates postmenstrual age (PMA), total body weight (allometric), serum creatinine relative to an age-standardised creatinine; estimated with creatinine as a **time-varying** covariate (the baseline-only alternative worsened the fit, ΔOFV +876; Results 3.2).

Development data under 18 years (Table 1, covariates at inclusion):

| Dataset | n | Population | PMA (y) | PNA (d) | Weight (kg) |
|---|---|---|---|---|---|
| Allegaert et al. | 247 | premature neonates | 0.46-0.71 | 1-27 | 0.42-2.63 |
| de Hoog et al. | 130 | premature neonates | 0.51-0.84 | 3-27 | 0.51-4.41 |
| Oudin et al. | 67 | neonates and paediatric patients | 0.52-0.88 | 4-95 | 0.68-4.45 |
| Lo et al. | 116 | premature Malaysian neonates | 0.45-0.65 | 1-39 | 0.50-2.00 |
| van der Meer et al. | 389 (118 children/adolescents) | paediatric, adult and elderly | 2.58-97.8 | – | 8.70-160 |

Exclusions by design: renal replacement therapy (haemodialysis, haemodiafiltration, CRRT), ECMO, non-intravenous administration. No subject had PMA between 0.88 and 2.58 years; the preview refuses that range (DATASET-COVERAGE.md).

**Formulation status:** the article's Eq. 6 and the supplementary NONMEM control stream disagree on clearance (4.10 vs 5.31 L/h for the reference adult). The preview computes with the supplementary (normalised) control stream as a **research candidate**; the article transcription is shown as a sensitivity row. The owner has asked the corresponding author which representation produced Table 3 and the Table 4 dosing simulations; no reply has been received. This is unresolved (MODEL-RESOLUTION.md).

## 2. External evidence on the Colin 2019 model in children (as published; not generated here)

| Study | Population | What was found for Colin 2019 |
|---|---|---|
| Colin PJ et al. Ther Drug Monit 2021 (PMC7803436) | 49 obese **adults** (BMI ≥ 30, age ≥ 16), Scotland | a priori bias −7.0 %, RMSE 4.34 mg/L (lowest of five models); a posteriori bias 1.96 %, RMSE 2.75 mg/L (best); authors conclude no advantage of obesity-specific models |
| Hughes JH et al. Clin Pharmacokinet 2023;62:67-76 (PMC9898357) | 2061 infants < 1 year, 5794 levels, 28 US sites; weight 0.3-15.1 kg; GA 22-43 weeks (40 % imputed) | Colin not among the best-performing models (Dao and Jacqz-Aigrain were); prediction error significantly higher when GA was imputed for PMA ≤ 37 weeks; Colin's creatinine effect described as weak; numeric values only in figures |
| Liu YX et al. Front Pharmacol 2021 (PMC8058705) | 171 neonates, 319 levels, two Chinese centres; PMA 28.3-47.1 weeks; weight 0.81-5.6 kg | 18 neonatal models including Colin: "no model satisfied the standards of MDPE ≤ ±15 %, MAPE ≤ 30 %, F20 > 35 %, F30 > 50 %"; Colin-specific values only in supplementary tables |
| Schouwenburg S et al. J Infect Dis 2025;231:e882-e890 (PMC12128073) | Cohort A: 21 infants < 50 days (weight 0.7-4.2 kg); Cohort B: 124 children 0.1-17.2 y (2.3-74.6 kg), Rotterdam | Cohort A: Chen, Colin and Mehrotra "seemed to perform best" with trough-only AUC estimation (rBias −3.3 to −1.4 %, rRMSE 6.4-9.0 %); Colin had the highest share of patients needing no dose change (81 %). Cohort B best models were Alsultan and Lv, not Colin. Authors note Colin "was not externally validated" at development |
| McCarthy MG et al. Clin Pharmacokinet 2026;65:527-543 (PMC13038739) | Oncology: 371 children 0.2-20 y (5-112 kg), 20 sites; CVICU: 219 children 0.1-17.8 y (3-91 kg), 11 sites | Oncology: Colin 2019 had the best overall a priori and a posteriori performance and "was the only model close to satisfying all our criteria for clinical acceptability a posteriori"; CVICU: "adequate predictive performance but was outperformed by all three specialized models a posteriori on all metrics except bias" |
| Alrahahleh D et al. Clin Pharmacokinet 2024;63:367-380 (PMC10954945) | 69 preterm neonates, Sydney | Colin excluded from evaluation because it "included a greater age range than considered appropriate" |
| Xu H et al. Antimicrob Agents Chemother 2026;70:e01840-25 (PMC13231927) | 627 children 0.2-18.4 y, Australia | no head-to-head evaluation; typical clearance "comparable" to Colin; ECMO, peritoneal dialysis and RRT excluded |
| Vander Elst Z et al. Br J Clin Pharmacol 2026;92:2028-2048 (PMC13304247) | systematic review, scoring-based selection | Colin 2019 listed with "internal validation" only; Chen (2023) scored highest for neonates and children |

Reading: evidence for the model in **neonates** is mixed (not best-in-class in the largest infant dataset; competitive in a small trough-only cohort); in **children > 2 years** it performed well in oncology and acceptably in cardiac ICU patients; in **obese** patients it was evaluated in adults only. None of these studies validates this software; they describe the published model in other implementations.

## 3. Proposed input rules (for decision)

Categories: **A** mathematically invalid or beyond documented human extremes → refused; **B** unusual enough to require verification before calculation → refused until the administrator confirms the entry (`inputs_verified`); **C** outside the studied model population → computed, reported as such; **D** clinical validity unknown → computed, reported as such. The preview never silently accepts a B value and never describes a B, C or D value as impossible.

| Input | Rule | Category | Source and limitation |
|---|---|---|---|
| Any number | finite JS number; units from fixed lists | A | technical |
| Weight < 0.2 kg | refused | A | a 2022 Tiniest Babies Registry publication reports survivors down to 212 g (PMID 35422378). The 0.2 kg cutoff is provisional research scope, not a physiological law |
| Weight > 11 kg in the first 28 days | refused | A | heaviest documented birth 9.98 kg (Guinness World Records, 1879); 11 kg leaves a margin; the 10.2 kg Aversa 1955 case is undocumented |
| Weight > 160 kg | refused | C (scope) | provisional research scope; 160 kg is the maximum of a mixed-age van der Meer dataset, not a verified pediatric maximum. **Question 1:** keep as scope, or compute with a C flag? |
| Weight-for-age \|z\| > 3 (WHO 2006 standard 0-5 y; CDC 2000 reference 5-20 y; corrected age for preterm birth under 2 y) | verification required | B | WHO Multicentre Growth Reference Study 1997-2003 (standard for healthy term children); CDC 2000 US reference (NHES/NHANES 1963-1994). Both sexes evaluated, the value nearer zero used (sex is not a model input). −3 SD is WHO's "severely underweight" line; +3 SD has no obesity meaning without height. **Question 2:** is \|z\| > 3 the right gate, and should any value be a hard refusal? |
| Weight-for-age \|z\| > 5 | verification required, stronger wording (likely unit/age error) | B | same references; no evidence base for the number 5 beyond its rarity |
| Preterm infant below term-equivalent PMA | not checked (no preterm reference loaded) | D | Fenton 2013 (BMC Pediatr 13:59) covers 22-50 weeks but its numeric tables are not published in machine-readable form; **Question 3:** should the unit's Fenton chart be mandatory for these entries? |
| Weight outside the development bands (neonates 0.42-4.45 kg at PNA ≤ 95 d; children 8.7-160 kg) | reported | C | Colin 2019 Table 1 |
| Weight-for-age z > +2 | reported | D | obesity cannot be classified without height (CDC BMI-for-age ≥ 95th centile); 2020 guideline recs 23-24: no different mg/kg empiric dose in obese children, monitoring "of particular value", loading 20 mg/kg total body weight; external evaluation in obese adults only |
| Gestational age 22-44 weeks | input domain | A/C | 22 weeks: lower bound of active-care practice in most guidelines (ACOG/SMFM Obstetric Care Consensus 6, periviable 20 0/7-25 6/7 weeks); survival documented from 21 weeks 1 day (Guinness 2021, 420 g). 42 0/7 weeks = post-term (ACOG Practice Bulletin 146); 44 allows two weeks beyond. **Question 4:** lower the floor to 21 weeks or keep 22? (The PMA floor 23.4 weeks from the dataset applies regardless.) |
| Postnatal age < 72 h | reported | D | newborn creatinine reflects maternal creatinine in the first 72 h (Evans RE et al. Front Pediatr 2023, review; Miall LS et al. Pediatrics 1999, rises in the first 48 h in preterms) |
| PMA 0.88-2.58 y | refused | C | no development data (owner decision) |
| PNA ≥ 18 y | refused | scope | adult calculator exists |
| Serum creatinine 0.1-10 mg/dL; outside 0.15-9.75 reported | A / C | analytic floor; Table 1 range |
| Unstable renal function flag | reported, not validated | D | see §4 |
| RRT, ECMO, non-IV | refused | C | excluded from development data; guideline recs 14-16 cover RRT dosing in adults only |

## 4. Renal function and changing clearance (assessed separately)

The model uses a single serum creatinine relative to an age-standardised value and assumes constant clearance over the modelled history and the 24-h forecast. The source model was estimated with time-varying creatinine; this preview does not take a creatinine time course. For a patient with deteriorating or recovering renal function (KDIGO 2012: creatinine rise ≥ 0.3 mg/dL within 48 h or ≥ 1.5 × baseline within 7 days, or urine output < 0.5 mL/kg/h for 6 h; Kidney Int Suppl 2012;2:19-36), neither the posterior fit nor the forecast is validated: a level drawn under a different clearance than the one prevailing at the forecast will be fitted as if clearance were constant. The 2020 guideline (recs 4 and 20) asks for frequent monitoring and dose adjustment in such patients and notes that vancomycin clearance and creatinine clearance "are not always well correlated in pediatric patients" (rec 19). Augmented renal clearance is likewise not represented beyond a low creatinine. **Question 5:** should the flag refuse the forecast (keeping steady-state and posterior parameters), or remain a prominent note?

## 5. Input and timing workflow (what the administrator sees)

1. Sign-in as a verified system administrator; per-session research acknowledgement (server-enforced).
2. Patient fields with units; gestational age required under 1 year.
3. Time zone of the entries chosen explicitly (IANA zone or fixed offset; default the browser zone). Each dose and level time is converted to an instant with an explicit offset; a local time that did not exist is refused inline; a repeated local time requires the offset to be chosen; the resolved offset and UTC instant are displayed. The API accepts only offset-qualified timestamps.
4. Doses may be entered in any order; they are modelled by absolute time, duplicates and overlapping infusions are refused, and the result shows the chronological history with the original row numbers.
5. Forecast window = 24 h from the next planned dose (explicit `next_dose_start`, required with a dose history; no inferred time). It must start after every level and after the end of the last recorded infusion; otherwise the request is refused with the valid repairs. No dose is moved or invented.
6. Unusual-for-age values stop the calculation until verified; outside-population and unknown-validity items are shown with sources on every result.
7. Every result is labelled research-only, carries the candidate-formulation statement, the AUC24 400-600 target statement (serious MRSA, MIC 1 mg/L assumed; guideline rec 1; pediatric target from adult data, rec 17) and the nephrotoxicity thresholds (rec 21: AUC 800 mg·h/L, trough 15 mg/L, avoid ≥ 100 mg/kg/day).

## 6. Validation evidence available

- **Synthetic self-consistency** (virtual patients drawn from the model): prior-only MAPE 22 %, one level 13 %, two levels 11 %; 90 % credible-interval coverage 89.6 / 89.4 / 89.8 %; AUC-category agreement 48 / 68 / 71 %. These say nothing about real children (INTERVAL-COVERAGE.md, synthetic-performance.json).
- **Independent implementation check**: a standard-library Python reference reproduces parameters to 1e-9, concentrations to 2e-5 and MAP optima to 2e-3 (reference-cases.json).
- **External, published** (§2): mixed in neonates, favourable in oncology, evaluated in obese adults only; none concern this implementation.
- **Not done**: any evaluation on real pediatric levels; any comparison of this implementation's posteriors with a reference Bayesian tool on real data.

## 7. Questions requiring clinical decisions

1. Keep 160 kg as a hard scope limit, or compute with an outside-population flag?
2. Is weight-for-age |z| > 3 the right verification gate; should any z be a hard refusal; should sex be added as an input to use the correct chart?
3. For preterm infants below term-equivalent age, require confirmation against the unit's Fenton chart, or load Fenton data under licence?
4. Gestational-age floor: 22 weeks (current) or 21 weeks?
5. Unstable renal function: refuse the forecast, or keep the current note?
6. Should out-of-population weights (neonates < 0.42 kg or > 4.45 kg; children < 8.7 kg) be refused like the age gap, or remain warnings?
7. Which external pediatric dataset and acceptance thresholds (bias, imprecision, coverage, category agreement by age band) should define "validated" for this implementation?
8. Pending the authors' reply: continue with the supplementary formulation as the candidate, or hold all pediatric calculations?

## 8. Evidence needed before patient-care use

The authors' clarification of the clearance parameterisation; an external evaluation on real pediatric levels with pre-specified thresholds, by age band (preterm, term neonate, infant, child, adolescent) and in obese and renally unstable children; a decision on the adult engine's transcription; production access review; clinical governance sign-off. Until then the preview remains research-only behind admin authorization and the session acknowledgement.

## Sources (retrieved 2026-10-29)

- Rybak MJ et al. Executive summary: therapeutic monitoring of vancomycin for serious MRSA infections. J Pediatric Infect Dis Soc 2020;9:281-284 (PMC7358040); full guideline Am J Health-Syst Pharm 2020;77:835-864, DOI 10.1093/ajhp/zxaa036.
- WHO Child Growth Standards (2006), weight-for-age z-score expanded tables, boys and girls (cdn.who.int, child-growth-standards/indicators/weight-for-age/expanded-tables).
- CDC 2000 Growth Charts, weight-for-age LMS data file wtage.csv (cdc.gov/growthcharts/data/zscore/wtage.csv); Kuczmarski RJ et al. Vital Health Stat 11 2002;(246):1-190. CDC recommends WHO standards under 2 years and CDC charts from 2 years (cdc.gov/growthcharts/who-data-files.htm, reviewed 2024-09-02).
- Fenton TR, Kim JH. A systematic review and meta-analysis to revise the Fenton growth chart for preterm infants. BMC Pediatr 2013;13:59 (PMC3637477): 22-50 weeks, 3rd/10th/50th/90th/97th centiles, six population surveys (3.99 million births); a reference, not a standard; numeric tables available via the ucalgary.ca/fenton calculator only.
- Guinness World Records, heaviest birth: 9.98 kg, 19 January 1879 (guinnessworldrecords.com/world-records/heaviest-birth). Most premature baby to survive: 21 weeks 1 day, 420 g, 5 July 2020, UAB Hospital (Guinness, reported 11 November 2021).
- Tiniest Babies Registry, University of Iowa (webapps1.healthcare.uiowa.edu/TiniestBabies): Bell EF. 2022, PMID 35422378, DOI 10.1016/j.siny.2022.101326: 291 survivors, birth weights 212–399 g. This corrects the outdated 245-g claim; it does not prove a universal lower physiological bound.
- ACOG/SMFM Obstetric Care Consensus No. 6, Periviable birth (2017): periviable 20 0/7-25 6/7 weeks. ACOG Practice Bulletin 146 (2014): late-term 41 0/7-41 6/7, post-term ≥ 42 0/7 weeks. WHO: newborn period = first 28 days of life (WHO fact sheet, 14 March 2024).
- Evans RE, Peterson J, Kim JJ, Mahaveer A. How to know when little kidneys are in trouble: a review of current tools for diagnosing AKI in neonates. Front Pediatr 2023;11:1270200. Miall LS et al. Plasma creatinine rises dramatically in the first 48 hours of life in preterm infants. Pediatrics 1999;104:e76.
- KDIGO Clinical Practice Guideline for Acute Kidney Injury. Kidney Int Suppl 2012;2:1-138 (definition 2.1.1, p. 19).
- External evaluations: Colin 2021 (PMC7803436); Hughes 2023 (PMC9898357); Liu 2021 (PMC8058705); Schouwenburg 2025 (PMC12128073); McCarthy 2026 (PMC13038739); Alrahahleh 2024 (PMC10954945); Xu 2026 (PMC13231927); Vander Elst 2026 (PMC13304247).
