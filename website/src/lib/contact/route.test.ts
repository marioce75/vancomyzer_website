import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/contact/route";

test("unconfigured SMTP never claims that an access enquiry was delivered",async()=>{
 const user=process.env.SMTP_USER,pass=process.env.SMTP_PASS;delete process.env.SMTP_USER;delete process.env.SMTP_PASS;
 try{
  const response=await POST(new NextRequest("http://localhost/api/contact",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:"Synthetic Tester",email:"test@example.org",topic:"restricted_access",message:"Synthetic interest in saved history",acknowledgement:true})}));
  assert.equal(response.status,503);assert.equal((await response.json()).ok,undefined);
 }finally{if(user===undefined)delete process.env.SMTP_USER;else process.env.SMTP_USER=user;if(pass===undefined)delete process.env.SMTP_PASS;else process.env.SMTP_PASS=pass;}
});

test("only existing team destinations receive enquiries; technical requests never get access acknowledgements",async()=>{
 const nodemailer=(await import("nodemailer")).default;
 const original=nodemailer.createTransport;const old={user:process.env.SMTP_USER,pass:process.env.SMTP_PASS,enabled:process.env.ACCESS_REQUEST_ACK_ENABLED};
 const sent: Array<{to:string;replyTo:string;text:string}>=[];
 nodemailer.createTransport=(()=>({sendMail:async(options:{to:string;replyTo:string;text:string})=>{sent.push(options);return {accepted:[options.to]};}})) as unknown as typeof nodemailer.createTransport;
 process.env.SMTP_USER="sender@example.org";process.env.SMTP_PASS="synthetic-only";process.env.ACCESS_REQUEST_ACK_ENABLED="true";
 try{
  for(const [i,topic] of Array.from(["technical","clinical","research"].entries())){
   const response=await POST(new NextRequest("http://localhost/api/contact",{method:"POST",headers:{"content-type":"application/json","x-forwarded-for":`192.0.2.${i+1}`},body:JSON.stringify({name:"Synthetic Tester",email:"tester@example.org",topic,message:"Synthetic technical question",acknowledgement:true})}));
   assert.equal(response.status,200);
  }
  delete process.env.ACCESS_REQUEST_ACK_ENABLED;
  const disabledResponse = await POST(new NextRequest("http://localhost/api/contact", {method:"POST",headers:{"content-type":"application/json","x-forwarded-for":"192.0.2.20"},body:JSON.stringify({name:"Synthetic Tester",email:"tester@example.org",topic:"restricted_access",message:"Synthetic interest; acknowledgement switch is off",acknowledgement:true})}));
  assert.equal(disabledResponse.status,200);
  assert.equal(sent.length,4);
  assert.equal(sent.pop()?.to,"contact@vancomyzer.com");
  assert.equal(sent.length,3);assert.deepEqual(sent.map(x=>x.to),["contact@vancomyzer.com","contact@vancomyzer.com","contact@dosys.health"]);
  assert.equal(sent.every(x=>x.replyTo==="tester@example.org"),true);
 }finally{
  nodemailer.createTransport=original;
  for(const [key,value] of [["SMTP_USER",old.user],["SMTP_PASS",old.pass],["ACCESS_REQUEST_ACK_ENABLED",old.enabled]])if(value===undefined)delete process.env[key!];else process.env[key!]=value;
 }
});
