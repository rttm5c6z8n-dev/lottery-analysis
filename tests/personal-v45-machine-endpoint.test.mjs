import assert from 'node:assert/strict';
import{onRequestGet}from '../functions/api/dlt-machine.js';
const originalFetch=globalThis.fetch;
const html='<h1>中国体育彩票超级大乐透第26129期开奖公告</h1>开奖日期：2026年11月11日 本期使用第2套摇奖球 前区 后区 本期出球顺序：02 12 14 33 17 08 07 本期开奖号码：02 12 14 17 33 07 08 本期中奖情况';
try{
 globalThis.fetch=async ()=>new Response(html,{status:200,headers:{'content-type':'text/html;charset=utf-8'}});
 const req=new Request('https://lottery-analysis.pages.dev/api/dlt-machine?period=26129');
 const out=await onRequestGet({request:req});
 assert.equal(out.status,200);
 const data=await out.json();
 assert.equal(data.ballSet,2);
 assert.deepEqual(data.drawOrder.front,[2,12,14,33,17]);
 assert.equal(data.officialPublisherCrossCheck,false);
 const invalid=await onRequestGet({request:new Request('https://lottery-analysis.pages.dev/api/dlt-machine?period=25000')});
 assert.equal(invalid.status,400);
 const foreign=await onRequestGet({request:new Request(req.url,{headers:{Origin:'https://attacker.invalid'}})});
 assert.equal(foreign.status,403);
 globalThis.fetch=async()=>new Response('unavailable',{status:503,headers:{'content-type':'text/html'}});
 const failed=await onRequestGet({request:req});
 assert.equal(failed.status,503);
 assert.equal((await failed.json()).stored,false);
 console.log('Ball-set upstream lookup: official values, invalid period, foreign origin and fail-closed PASS');
}finally{globalThis.fetch=originalFetch}
