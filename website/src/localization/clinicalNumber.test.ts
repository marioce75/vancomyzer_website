import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseClinicalNumber, formatClinicalInput, hasInvalidNumericValues } from '../lib/parseClinicalNumber';
const valid: [string, number][] = [['1.2',1.2],['1,2',1.2],[' 0,83 ',.83],['.5',.5],[',5',.5],['0.001',.001],['0,001',.001],['1.2340',1.234],['1,2340',1.234],['1000',1000],['-3',-3],['0',0],['1000.123',1000.123]];
const invalid = ['1,000','1.000','70,000','75.500','001,234','-1.234','1,234.5','1.234,5','1 000','1\u00a0000','1\u202f000','1e3','+1','75kg','1.2mg','1.','1,','.','-','--2','1/2','1..2','Infinity','NaN',''];
for (const locale of ['en','es','fr','pt-BR']) {
 test(`${locale}: explicit decimal grammar, grouping and pasted text`, () => {
  for (const [raw,n] of valid) assert.equal(parseClinicalNumber(raw),n,raw);
  for (const raw of invalid) assert.equal(parseClinicalNumber(raw),null,raw);
 });
}
test('numeric prefill and explicit three-place decimals roundtrip without guessing', () => {
 for (const n of [0,1.234,75.555,-1.234,1000,.001,30,300]) assert.equal(parseClinicalNumber(formatClinicalInput(n)),n);
 assert.equal(parseClinicalNumber(NaN),null); assert.equal(parseClinicalNumber(Infinity),null);
 assert.equal(hasInvalidNumericValues({patient:{weight:NaN}}),true);
 assert.equal(hasInvalidNumericValues({levels:[{value:Infinity}]}),true);
 assert.equal(hasInvalidNumericValues({weight:70,optional:undefined}),false);
});

import { computeInitialRegimen } from '../lib/initialRegimen';
import { runExistingRegimenPipeline } from '../lib/pk/runExistingRegimenPipeline';
const patient={age:55,sex:'male' as const,weight_kg:70,height_cm:170,serum_creatinine_mg_dl:1.2};
test('point/comma canonical inputs preserve initial and existing-regimen outputs across locales',()=>{
 const run=(scr:number)=>runExistingRegimenPipeline({patient:{...patient,serum_creatinine_mg_dl:scr},regimen:{dose_mg:1000,interval_hours:12,infusion_duration_hours:1},levels:[{value_mcg_ml:12,collection_time:'',time_since_last_dose_hours:3}]});
 for(const locale of ['en','es','fr','pt-BR']) for(const raw of ['1.2','1,2']) {
  const scr=parseClinicalNumber(raw)!;
  assert.deepEqual(computeInitialRegimen({...patient,serum_creatinine_mg_dl:scr}),computeInitialRegimen(patient),locale);
  assert.deepEqual(run(scr),run(1.2),locale);
 }
});

import { clinicalDraftReplacer, clinicalDraftReviver } from '../lib/parseClinicalNumber';
test('interrupted invalid draft cannot restore an optional malformed field as null', () => {
 const saved=JSON.stringify({patient:{height_cm:NaN,weight_kg:70},regimen:{loading_to_maintenance_hours:NaN}},clinicalDraftReplacer);
 const restored=JSON.parse(saved,clinicalDraftReviver);
 assert.equal(hasInvalidNumericValues(restored),true);
 assert.ok(Number.isNaN(restored.patient.height_cm));
 assert.ok(Number.isNaN(restored.regimen.loading_to_maintenance_hours));
 assert.equal(restored.patient.weight_kg,70);
});
