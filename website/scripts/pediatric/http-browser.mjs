/** Isolated fixture-only HTTP/browser test for the pediatric research preview.
 * Never reads an application DB or .env file. Run from website/:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/pediatric/http-browser.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const { encode } = require('next-auth/jwt');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = process.cwd();
assert(fs.existsSync(path.join(source,'src/lib/pediatric/access.ts')));
assert(!fs.existsSync('/data'), 'Refuse fixture run when production /data exists');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(),'pediatric-auth-fixture-'));
for (const name of ['src','public','package.json','tsconfig.json','next-env.d.ts','next.config.js','postcss.config.js','tailwind.config.ts']) {
  if(fs.existsSync(path.join(source,name))) fs.cpSync(path.join(source,name),path.join(fixture,name),{recursive:true});
}
fs.symlinkSync(fs.realpathSync('node_modules'),path.join(fixture,'node_modules'),'dir');
fs.mkdirSync(path.join(fixture,'data'));
const db = new Database(path.join(fixture,'data/users.db'));
// Copy only schema text from source code, never an existing database.
const code = fs.readFileSync('src/lib/db.ts','utf8');
const schema = code.match(/CREATE TABLE IF NOT EXISTS users \([\s\S]*?\n    \);/)[0];
db.exec(schema);
for(const q of ['ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0','ALTER TABLE users ADD COLUMN mfa_verified_at TEXT','ALTER TABLE users ADD COLUMN mfa_verified_session_token TEXT']) db.exec(q);
const now = Date.now();
const date = ms => new Date(ms).toISOString().replace('T',' ').slice(0,19);
const insert = db.prepare(`INSERT INTO users (id,username,email,password_hash,full_name,credentials,role,status,session_token,last_login,mfa_enabled,mfa_verified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
for(const [id,role,status,mfa,verified] of [[1,'admin','active',0,null],[2,'pharmacist','active',0,null],[3,'admin','disabled',0,null],[4,'admin','active',1,null],[5,'admin','active',1,date(now-60000)]]) {
  insert.run(id,`fixture${id}`,`fixture${id}@example.invalid`,'NO_LOGIN_PASSWORD','Synthetic fixture','Fixture',role,status,`fixture-session-${id}`,date(now-120000),mfa,verified);
}
db.prepare("UPDATE users SET mfa_verified_session_token=session_token WHERE id=5").run();
const secret=randomBytes(32).toString('hex');
const port=process.env.PEDIATRIC_TEST_PORT || '3217';
const base=`http://127.0.0.1:${port}`;
const log=fs.openSync(path.join(fixture,'server.log'),'w');
// Explicit environment allowlist: never inherit credentials, mail, billing, or production config.
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','-H','127.0.0.1','-p',port],{cwd:fixture,env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'development',NEXTAUTH_SECRET:secret,NEXTAUTH_URL:base,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_OPEN_ACCESS:'true'},stdio:['ignore',log,log]});
let browser; const results=[];
const cookie=async(id,overrides={})=>encode({secret,token:{id:String(id),role:id===2?'pharmacist':'admin',sessionToken:`fixture-session-${id}`,lastActivity:now,mfaPending:id===4,mfaVerified:id===5,...overrides},maxAge:600});
const tokens={admin:await cookie(1),pharmacist:await cookie(2),disabled:await cookie(3),pendingMfa:await cookie(4),verifiedMfa:await cookie(5),expiredActivity:await cookie(1,{lastActivity:now-3600001}),forged:await encode({secret:'wrong-signing-key',token:{id:'1',role:'admin'},maxAge:600})};
async function request(name,token,method='GET',target='/api/admin/pediatric',extra={},body,ack) {
  const cookies=[token?`next-auth.session-token=${token}`:null,ack?`pediatric_research_ack=${ack}`:null].filter(Boolean).join('; ');
  const r=await fetch(base+target,{method,redirect:'manual',headers:{...(cookies?{cookie:cookies}:{ }),...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
  const text=await r.text(); return {r,body:text};
}
const ACK_VERSION=fs.readFileSync('src/lib/pediatric/colin2019/manifest.ts','utf8').match(/PEDIATRIC_ACK_STATEMENT_VERSION = "([^"]+)"/)[1];
async function acknowledge(token,body={acknowledge:true,version:ACK_VERSION}) {
  const {r,body:text}=await request('ack',token,'POST','/api/admin/pediatric/acknowledge',{},body);
  const setCookie=r.headers.get('set-cookie')||''; const m=setCookie.match(/pediatric_research_ack=([^;]*)/);
  return {r,text,ack:m?m[1]:null,setCookie};
}
// Synthetic request bodies (no real patient).
const T0=Date.UTC(2026,9,28,8,0,0); const iso=h=>new Date(T0+h*3600000).toISOString();
const child={patient:{postnatal_age:{value:6,unit:'years'},weight:{value:20,unit:'kg'},serum_creatinine:{value:0.4,unit:'mg/dL'}},regimen:{dose_mg:300,interval_hours:6,infusion_minutes:60}};
const childLevels={...child,regimen:{...child.regimen,next_dose_start:iso(36)},doses:[0,6,12,18,24,30].map(h=>({start:iso(h),dose_mg:300,infusion_minutes:60})),levels:[{time:iso(32),concentration_mg_l:22},{time:iso(35.5),concentration_mg_l:9}]};
const neonate={patient:{postnatal_age:{value:10,unit:'days'},gestational_age_weeks:32,weight:{value:1500,unit:'g'},serum_creatinine:{value:0.64,unit:'mg/dL'}},regimen:{dose_mg:22,interval_hours:12,infusion_minutes:60}};
try {
  let ready=false;
  for(let i=0;i<120;i++) { assert(server.exitCode === null,'fixture server exited; inspect server.log'); try {await fetch(base+'/api/admin/pediatric');ready=true;break;}catch{} await new Promise(r=>setTimeout(r,500)); }
  assert(ready,'server ready');
  // Authorization matrix: GET status; POST with no body (allowed users are stopped by the missing acknowledgement → 403 acknowledgement_required; everyone else is denied before that).
  for(const [name,token,expected] of [['anonymous',null,401],['admin',tokens.admin,200],['pharmacist',tokens.pharmacist,403],['disabled',tokens.disabled,403],['pending MFA',tokens.pendingMfa,403],['verified MFA',tokens.verifiedMfa,200],['expired activity',tokens.expiredActivity,403],['forged JWT',tokens.forged,401]]) {
    for(const method of ['GET','POST']) {const {r,body}=await request(name,token,method); assert.equal(r.status,expected===200&&method==='POST'?403:expected,`${name} ${method}: ${body}`); if(expected===200){assert.match(r.headers.get('cache-control'),/no-store/); if(method==='GET')assert.match(body,/"acknowledged":false/); else assert.match(body,/acknowledgement_required/);} results.push(`${name} ${method}: ${r.status}`);}
  }
  // Acknowledgement endpoint: only a verified admin can acknowledge, only with an explicit JSON body of the current statement version.
  for(const [name,token,expected] of [['anonymous',null,401],['pharmacist',tokens.pharmacist,403],['disabled',tokens.disabled,403],['pending MFA',tokens.pendingMfa,403],['expired activity',tokens.expiredActivity,403],['forged JWT',tokens.forged,401]]) {
    const a=await acknowledge(token); assert.equal(a.r.status,expected,`${name} acknowledge: ${a.text}`); assert.equal(a.ack,null); results.push(`${name} acknowledge: ${a.r.status}, no cookie`);
  }
  { const a=await acknowledge(tokens.admin,{acknowledge:false,version:ACK_VERSION}); assert.equal(a.r.status,400); assert.equal(a.ack,null); results.push('admin acknowledge=false: 400, no cookie'); }
  { const a=await acknowledge(tokens.admin,{acknowledge:true,version:'0000-00-00.0'}); assert.equal(a.r.status,409); assert.equal(a.ack,null); results.push('admin stale statement version: 409, no cookie'); }
  { const {r}=await request('ack form-encoded',tokens.admin,'POST','/api/admin/pediatric/acknowledge',{'Content-Type':'application/x-www-form-urlencoded'},'acknowledge=true'); assert.equal(r.status,400); results.push('admin form-encoded acknowledge (cross-site shape): 400'); }
  const adminAck=await acknowledge(tokens.admin); assert.equal(adminAck.r.status,200); assert(adminAck.ack,'admin acknowledgement cookie issued'); assert.match(adminAck.setCookie,/HttpOnly/i); assert.match(adminAck.setCookie,/SameSite=strict/i); assert.match(adminAck.setCookie,/Path=\/api\/admin\/pediatric/); results.push('admin acknowledge: 200, httpOnly strict path-scoped cookie');
  const mfaAck=await acknowledge(tokens.verifiedMfa); assert.equal(mfaAck.r.status,200); assert(mfaAck.ack); results.push('verified-MFA admin acknowledge: 200');
  { const {r,body}=await request('admin status after ack',tokens.admin,'GET','/api/admin/pediatric',{},undefined,adminAck.ack); assert.equal(r.status,200); assert.match(body,/"acknowledged":true/); results.push('admin status after acknowledgement: acknowledged'); }
  // The acknowledgement is bound to the user and login session: another admin's cookie, or the cookie after re-login/revocation, is refused.
  { const {r,body}=await request('ack of another user',tokens.admin,'POST','/api/admin/pediatric',{},child,mfaAck.ack); assert.equal(r.status,403); assert.match(body,/acknowledgement_required/); assert.match(body,/wrong_user/); results.push('admin calculation with another admin\'s acknowledgement cookie: 403'); }
  { const {r,body}=await request('tampered ack',tokens.admin,'POST','/api/admin/pediatric',{},child,adminAck.ack.slice(0,-3)+'abc'); assert.equal(r.status,403); assert.match(body,/bad_signature|malformed/); results.push('admin calculation with tampered acknowledgement: 403'); }
  { db.exec("UPDATE users SET session_token='fixture-session-1-relogin' WHERE id=1"); const relogin=await cookie(1,{sessionToken:'fixture-session-1-relogin'}); const {r,body}=await request('ack after re-login',relogin,'POST','/api/admin/pediatric',{},child,adminAck.ack); assert.equal(r.status,403); assert.match(body,/wrong_session/); db.exec("UPDATE users SET session_token='fixture-session-1' WHERE id=1"); results.push('admin calculation after re-login with the old acknowledgement: 403'); }
  let {r}=await request('spoofed headers',null,'GET','/api/admin/pediatric',{'x-user-role':'admin','x-user-id':'1'});assert.equal(r.status,401);results.push('spoofed identity headers: denied');
  // Calculation requests: only a current, active, verified system admin receives a result.
  for(const [name,token,expected] of [['anonymous',null,401],['pharmacist',tokens.pharmacist,403],['disabled',tokens.disabled,403],['pending MFA',tokens.pendingMfa,403],['expired activity',tokens.expiredActivity,403],['forged JWT',tokens.forged,401]]) {
    const {r,body}=await request(name,token,'POST','/api/admin/pediatric',{},childLevels,adminAck.ack); assert.equal(r.status,expected,`${name} calculation: ${body}`); assert.doesNotMatch(body,/estimate_basis|steady_state_auc24/); results.push(`${name} calculation with valid body and the admin's acknowledgement cookie: ${r.status}, no result`);
  }
  { const {r,body}=await request('admin without ack',tokens.admin,'POST','/api/admin/pediatric',{},childLevels); assert.equal(r.status,403); assert.match(body,/acknowledgement_required/); assert.doesNotMatch(body,/estimate_basis/); results.push('admin calculation without acknowledgement: 403, no result'); }
  for(const [name,sql] of [['demoted',"UPDATE users SET role='pharmacist' WHERE id=1"],['revoked',"UPDATE users SET role='admin', session_token=NULL WHERE id=1"]]) {
    db.exec(sql); const {r,body}=await request(name,tokens.admin,'POST','/api/admin/pediatric',{},childLevels,adminAck.ack);assert.equal(r.status,403);assert.doesNotMatch(body,/estimate_basis/);results.push(`${name} existing signed cookie + acknowledgement, calculation: denied`);
  }
  db.exec("UPDATE users SET role='admin',session_token='fixture-session-1' WHERE id=1");
  for(const [name,body,status,check] of [
    ['child prior-only',child,200,j=>j.status==='ok'&&j.estimate_basis==='prior_only'&&j.research_only===true&&j.formulation==='fitted_nonmem'&&Array.isArray(j.curve)],
    ['child two levels',childLevels,200,j=>j.estimate_basis==='posterior_two_level'&&j.posterior.exposure.steady_state_auc24>0&&j.posterior.exposure.forecast_auc24_next24h>0&&j.posterior.exposure.steady_state_auc24_interval.lower<j.posterior.exposure.steady_state_auc24],
    ['preterm neonate (grams, GA 32 wk)',neonate,200,j=>j.estimate_basis==='prior_only'&&Math.abs(j.derived.pma_weeks-33.43)<0.01&&j.derived.weight_kg===1.5],
    ['ECMO',{...child,patient:{...child.patient,ecmo:true}},422,j=>j.status==='unsupported'&&'patient.ecmo' in j.field_errors],
    ['renal replacement therapy',{...child,patient:{...child.patient,renal_replacement_therapy:true}},422,j=>j.status==='unsupported'],
    ['age 18 years',{...child,patient:{...child.patient,postnatal_age:{value:18,unit:'years'}}},422,j=>'patient.postnatal_age' in j.field_errors],
    ['age 21 years',{...child,patient:{...child.patient,postnatal_age:{value:21,unit:'years'}}},422,j=>'patient.postnatal_age' in j.field_errors],
    ['age 17.999 years',{...child,patient:{...child.patient,postnatal_age:{value:17.999,unit:'years'},weight:{value:70,unit:'kg'}}},200,j=>j.status==='ok'],
    ['infant without gestational age',{...child,patient:{...child.patient,postnatal_age:{value:3,unit:'months'},weight:{value:5,unit:'kg'}}},400,j=>'patient.gestational_age_weeks' in j.field_errors],
    ['dataset gap (12 months)',{...child,patient:{...child.patient,postnatal_age:{value:12,unit:'months'},gestational_age_weeks:40,weight:{value:9,unit:'kg'}}},422,j=>'patient.postnatal_age' in j.field_errors&&/Oudin/.test(j.field_errors['patient.postnatal_age'])],
    ['dataset gap with acknowledge flag (still refused)',{...child,patient:{...child.patient,postnatal_age:{value:12,unit:'months'},gestational_age_weeks:40,weight:{value:9,unit:'kg'},acknowledge_dataset_gap:true}},422,j=>'patient.postnatal_age' in j.field_errors],
    ['term infant 40 days (just below the gap)',{...child,patient:{...child.patient,postnatal_age:{value:40,unit:'days'},gestational_age_weeks:40,weight:{value:4,unit:'kg'}},regimen:{dose_mg:60,interval_hours:8,infusion_minutes:60}},200,j=>j.derived.pma_years<0.88],
    ['term child 662 days (just above the gap)',{...child,patient:{...child.patient,postnatal_age:{value:662,unit:'days'},gestational_age_weeks:40,weight:{value:12,unit:'kg'}}},200,j=>j.derived.pma_years>2.58],
    ['6-year-old PMA convention',child,200,j=>Math.abs(j.derived.pma_years-(6+40/52))<1e-12&&j.derived.age_convention==='PMA_years = postnatal_days/365.25 + gestational_weeks/52'],
    // Review of acb9984: input-validation and timing defects (INPUT-VALIDATION.md)
    ['age unit "toString" (inherited property name)',{...child,patient:{...child.patient,postnatal_age:{value:6,unit:'toString'}}},400,j=>j.status==='invalid'&&'patient.postnatal_age' in j.field_errors],
    ['age unit "constructor"',{...child,patient:{...child.patient,postnatal_age:{value:6,unit:'constructor'}}},400,j=>'patient.postnatal_age' in j.field_errors],
    ['age unit "__proto__" via JSON',JSON.stringify(child).replace('"unit":"years"','"unit":"__proto__"'),400,j=>'patient.postnatal_age' in j.field_errors],
    ['weight unit "lb"',{...child,patient:{...child.patient,weight:{value:44,unit:'lb'}}},400,j=>'patient.weight' in j.field_errors],
    ['null weight',{...child,patient:{...child.patient,weight:{value:null,unit:'kg'}}},400,j=>'patient.weight' in j.field_errors],
    ['string dose',{...child,regimen:{...child.regimen,dose_mg:'300'}},400,j=>'regimen.dose_mg' in j.field_errors],
    ['dose Infinity via JSON (parses as null)',JSON.stringify(child).replace('"dose_mg":300','"dose_mg":null'),400,j=>'regimen.dose_mg' in j.field_errors],
    ['February 30 administration',{...child,doses:[{start:'2026-02-30T08:00:00Z',dose_mg:300,infusion_minutes:60}]},400,j=>/Day 30 does not exist/.test(j.field_errors['doses[0].start'])],
    ['February 29 2026 (not a leap year)',{...child,doses:[{start:'2026-02-29T08:00:00Z',dose_mg:300,infusion_minutes:60}]},400,j=>/not a leap year/.test(j.field_errors['doses[0].start'])],
    ['February 29 2024 (leap day accepted)',{...child,doses:[{start:'2024-02-29T08:00:00Z',dose_mg:300,infusion_minutes:60}]},200,j=>j.timeline.origin==='2024-02-29T08:00:00.000Z'],
    ['24:00 level time',{...child,doses:[{start:iso(0),dose_mg:300,infusion_minutes:60}],levels:[{time:'2026-10-28T24:00:00Z',concentration_mg_l:10}]},400,j=>/Hour 24/.test(j.field_errors['levels[0].time'])],
    ['offset +25:00',{...child,doses:[{start:'2026-10-28T08:00:00+25:00',dose_mg:300,infusion_minutes:60}]},400,j=>/offset/.test(j.field_errors['doses[0].start'])],
    ['explicit -05:00 offset honoured',{...child,doses:[{start:'2026-10-28T03:00:00-05:00',dose_mg:300,infusion_minutes:60}]},200,j=>j.timeline.origin==='2026-10-28T08:00:00.000Z'],
    ['level 48 h after a single dose (forecast would precede it)',{...child,doses:[{start:iso(0),dose_mg:300,infusion_minutes:60}],levels:[{time:iso(48),concentration_mg_l:3}]},400,j=>/Enter the next planned dose start time explicitly/.test(j.field_errors['regimen.next_dose_start'])],
    ['same, repaired with next_dose_start after the level',{...child,regimen:{...child.regimen,next_dose_start:iso(50)},doses:[{start:iso(0),dose_mg:300,infusion_minutes:60}],levels:[{time:iso(48),concentration_mg_l:3}]},200,j=>j.estimate_basis==='posterior_one_level'&&j.timeline.next_dose_anchor==='regimen.next_dose_start'&&j.timeline.forecast_window.start_hours===50&&j.timeline.last_level_hours===48],
    ['next_dose_start before the last infusion ends',{...child,regimen:{...child.regimen,next_dose_start:iso(0.5)},doses:[{start:iso(0),dose_mg:300,infusion_minutes:60}]},400,j=>'regimen.next_dose_start' in j.field_errors],
    ['duplicate dose time',{...child,doses:[0,6,6].map(h=>({start:iso(h),dose_mg:300,infusion_minutes:60}))},400,j=>/duplicate/.test(j.field_errors['doses[2].start'])],
    ['out-of-order doses and levels (accepted by timestamp)',{...child,doses:[12,0,6].map(h=>({start:iso(h),dose_mg:300,infusion_minutes:60})),levels:[{time:iso(17.5),concentration_mg_l:9},{time:iso(14),concentration_mg_l:20}]},200,j=>j.estimate_basis==='posterior_two_level'&&j.timeline.last_dose_start_hours===12&&j.timeline.next_planned_dose_hours===18],
    ['infusion longer than interval',{...child,regimen:{dose_mg:300,interval_hours:6,infusion_minutes:400}},400,j=>'regimen.infusion_minutes' in j.field_errors],
    // Review round 3: documented hard limits, verification gate, review items, default-anchor overlap, audit rows (CLINICAL-REVIEW.md)
    ['two-year-old at 0.4 kg (unusual for age: verification required, no result)',{...child,patient:{...child.patient,postnatal_age:{value:2,unit:'years'},weight:{value:0.4,unit:'kg'}}},409,j=>j.status==='needs_verification'&&j.input_review.some(it=>it.category==='verify'&&/WHO Child Growth Standards 2006/.test(it.source))&&'patient.weight' in j.field_errors],
    ['two-year-old at 0.4 kg, inputs_verified (computes; review items retained)',{...child,patient:{...child.patient,postnatal_age:{value:2,unit:'years'},weight:{value:0.4,unit:'kg'}},inputs_verified:true},200,j=>j.input_review.verified===true&&j.input_review.items.some(it=>it.category==='verify')&&j.input_review.items.some(it=>it.category==='outside_model_population')],
    ['ten-day-old at 9 kg (verification required)',{...child,patient:{...child.patient,postnatal_age:{value:10,unit:'days'},gestational_age_weeks:40,weight:{value:9,unit:'kg'}}},409,j=>j.status==='needs_verification'],
    ['ten-day-old at 11.1 kg (above the heaviest documented birth: refused)',{...child,patient:{...child.patient,postnatal_age:{value:10,unit:'days'},gestational_age_weeks:40,weight:{value:11.1,unit:'kg'}}},400,j=>/heaviest documented human birth weight/.test(j.field_errors['patient.weight'])],
    ['190 g (below the smallest documented survivor: refused)',{...child,patient:{...child.patient,postnatal_age:{value:5,unit:'days'},gestational_age_weeks:24,weight:{value:190,unit:'g'}}},400,j=>/smallest documented surviving birth weight/.test(j.field_errors['patient.weight'])],
    ['two-year-old at 8.6 kg (outside model population: reported, computes)',{...child,patient:{...child.patient,postnatal_age:{value:2,unit:'years'},weight:{value:8.6,unit:'kg'}}},200,j=>j.input_review.items.some(it=>it.category==='outside_model_population'&&/8\.7-160 kg/.test(it.message))&&!j.input_review.items.some(it=>it.category==='verify')],
    ['unstable renal function (clinical validity unknown, sources cited)',{...child,patient:{...child.patient,unstable_renal_function:true}},200,j=>j.input_review.items.some(it=>it.category==='clinical_validity_unknown'&&/KDIGO 2012/.test(it.source))],
    ['12-hour recorded infusion with q6h regimen and no next_dose_start (default anchor would overlap: refused)',{...child,doses:[{start:iso(0),dose_mg:300,infusion_minutes:720}]},400,j=>/Enter the next planned dose start time explicitly/.test(j.field_errors['regimen.next_dose_start'])],
    ['12-hour infusion with explicit next_dose_start at hour 6 (refused)',{...child,regimen:{...child.regimen,next_dose_start:iso(6)},doses:[{start:iso(0),dose_mg:300,infusion_minutes:720}]},400,j=>/before the last recorded infusion ends/.test(j.field_errors['regimen.next_dose_start'])],
    ['12-hour infusion with explicit next_dose_start at hour 12 (accepted)',{...child,regimen:{...child.regimen,next_dose_start:iso(12)},doses:[{start:iso(0),dose_mg:300,infusion_minutes:720}]},200,j=>j.timeline.next_planned_dose_hours===12&&j.timeline.doses[0].end===iso(12)],
    ['unordered rows keep their row numbers in the audit timeline',{...child,doses:[12,0,6].map(h=>({start:iso(h),dose_mg:300,infusion_minutes:60})),levels:[{time:iso(17.5),concentration_mg_l:9},{time:iso(14),concentration_mg_l:20}]},200,j=>j.timeline.doses.map(d=>d.row).join()==='2,3,1'&&j.timeline.levels.map(l=>l.row).join()==='2,1'],
    ['DST fold instants from the browser flow are accepted and preserved (-04:00 then -05:00)',{...child,doses:[{start:'2026-11-01T00:30:00-04:00',dose_mg:300,infusion_minutes:30},{start:'2026-11-01T01:30:00-05:00',dose_mg:300,infusion_minutes:30}]},200,j=>j.timeline.doses[0].start==='2026-11-01T04:30:00.000Z'&&j.timeline.doses[1].start==='2026-11-01T06:30:00.000Z'],
    ['6574 days (17.999 y) accepted',{...child,patient:{...child.patient,postnatal_age:{value:6574,unit:'days'},weight:{value:70,unit:'kg'}}},200,j=>j.status==='ok'],
    ['6575 days (18.001 y) refused',{...child,patient:{...child.patient,postnatal_age:{value:6575,unit:'days'},weight:{value:70,unit:'kg'}}},422,j=>'patient.postnatal_age' in j.field_errors],
    ['creatinine umol/L',{...child,patient:{...child.patient,serum_creatinine:{value:35.36,unit:'umol/L'}}},200,j=>Math.abs(j.derived.scr_mg_dl-0.4)<1e-9],
    ['levels without doses',{...child,levels:childLevels.levels},400,j=>'doses' in j.field_errors],
    ['ambiguous timestamp',{...childLevels,doses:[{start:'2026-10-28T08:00:00',dose_mg:300,infusion_minutes:60}]},400,j=>'doses[0].start' in j.field_errors],
    ...[undefined,null,'','   '].flatMap(value => [
      [`missing dose time ${JSON.stringify(value)}`, {...childLevels,doses:[{start:value,dose_mg:300,infusion_minutes:60}]},400,j=>'doses[0].start' in j.field_errors],
      [`missing sample time ${JSON.stringify(value)}`, {...childLevels,levels:[{time:value,concentration_mg_l:10}]},400,j=>'levels[0].time' in j.field_errors],
      [`missing planned time ${JSON.stringify(value)}`, {...childLevels,regimen:{...childLevels.regimen,next_dose_start:value}},400,j=>'regimen.next_dose_start' in j.field_errors],
    ]),
    ['invalid JSON','{not json',400,j=>j.status==='invalid'],
    ['oversized body',JSON.stringify(child)+' '.repeat(70000),413,j=>j.status==='invalid'],
  ]) {
    const fixtureBody = status === 200 && body?.doses?.length && !body.regimen.next_dose_start ? {...body,regimen:{...body.regimen,next_dose_start:new Date(Math.max(...body.doses.map(d=>Date.parse(d.start)))+body.regimen.interval_hours*3600000).toISOString()}} : body;
    const {r,body:text}=await request(name,tokens.admin,'POST','/api/admin/pediatric',{},fixtureBody,adminAck.ack); assert.equal(r.status,status,`${name}: ${text.slice(0,300)}`); const j=JSON.parse(text); assert(check(j),`${name} payload check: ${text.slice(0,300)}`); assert.match(r.headers.get('cache-control'),/no-store/);
    if(status>=400){assert.doesNotMatch(text,/estimate_basis|candidate_regimens|steady_state_auc24|"prior"|"posterior"/,`${name}: error must carry no dosing result`); assert(!/NaN|Infinity/.test(text)); if(status===409)assert.doesNotMatch(text,/"parameters"|"exposure"/);}
    else {assert(!/NaN|Infinity/.test(text),`${name}: result contains NaN/Infinity`); for(const k of ['pma_years','weight_kg','scr_mg_dl'])assert(typeof j.derived[k]==='number'&&Number.isFinite(j.derived[k]),`${name}: derived.${k}`); for(const k of ['CL','V1','V2','Q'])assert(Number.isFinite(j.prior.parameters[k]),`${name}: prior ${k}`); assert(Number.isFinite(j.prior.exposure.steady_state_auc24));}
    results.push(`admin ${name}: ${r.status}`);
  }
  // Regression: byte limits apply after authorization/acknowledgement, before calculations.
  { const {r}=await request('UTF8 oversized',tokens.admin,'POST','/api/admin/pediatric',{}, {...child,padding:'€'.repeat(30000)},adminAck.ack);assert.equal(r.status,413);results.push('UTF8 90KB calculation: 413'); }
  { const a=await acknowledge(tokens.admin,{acknowledge:true,version:ACK_VERSION,padding:'€'.repeat(30000)});assert.equal(a.r.status,413);results.push('UTF8 90KB acknowledgement: 413'); }
  // Equal timestamps accepted only with matching session proof; timestamp-only proof is denied.
  db.exec("UPDATE users SET mfa_verified_at=last_login WHERE id=5");
  assert.equal((await request('same-second bound MFA',tokens.verifiedMfa)).r.status,200);
  db.exec("UPDATE users SET mfa_verified_session_token='previous-session' WHERE id=5");
  assert.equal((await request('stale-session MFA',tokens.verifiedMfa)).r.status,403);
  db.exec("UPDATE users SET mfa_verified_session_token=session_token WHERE id=5");
  const pending5=await cookie(5,{mfaPending:true,mfaVerified:false});
  assert.equal(JSON.parse((await request('bound MFA refresh',pending5,'GET','/api/auth/session')).body).user.mfaPending,false);
  db.exec("UPDATE users SET mfa_verified_session_token='previous-session' WHERE id=5");
  assert.equal(JSON.parse((await request('stale MFA refresh',pending5,'GET','/api/auth/session')).body).user.mfaPending,true);
  db.exec("UPDATE users SET mfa_verified_session_token=session_token WHERE id=5");
  results.push('MFA same-second binding accepted; previous-session proof denied by pediatric gate and session refresh');
  { const {generateSecret,generateSync}=require('otplib');const mfaSecret=generateSecret();
    db.prepare("UPDATE users SET mfa_secret=?, mfa_verified_at=NULL, mfa_verified_session_token=NULL WHERE id=4").run(mfaSecret);
    const code=generateSync({secret:mfaSecret});
    assert.equal((await request('invalid MFA code',tokens.pendingMfa,'POST','/api/auth/mfa/verify',{}, {token:'abcdef'})).r.status,401);
    db.exec("UPDATE users SET session_token='changed-session' WHERE id=4");
    assert.equal((await request('stale MFA session',tokens.pendingMfa,'POST','/api/auth/mfa/verify',{}, {token:code})).r.status,401);
    assert.equal(db.prepare('SELECT mfa_verified_session_token FROM users WHERE id=4').get().mfa_verified_session_token,null);
    db.exec("UPDATE users SET session_token='fixture-session-4' WHERE id=4");
    assert.equal((await request('valid MFA current session',tokens.pendingMfa,'POST','/api/auth/mfa/verify',{}, {token:generateSync({secret:mfaSecret})})).r.status,200);
    assert.equal(db.prepare('SELECT mfa_verified_session_token FROM users WHERE id=4').get().mfa_verified_session_token,'fixture-session-4');
    assert.equal((await request('MFA verified current session',tokens.pendingMfa)).r.status,200);
    db.exec("UPDATE users SET mfa_secret=NULL,mfa_verified_at=NULL,mfa_verified_session_token=NULL WHERE id=4");
    results.push('real MFA verify route: invalid code and stale session refused, valid code writes exact session proof, pediatric access allowed');
  }
  browser=await chromium.launch({headless:true});
  for (const [zone,fallback,offset] of [['Etc/GMT+5',false,'-05:00'],['Europe/Paris',true,'+01:00']]) {
    const context=await browser.newContext({timezoneId:zone});
    await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
    if(fallback)await context.addInitScript(()=>{Intl.supportedValuesOf=undefined;});
    await context.addCookies([{name:'next-auth.session-token',value:tokens.admin,url:base},{name:'pediatric_research_ack',value:adminAck.ack,url:base}]);
    const page=await context.newPage();await page.goto(base+'/admin/dashboard/pediatric',{waitUntil:'networkidle'});
    await page.getByLabel('Time zone').waitFor();assert.equal(await page.getByLabel('Time zone').inputValue(),zone);
    assert.equal(await page.getByLabel('Time zone').locator('option:checked').innerText(),zone);
    await page.getByRole('button',{name:'+ Add dose'}).click();await page.getByLabel('Dose 1 start').fill('0026-10-29T08:00');
    await page.getByRole('button',{name:'Calculate (research only)'}).click();assert.equal(await page.getByRole('heading',{name:'Result',exact:true}).count(),0);
    await page.getByLabel('Dose 1 start').fill('2026-10-29T08:00');await page.getByLabel('Next planned dose start').fill('2026-10-29T14:00');
    const pending=page.waitForRequest(req=>req.url().endsWith('/api/admin/pediatric')&&req.method()==='POST');
    await page.getByRole('button',{name:'Calculate (research only)'}).click();const sent=JSON.parse((await pending).postData());
    assert.equal(sent.doses[0].start,'2026-10-29T08:00:00'+offset);await page.getByRole('heading',{name:'Result',exact:true}).waitFor();
    results.push(`browser ${zone} fallback=${fallback}: displayed zone and submitted offset match; year 0026 refused`);await context.close();
  }
  const searchBody={...child,research_regimen_context:{serious_mrsa_mic1:true,normal_stable_renal_function:true}};
  {const {r,body}=await request('research shortlist',tokens.admin,'POST','/api/admin/pediatric',{},searchBody,adminAck.ack);assert.equal(r.status,200);assert.equal(JSON.parse(body).research_regimens.status,'available');results.push('admin research shortlist: available');}
  for(const [name,token,status] of [['anonymous',null,401],['nonadmin',tokens.pharmacist,403]]){const {r,body}=await request(name,token,'POST','/api/admin/pediatric',{},searchBody,adminAck.ack);assert.equal(r.status,status);assert.doesNotMatch(body,/research_regimens/);results.push(`${name} research shortlist denied`);}
  {
    const context=await browser.newContext({timezoneId:'UTC'});
    await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
    await context.addCookies([{name:'next-auth.session-token',value:tokens.admin,url:base},{name:'pediatric_research_ack',value:adminAck.ack,url:base}]);
    const page=await context.newPage();await page.goto(base+'/admin/dashboard/pediatric',{waitUntil:'networkidle'});
    const search=page.getByRole('button',{name:'Find research regimens'});await search.waitFor();assert.equal(await search.isDisabled(),true);
    await page.getByLabel('Serious MRSA research scenario, MIC assumed 1 mg/L').check();
    await page.getByLabel('Normal, stable renal function independently confirmed for this research scenario').check();
    await page.getByRole('button',{name:'+ Add dose'}).click();await page.getByLabel('Dose 1 start').fill('2026-10-29T08:00');await page.getByLabel('Next planned dose start').fill('2026-10-29T14:00');
    await search.click();await page.getByRole('heading',{name:'Research regimen comparison'}).waitFor();
    await page.getByRole('heading',{name:'Research regimen comparison'}).scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(source,'docs/pediatric/research-regimens.png'),fullPage:true});
    await page.getByRole('button',{name:'Current entered regimen',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Apply selected research regimen'}).count(),0);
    await page.getByRole('button',{name:'400 mg q8h',exact:true}).click();await page.getByRole('button',{name:'Apply selected research regimen'}).click();
    assert.equal(await page.getByLabel('Regimen dose mg').inputValue(),'400');assert.equal(await page.getByLabel('Regimen interval hours').inputValue(),'8');assert.equal(await page.getByLabel('Regimen infusion minutes').inputValue(),'60');
    assert.equal(await page.getByLabel('Dose 1 start').inputValue(),'2026-10-29T08:00');assert.equal(await page.getByLabel('Next planned dose start').inputValue(),'2026-10-29T14:00');assert.equal(await page.getByRole('heading',{name:'Research regimen comparison'}).count(),0);
    await search.click();await page.getByRole('heading',{name:'Research regimen comparison'}).waitFor();
    await page.getByLabel('Weight',{exact:true}).fill('21');assert.equal(await page.getByRole('heading',{name:'Research regimen comparison'}).count(),0);assert.equal(await search.isDisabled(),true);
    await page.getByLabel('Serious MRSA research scenario, MIC assumed 1 mg/L').check();
    await page.getByLabel('Normal, stable renal function independently confirmed for this research scenario').check();
    let release; const held=new Promise(resolve=>{release=resolve;}); let intercepted; const seen=new Promise(resolve=>{intercepted=resolve;});
    await page.route('**/api/admin/pediatric',async route=>{if(route.request().method()==='POST'){intercepted();await held;}await route.continue();});
    await search.click();await seen;await page.getByLabel('Weight',{exact:true}).fill('22');release();await page.waitForLoadState('networkidle');
    assert.equal(await page.getByRole('heading',{name:'Research regimen comparison'}).count(),0,'late response cannot restore stale choices');
    results.push('browser delayed response: input changes prevent stale recommendations');
    results.push('browser shortlist: explicit assumptions, current comparison, q8 option, explicit apply preserves history/time, input changes invalidate options');
    await context.close();
  }
  for(const [name,token,allowed] of [['anonymous',null,false],['admin',tokens.admin,true],['pharmacist',tokens.pharmacist,false],['disabled',tokens.disabled,false],['pending MFA',tokens.pendingMfa,false],['verified MFA',tokens.verifiedMfa,true],['demoted',tokens.admin,false],['revoked',tokens.admin,false]]) {
    if(name==='demoted')db.exec("UPDATE users SET role='pharmacist' WHERE id=1");
    if(name==='revoked')db.exec("UPDATE users SET role='admin',session_token=NULL WHERE id=1");
    const context=await browser.newContext({viewport:{width:1280,height:1400},timezoneId:name==='admin'?'Asia/Tokyo':'America/New_York'});
    // Keep all browser traffic local, including fonts and analytics.
    await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
    if(token)await context.addCookies([{name:'next-auth.session-token',value:token,url:base}]);
    const page=await context.newPage();await page.goto(base+'/admin/dashboard/pediatric',{waitUntil:'networkidle'});
    const content=page.getByRole('heading',{name:'Vancomyzer Pediatric',exact:true});
    if(allowed) {
      await content.waitFor({timeout:20000});
      assert.match(await page.locator('body').innerText(),/Colin 2019/);
      assert.equal(await page.getByText('Research only — not independently clinically validated — not for patient care.',{exact:true}).count(),1);
      if(name==='admin') {
        // The form is hidden until the session acknowledgement; the server refuses calculations regardless.
        await page.getByRole('heading',{name:'Research acknowledgement for this session',exact:true}).waitFor({timeout:20000});
        assert.equal(await page.getByRole('button',{name:'Calculate (research only)'}).count(),0,'calculator hidden before acknowledgement');
        const bodyText=await page.locator('body').innerText(); assert.match(bodyText,/not been independently clinically validated/); assert.match(bodyText,/not treated as resolved/);
        const ackButton=page.getByRole('button',{name:'Acknowledge for this session'}); assert.equal(await ackButton.isDisabled(),true,'acknowledge button disabled until the box is ticked');
        await page.getByLabel('I have read and accept the research acknowledgement').check();
        await ackButton.click();
        await page.getByRole('button',{name:'Calculate (research only)'}).waitFor({timeout:20000});
        assert.equal(await page.getByRole('heading',{name:'Research acknowledgement for this session',exact:true}).count(),0);
        results.push('browser admin: acknowledgement panel shown first, calculator unlocked after acknowledging');
        // Submit the default synthetic 6-year-old (prior-only), then a refusal (ECMO).
        await page.getByRole('button',{name:'Calculate (research only)'}).click();
        await page.getByRole('heading',{name:'Result',exact:true}).waitFor({timeout:20000});
        const text=await page.locator('body').innerText();
        assert.match(text,/Population prior only/); assert.match(text,/Steady-state AUC24/); assert.match(text,/RESEARCH ONLY/); assert.match(text,/Research regimen comparison/); assert.match(text,/research candidate pending/);
        await page.screenshot({path:path.join(fixture,'admin-preview.png'),fullPage:true});
        await page.getByLabel('ECMO (excluded)').check();
        await page.getByRole('button',{name:'Calculate (research only)'}).click();
        await page.getByText('Outside the supported population; no calculation was performed.').waitFor({timeout:20000});
        assert.equal(await page.getByRole('heading',{name:'Result',exact:true}).count(),0);
        results.push('browser admin: prior-only result rendered, ECMO refused');
        // A 12-month-old in the dataset gap is refused in the browser too.
        await page.getByLabel('ECMO (excluded)').uncheck();
        // Explicit time-zone handling in the browser (browser zone is Asia/Tokyo here; the entries are declared as America/New_York).
        await page.getByLabel('Time zone').selectOption('America/New_York');
        await page.getByRole('button',{name:'+ Add dose'}).click();
        assert.equal(await page.getByLabel('Dose 1 start').inputValue(),'','new dose timestamp blank');
        assert.equal(await page.getByLabel('Next planned dose start').inputValue(),'','planned timestamp blank');
        await page.getByRole('button',{name:'+ Add level'}).click();
        assert.equal(await page.getByLabel('Level 1 time').inputValue(),'','new sample timestamp blank');
        await page.getByRole('button',{name:'Calculate (research only)'}).click();
        await page.getByText(/Resolve the highlighted date\/time entries first/).waitFor();
        assert.equal(await page.getByRole('heading',{name:'Result',exact:true}).count(),0);
        await page.getByRole('button',{name:'Remove'}).last().click();
        results.push('browser: dose, sample and planned timestamps start blank; missing timestamps yield no result');
        await page.getByLabel('Dose 1 start').fill('2026-03-08T02:30');
        await page.getByText(/02:30 does not exist in America\/New_York/).waitFor({timeout:10000});
        await page.getByRole('button',{name:'Calculate (research only)'}).click();
        await page.getByText(/Resolve the highlighted date\/time entries first/).waitFor({timeout:10000});
        assert.equal(await page.getByRole('heading',{name:'Result',exact:true}).count(),0,'no result while a non-existent local time is entered');
        await page.getByLabel('Dose 1 start').fill('2026-11-01T01:30');
        await page.getByText(/01:30 occurs twice in America\/New_York/).waitFor({timeout:10000});
        await page.getByLabel('Dose 1 offset').selectOption('-300');
        await page.getByText('= 2026-11-01T01:30:00-05:00 (UTC 2026-11-01T06:30:00Z)').waitFor({timeout:10000});
        await page.getByRole('button',{name:'Calculate (research only)'}).click();
        assert.equal(await page.getByRole('heading',{name:'Result',exact:true}).count(),0,'planned timestamp still required after resolving dose time');
        await page.getByLabel('Next planned dose start').fill('2026-11-01T07:30');
        await page.getByRole('button',{name:'+ Add dose'}).click();
        assert.equal(await page.getByLabel('Dose 2 start').inputValue(),'','subsequent dose does not copy or advance previous timestamp');
        await page.getByRole('button',{name:'Remove'}).last().click();
        let captured=null; page.on('request',req=>{ if(req.url().endsWith('/api/admin/pediatric')&&req.method()==='POST') captured=req.postData(); });
        await page.getByRole('button',{name:'Calculate (research only)'}).click();
        await page.getByRole('heading',{name:'Result',exact:true}).waitFor({timeout:20000});
        assert(captured&&JSON.parse(captured).regimen.next_dose_start==='2026-11-01T07:30:00-05:00','explicit planned time preserved');
        assert(captured&&JSON.parse(captured).doses[0].start==='2026-11-01T01:30:00-05:00','the chosen offset is sent verbatim');
        assert.match(await page.locator('body').innerText(),/2026-11-01T06:30:00Z/);
        results.push('browser admin (Tokyo browser zone, New York entries): DST gap refused inline, DST fold needs an explicit offset, exact instant preserved and displayed');
        // Unusual weight: the verification panel must appear before any result, then the verified calculation runs.
        await page.getByRole('button',{name:'Remove'}).first().click();
        await page.getByLabel('Next planned dose start').fill('');
        await page.getByLabel('Weight',{exact:true}).fill('0.4');
        await page.getByRole('button',{name:'Calculate (research only)'}).click();
        await page.getByRole('heading',{name:'Verify these inputs before any calculation',exact:true}).waitFor({timeout:20000});
        assert.equal(await page.getByRole('heading',{name:'Result',exact:true}).count(),0,'no result before verification');
        assert.match(await page.locator('body').innerText(),/VERIFY/);
        await page.getByLabel('I have verified the flagged values against the chart').check();
        await page.getByRole('button',{name:'Calculate with verified inputs (research only)'}).click();
        await page.getByRole('heading',{name:'Result',exact:true}).waitFor({timeout:20000});
        assert.match(await page.locator('body').innerText(),/flagged values verified by the administrator/);
        results.push('browser admin: unusual weight gated behind verification, then computed with the review retained');
        await page.getByLabel('Weight',{exact:true}).fill('20');
        await page.getByLabel('Postnatal age',{exact:true}).fill('12'); await page.getByLabel('Postnatal age unit').selectOption('months'); await page.getByLabel('Gestational age weeks').fill('40'); await page.getByLabel('Weight',{exact:true}).fill('9');
        await page.getByRole('button',{name:'Calculate (research only)'}).click();
        await page.getByText('Outside the supported population; no calculation was performed.').waitFor({timeout:20000});
        assert.match(await page.locator('body').innerText(),/no acknowledgement can override this/);
        results.push('browser admin: dataset-gap infant refused with the boundary evidence');
      } else if(name==='verified MFA') {
        await page.getByRole('heading',{name:'Research acknowledgement for this session',exact:true}).waitFor({timeout:20000});
        assert.equal(await page.getByRole('button',{name:'Calculate (research only)'}).count(),0);
        results.push('browser verified-MFA admin: acknowledgement required before the calculator');
      }
    }
    else assert.equal(await content.count(),0,`${name} must not see pediatric workspace`);
    results.push(`browser ${name}: ${allowed?'preview visible':'preview denied'}`);await context.close();
  }
  fs.copyFileSync(path.join(fixture,'admin-preview.png'),path.join(source,'docs/pediatric/admin-preview.png'));
  fs.writeFileSync(path.join(source,'docs/pediatric/http-browser-results.json'),JSON.stringify({fixture,results,passed:true},null,2)+'\n');
  console.log(JSON.stringify({fixture,checks:results.length,passed:true},null,2));
} finally {if(browser)await browser.close();server.kill('SIGTERM');db.close();fs.closeSync(log);}
