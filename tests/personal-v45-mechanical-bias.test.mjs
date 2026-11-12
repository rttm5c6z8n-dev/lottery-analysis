import assert from 'node:assert/strict';
import{exactBinomialTwoTail,probabilityUnorderedDraw,biasFrequencyTests,walkForwardBiasTest,prizeOdds}from '../personal/v45-mechanical-bias.mjs';
let seed=123456;
const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};
function pick(start,end,count){
 const a=Array.from({length:end-start+1},(_,i)=>start+i);
 for(let i=0;i<count;i++){const j=i+Math.floor(random()*(a.length-i));[a[i],a[j]]=[a[j],a[i]]}
 return a.slice(0,count).sort((x,y)=>x-y);
}
const fair=[],biased=[],inYear={};
for(let i=0;i<1250;i++){
 const date=new Date(Date.UTC(2016,0,1+i)).toISOString().slice(0,10);
 const year=date.slice(2,4),idx=(inYear[year]=(inYear[year]||0)+1);
 const row={period:year+String(idx).padStart(3,'0'),date,nums:[...pick(1,35,5),...pick(1,12,2)]};
 fair.push(row);
 biased.push({...row,nums:[...[1,...pick(2,35,4)].sort((a,b)=>a-b),...row.nums.slice(5)]});
}
assert(Math.abs(probabilityUnorderedDraw([1,2,3,4,5],Array(35).fill(1))-1/324632)<1e-13);
assert(Math.abs(probabilityUnorderedDraw([1,2],Array(12).fill(1))-1/66)<1e-13);
assert.equal(exactBinomialTwoTail(10,0,0.5),2/1024);
assert.equal(biasFrequencyTests(fair).testsExecuted,94);
assert.equal(biasFrequencyTests(fair).significant.length,0,'deterministic fair calibration should have no familywise false flag');
const flags=biasFrequencyTests(biased);
assert(flags.significant.some(x=>x.zone==='前区'&&x.number===1),'detect planted persistent physical-number bias');
const normal=walkForwardBiasTest(fair,{testDraws:150,trainWindow:600});
const planted=walkForwardBiasTest(biased,{testDraws:150,trainWindow:600});
assert.equal(normal.evaluatedDraws,150);
assert.equal(normal.preliminarySignal,false,'fair control must not cross the predefined robust evidence threshold');
assert(planted.meanLogAdvantage>0,'planted stable number bias should improve held-out log score');
assert(planted.preliminarySignal,'two half-splits and approximate interval must agree for planted stable bias');
assert.equal(planted.scores.length,150);
const changed=biased.map((r,i)=>i===biased.length-1?{...r,nums:[1,3,7,9,12,1,2]}:r);
const altered=walkForwardBiasTest(changed,{testDraws:150,trainWindow:600});
assert.equal(altered.scores[0].logLikelihoodAdvantage,planted.scores[0].logLikelihoodAdvantage,'future changed draw must not leak to earlier predictions');
const odds=prizeOdds(5);
assert(Math.abs(odds.firstProbability-5/21425712)<1e-15);
assert(Math.abs(odds.secondProbability-100/21425712)<1e-15);
assert.throws(()=>walkForwardBiasTest(fair,{testDraws:800,trainWindow:600}),/不足/);
assert.throws(()=>biasFrequencyTests([fair[0],fair[0],...fair.slice(2)]),/重复/);
console.log('V4.5: 94 tests, planted bias, fair control, no lookahead, hypergeometric combinations, prize probabilities PASS');
