import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const website=fileURLToPath(new URL('../../',import.meta.url));
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const fontCache=process.env.FONT_CACHE_DIR;
const out=repo+'/docs/reviews/direction-a'; fs.mkdirSync(out,{recursive:true});
const services=[]; let browser;
const emit=(label,data)=>console.log(JSON.stringify({label,...data}));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function service(name,port,dev=false){
 const cwd=website;
 const log=fs.openSync(`${out}/${name}-server.log`,'w');
 const p=spawn(process.execPath,[`${cwd}/node_modules/next/dist/bin/next`,dev?'dev':'start','-H','127.0.0.1','-p',String(port)],{cwd,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:dev?'development':'production'},stdio:['ignore',log,log]});
 services.push(p);
 for(let n=0;n<90;n++){
  try{const r=await fetch(`http://127.0.0.1:${port}`,{signal:AbortSignal.timeout(1500)});if(r.status===200)return;}catch{}
  if(p.exitCode!==null)throw Error(`${name} server exited ${p.exitCode}`);
  await delay(400);
 }
 throw Error(`${name} server not ready`);
}
function ratio(a,b){
 const lum=s=>{const c=(s.match(/[\d.]+/g)||[]).slice(0,3).map(n=>Number(n)/255).map(n=>n<=0.04045?n/12.92:((n+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 const x=lum(a),y=lum(b);return Number(((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(3));
}
async function viewportReport(page){return await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)&&getComputedStyle(e).position!=='fixed';}).slice(0,6).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,70)}))}));}
async function routeFonts(ctx){
 if(!fontCache)return;
 await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:r.request().url().includes('Newsreader')?fs.readFileSync(fontCache+'/index.css','utf8'):''}));
 await ctx.route('https://fonts.gstatic.com/**',r=>{const p=fontCache+'/'+new URL(r.request().url()).pathname.split('/').pop();return fs.existsSync(p)?r.fulfill({status:200,contentType:'font/ttf',body:fs.readFileSync(p)}):r.abort();});
}
try{
 await service('review',3105);

 const executablePath=process.env.PW_CHROMIUM;
 emit('browser',{executablePath});
 browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage'],headless:true,proxy:{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1,localhost'}});
 for(const [name,port] of [['head',3105]]){
  const base=`http://127.0.0.1:${port}`;
  const nj=await browser.newContext({javaScriptEnabled:false,ignoreHTTPSErrors:true,reducedMotion:'reduce',viewport:{width:1440,height:900}});
  await routeFonts(nj); const np=await nj.newPage();await np.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await np.screenshot({path:`${out}/${name}-before-hydration.png`,timeout:15000});
  emit('prehydration',{name,...await np.evaluate(()=>{const h=document.querySelector('h1');let e=h;const ancestors=[];while(e){const c=getComputedStyle(e);ancestors.push({tag:e.tagName,cls:e.className,background:c.backgroundColor});e=e.parentElement;}return {textColor:getComputedStyle(h).color,ancestors};})});
  const initial=await np.locator('.vz-site-frame').evaluate(e=>({background:getComputedStyle(e).backgroundColor,text:getComputedStyle(e.querySelector('h1')).color}));
  if(ratio(initial.text,initial.background)<4.5)throw Error('Initial-render contrast');
  await nj.close();
  const ctx=await browser.newContext({ignoreHTTPSErrors:true,reducedMotion:'reduce',viewport:{width:1440,height:900}});
  await routeFonts(ctx); const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForSelector('body.theme-basic');
  await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,4000))]));
  emit('fonts',{name,fonts:await page.evaluate(()=>[...document.fonts].filter(x=>x.status==='loaded').map(x=>x.family))});
  for(const width of [1440,1024,820,390,320]){
   await page.setViewportSize({width,height:900});
   emit('home-layout',{name,...await viewportReport(page)});
   if(name==='head'&&(width===1440||width===320))await page.screenshot({path:`${out}/${name}-home-${width}.png`});
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/calculator',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByRole('dialog').waitFor({timeout:60000});
  const accept=page.getByRole('button',{name:'Accept and continue'});
  if(!await accept.isDisabled())throw Error('Consent enabled before acceptance');
  emit('gate-pending',{name,disabled:await accept.isDisabled(),box:await accept.boundingBox(),hintCount:await page.locator('.vmz-gate-hint:visible').count(),focus:await page.evaluate(()=>document.activeElement.className)});
  if(name==='head')await page.screenshot({path:`${out}/head-gate-mobile.png`});
  await page.getByRole('checkbox').check();
  if(await accept.isDisabled())throw Error('Consent did not enable');
  emit('gate-checked',{name,disabled:await accept.isDisabled(),hintVisible:await page.locator('.vmz-gate-hint:visible').count()});
  await accept.click();await page.locator('input[inputmode]').first().waitFor({timeout:45000});
  emit('gate-accepted',{name,acceptance:await page.evaluate(()=>localStorage.getItem('vmz_disclaimer_acceptance'))});
  await page.setViewportSize({width:1440,height:900});
  await page.mouse.move(0,800);
  for(const label of ['Home','FAQ','Evidence','SIGN IN']){
   const link=page.locator('header.shrink-0').getByRole('link',{name:label,exact:true});
   if(await link.count()===0)continue;await link.hover();await page.waitForTimeout(200);
   const v=await link.evaluate(e=>({color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor}));
   emit('header-hover',{name,item:label,...v,contrast:ratio(v.color,v.background)}); if(ratio(v.color,v.background)<4.5)throw Error('Header contrast');
  }
  const gear=page.locator('header.shrink-0').getByRole('button',{name:'Clinical settings'}).filter({visible:true});
  await gear.hover();await page.waitForTimeout(200);
  const g=await gear.evaluate(e=>({color:getComputedStyle(e.querySelector('svg')).color,background:getComputedStyle(e).backgroundColor}));emit('header-hover',{name,item:'Settings icon',...g,contrast:ratio(g.color,g.background)});
  if(ratio(g.color,g.background)<4.5)throw Error('Settings icon contrast');
  await page.mouse.move(0,800);
  const rrt=page.getByRole('group',{name:'Renal replacement therapy'});
  const no=rrt.getByRole('button',{name:'No',exact:true});
  const rb=await rrt.boundingBox();const clip={x:Math.max(0,rb.x-9),y:Math.max(0,rb.y-9),width:rb.width+18,height:rb.height+18};
  await page.screenshot({path:`${out}/${name}-rrt-blurred.png`,clip});
  await page.keyboard.press('Tab');await no.focus();
  emit('rrt-focus',{name,...await no.evaluate(e=>({outline:getComputedStyle(e).outline,offset:getComputedStyle(e).outlineOffset,parentOverflow:getComputedStyle(e.parentElement).overflow,focusVisible:e.matches(':focus-visible')}))});
  await page.screenshot({path:`${out}/${name}-rrt-focused.png`,clip}); if(await no.evaluate(e=>getComputedStyle(e).outlineOffset)!=='-3px')throw Error('Clipped focus');
  const inputs=page.locator('input[inputmode]');
  for(const [i,v] of ['58','82','172','1.1'].entries())await inputs.nth(i).fill(v);
  await no.click();await page.locator('.vz-table tbody tr').first().waitFor({timeout:45000});
  emit('calculator-result',{name,rows:await page.locator('.vz-table tbody tr').allTextContents(),...await viewportReport(page)});
  if(name==='head'){
   await page.setViewportSize({width:1600,height:1000});
   await page.screenshot({path:`${out}/calculator-desktop.png`});
   if(process.env.UPDATE_CALCULATOR_IMAGE==='1')fs.copyFileSync(`${out}/calculator-desktop.png`,website+'/public/images/calculator-result-fictional.png');
   await page.setViewportSize({width:390,height:844});
   const table=page.locator('.vz-table'); await table.scrollIntoViewIfNeeded();
   await page.screenshot({path:`${out}/calculator-mobile.png`});
   const bad=await page.locator('body').innerText();
   if(/[✓✔✅→←↗]/.test(bad))throw Error('Unwanted symbols in calculator');
  }
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('input[inputmode]').first().waitFor({timeout:30000});emit('gate-reload',{name,dialogs:await page.getByRole('dialog').count()});
  if(name==='head'){
   await page.evaluate(()=>{localStorage.removeItem('vmz_disclaimer_acceptance');});
   await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Exit',exact:true}).click();await page.waitForURL(base+'/');emit('gate-exit',{name,url:page.url()});
  }
  for(const route of ['/','/about','/contact','/compliance','/upgrade/department','/launch','/admin','/mfa-verify','/faq','/pricing','/disclaimer','/privacy','/terms','/login','/register','/reset-password','/transparent-dosing','/transparent-dosing/cases','/transparent-dosing/equations','/transparent-dosing/predictive-performance','/transparent-dosing/engine-crosscheck','/transparent-dosing/software-checks']){
   await page.setViewportSize({width:390,height:844});
   const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:60000});
   const text=await page.locator('body').innerText();
   const symbols=text.match(/[✓✔✅→←↗]/g)||[];
   emit('route-scan',{route,status:response.status(),symbols,...await viewportReport(page)});
   if(![200,307,308].includes(response.status())||symbols.length||(await viewportReport(page)).scrollWidth>390)throw Error('Route scan failed: '+route);
   if(route==='/')await page.screenshot({path:`${out}/homepage-mobile.png`});
  }
  emit('browser-errors',{name,errors});if(errors.length)throw Error('Browser errors');await ctx.close();
 }
 await browser.close();browser=null;
 const log=fs.openSync(out+'/lifecycle.log','w');
 const proc=spawn(process.execPath,['scripts/e2e/result-lifecycle.mjs'],{cwd:website,env:{...process.env,BASE:'http://127.0.0.1:3105',PW_CHROMIUM:executablePath},stdio:['ignore',log,log]});
 const status=await new Promise(r=>proc.on('exit',r));emit('lifecycle',{status,output:fs.readFileSync(out+'/lifecycle.log','utf8')});if(status!==0)throw Error('Lifecycle failed');
}catch(e){console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();for(const p of services)p.kill('SIGTERM');}
