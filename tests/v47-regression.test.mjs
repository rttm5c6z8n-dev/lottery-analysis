import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  exactFairFrontBenchmark,
  generateFairControl,
  createPairRecord,
  verifyExportedPairStandalone,
  evaluatePair,
  formatPairedDrawReport,
  summarizeCalibratedPairedRounds
} from '../personal/v47-paired-control.mjs';

const subtle=webcrypto.subtle;
const asTickets=fronts=>fronts.map(front=>({front,back:[1,2]}));
const crowded=asTickets([
  [1,2,3,4,5],[1,2,3,4,6],[1,2,3,4,7],[1,2,3,4,8],[1,2,3,4,9]
]);
const dispersed=asTickets([
  [1,10,18,26,34],[2,11,19,27,35],[3,12,20,28,32],
  [4,13,21,29,33],[5,14,22,30,31]
]);

test('exact baseline enumerates C(35,5), with fixed known synthetic counts',()=>{
  const x=exactFairFrontBenchmark(crowded,dispersed);
  assert.equal(x.total,324632);
  assert.equal(x.modelWins,43963);
  assert.equal(x.controlWins,167313);
  assert.equal(x.ties,113356);
  assert.equal(x.modelWins+x.controlWins+x.ties,x.total);
  assert.ok(x.expectedDelta<0);
});

test('benchmark is symmetric on switching groups and is all ties against identical tickets',()=>{
  const forward=exactFairFrontBenchmark(crowded,dispersed);
  const reverse=exactFairFrontBenchmark(dispersed,crowded);
  assert.equal(reverse.modelWins,forward.controlWins);
  assert.equal(reverse.controlWins,forward.modelWins);
  assert.equal(reverse.ties,forward.ties);
  assert.equal(reverse.expectedModelBest,forward.expectedControlBest);
  assert.equal(reverse.expectedControlBest,forward.expectedModelBest);
  assert.ok(Math.abs(reverse.expectedDelta+forward.expectedDelta)<1e-12);
  const same=exactFairFrontBenchmark(crowded,crowded);
  assert.equal(same.ties,same.total);
  assert.equal(same.modelWins,0);
  assert.equal(same.controlWins,0);
  assert.equal(same.expectedDelta,0);
});

test('seeded secure draw can be reproduced, containing five distinct valid front sets',async()=>{
  const seed='ab'.repeat(32);
  const first=await generateFairControl(seed,subtle);
  const second=await generateFairControl(seed,subtle);
  assert.deepEqual(first,second);
  assert.equal(first.length,5);
  assert.equal(new Set(first.map(x=>x.front.join(','))).size,5);
  for(const ticket of first){
    assert.equal(ticket.front.length,5);
    assert.equal(ticket.back.length,2);
    assert.equal(new Set(ticket.front).size,5);
    assert.equal(new Set(ticket.back).size,2);
    assert.ok(ticket.front.every(n=>n>=1&&n<=35));
    assert.ok(ticket.back.every(n=>n>=1&&n<=12));
  }
});

async function syntheticPair(){
  return createPairRecord({
    locked:{
      period:'99999',
      modelCreatedAt:'2026-01-01T09:00:00.000Z',
      plannedDrawAt:'2026-01-02T18:00:00+08:00',
      modelDigest:'d'.repeat(64),
      tickets:crowded
    },
    seed:'4c'.repeat(32),
    createdAt:'2026-01-01T10:00:00.000Z',
    officialGate:{
      period:'99999',
      latestPublished:'99998',
      checkedAt:'2026-01-01T09:59:59.000Z',
      officialSource:'https://www.gstc.org.cn/wanfa/dlt_history'
    }
  },subtle);
}

test('exported JSON passes standalone validation without importing or overwriting records',async()=>{
  const record=await syntheticPair();
  const result=await verifyExportedPairStandalone(record,subtle);
  assert.equal(result.valid,true);
  assert.equal(result.period,'99999');
  assert.equal(result.digest,record.proof.digest);
  assert.equal(result.scope,'standalone-untrusted-time');
});

test('tampered JSON and changed random seeds fail portable verification',async()=>{
  const original=await syntheticPair();
  const tampered=structuredClone(original);
  tampered.payload.controlTickets[0].front=[1,2,3,4,5];
  await assert.rejects(verifyExportedPairStandalone(tampered,subtle));

  const changedSeed=structuredClone(original);
  changedSeed.payload.controlSeed='00'.repeat(32);
  await assert.rejects(verifyExportedPairStandalone(changedSeed,subtle));

  const invalidTime=structuredClone(original);
  invalidTime.payload.createdAt='2026-01-03T00:00:00.000Z';
  await assert.rejects(verifyExportedPairStandalone(invalidTime,subtle));
});

test('draw report keeps the original primary metric and labels theory separately',async()=>{
  const record=await syntheticPair();
  const draw={front:[1,2,3,4,5],back:[1,2]};
  const score=evaluatePair(record,draw);
  const baseline=exactFairFrontBenchmark(record.payload.modelTickets,record.payload.controlTickets);
  const report=formatPairedDrawReport(score,draw,baseline);
  assert.ok(report.includes('第99999期'));
  assert.ok(report.includes('模型5注'));
  assert.ok(report.includes('随机5注'));
  assert.ok(report.includes('理论'));
  assert.ok(report.includes('最佳前区命中差'));
  assert.ok(report.includes(String(score.bestFrontDelta)));
  assert.equal(score.model.ticketScores.length,5);
  assert.equal(score.control.ticketScores.length,5);
});

test('calibrated summary matches arithmetic and guards against repeated periods',()=>{
  const baseline=exactFairFrontBenchmark(crowded,dispersed);
  const sample=[{score:{period:'99997',bestFrontDelta:1},benchmark:baseline},
                {score:{period:'99998',bestFrontDelta:-1},benchmark:baseline}];
  const agg=summarizeCalibratedPairedRounds(sample);
  assert.equal(agg.periods,2);
  assert.equal(agg.observedMeanDelta,0);
  assert.ok(Math.abs(agg.expectedMeanDelta-baseline.expectedDelta)<1e-12);
  assert.ok(Math.abs(agg.meanExcess+baseline.expectedDelta)<1e-12);
  assert.ok(Math.abs(agg.expectedModelWins-2*baseline.modelWinProbability)<1e-12);
  assert.throws(()=>summarizeCalibratedPairedRounds([sample[0],sample[0]]));
  assert.equal(summarizeCalibratedPairedRounds([]).periods,0);
});
