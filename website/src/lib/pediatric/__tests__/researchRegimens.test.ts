import assert from 'node:assert/strict';
import {runPediatricEngine,type PediatricRequest,type PediatricResult} from '../engine';
import {researchRegimens} from '../researchRegimens';
const base:PediatricRequest={patient:{postnatal_age:{value:6,unit:'years'},weight:{value:20,unit:'kg'},serum_creatinine:{value:0.4,unit:'mg/dL'}},regimen:{dose_mg:300,interval_hours:6,infusion_minutes:60},research_regimen_context:{serious_mrsa_mic1:true,normal_stable_renal_function:true}};
let checks=0;
const check=(v:unknown)=>{assert.ok(v);checks++;};
const run=(r:PediatricRequest)=>{const result=runPediatricEngine(r);assert.equal(result.status,'ok');return result as PediatricResult;};
const first=run(base);check(first.research_regimens?.status==='available');
for(const c of first.research_regimens!.options){
 check(Math.abs(c.auc24-c.dose_mg*24/c.interval_hours/first.prior.parameters.CL)<1e-9);
 check(c.daily_dose_mg_per_kg>=60 && c.daily_dose_mg_per_kg<=80 && c.dose_mg*24/c.interval_hours<=3600);
 check([6,8].includes(c.interval_hours)&&c.trough<15&&c.auc24>=400&&c.auc24<=600);
 check(c.forecast_auc24_next24h===null);
 const applied=run({...base,regimen:c});
 check(Math.abs(applied.prior.exposure.steady_state_auc24-c.auc24)<1e-9);
 check(Math.abs(applied.prior.exposure.steady_state_auc24_interval!.lower-c.steady_state_auc24_interval.lower)<1e-9);
}
check(first.research_regimens!.options[0].dose_mg===350);
for(const context of [undefined,{serious_mrsa_mic1:true,normal_stable_renal_function:false},{serious_mrsa_mic1:false,normal_stable_renal_function:true},{serious_mrsa_mic1:true,normal_stable_renal_function:'true'}]) check(run({...base,research_regimen_context:context as any}).research_regimens!.status==='withheld');
check(run({...base,patient:{...base.patient,unstable_renal_function:true}}).research_regimens!.status==='withheld');
const neonatal=run({...base,patient:{postnatal_age:{value:10,unit:'days'},gestational_age_weeks:40,weight:{value:3.2,unit:'kg'},serum_creatinine:{value:0.4,unit:'mg/dL'}},regimen:{dose_mg:48,interval_hours:12,infusion_minutes:60}});check(neonatal.research_regimens!.status==='withheld');
for(const age of [0.25,1,18]) check(runPediatricEngine({...base,patient:{...base.patient,postnatal_age:{value:age,unit:'years'},gestational_age_weeks:40}}).status==='unsupported');
for(const weight of [0.19,160.1]) check(runPediatricEngine({...base,patient:{...base.patient,weight:{value:weight,unit:'kg'}},inputs_verified:true}).status==='invalid');
check(run({...base,patient:{...base.patient,weight:{value:160,unit:'kg'}},inputs_verified:true}).research_regimens!.status==='withheld');
for(const p of [{ecmo:true},{renal_replacement_therapy:true},{route:'other' as const}]) check(runPediatricEngine({...base,patient:{...base.patient,...p}}).status==='unsupported');
const history={...base,doses:[{start:'2026-10-29T08:00:00Z',dose_mg:300,infusion_minutes:60}],regimen:{...base.regimen,next_dose_start:'2026-10-29T14:00:00Z'}};
const h=run(history);
for(const c of h.research_regimens!.options){const applied=run({...history,regimen:{...c,next_dose_start:history.regimen.next_dose_start}});check(Math.abs(applied.prior.exposure.forecast_auc24_next24h!-c.forecast_auc24_next24h!)<1e-9);}
check(runPediatricEngine({...history,regimen:base.regimen}).status==='invalid');
const withLevels=run({...history,levels:[{time:'2026-10-29T13:00:00Z',concentration_mg_l:10}]});
if(withLevels.research_regimens!.status==='available')for(const c of withLevels.research_regimens!.options)check(Math.abs(c.auc24-c.dose_mg*24/c.interval_hours/withLevels.posterior!.parameters.CL)<1e-9);
check(researchRegimens({...first,level_count:1},base,()=>null).status==='withheld');
const noMatch=researchRegimens({...first,candidate_regimens:[]},base,()=>null);check(noMatch.status==='no_match'&&noMatch.options.length===0);
check(researchRegimens({...first,input_review:{items:[{field:'patient.weight',category:'outside_model_population',message:'fixture',source:'fixture'}],verified:true}},base,()=>null).status==='withheld');
console.log(`${checks} pediatric research regimen checks passed.`);
