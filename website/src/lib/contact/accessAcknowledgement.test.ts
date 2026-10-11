import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acknowledgementRecipient, claimAcknowledgement, ACK_TEXT } from "./accessAcknowledgement";
import { contactSchema } from "./schema";
import { readContactRequest } from "./request";

const access = { topic: "restricted_access", email: "Clinician@example.org", acknowledgement: true };
test("acknowledgement requires enabled dedicated topic and explicit opt-in", () => {
  assert.equal(acknowledgementRecipient(access, true, "sender@dosys.health"), "clinician@example.org");
  assert.equal(acknowledgementRecipient(access, false, "sender@dosys.health"), null);
  assert.equal(acknowledgementRecipient({...access, acknowledgement:false}, true, "sender@dosys.health"), null);
  for (const topic of ["technical","clinical","hospital","research","other", "Restricted_access"]) assert.equal(acknowledgementRecipient({...access,topic},true,"sender@dosys.health"),null);
});
test("automated, internal, multiple-recipient and header-injection destinations suppressed", () => {
  for (const email of ["noreply@example.org","no-reply@example.org","mailer-daemon@example.org","bounce+123@example.org","notifications@example.org","postmaster@example.org","contact@vancomyzer.com","legal@dosys.health","sender@example.org","a@example.org,b@example.org","a@example.org\r\nBcc: b@example.org"])
    assert.equal(acknowledgementRecipient({...access,email},true,"sender@example.org"),null,email);
});
test("deduplication survives connection restart and stores no raw address", () => {
 const dir=mkdtempSync(join(tmpdir(),"vmz-ack-test-")); const file=join(dir,"test.sqlite");
 try {
  let db=new Database(file);const now=2000000000000;
  assert.equal(claimAcknowledgement(db,"clinician@example.org",now),true);db.close();
  db=new Database(file);assert.equal(claimAcknowledgement(db,"CLINICIAN@example.org",now+1000),false);
  const row=db.prepare("SELECT recipient_hash FROM access_acknowledgements").get() as {recipient_hash:string};assert.equal(row.recipient_hash.includes("@"),false);
  assert.equal(claimAcknowledgement(db,"clinician@example.org",now+7*86400000),true);db.close();
 } finally {rmSync(dir,{recursive:true,force:true});}
});
test("acknowledgement is truthful preparation wording, no access grant or deadline",()=>{
 assert.match(ACK_TEXT,/preparing a validation study/);assert.match(ACK_TEXT,/does not grant access/);assert.doesNotMatch(ACK_TEXT,/underway|soon|support@/i);
});
test("contact validation handles malformed field types and multiple addresses",()=>{
 const good={name:"Synthetic Tester",email:"tester@example.org",topic:"restricted_access",message:"Synthetic access enquiry"};assert.equal(contactSchema.safeParse(good).success,true);
 for(const patch of [{name:42},{email:["a@example.org"]},{email:"a@example.org,b@example.org"},{name:"a\r\nb"},{topic:"unknown"},{message:"a"},{website:"bot.example.org"}])assert.equal(contactSchema.safeParse({...good,...patch}).success,false);
});
test("cross-origin, wrong media type and oversized bodies are refused",async()=>{
 const url="https://vancomyzer.com/api/contact";
 for(const [headers,body,status] of [[{"origin":"https://other.example","content-type":"application/json"},"{}",403],[{"content-type":"text/plain"},"{}",415],[{"content-type":"application/json"},JSON.stringify({message:"x".repeat(17000)}),413]] as const){const r=await readContactRequest(new Request(url,{method:"POST",headers,body}));assert.equal(r.ok,false);if(!r.ok)assert.equal(r.status,status);}
});
test("persistent daily ceiling limits acknowledgements across recipients",()=>{
 const db=new Database(":memory:");const now=2000000000000;
 for(let i=0;i<100;i++)assert.equal(claimAcknowledgement(db,`synthetic-${i}@example.org`,now),true);
 assert.equal(claimAcknowledgement(db,"one-more@example.org",now),false);
 assert.equal(claimAcknowledgement(db,"one-more@example.org",now+86400001),true);db.close();
});
