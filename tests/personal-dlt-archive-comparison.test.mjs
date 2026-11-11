import assert from 'node:assert/strict';
import{compareStoredArchiveToDraw}from '../personal/dlt-archive-comparison.mjs';
const picks=[
 [2,7,25,26,31,5,9],
 [2,6,25,26,31,5,9],
 [2,7,25,26,33,5,9],
 [2,7,25,26,32,5,9],
 [7,10,20,25,26,5,9]
].map(nums=>({nums,score:1}));
const archive={id:'saved26128',throughPeriod:'26128',snapshotId:'snap',trainId:'train',reportId:'report',sourceHash:'hash',generatedAt:'2026-11-11T14:32:54+08:00',coverage:1,covered:21425712,total:21425712,picks};
const data={snapshots:[{id:'snap',sourceHash:'hash'}],trains:[{id:'train',snapshotId:'snap'}],reports:[{id:'report',trainId:'train',snapshotId:'snap'}],results:[archive]};
const official={crossPageAgreement:true,checkedAt:'2026-11-12T00:00:00Z',records:[{period:'26129',date:'2026-11-11',front:[2,12,14,17,33],back:[7,8]}]};
const report=compareStoredArchiveToDraw(data,official);
assert.equal(report.archives.length,1);
assert.equal(report.archives[0].picks.length,5);
assert.deepEqual(report.archives[0].picks.map(x=>[x.frontHits,x.backHits]),[[1,0],[1,0],[2,0],[1,0],[0,0]]);
assert.equal(report.archives[0].bestFront,2);
assert.equal(report.archives[0].completeHits,0);
assert.match(report.label,/不计入正式事前预测/);
assert.match(report.archives[0].timingNote,/缺少可信/);
assert.throws(()=>compareStoredArchiveToDraw(data,{...official,crossPageAgreement:false}),/未确认一致/);
assert.equal(compareStoredArchiveToDraw({...data,results:[{...archive,throughPeriod:'26129'}]},official).archives.length,0);
assert.equal(compareStoredArchiveToDraw({...data,results:[{...archive,reportId:'different'}]},official).archives.length,0);
assert.equal(compareStoredArchiveToDraw({...data,results:[{...archive,generatedAt:'2026-11-12T06:00:00+08:00'}]},official).archives.length,0);
console.log('Read-only official draw vs preserved model archive comparison passed');
