'use strict';
const assert=require('node:assert/strict'),C=require('../v28-core.js');
const at='2026-11-09T12:01:00.000Z',readAt='2026-11-09T12:00:00.000Z';
const raw={period:'26103',date:'2026-09-09',nums:[3,16,17,32,35,2,12],url:'https://gdlottery.cn/f_html/kjgg/P085_26103.html',kind:'draw'};
const local=[{period:raw.period,date:raw.date,nums:raw.nums.slice()}];
const parsed=C.parse(JSON.stringify([{...raw,acquisition:{channel:'https',sourceUrl:'https://fake.example/stolen',readAt:'1999-01-01T00:00:00.000Z'}}]));
assert.equal(parsed[0].acquisition,undefined);
const refs=C.capture(parsed,{channel:'https',sourceUrl:'https://data.example/final.json',requestedUrl:'https://data.example/start',readAt});
let r=C.verify(raw.period,refs,local,at),d=r.details[0];
assert.equal(r.grade,'来源待核');assert.equal(d.fields.length,9);assert(d.fields.every(f=>f.result==='一致'));assert.equal(d.external.period,raw.period);assert.deepEqual(d.external.front,raw.nums.slice(0,5));assert.equal(d.readAt,readAt);assert.equal(d.sourceUrl,'https://data.example/final.json');assert.notEqual(d.sourceUrl,d.evidenceUrl);
for(let i=0;i<9;i++){const a=C.snapshot(local[0]),b=C.snapshot(refs[0]);if(i===0)b.period='26104';else if(i===1)b.date='2026-09-10';else if(i<7)b.front[i-2]++;else b.back[i-7]--;const fields=C.fields(a,b);assert.equal(fields.filter(f=>f.result==='不一致').length,1);assert.equal(fields[i].result,'不一致')}
r=C.verify(raw.period,[],local,at);assert.equal(r.grade,'未比对');assert.equal(r.details[0].external,null);assert(r.details[0].fields.every(f=>f.result==='未比对'));assert.equal(r.details[0].readAt,null);assert(!r.state.includes('一致'));
r=C.verify(raw.period,refs,[{...local[0],date:'2026-09-10',nums:[1,16,17,32,35,2,11]}],at);assert.equal(r.grade,'D');assert(r.errors.includes('日期不一致'));assert(r.errors.includes('前区1不一致'));assert(r.errors.includes('后区2不一致'));assert.equal(r.details[0].external.back[1],12);
const reviewed={...refs[0],review:{method:'manual-original-notice',identity:C.id(refs[0]),at:readAt}};
const third={...refs[0],kind:'third-party'};
r=C.verify(raw.period,[reviewed,third],local,at);assert.equal(r.grade,'A');assert.equal(r.details[0].grade,'A');assert.equal(r.details[1].grade,'来源待核');assert.match(r.details[1].failureReasons.join('；'),/第三方/);
const csv=C.csv({[r.period]:r});for(const name of ['本地期号','本地前区1','本地后区2','外部期号','外部日期','外部前区5','外部后区2','实际数据来源URL','外部读取时间','来源类型','字段失败原因','失败原因','本条证据等级'])assert(csv.includes(name));assert(csv.includes('https://data.example/final.json'));assert(csv.includes(readAt));assert.equal(csv.split('\r\n').length,3);
const old=C.verify(raw.period,[raw],local,at);assert.equal(old.details[0].readAt,null);assert.equal(old.details[0].sourceUrl,null);assert(C.csv({[old.period]:old}).includes('未知'));
assert(!C.csv({x:{period:raw.period,grade:'A',state:'一致',local:local[0],at}}).includes('"A"'));
const noLocal=C.verify(raw.period,refs,[],at);assert.equal(noLocal.details[0].local,null);assert.equal(noLocal.details[0].external.period,raw.period);assert(noLocal.details[0].fields.every(f=>f.result==='未比对'));
assert.equal(C.verify(raw.period,refs,[local[0],local[0]],at).details.length,2);
const before=JSON.stringify(local);C.verify(raw.period,refs,local,at);assert.equal(JSON.stringify(local),before);
console.log('Trace core passed: nine separate fields, actual provenance, no external is un-compared, mismatches, per-evidence grades, CSV flattening, missing legacy metadata, immutable local snapshots.');

for(const result of [r,old,noLocal,C.verify(raw.period,[],local,at),C.verify(raw.period,refs,[local[0],local[0]],at)]){const packed=C.packResult(result),expanded=C.unpackResult(JSON.parse(JSON.stringify(packed)));assert.deepEqual(expanded,JSON.parse(JSON.stringify(result)));assert.equal(C.csv({x:packed}),C.csv({x:result}))}
console.log('Lossless storage round-trip and packed CSV passed.');

const job={version:1,queue:refs,results:{[r.period]:r},inspections:{[old.period]:old}};assert.deepEqual(C.unpackState(JSON.parse(JSON.stringify(C.packState(job)))),JSON.parse(JSON.stringify(job)));console.log('Shared provenance state round-trip passed.');
