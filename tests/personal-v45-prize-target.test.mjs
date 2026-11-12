import assert from 'node:assert/strict';
import{walkForwardBiasTest,probabilityUnorderedDraw,EXACT_COMBINATIONS}from '../personal/v45-mechanical-bias.mjs';
import{buildPrizeHypotheses}from '../personal/v45-prize-target.mjs';
let seed=88331;
const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};
function sample(max,k){
 const v=Array.from({length:max},(_,i)=>i+1);
 for(let j=0;j<k;j++){const idx=j+Math.floor(random()*(max-j));[v[j],v[idx]]=[v[idx],v[j]]}
 return v.slice(0,k).sort((a,b)=>a-b);
}
const rows=[],seq={};
for(let i=0;i<1200;i++){
 const date=new Date(Date.UTC(2016,0,1+i)).toISOString().slice(0,10),year=date.slice(2,4);
 seq[year]=(seq[year]||0)+1;
 rows.push({period:year+String(seq[year]).padStart(3,'0'),date,nums:[...sample(35,5),...sample(12,2)]});
}
const backtest=walkForwardBiasTest(rows,{testDraws:150,trainWindow:600});
const h=buildPrizeHypotheses(rows,backtest);
assert.equal(h.historyThroughPeriod,rows.at(-1).period);
assert.equal(h.candidatePoolSize,3003);
assert.equal(h.backPairCount,66);
assert.equal(h.strategies.length,2);
assert.equal(h.parameterLock.priorStrength,1800);
assert.equal(h.parameterLock.weightLimit,0.2);
for(const strategy of h.strategies){
 assert.equal(strategy.picks.length,5);
 assert.equal(new Set(strategy.picks.map(p=>p.front.join(','))).size,5);
 assert(strategy.picks.every(p=>p.front.length===5&&p.back.length===2));
 assert(strategy.weightedFirstProbability>0&&strategy.weightedSecondProbability>0);
 assert(Math.abs(strategy.picks.reduce((s,p)=>s+p.weightedFirstProbability,0)-strategy.weightedFirstProbability)<1e-15);
}
assert.deepEqual(h.strategies[0].picks.map(p=>p.front),h.strategies[1].picks.map(p=>p.front));
assert.equal(h.fairBaselines.first,5/EXACT_COMBINATIONS);
assert.equal(h.fairBaselines.second,100/EXACT_COMBINATIONS);
const uniformBack=Array(12).fill(1);
const back=[5,9],first=probabilityUnorderedDraw(back,uniformBack);
let second=0;
for(let i=1;i<=12;i++)if(!back.includes(i))second+=probabilityUnorderedDraw([5,i],uniformBack)+probabilityUnorderedDraw([9,i],uniformBack);
assert(Math.abs(first-1/66)<1e-14);
assert(Math.abs(second-20/66)<1e-14,'5+1 means EXACTLY one rear match, 20 remaining combinations');
assert.throws(()=>buildPrizeHypotheses(rows,{...backtest,lastTestPeriod:'26129'}),/历史截止/);
assert.throws(()=>buildPrizeHypotheses(rows,{...backtest,priorStrength:999}),/回测参数/);
assert.throws(()=>buildPrizeHypotheses(rows,{...backtest,trainingIsPastOnly:false}),/滚动/);
assert.deepEqual(buildPrizeHypotheses(rows,backtest),h,'deterministic candidate result for fixed input');
console.log('Prize-target research: distinct five fronts, first 5+2, second exactly 5+1, 3003x66 pool, leakage guards PASS');
