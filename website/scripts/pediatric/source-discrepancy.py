"""Fixed synthetic source audit; NOT a dosing model or a pediatric calculator.
Run: python3 scripts/pediatric/source-discrepancy.py
Inputs come from Colin 2019's abstract, Discussion worked examples and Table 4;
fixed effects from Table 3 and the last iteration of official MOESM2, not NONMEM
initial estimates. No app-engine import, patient data, regimen recommendation
or network access.
"""
import json
import math

PMA = 35 + 40/52
SCR = .83

def article(pma=PMA, wt=70, scr=SCR, normalize=False, precise_scr=False):
    std = (math.exp(-1.22839 + .67190*math.log10(pma) + 6.27017*math.exp(-3.10940*pma))
           if precise_scr else math.exp(-1.228 + .672*math.log10(pma) + 6.27*math.exp(-3.11*pma)))
    mat = (pma*52)**2.89/((pma*52)**2.89 + 46.4**2.89)
    decline = 1/(1+(pma/61.6)**2.24)
    refmat = (PMA*52)**2.89/((PMA*52)**2.89 + 46.4**2.89)
    refdecline = 1/(1+(PMA/61.6)**2.24)
    fscr=math.exp(-.649*(scr-std))
    return 5.31*(wt/70)**.75*mat*decline*fscr/(refmat*refdecline if normalize else 1)

# Official supplement final iteration: log fixed effects, not rounded final table.
THETA = [1.6674,3.7555,3.7343,1.1665,4.1159,-.11302,1.0611,.80677,-.43280]
cl0,v1,v2,q,deg50,mat50,gamma,decline_gamma,scr_coeff=map(math.exp,THETA)
def supplement(pma=PMA,wt=70,scr=SCR,normalize=True):
    std=math.exp(-1.22839+.67190*math.log10(pma)+6.27017*math.exp(-3.10940*pma))
    def mat(t): return t**gamma/(t**gamma+mat50**gamma)
    def decay(t): return t**(-decline_gamma)/(t**(-decline_gamma)+deg50**(-decline_gamma))
    return cl0*(wt/70)**.75*mat(pma)*decay(pma)*math.exp(-scr_coeff*(scr-std))/(mat(PMA)*decay(PMA) if normalize else 1)

article_cl=article()
supplement_cl=supplement()
assert abs(article_cl-4.10)<.01
assert abs(supplement_cl-5.3033521341)<1e-8
# Unit consistency: maturation in years vs weeks is algebraically identical.
assert math.isclose((PMA*52)**2.89/((PMA*52)**2.89+46.4**2.89),PMA**2.89/(PMA**2.89+(46.4/52)**2.89),rel_tol=1e-14)
refmat=(PMA*52)**2.89/((PMA*52)**2.89+46.4**2.89)
refdecay=1/(1+(PMA/61.6)**2.24)
normalized_table=article(normalize=True)
assert math.isclose(normalized_table/article_cl,1/(refmat*refdecay),rel_tol=1e-14)
assert abs(supplement_cl/normalized_table-1)<.003
assert abs(article(scr=73.4/88.4)/article_cl-1)<.001
# Literal online Eq 12 has opposite signs in numerator and denominator half-point.
literal_decay=PMA**(-2.24)/(PMA**(-2.24)+61.6**2.24)
# Vendor documentation is independent evidence of an implemented variant, not author approval.
chorus_std=math.exp(-1.22839+.67190*math.log10(PMA)+6.27017*math.exp(-3.10940*PMA))
chorus_cl=5.312*math.exp(-.64856*(SCR-chorus_std))

# --- Article's own worked examples (Discussion) and Table 4 optimised adult dose -----
examples=[]
for label,pma,wt,scr,published in [
    ("Abstract reference: 35 y, 70 kg, SCr 0.83 mg/dL",PMA,70,.83,4.10),
    ("Discussion: 60 y, 65 kg, SCr 0.97 mg/dL (85.7 umol/L)",60+40/52,65,.97,2.55),
    ("Discussion: 32-week PMA neonate, 1.5 kg, SCr 0.64 mg/dL",32/52,1.5,.64,.0756)]:
    a=article(pma,wt,scr); s=supplement(pma,wt,scr)
    examples.append({'case':label,'published_CL_L_h':published,'article_transcription_CL_L_h':a,'fitted_nonmem_CL_L_h':s,
                     'article_rel_error':a/published-1,'fitted_rel_error':s/published-1})
    assert abs(a/published-1)<.005, label   # the article's numbers reproduce only under the unnormalised transcription
    assert abs(s/published-1)>.2, label
# Table 4: FDA label adults, optimised daily dose 3000 mg (from 2000 mg), target AUC24 400-700.
table4={'fda_adult_optimised_daily_dose_mg':3000,'auc24_with_fitted_reference_CL':3000/supplement_cl,'auc24_with_article_reference_CL':3000/article_cl,
        'original_2000_mg_auc24_fitted':2000/supplement_cl,'original_2000_mg_auc24_article':2000/article_cl,'target_band':[400,700],
        'smpc_adult_optimised_daily_dose_mg_per_kg':43,'smpc_auc24_fitted_70kg':43*70/supplement_cl,'smpc_auc24_article_70kg':43*70/article_cl}
