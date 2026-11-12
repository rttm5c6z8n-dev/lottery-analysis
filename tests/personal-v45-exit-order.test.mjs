import assert from 'node:assert/strict';
import{exitOrderByBallSet}from '../personal/v45-exit-order.mjs';
const rows=Array.from({length:125},(_,i)=>({
 period:String(26001+i).padStart(5,'0'),ballSet:2,
 numbers:{front:[2,7,13,24,35],back:[2,11]},
 drawOrder:{front:[35,2,7,13,24],back:[11,2]}
}));
const res=exitOrderByBallSet(rows);
const chosen=res.results.find(x=>x.ballSet===2&&x.zone==='front');
assert.equal(chosen.issues,125);
assert.equal(chosen.eligibleForExploratoryTest,true);
assert.equal(chosen.crossesApproxBonferroniThreshold,true);
assert(chosen.zScore>2.64);
assert.equal(res.results.find(x=>x.ballSet===1&&x.zone==='front').eligibleForExploratoryTest,false);
const sparse=exitOrderByBallSet(rows.slice(0,8));
assert.equal(sparse.results.find(x=>x.ballSet===2&&x.zone==='front').crossesApproxBonferroniThreshold,false);
const inconsistent=exitOrderByBallSet([{...rows[0],drawOrder:{front:[35,2,7,13,25],back:[11,2]}}]);
assert.equal(inconsistent.results.find(x=>x.ballSet===2&&x.zone==='front').skipped,1);
console.log('Ball-set conditional first-exit bias detects synthetic positional bias; small samples withheld PASS');
