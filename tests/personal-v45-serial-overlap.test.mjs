import assert from 'node:assert/strict';
import{serialOverlapAudit}from '../personal/v45-serial-overlap.mjs';
let state=99217;
const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296};
function pick(max,k){const a=Array.from({length:max},(_,i)=>i+1);for(let j=0;j<k;j++){const i=j+Math.floor(random()*(max-j));[a[j],a[i]]=[a[i],a[j]]}return a.slice(0,k).sort((a,b)=>a-b)}
const fair=[],annual={};
for(let i=0;i<1200;i++){
 const date=new Date(Date.UTC(2016,0,i+1)).toISOString().slice(0,10),y=date.slice(2,4);
 annual[y]=(annual[y]||0)+1;
 fair.push({period:y+String(annual[y]).padStart(3,'0'),date,nums:[...pick(35,5),...pick(12,2)]});
}
const actual=serialOverlapAudit(fair);
assert(actual.pairs>=500);
assert.equal(actual.zones.length,2);
assert.equal(actual.significant.length,0,'fixed-seed fair synthetic control should not cross threshold');
assert(Math.abs(actual.zones[0].expectedMean-25/35)<1e-12);
assert(Math.abs(actual.zones[1].expectedMean-4/12)<1e-12);
const forced=fair.map((row,i)=>i%2?{...row,nums:fair[i-1].nums.slice()}:row);
const anomaly=serialOverlapAudit(forced);
assert.equal(anomaly.significant.length,2,'repeated consecutive draws should be detected');
assert(anomaly.zones.every(x=>x.observedMean>x.expectedMean));
assert.throws(()=>serialOverlapAudit([fair[0],fair[0],...fair.slice(2)]),/重复/);
assert.throws(()=>serialOverlapAudit(fair.slice(0,20)),/300/);
console.log('Serial overlap: hypergeometric expectations, disjoint-pair fair calibration and planted repeats PASS');
