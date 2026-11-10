import fs from 'node:fs';
import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/research-latest.js';
const list=fs.readFileSync('/tmp/v29-js-data.html','utf8');
const article=fs.readFileSync('/tmp/special-26128.html','utf8');
let calls=[];
globalThis.fetch=async (url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');return new Response(calls.length===1?list:article)};
let r=await onRequestGet(),j=await r.json();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(j.latest.period,'26128');assert.equal(j.latest.drawDate,'2026-11-09');assert.deepEqual(j.latest.nums,[3,13,20,25,34,9,12]);assert(j.latest.originalContent);assert.equal(j.next,null);assert.deepEqual(calls,['https://api.js-lottery.com/Lottery/_ListData?itemType=lo&pageindex=1','https://api.js-lottery.com/cms/post-148224.html']);
for(const status of [302,403,429,567]){calls=[];globalThis.fetch=async url=>{calls.push(url);return new Response('access restriction',{status})};r=await onRequestGet();assert.equal(r.status,502);assert.equal(calls.length,1);assert.equal((await r.json()).next,null)}
globalThis.fetch=async()=>new Response('<html>verification</html>');assert.equal((await onRequestGet()).status,502);
calls=[];globalThis.fetch=async()=>new Response(++calls.length===1?list:article.replaceAll('26128','26127'));assert.equal((await onRequestGet()).status,502);
console.log('BC source PASS: real saved official list + original date/7 numbers; source retained; no inferred next issue; restrictions, verification, title mismatch stop.');
