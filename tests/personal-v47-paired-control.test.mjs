import assert from 'node:assert/strict';
import{webcrypto}from 'node:crypto';
import{stampLockedRecords}from '../personal/v40-lock-proof.mjs';
import{verifyLockedModel,generateFairControl,createPairRecord,verifyPairRecord,evaluatePair,summarizePairedRounds}from '../personal/v47-paired-control.mjs';
const subtle=webcrypto.subtle;
const seed='ab'.repeat(32),seed2='cd'.repeat(32);
const pick=(front,back)=>({front,back});
const frontSets=[[1,2,3,4,5],[6,7,8,9,10],[11,12,13,14,15],[16,17,18,19,20],[21,22,23,24,25]];
const rows=frontSets.map((front,i)=>({
 period:'26130',ticket:pick(front,[1,2]),method:'V3.1 第'+(i+1)+'组',
 createdAt:'2026-11-12T08:00:00Z',
 source:{type:'v31-result',rank:i+1,resultId:'model-1',throughPeriod:'26128',generatedAt:'2026-11-11T14:00:00+08:00'},
 batch:{id:'five-model-1',size:5,rank:i+1},
 targetEvidence:{plannedDrawAt:'2026-11-14T20:30:00+08:00',sourceUrl:'https://www.gstc.org.cn/example'},
 liveGate:{latestPublished:'26129'}
}));
const model=(await stampLockedRecords(rows,subtle)).records;
const locked=await verifyLockedModel(model,subtle);
assert.equal(locked.period,'26130');
assert.match(locked.modelDigest,/^[0-9a-f]{64}$/);
const random=await generateFairControl(seed,subtle);
assert.equal(random.length,5);
assert.equal(new Set(random.map(t=>t.front.join(','))).size,5);
assert.deepEqual(random,await generateFairControl(seed,subtle));
assert.notDeepEqual(random,await generateFairControl(seed2,subtle));
const gate={period:'26130',latestPublished:'26129',checkedAt:'2026-11-12T08:05:00Z',officialSource:'https://www.gstc.org.cn/wanfa/dlt'};
const record=await createPairRecord({locked,seed,createdAt:'2026-11-12T08:06:00Z',officialGate:gate},subtle);
assert.equal((await verifyPairRecord(record,locked,subtle)).valid,true);
assert.equal(record.payload.controlTickets.length,5);
assert.match(record.proof.digest,/^[0-9a-f]{64}$/);
const corrupted=structuredClone(record);
corrupted.payload.controlTickets[0].front[0]=35;
await assert.rejects(()=>verifyPairRecord(corrupted,locked,subtle),/种子|不符合|摘要/);
const corruptedSeed=structuredClone(record);
corruptedSeed.payload.controlSeed=seed2;
await assert.rejects(()=>verifyPairRecord(corruptedSeed,locked,subtle),/种子|不符合/);
const changedModel=structuredClone(model);
changedModel[0].ticket.front=[2,3,4,5,6];
await assert.rejects(()=>verifyLockedModel(changedModel,subtle),/指纹/);
await assert.rejects(()=>createPairRecord({locked,seed,createdAt:'2026-11-14T13:00:00Z',officialGate:gate},subtle),/计划开奖前/);
await assert.rejects(()=>createPairRecord({locked,seed,createdAt:'2026-11-12T08:06:00Z',officialGate:{...gate,latestPublished:'26130'}},subtle),/已开奖|不足|未来期号/);
await assert.rejects(()=>generateFairControl('x',subtle),/随机种子/);
const matched=evaluatePair(record,{front:[1,2,3,4,5],back:[1,2]});
assert.equal(matched.model.bestFront,5);
assert.equal(matched.model.firstPrize,true);
assert.equal(matched.model.secondPrize,false);
const second=evaluatePair(record,{front:[1,2,3,4,5],back:[1,9]});
assert.equal(second.model.firstPrize,false);
assert.equal(second.model.secondPrize,true);
const summary=summarizePairedRounds([matched,second]);
assert.equal(summary.periods,2);
assert.equal(summary.modelWins+summary.controlWins+summary.ties,2);
assert.equal(summarizePairedRounds([]).meanBestFrontDifference,null);
console.log('V4.7 deterministic cryptographic seed, full-model proof, immutable paired hash, actual first/second prize scoring PASS');
