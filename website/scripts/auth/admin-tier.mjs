/** Isolated fixture-only HTTP/browser test for admin tier changes.
 * Never reads an application DB or .env file. Run from website/:
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright npm run test:admin-tier
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


  const output=[];
  for(const tier of ['individual_pro','department','hospital','free','Individual Pro','pro',' hospital ',null]) {
    db.prepare("UPDATE users SET subscription_tier='free' WHERE id=2").run();
    const {r,body}=await request('tier',tokens.admin,'POST','/api/admin',{}, {action:'set_tier',userId:2,tier});
    const stored=db.prepare('SELECT subscription_tier FROM users WHERE id=2').get().subscription_tier;
    output.push({input:tier,status:r.status,stored});
    const valid=['free','individual_pro','department','hospital'].includes(tier);
    if(valid){assert.equal(r.status,200);assert.equal(stored,tier);}
    else if(process.env.EXPECT_FIXED==='1'){assert.equal(r.status,400);assert.equal(stored,'free');}
  }
  for(const [name,token] of [['anonymous',null],['pharmacist',tokens.pharmacist],['stale',tokens.expiredActivity]]) {
    const {r}=await request(name,token,'POST','/api/admin',{}, {action:'set_tier',userId:2,tier:'hospital'});
    assert([401,403].includes(r.status));output.push({name,status:r.status});
  }

  if(process.env.EXPECT_FIXED==='1') {
    browser=await chromium.launch({headless:true});const context=await browser.newContext();
    await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
    await context.addCookies([{name:'next-auth.session-token',value:tokens.admin,url:base}]);
    const page=await context.newPage();await page.goto(base+'/admin/dashboard/users',{waitUntil:'networkidle',timeout:60000});
    await page.getByText('fixture2@example.invalid',{exact:true}).click();
    const drawer=page.getByRole('dialog');
    await drawer.getByRole('button',{name:'Change tier',exact:true}).click();
    await drawer.getByLabel('New tier',{exact:true}).selectOption('individual_pro');
    await drawer.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(db.prepare('SELECT subscription_tier FROM users WHERE id=2').get().subscription_tier,'free');
    await drawer.getByRole('button',{name:'Change tier',exact:true}).click();
    await drawer.getByLabel('New tier',{exact:true}).selectOption('individual_pro');
    const saved=page.waitForResponse(r=>r.url()===base+'/api/admin' && r.request().method()==='POST');
    await drawer.getByRole('button',{name:'Save tier',exact:true}).click();assert.equal((await saved).status(),200);
    assert.equal(db.prepare('SELECT subscription_tier FROM users WHERE id=2').get().subscription_tier,'individual_pro');
    output.push({browser:'drawer selected Individual Pro, cancelled without mutation, then saved successfully'});
    await page.reload({waitUntil:'networkidle'});
    const row=page.getByRole('row').filter({hasText:'fixture2@example.invalid'});
    await row.getByRole('button',{name:'Actions menu',exact:true}).click();
    await row.getByRole('button',{name:'Change tier',exact:true}).click();
    await row.getByLabel('New tier',{exact:true}).selectOption('department');
    const menuSaved=page.waitForResponse(r=>r.url()===base+'/api/admin' && r.request().method()==='POST');
    await row.getByRole('button',{name:'Save tier',exact:true}).click();assert.equal((await menuSaved).status(),200);
    assert.equal(db.prepare('SELECT subscription_tier FROM users WHERE id=2').get().subscription_tier,'department');
    output.push({browser:'row menu saved Department successfully'});
    db.prepare("UPDATE users SET subscription_tier='enterprise' WHERE id=2").run();
    await page.reload({waitUntil:'networkidle'});
    await page.getByText('fixture2@example.invalid',{exact:true}).click();
    await drawer.getByRole('button',{name:'Change tier',exact:true}).click();
    if(process.env.EXPECT_LEGACY_FIXED!=='0') {
      assert.equal(await drawer.getByLabel('New tier',{exact:true}).inputValue(),'hospital');
      await drawer.getByLabel('New tier',{exact:true}).selectOption('free');
      await drawer.getByRole('button',{name:'Cancel',exact:true}).click();
      assert.equal(db.prepare('SELECT subscription_tier FROM users WHERE id=2').get().subscription_tier,'enterprise');
      await drawer.getByRole('button',{name:'Change tier',exact:true}).click();
      assert.equal(await drawer.getByLabel('New tier',{exact:true}).inputValue(),'hospital');
    }
    const legacySaved=page.waitForResponse(r=>r.url()===base+'/api/admin' && r.request().method()==='POST');
    await drawer.getByRole('button',{name:'Save tier',exact:true}).click();
    const legacyResponse=await legacySaved;
    const legacyResult={browser:'legacy enterprise save without changing selection',status:legacyResponse.status(),submitted:legacyResponse.request().postDataJSON().tier,stored:db.prepare('SELECT subscription_tier FROM users WHERE id=2').get().subscription_tier};
    output.push(legacyResult);
    assert.equal(legacyResult.status,process.env.EXPECT_LEGACY_FIXED!=='0'?200:400);
    assert.equal(legacyResult.stored,process.env.EXPECT_LEGACY_FIXED!=='0'?'hospital':'enterprise');
    await context.close();
  }
  console.log(JSON.stringify(output,null,2));
} finally {if(browser)await browser.close();server.kill('SIGTERM');db.close();fs.closeSync(log);}
