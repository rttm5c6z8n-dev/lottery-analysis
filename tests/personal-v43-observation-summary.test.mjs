import assert from 'node:assert/strict';
import{summarizeObservations}from '../personal/v43-observation-summary.mjs';
const score=(f,b)=>({score:{frontHits:f,backHits:b,exact:f===5&&b===2}});
const rows=[
 {period:'26132',eligibleTickets:5,modelScores:[{score:null}],officialDraw:null,sourceCorroborated:false},
 {period:'26130',eligibleTickets:5,modelScores:[score(1,0),score(2,1)],officialDraw:{period:'26130'},sourceCorroborated:true},
 {period:'26129',eligibleTickets:5,modelScores:[score(3,0),score(1,1)],officialDraw:{period:'26129'},sourceCorroborated:false},
 {period:'26128',eligibleTickets:1,modelScores:[],officialDraw:null,sourceCorroborated:false},
 {period:'26127',eligibleTickets:0,modelScores:[],officialDraw:{period:'26127'},sourceCorroborated:false},
];
const out=summarizeObservations({rows,periods:5,latestOfficialPeriod:'26131'},'2026-11-13T10:00:00Z');
assert.equal(out.pendingPeriods,1);
assert.equal(out.doublePagePeriods,1);
assert.equal(out.historyOnlyPeriods,1);
assert.equal(out.missingHistoryPeriods,1);
assert.equal(out.rejectedPeriods,1);
assert.equal(out.observedPeriods,2);
assert.equal(out.observedTickets,4);
assert.equal(out.totalFront,7);
assert.equal(out.totalBack,2);
assert.equal(out.meanFront,7/4);
assert.equal(out.meanBack,2/4);
assert.deepEqual(out.groups.pending,['26132']);
assert.deepEqual(out.groups.notInPage,['26128']);
assert.throws(()=>summarizeObservations({},'2026-11-13T10:00:00Z'),/缺少/);
console.log('V4.3 multi-draw source and coverage classification passed');
