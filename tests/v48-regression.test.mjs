import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseV48LocalState,indexOfficialDraws,roundStatus,statusLabel,
  summarizeV48Statuses,nextStepForCandidate,V48_LOCK_KEY,V48_PAIR_KEY
} from '../personal/v48-core.mjs';

test('V4.8 reads original V4.0 and V4.7 keys without rewriting them',()=>{
 assert.equal(V48_LOCK_KEY,'lottery_v38_predictions');
 assert.equal(V48_PAIR_KEY,'lottery_v47_paired_controls');
 const originalLocks=JSON.stringify([{period:'26130',batch:{rank:1}},
  {period:'26130',batch:{rank:2}},{period:'bad'}]);
 const originalPairs=JSON.stringify({'26130':{proof:{digest:'abc'}}});
 const state=parseV48LocalState(originalLocks,originalPairs);
 assert.equal(state.groups.get('26130').length,2);
 assert.equal(state.groups.size,1);
 assert.ok(Object.hasOwn(state.pairs,'26130'));
 assert.equal(JSON.stringify(state.groups.get('26130')),JSON.stringify(JSON.parse(originalLocks).slice(0,2)));
 assert.equal(originalPairs,JSON.stringify({'26130':{proof:{digest:'abc'}}}));
});

test('V4.8 rejects corrupted archives; missing data remains empty and is not fabricated',()=>{
 const empty=parseV48LocalState(null,null);
 assert.equal(empty.groups.size,0);assert.deepEqual(empty.pairs,{});
 assert.throws(()=>parseV48LocalState('not JSON',null));
 assert.throws(()=>parseV48LocalState('{}','{}'));
 assert.throws(()=>parseV48LocalState('[]','[]'));
});

test('official draw index rejects invalid and conflicting periods',()=>{
 const payload={latestPeriod:'26130',records:[
  {period:'26130',front:[1,2,3,4,5],back:[6,7]},
  {period:'26129',front:[2,3,4,5,6],back:[8,9]},
  {period:'26129',front:[2,3,4,5,7],back:[8,9]},
  {period:'26131',front:[1,2,3,4,5],back:[1,2]},
  {period:'26127',front:[1,1,2,3,4],back:[2,3]}
 ]};
 const indexed=indexOfficialDraws(payload);
 assert.deepEqual([...indexed.map.keys()],['26130']);
 assert.deepEqual([...indexed.conflicts],['26129']);
 assert.equal(indexed.latest,'26130');
 assert.throws(()=>indexOfficialDraws({latestPeriod:'x',records:[]}));
});

test('round status never marks a future draw as scored without a published result',()=>{
 const base={period:'26130',hasLock:true,hasPair:true,proofValid:true,draw:null,latest:'26129'};
 assert.equal(roundStatus(base),'awaiting-draw');
 assert.equal(roundStatus({...base,latest:'26130'}),'official-missing');
 assert.equal(roundStatus({...base,latest:undefined}),'official-unavailable');
 assert.equal(roundStatus({...base,draw:{front:[1,2,3,4,5],back:[6,7]}}),'scored');
 assert.equal(roundStatus({...base,proofValid:false}),'invalid-proof');
 assert.equal(roundStatus({...base,hasPair:false}),'locked-only');
 assert.equal(roundStatus({...base,hasLock:false}),'missing-model');
 assert.ok(statusLabel('awaiting-draw').includes('尚无'));
});

test('V4.8 summarized counts distinguish pending, graded and issues',()=>{
 const results=summarizeV48Statuses([
  {status:'scored'},{status:'awaiting-draw'},{status:'official-unavailable'},
  {status:'invalid-proof'},{status:'locked-only'}]);
 assert.deepEqual(results,{total:5,scored:1,pending:2,needsAttention:2});
});

test('next-step guidance recognizes an already locked paired future round',()=>{
 const info=nextStepForCandidate('26130','2026-11-14',[{period:'26130',status:'awaiting-draw'}]);
 assert.equal(info.stage,'ready-awaiting');
 assert.match(info.message,/不要重复锁定/);
 const newIssue=nextStepForCandidate('26131','2026-11-16',[{period:'26130',status:'scored'}]);
 assert.equal(newIssue.stage,'unlocked');
 const invalid=nextStepForCandidate('26130','2026-11-14',[{period:'26130',status:'invalid-proof'}]);
 assert.equal(invalid.stage,'review-required');
 const unpaired=nextStepForCandidate('26130','2026-11-14',[{period:'26130',status:'locked-only'}]);
 assert.equal(unpaired.stage,'model-only');
});
