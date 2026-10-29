import assert from 'node:assert/strict';
import {readBoundedJson,BodyTooLarge} from '../requestBody';
async function main() {
 const req=(text:string)=>new Request('http://fixture.invalid',{method:'POST',body:text});
 assert.deepEqual(await readBoundedJson(req('{"a":"€"}')), {a:'€'});
 for(const text of [JSON.stringify({padding:'€'.repeat(30000)}), JSON.stringify({padding:'a'.repeat(65536)})]) await assert.rejects(readBoundedJson(req(text)),BodyTooLarge);
 const exact='"'+'a'.repeat(65534)+'"'; assert.equal((await readBoundedJson(req(exact)) as string).length,65534);
 let cancelled=false; const bytes=new TextEncoder().encode('{"a":"€"}');let i=0;
 const stream=new ReadableStream({pull(c){if(i<bytes.length){c.enqueue(bytes.slice(i,i+1));i++;}else c.close();}});
 assert.deepEqual(await readBoundedJson(new Request('http://fixture.invalid',{method:'POST',body:stream,duplex:'half'} as any)),{a:'€'});
 const endless=new ReadableStream({pull(c){c.enqueue(new Uint8Array(32769));},cancel(){cancelled=true;}});
 await assert.rejects(readBoundedJson(new Request('http://fixture.invalid',{method:'POST',body:endless,duplex:'half'} as any)),BodyTooLarge);assert.equal(cancelled,true);
 await assert.rejects(readBoundedJson(req('{bad')));
 console.log('7 bounded JSON tests passed: UTF-8, exact boundary, split code point, cancellation, malformed JSON.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
