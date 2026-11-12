import assert from 'node:assert/strict';
import{scanChronologicalRegimes,normalTwoTail}from '../personal/v45-regime-scan.mjs';
assert(Math.abs(normalTwoTail(0)-1)<1e-6);
assert(Math.abs(normalTwoTail(1.96)-0.0499958)<0.0001);
let seed=79113;
const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};
function choose(pool,k){const a=[...pool];for(let i=0;i<k;i++){const j=i+Math.floor(rnd()*(a.length-i));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,k).sort((a,b)=>a-b)}
const rows=[],counts={};for(let i=0;i<2946;i++){
 const date=new Date(Date.UTC(2007,0,i+1)).toISOString().slice(0,10),year=date.slice(2,4);
 counts[year]=(counts[year]||0)+1;
 rows.push({period:year+String(counts[year]).padStart(3,'0'),date,
  nums:[...choose(Array.from({length:35},(_,i)=>i+1),5),...choose(Array.from({length:12},(_,i)=>i+1),2)]});
}
const res=scanChronologicalRegimes(rows);
assert.equal(res.draws,2946);
assert.deepEqual(res.cutpoints,[600,900,1200,1500,1800,2100]);
assert.equal(res.tests,282);
assert.equal(res.number29.length,6);
assert.equal(res.all.length,282);
assert.equal(res.number29.reduce((s,r)=>s+(r.cut===1800?1:0),0),1);
assert(res.all.every(r=>r.adjustedP>=0&&r.adjustedP<=1));
const altered=rows.map((row,i)=>{
 const f=row.nums.slice(0,5);
 const base=Array.from({length:35},(_,j)=>j+1);
 const newFront=i<1800?[29,...f.filter(n=>n!==29),...base.filter(n=>n!==29&&!f.includes(n))].slice(0,5):
 [...f.filter(n=>n!==29),...base.filter(n=>n!==29&&!f.includes(n))].slice(0,5);
 return {...row,nums:[...newFront.sort((a,b)=>a-b),...row.nums.slice(5)]};
});
const planted=scanChronologicalRegimes(altered);
const p29=planted.number29.find(r=>r.cut===1800);
assert.equal(p29.earlyHits,1800);
assert.equal(p29.lateHits,0);
assert.equal(p29.signal,true);
assert.throws(()=>scanChronologicalRegimes([...rows.slice(0,-1),rows[0]]),/重复/);
console.log('Fixed-cut 47-ball global 282-test correction, fair rows and planted drift PASS');
