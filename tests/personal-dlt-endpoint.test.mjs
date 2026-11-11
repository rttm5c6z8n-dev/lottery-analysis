import assert from 'node:assert/strict';
import{onRequestGet}from '../functions/api/dlt-results.js';
const originalFetch=globalThis.fetch;
const history='<h2>超级大乐透历史开奖数据</h2><table><tr><td>2026-11-11</td><td>26129</td><td>02121417330708</td></tr></table> 当前第 1 / 58 页';
const latest='超级大乐透 26129 期 开奖日期：2026-11-11 开奖日：每周一、三、六 开奖号码： 02 12 14 17 33 07 08';
const req=new Request('https://lottery-analysis.pages.dev/api/dlt-results');
try{
 globalThis.fetch=async url=>new Response(url.includes('dlt_history')?history:latest,{status:200,headers:{'content-type':'text/html;charset=utf-8'}});
 const ok=await onRequestGet({request:req});
 assert.equal(ok.status,200);
 const data=await ok.json();
 assert.equal(data.latestPeriod,'26129');
 assert.equal(data.crossPageAgreement,true);
 assert.equal(data.records[0].front.join(','),'2,12,14,17,33');
 assert.equal(data.verifiedByIndependentPublisher,false);
 assert.equal(ok.headers.get('Cache-Control'),'no-store');
 globalThis.fetch=async url=>new Response(url.includes('dlt_history')?history:'outdated',{status:200,headers:{'content-type':'text/html'}});
 const partial=await onRequestGet({request:req});
 assert.equal(partial.status,200);
 assert.equal((await partial.json()).crossPageAgreement,false);
 globalThis.fetch=async()=>new Response('upstream error',{status:503,headers:{'content-type':'text/html'}});
 const failed=await onRequestGet({request:req});
 assert.equal(failed.status,503);
 assert.deepEqual((await failed.json()).records,[]);
 const foreign=await onRequestGet({request:new Request('https://lottery-analysis.pages.dev/api/dlt-results',{headers:{Origin:'https://foreign.invalid'}})});
 assert.equal(foreign.status,403);
 console.log('Official history API endpoint success, mismatch and fail-closed tests passed');
}finally{globalThis.fetch=originalFetch}
