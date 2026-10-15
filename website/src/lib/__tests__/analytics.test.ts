import test from "node:test";
import assert from "node:assert/strict";
import { ANALYTICS_HOST, analyticsAllowed, safeProps, safePage, transformAnalytics } from "../analytics-policy";
const url = `https://${ANALYTICS_HOST}/calculator`;
test("only production hosts and explicit public paths are tracked", () => {
  for (const host of ["localhost", "127.0.0.1", "preview.example.com", "evil."+ANALYTICS_HOST]) assert.equal(analyticsAllowed(host), false);
  for (const path of ["/admin", "/research/secret", "/settings/history", "/patient/jane@example.com"]) assert.equal(safePage(`https://${ANALYTICS_HOST}${path}`), null);
  assert.equal(safePage(`http://${ANALYTICS_HOST}/`), null);
});
test("sensitive URL and payload data cannot leave the browser", () => {
  const output = transformAnalytics({n:"pageview",u:url+"?age=70&email=synthetic@example.com&utm_campaign=patient-123&utm_source=linkedin&utm_medium=paid-social#private",r:"https://www.linkedin.com/in/private?email=x",p:{dose:1000,email:"synthetic@example.com"},m:"private",$:100,title:"patient",d:"untrusted"});
  assert.deepEqual(output,{n:"pageview",u:url+"?utm_source=linkedin&utm_medium=paid-social",r:"https://www.linkedin.com/",p:{},d:ANALYTICS_HOST});
  assert.equal(transformAnalytics({n:"Form: Submission",u:url}),null);
  assert.equal(transformAnalytics({n:"New Visitor",u:url}),null);
  assert.equal(transformAnalytics({n:"person@example.com",u:url}),null);
  assert.equal(transformAnalytics({n:"pageview",u:"not a URL"}),null);
  assert.equal(transformAnalytics({n:"pageview",u:url,r:"http://localhost:3000/patient"})?.r,null);
});
test("only enumerated UI property values pass", () => {
  const props=safeProps("Calculation Run",{mode:"empiric",dose:1000,email:"synthetic@example.com"});
  if (ANALYTICS_HOST === "vancomyzer.com") {
    assert.deepEqual(props,{mode:"empiric"});
    assert.deepEqual(safeProps("Calculation Run",{mode:"private"}),{});
  } else {
    assert.equal(props,null);
    assert.deepEqual(safeProps("Contact Form Submit",{tab:"Other",email:"synthetic@example.com"}),{});
    assert.deepEqual(safeProps("PN Early Access",{role:"private"}),{});
  }
});

import { isCalculationCompletion } from "../calculation-analytics";
test("only explicit well-formed successful results count", () => {
  const good = { recommendation_type:"initial_regimen", auc24:400, curve:[{time_hours:0,concentration:0},{time_hours:1,concentration:20}] };
  assert.equal(isCalculationCompletion("explicit",good),true);
  for (const data of [{}, {...good,error_type:"calculation_error"}, {...good,auc24:NaN}, {...good,curve:[]}, {...good,curve:[{},{}]}, {...good,curve:[null,null]}, {...good,curve:[{time_hours:0,concentration:NaN},{}]}, {...good,recommendation_type:"unknown"}]) assert.equal(isCalculationCompletion("explicit",data),false);
  assert.equal(isCalculationCompletion("auto",good),false);
});

test("fixed campaign vocabulary survives while unreviewed values are removed", () => {
 assert.equal(safePage(url+"?utm_campaign=founder_intro&utm_content=unverified&utm_term=patient"),url+"?utm_campaign=founder_intro");
 assert.equal(safePage(url+"?utm_campaign=jane-doe&utm_content=private"),url);
 assert.equal(transformAnalytics({n:"pageview",u:url,v:36})?.v,36);
});

import { analyticsConfig } from "../analytics-config";
test("loader and admin share explicit configuration status", () => {
 const src="https://plausible.io/js/pa-pu9RB-Ekqqx6_tRYKonxB.js";
 assert.deepEqual(analyticsConfig(" "+src+" ",undefined),{status:"configured",src});
 assert.equal(analyticsConfig(src,"true").status,"disabled");
 assert.equal(analyticsConfig(undefined,undefined).status,"missing");
 assert.equal(analyticsConfig("https://plausible.io/js/script.js",undefined).status,"unsupported");
});

test("observed campaigns and public referrals survive, developer campaigns do not", () => {
 for (const campaign of ["founder_intro", "calculator_tutorial", "company_intro"]) assert.equal(safePage(url+"?utm_campaign="+campaign),url+"?utm_campaign="+campaign);
 for (const campaign of ["analytics_verification", "tracking_check"]) assert.equal(safePage(url+"?utm_campaign="+campaign),null);
 for (const host of ["www.youtube.com", "x.com", "t.co", "chatgpt.com"]) assert.equal(transformAnalytics({n:"pageview",u:url,r:`https://${host}/private?email=secret`})?.r,`https://${host}/`);
});

test("developer visit stays excluded across SPA navigation", () => {
 assert.equal(transformAnalytics({n:"pageview",u:url+"?utm_campaign=tracking_check"}),null);
 assert.equal(transformAnalytics({n:"pageview",u:url}),null);
 assert.equal(transformAnalytics({n:"Calculation Run",u:url,p:{mode:"empiric"}}),null);
});
