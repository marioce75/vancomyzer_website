import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pediatricAdminAllowed as allow } from './access';
import { pediatricStatus } from './status';
import { issueAcknowledgementToken, verifyAcknowledgementToken, ACK_TTL_MS, ACK_COOKIE_PATH, ackCookieOptions } from './acknowledgement';
import { PEDIATRIC_ACK_STATEMENT_VERSION } from './colin2019/manifest';
const now = Date.parse('2026-10-29T12:00:00Z');
const token = { id: '1', role: 'admin', sessionToken: 'test-session', lastActivity: now - 10000, iat: now/1000 - 120, exp: now/1000 + 600 };
const user = { id: 1, role: 'admin', status: 'active', last_login: '2026-10-29 11:58:00', mfa_enabled: 0, mfa_verified_at: null as string|null };
let count = 0;
function check(result: boolean, expected: boolean) { assert.equal(result, expected); count++; }
check(allow(token,user,'test-session',now),true);
check(allow(null,user,'test-session',now),false);
check(allow(token,undefined,'test-session',now),false);
for(const role of ['pharmacist','user','institutional_admin','']) check(allow(token,{...user,role},'test-session',now),false);
for(const status of ['disabled','pending','deleted','']) check(allow(token,{...user,status},'test-session',now),false);
for(const session of [null,'','revoked']) check(allow(token,user,session,now),false);
for(const lastActivity of [now+1,now-3600000,NaN,Infinity,undefined]) check(allow({...token,lastActivity},user,'test-session',now),false);
for(const exp of [now/1000,NaN,Infinity,undefined]) check(allow({...token,exp},user,'test-session',now),false);
check(allow({...token,id:'2'},user,'test-session',now),false);
check(allow({...token,role:'pharmacist'},user,'test-session',now),false);
check(allow({...token,mfaPending:true},user,'test-session',now),false);
for(const mfa_verified_at of [null,'invalid','2026-10-29 11:57:00','2026-10-29 12:01:00']) check(allow({...token,mfaVerified:true},{...user,mfa_enabled:1,mfa_verified_at},'test-session',now),false);
check(allow(token,{...user,mfa_enabled:1,mfa_verified_at:'2026-10-29 11:59:00',mfa_verified_session_token:'test-session'},'test-session',now),true);
// Research preview: enabled, research-only, scope and formulation declared; never clinical.
assert.equal(pediatricStatus.model,'colin_2019');
assert.equal(pediatricStatus.calculationsEnabled,true);
assert.equal(pediatricStatus.researchOnly,true);
assert.equal(pediatricStatus.clinicalUseAllowed,false);
assert.equal(pediatricStatus.formulation,'fitted_nonmem');
assert.equal(pediatricStatus.formulationStatus,'candidate_pending_author_clarification');
assert.match(pediatricStatus.formulationStatement,/not treated as resolved/);
assert.equal(pediatricStatus.acknowledgement.required,true);
assert.equal(pediatricStatus.supportedAgeRange.datasetGapPmaYears.policy,'refused');
assert.match(pediatricStatus.acknowledgement.statement,/not been independently clinically validated/);
assert.equal(pediatricStatus.supportedAgeRange.postnatalAgeYearsMaxExclusive,18);
assert.match(pediatricStatus.message,/Research preview only/);
// Per-session research acknowledgement token: signed, bound to user + login session + statement version, time-limited.
{
  const secret='fixture-secret'; const t0=now;
  const {token,expiresAt}=issueAcknowledgementToken({userId:1,sessionToken:'test-session',secret,now:t0});
  assert.equal(expiresAt,t0+ACK_TTL_MS);
  const ok=(tok:string|null|undefined,args:Partial<{userId:number;sessionToken:string|null;secret:string;now:number}>={})=>verifyAcknowledgementToken(tok,{userId:1,sessionToken:'test-session',secret,now:t0+1000,...args});
  const good=ok(token); assert.ok(good.ok); count++;
  for (const [args,reason] of [
    [{userId:2},'wrong_user'],[{sessionToken:'other-session'},'wrong_session'],[{sessionToken:null},'wrong_session'],[{secret:'other-secret'},'bad_signature'],
    [{now:t0+ACK_TTL_MS},'expired'],[{now:t0-1},'expired'],
  ] as const) { const v=ok(token,args); assert.ok(!v.ok && v.reason===reason,`${reason}: ${JSON.stringify(v)}`); count++; }
  for (const [bad,reason] of [[undefined,'missing'],[null,'missing'],['','missing'],['abc','malformed'],['abc.def','bad_signature'],[token+'x','bad_signature'],[token.split('.')[0]+'.'+token.split('.')[1].slice(0,-2)+'AA','bad_signature']] as const) { const v=ok(bad as string|null|undefined); assert.ok(!v.ok && v.reason===reason,`${reason}: ${JSON.stringify(v)}`); count++; }
  // A token forged for the current version but signed with the wrong key, and one re-signed for a different statement version, fail.
  const payload=JSON.parse(Buffer.from(token.split('.')[0].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString()); assert.equal(payload.v,PEDIATRIC_ACK_STATEMENT_VERSION); assert.equal(typeof payload.sth,'string'); assert.ok(!('test-session'===payload.sth),'session token is hashed, never stored in the cookie'); count++;
  const opts=ackCookieOptions(expiresAt); assert.equal(opts.httpOnly,true); assert.equal(opts.sameSite,'strict'); assert.equal(opts.path,ACK_COOKIE_PATH); count++;
}
// Wiring: every handler authorizes, then checks the acknowledgement, before reading the body; nothing is persisted; the adult engine is never imported.
const route=readFileSync('src/app/api/admin/pediatric/route.ts','utf8');
assert.equal((route.match(/await getPediatricAdmin\(\)/g)||[]).length,2);
assert.ok(route.indexOf('await getPediatricAdmin()') < route.indexOf('acknowledgement(request, admin)') && route.lastIndexOf('acknowledgement(request, admin)') < route.indexOf('readBoundedJson(request)'));
assert.match(route,/acknowledgement_required/);
assert.match(route,/no-store/);
const ackRoute=readFileSync('src/app/api/admin/pediatric/acknowledge/route.ts','utf8');
assert.ok(ackRoute.indexOf('await getPediatricAdmin()') < ackRoute.indexOf('readBoundedJson(request)'));
assert.match(ackRoute,/acknowledge !== true/); assert.match(ackRoute,/PEDIATRIC_ACK_STATEMENT_VERSION/);
assert.doesNotMatch(ackRoute,/logCalculation|getDb|INSERT|UPDATE/);
assert.doesNotMatch(route,/logCalculation|logCalculationEntry|getDb|initialRegimen|runExistingRegimenPipeline|buildPriorParameters/);
assert.match(readFileSync('src/app/admin/dashboard/pediatric/page.tsx','utf8'),/await requirePediatricAdmin\(\)/);
const workspace=readFileSync('src/app/admin/dashboard/pediatric/workspace.tsx','utf8');
assert.doesNotMatch(workspace,/acknowledge_dataset_gap/); assert.match(workspace,/acknowledgement_required/); assert.match(workspace,/\/api\/admin\/pediatric\/acknowledge/);
assert.doesNotMatch(readFileSync('src/lib/pediatric/engine.ts','utf8'),/gapAcknowledged|acknowledge_dataset_gap\?:/);
for (const f of ['src/lib/pediatric/engine.ts','src/lib/pediatric/colin2019/prior.ts','src/lib/pediatric/colin2019/fit.ts','src/lib/pediatric/colin2019/manifest.ts']) {
  assert.doesNotMatch(readFileSync(f,'utf8'),/import[^\n]*(buildPriorParameters|modelRegistry|posteriorEngine|fitPosteriorParameters)/, `${f} must not import the adult prior/posterior modules`);
}

for (const binding of [null, undefined, '', 'previous-session']) check(allow(token, {...user, mfa_enabled:1, mfa_verified_at:user.last_login, mfa_verified_session_token:binding}, 'test-session', now), false);
check(allow(token, {...user, mfa_enabled:1, mfa_verified_at:user.last_login, mfa_verified_session_token:'test-session'}, 'test-session', now), true);
check(allow({...token,sessionToken:'new-session'}, {...user,mfa_enabled:1,mfa_verified_at:user.last_login,mfa_verified_session_token:'test-session'},'new-session',now),false);
console.log(`${count} authorization/acknowledgement policy cases and research-preview status/wiring assertions passed. Run scripts/pediatric/http-browser.mjs for HTTP/browser integration.`);