assert 400<table4['auc24_with_fitted_reference_CL']<700 and table4['auc24_with_article_reference_CL']>700
assert 400<table4['smpc_auc24_fitted_70kg']<700 and table4['smpc_auc24_article_70kg']>700
# Table 3 = exp(printed 3-significant-digit final estimates of the normalised run).
table3_identity={'exp_1.67':math.exp(1.67),'exp_3.76':math.exp(3.76),'exp_3.73':math.exp(3.73),'exp_1.17':math.exp(1.17),'exp_4.12':math.exp(4.12),
                 'exp_-0.113_x52_weeks':math.exp(-.113)*52,'exp_1.06':math.exp(1.06),'exp_0.807':math.exp(.807),'exp_-0.433':math.exp(-.433),
                 'eta_shrinkage_run_vs_table3':{'run':[29.832,42.674,47.015],'table3':[29.8,42.7,47.0]}}
assert round(table3_identity['exp_1.67'],2)==5.31 and round(table3_identity['exp_4.12'],1)==61.6 and round(table3_identity['exp_-0.113_x52_weeks'],1)==46.4

rows=[
 {'variant':'Article table + narrative-consistent decline; unnormalized','CL_L_h':article_cl},
 {'variant':'Same article coefficients; ONLY add reference normalization','CL_L_h':normalized_table},
 {'variant':'Official NONMEM last iteration; normalized','CL_L_h':supplement_cl},
 {'variant':'Same NONMEM coefficients; ONLY remove normalization (audit counterfactual)','CL_L_h':supplement(normalize=False)},
 {'variant':'Chorus documented normalized equations; reference point','CL_L_h':chorus_cl},
 {'variant':'Article; convert rounded 73.4 micromol/L to mg/dL using 88.4','CL_L_h':article(scr=73.4/88.4)},
 {'variant':'Article; change only SCr-standard equation precision','CL_L_h':article(precise_scr=True)},
 {'variant':'Article; incorrectly treat 35 chronological years as PMA (sensitivity only)','CL_L_h':article(pma=35)},
 {'variant':'Article; use literal online Eq 12 sign pattern (inconsistent with narrative)','CL_L_h':article_cl*literal_decay/refdecay},
]
out={
 'purpose':'source discrepancy audit only; not clinical validation',
 'synthetic_reference':{'postnatal_age_years':35,'pma_years':PMA,'weight_kg':70,'scr_mg_dl':SCR,'eta':[0,0,0,0],'study10':False,'study13':False},
 'source_urls':{
  'article':'https://link.springer.com/article/10.1007/s40262-018-0727-5',
  'accepted_manuscript':'https://strathprints.strath.ac.uk/66504/10/Colin_etal_CP_2018_Vancomycin_pharmacokinetics_throughout_life.pdf',
  'supplement':'https://media.springernature.com/original/springer-static/esm/art%3A10.1007%2Fs40262-018-0727-5/MediaObjects/40262_2018_727_MOESM2_ESM.txt',
  'dosing_tables':'https://media.springernature.com/original/springer-static/esm/art%3A10.1007%2Fs40262-018-0727-5/MediaObjects/40262_2018_727_MOESM3_ESM.pdf',
  'independent_implementation_documentation':'https://vanc.app/model-library/colin-2019/'},
 'article_table_with_narrative_decline_CL_L_h':article_cl,
 'supplement_normalized_final_iteration_CL_L_h':supplement_cl,
 'relative_difference_percent':100*(supplement_cl/article_cl-1),
 'reference_maturation':refmat,'reference_decline':refdecay,
 'normalization_multiplier_same_coefficients':1/(refmat*refdecay),
 'equivalent_normalized_theta_for_article':5.31*refmat*refdecay,
 'equivalent_unnormalized_theta_for_normalized_article':5.31/(refmat*refdecay),
 'side_by_side':rows,
 'article_worked_examples':examples,
 'table4_optimised_dose_check':table4,
 'table3_equals_exp_of_run_output':table3_identity,
 'resolution':'The fitted model is the normalised supplementary run (Table 3 = exp of its printed estimates; eta shrinkage identical). The article transcription of Eq. 6 omitted /Fmat_R/Fage_R; the abstract value 4.10 L/h, both Discussion examples and Fig. 1 follow the transcription and are 0.7698x the fitted clearance. Table 4 optimised doses (3000 mg/day adults; 43 mg/kg/day SmPC) reach 400-700 only with the fitted clearance. Pediatric preview computes with the fitted parameterisation; the adult engine (article form) is unchanged and flagged for owner decision.',
 'pediatric_calculation_enabled':True,'pediatric_formulation':'fitted_nonmem','pediatric_research_only':True,
}
print(json.dumps(out,indent=2))
