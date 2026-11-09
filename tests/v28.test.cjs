'use strict';
const assert=require('node:assert/strict'),C=require('../v28-core.js');
const source={period:'26103',date:'2026-09-09',front:[3,16,17,32,35],back:[2,12],url:'https://gdlottery.cn/f_html/kjgg/P085_26103.html',kind:'draw'};
const parsed=C.parse(JSON.stringify([{...source,grade:'A',verified:true,review:{method:'manual-original-notice'}}]));
assert.equal(parsed[0].review,undefined);const queue=C.merge([],parsed).queue,r=queue[0],local=[r];
assert.equal(C.verify(r.period,queue,local,'now').grade,'来源待核');
r.review={method:'manual-original-notice',identity:C.id(r),at:'2026-11-09T12:00:00.000Z'};
assert.equal(C.verify(r.period,queue,local,'now').grade,'A');
for(const kind of ['holiday','third-party','unknown']){const x={...r,kind};x.review={...r.review,identity:C.id(x)};assert.equal(C.verify(r.period,[x],local,'now').grade,'来源待核')}
assert(!C.official('https://gdlottery.cn.evil.example/draw'));assert(!C.official('https://gdlottery.cn/'));assert(!C.official('http://gdlottery.cn/draw'));assert(!C.https('https://user:password@gdlottery.cn/draw'));
const fake={...r,url:'https://untrusted.example/draw'};fake.review={...r.review,identity:C.id(fake)};assert.equal(C.verify(r.period,[fake],local,'now').grade,'来源待核');
assert.equal(C.verify(r.period,[r],[r,r],'now').grade,'D');assert.equal(C.verify(r.period,[r],[],'now').grade,'D');
const changed={...r,nums:[1,16,17,32,35,2,12]};assert.equal(C.verify(r.period,[r],[changed],'now').grade,'D');assert.equal(C.verify(r.period,[r,changed],local,'now').grade,'D');
assert.equal(C.merge([r],[r,r]).duplicates,2);assert.equal(C.merge([r],[r,r]).queue.length,1);
assert.throws(()=>C.normal({...source,date:'2026-02-30'}));assert.throws(()=>C.normal({...source,front:[3,3,4,5,6]}));assert.throws(()=>C.normal({...source,back:['',12]}));
assert.throws(()=>C.parse('{bad}'),/JSON/);assert.throws(()=>C.parse('a,b\n1,2'),/CSV/);assert.throws(()=>C.parse('period,date\n"26103,2026-09-09'),/引号/);
const csv='\ufeffperiod,date,front1,front2,front3,front4,front5,back1,back2,url,kind\r\n26103,2026-09-09,3,16,17,32,35,2,12,"https://gdlottery.cn/path?a=1,b=2",draw\r\n';assert.equal(C.parse(csv)[0].url,'https://gdlottery.cn/path?a=1,b=2');
const before=JSON.stringify(local);const result=C.verify(r.period,[r],local,'2026-11-09T00:00:00Z');assert.equal(JSON.stringify(local),before);assert.match(C.csv({[r.period]:result}),/人工核实时间/);assert.match(C.csv({[r.period]:result}),/https:\/\/gdlottery/);
console.log('V28 core passed: imports, forgery rejection, manual evidence boundary, conflicts, duplicate counting, malformed CSV/JSON, immutable history and exports.');
