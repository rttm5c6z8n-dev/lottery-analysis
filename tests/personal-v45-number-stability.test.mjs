import assert from 'node:assert/strict';
import{analyzeTemporalStability}from '../personal/v45-number-stability.mjs';
let seed=123451;const rng=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};
function pick(n,k){const xs=Array.from({length:n},(_,i)=>i+1);for(let i=0;i<k;i++){const j=i+Math.floor(rng()*(n-i));[xs[i],xs[j]]=[xs[j],xs[i]]}return xs.slice(0,k).sort((a,b)=>a-b)}
const rows=[],perYear={};
for(let i=0;i<1200;i++){
 const date=new Date(Date.UTC(2016,0,1+i)).toISOString().slice(0,10),year=date.slice(2,4);
 perYear[year]=(perYear[year]||0)+1;
 rows.push({period:year+String(perYear[year]).padStart(3,'0'),date,nums:[...pick(35,5),...pick(12,2)]});
}
const base=analyzeTemporalStability(rows);
assert.equal(base.number,29);
assert.equal(base.all.draws,1200);
assert.equal(base.before.draws,800);
assert.equal(base.recent.draws,400);
assert.equal(base.blocks.length,4);
assert.equal(base.discoveredNumberForwardScore.testDraws,400);
assert.equal(base.pretestSelectedForwardScore.testDraws,400);
assert.equal(base.selectedAtPeriod,rows[799].period);
assert(Math.abs(base.all.observedRate-base.all.hits/1200)<1e-14);
const changed=rows.map((x,i)=>i===1199?{...x,nums:[1,3,5,7,29,1,2]}:x);
const altered=analyzeTemporalStability(changed);
assert.equal(altered.pretestSelectedForwardScore.scores[0].logAdvantage,base.pretestSelectedForwardScore.scores[0].logAdvantage,'must not leak later draw');
assert.equal(altered.selectedBeforeHoldout.number,base.selectedBeforeHoldout.number,'selection must use only earlier training window');
assert.throws(()=>analyzeTemporalStability([...rows.slice(0,1199),rows[0]]),/重复/);
assert.throws(()=>analyzeTemporalStability(rows,{number:36}),/范围/);
const biased=rows.map((r)=>({...r,nums:[...[29,...r.nums.slice(0,5).filter(n=>n!==29).slice(0,4),...Array.from({length:35},(_,i)=>i+1).filter(x=>x!==29&&!r.nums.slice(0,5).includes(x)).slice(0,4)].slice(0,5).sort((a,b)=>a-b),...r.nums.slice(5)]}));
const found=analyzeTemporalStability(biased);
assert.equal(found.recent.hits,400,'forced always-occurring number29 in this synthetic sample');
assert.equal(found.selectedBeforeHoldout.number,29);
assert(found.pretestSelectedForwardScore.meanLogAdvantage>0);
console.log('Temporal trend and pretest-only selected-number holdout scored without future leakage PASS');
