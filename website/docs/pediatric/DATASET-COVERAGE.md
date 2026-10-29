# Pediatric coverage of the Colin 2019 pooled dataset and the preview's refusal policy

Date: 2026-10-29. Source: Colin et al. 2019, Table 1 ("Details of the component datasets … covariate values at the time of inclusion"), accepted manuscript text extracted from the Strathclyde repository copy; ranges are quoted as printed.

## 1. Component datasets contributing individuals under 18 years

| Dataset | N | Population | PMA at inclusion (y) | PNA at inclusion (d) | Weight (kg) |
|---|---|---|---|---|---|
| Allegaert et al. [11] | 247 | premature neonates | 0.60 (0.46–0.71) | 11 (1–27) | 1.20 (0.42–2.63) |
| de Hoog et al. [15] | 130 | premature neonates | 0.60 (0.51–0.84) (PMA assumed = postconceptual age) | 13 (3–27) | 1.07 (0.51–4.41) |
| Oudin et al. [21] | 67 | neonates and paediatric patients | 0.60 (0.52–0.88) | 13 (4–95) | 1.06 (0.68–4.45) |
| Lo et al. [23] | 116 | premature Malaysian neonates | 0.55 (0.45–0.65) | 5 (1–39) | 0.90 (0.50–2.00) |
| van der Meer et al. [13] | 389 | paediatric, adult and elderly patients | 65.9 (2.58–97.8) | – | 70.0 (8.70–160) |

The pooled set is described as 559 newborns and 118 children/adolescents (Results 3.1); the 118 children and adolescents come from the van der Meer dataset only. Covariates were time-varying during modelling (footnote e), so individuals may have aged slightly beyond their inclusion values; the within-study time course is not published.

## 2. The gap

No component study enrolled anyone with a postmenstrual age above **0.88 years** (Oudin et al. maximum) and below **2.58 years** (van der Meer et al. minimum) at inclusion. In postnatal terms, for a term birth that is roughly 6 weeks to 1.8 years of age; for a birth at 24 weeks, roughly 5 months to 2.1 years. The maturation function is continuous through this range, so the model produces numbers there, but they rest on no observation.

The earlier preview wording ("about 5 months to 1.8 years postnatal") described only the preterm case; the term-infant lower edge is about 40 days.

## 3. Policy

Requests whose model PMA lies strictly inside (0.88, 2.58) years are refused with `status: "unsupported"` on `patient.postnatal_age`. The refusal quotes both boundary studies and converts the gap to postnatal days for the gestational age entered. The former `acknowledge_dataset_gap` flag has been removed from the request contract; if a client still sends it, it is ignored and the request is still refused (tested at unit, HTTP and browser level).

Boundaries are inclusive at both ends (PMA exactly 0.88 or 2.58 is accepted) because Table 1 reports those values as observed inclusion ranges. Values are compared on the model PMA defined in AGE-CONVENTION.md.

## 4. What inclusion does and does not establish

Inclusion of a population in the pooled fit means the model was *estimated* with some observations from it. It does not establish clinical validation of this software for that population:

- the pediatric data above 2.58 years are a single dataset of 118 children and adolescents;
- the neonatal data are four datasets dominated by premature infants, with few term neonates beyond the first month;
- the article reports in-sample fit (MdAPE by subgroup) and dosing simulations, not an external validation of individual predictions;
- the preview's own performance figures are synthetic (virtual patients drawn from the model itself) and say nothing about real children.

These statements appear in every result's limitations list and in the status payload.

## 5. Other dataset limits enforced or warned

Refused by design (excluded from the source dataset): renal replacement therapy (haemodialysis, haemodiafiltration, CRRT), ECMO, non-intravenous administration. Hard input limits: PMA ≥ 23.4 weeks, postnatal age < 18 years, weight 0.4–160 kg, creatinine 0.1–10 mg/dL. Warned when outside the dataset's observed ranges: neonatal postnatal age outside 1–95 days, weight below 0.42 kg, creatinine outside 0.15–9.75 mg/dL, postnatal age under 72 hours (maternal creatinine).
