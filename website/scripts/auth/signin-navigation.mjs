/** Isolated fixture-only HTTP/browser test for public Sign In navigation with stale sessions.
 * Never reads an application DB or .env file. Run from website/:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright npm run test:signin-navigation
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
const require = createRequire(path.join(process.cwd(),'package.json'));
const Database = require('better-sqlite3');
const { encode } = require('next-auth/jwt');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = process.cwd();
assert(fs.existsSync(path.join(source,'src/lib/pediatric/access.ts')));
assert(!fs.existsSync('/data'), 'Refuse fixture run when production /data exists');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(),'pediatric-auth-fixture-'));
for (const name of ['src','public','package.json','tsconfig.json','next-env.d.ts','next.config.js','postcss.config.js','tailwind.config.ts']) {
  if(fs.existsSync(path.join(source,name))) fs.cpSync(path.join(source,name),path.join(fixture,name),{recursive:true,filter:src=>!src.startsWith(path.join(source,'public','videos'))});
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
const base=`http://localhost:${port}`;
const log=fs.openSync(path.join(fixture,'server.log'),'w');
// Explicit environment allowlist: never inherit credentials, mail, billing, or production config.
const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','-H','127.0.0.1','-p',port],{cwd:fixture,env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'development',NEXTAUTH_SECRET:secret,NEXTAUTH_URL:base,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_OPEN_ACCESS:'true'},stdio:['ignore',log,log]});
let browser;
const cookie=async(id,overrides={})=>encode({secret,token:{id:String(id),role:id===2?'pharmacist':'admin',sessionToken:`fixture-session-${id}`,lastActivity:now,mfaPending:id===4,mfaVerified:id===5,...overrides},maxAge:600});
const tokens={admin:await cookie(1),pharmacist:await cookie(2),disabled:await cookie(3),pendingMfa:await cookie(4),verifiedMfa:await cookie(5),expiredActivity:await cookie(1,{lastActivity:now-3600001}),forged:await encode({secret:'wrong-signing-key',token:{id:'1',role:'admin'},maxAge:600})};
async function request(name,token,method='GET',target='/api/admin/pediatric',extra={},body,ack) {
  const cookies=[token?`next-auth.session-token=${token}`:null,ack?`pediatric_research_ack=${ack}`:null].filter(Boolean).join('; ');
  const r=await fetch(base+target,{method,redirect:'manual',headers:{...(cookies?{cookie:cookies}:{ }),...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
  const text=await r.text(); return {r,body:text};
}
try {
  let ready=false;
  for(let i=0;i<120;i++) { assert(server.exitCode === null,'fixture server exited; inspect server.log'); try {await fetch(base+'/api/admin/pediatric');ready=true;break;}catch{} await new Promise(r=>setTimeout(r,500)); }
  assert(ready,'server ready');
  assert.equal((await request('fixture identity',tokens.admin)).r.status,200,'fixture must authenticate its own signed token; refuse a stale listener');

  browser=await chromium.launch({headless:true});const output=[];
  for (const [name,token] of [['anonymous',null],['expired-admin',tokens.expiredActivity],['superseded-admin',await cookie(1,{sessionToken:'old-synthetic-session'})],['valid-admin',tokens.admin],['pending-mfa',tokens.pendingMfa],['calculator-expired',tokens.expiredActivity],['calculator-superseded',await cookie(1,{sessionToken:'old-synthetic-session'})]]) {
    const context=await browser.newContext();
    await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
    if(token) await context.addCookies([{name:'next-auth.session-token',value:token,url:base}]);
    const page=await context.newPage();
    await page.goto(base+(name.startsWith('calculator-')?'/calculator':'/'),{waitUntil:'networkidle',timeout:60000});
    const link=page.getByRole('link',{name:'Sign in',exact:true});
    const visible=await link.isVisible();
    if(visible) await link.click(); else await page.goto(base+'/login',{waitUntil:'domcontentloaded'});
    await page.waitForLoadState('networkidle');
    const url=new URL(page.url()).pathname;
    const form=await page.getByLabel('Username or Email').isVisible();
    const protectedResponse=await context.request.get(base+'/api/admin/pediatric');
    output.push({name,signInVisible:visible,destination:url,loginFormVisible:form,pediatricStatus:protectedResponse.status()});
    if(process.env.EXPECT_FIXED==='1') {assert.equal(url,'/login',name);assert(form,name);}
    if(name !== 'valid-admin') assert.notEqual(protectedResponse.status(),200,name+' must remain unauthorized');
    await context.close();
  }
  assert.equal((await request('magic form',tokens.admin,'GET','/login?magic=synthetic-not-submitted')).r.status,200);
  assert.equal((await request('registration redirect',tokens.admin,'GET','/register')).r.status,307);
  console.log(JSON.stringify(output,null,2));
} finally {if(browser)await browser.close();server.kill('SIGTERM');db.close();fs.closeSync(log);}
