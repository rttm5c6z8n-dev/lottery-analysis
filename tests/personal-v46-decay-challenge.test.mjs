import assert from 'node:assert/strict';
import{compareDecayModels,decayWeights,DECAY_CANDIDATES}from '../personal/v46-decay-challenge.mjs';
let state=61751;
function rand(){state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296}
function sample(max,k){const a=Array.from({length:max},(_,i)=>i+1);for(let i=0;i<k;i++){const j=i+Math.floor(rand()*(max-i));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,k).sort((a,b)=>a-b)}
const rows=[],counts={};
for(let i=0;i<1200;i++){
 const date=new Date(Date.UTC(2016,0,1+i)).toISOString().slice(0,10),year=date.slice(2,4);
 counts[year]=(counts[year]||0)+1;
 rows.push({period:year+String(counts[year]).padStart(3,'0'),date,nums:[...sample(35,5),...sample(12,2)]});
}
const original=JSON.stringify(rows);
const fair=compareDecayModels(rows);
assert.equal(fair.models.length,4);
assert.equal(fair.selectedByEarly200,'uniform','fixed seed fair-draw selection should prefer fair prior');
assert.equal(fair.exploratoryPassed,false);
assert.equal(fair.selectionDraws,200);
assert.equal(fair.validationDraws,200);
assert.equal(fair.models[0].all400.mean,0);
assert.equal(fair.models.find(m=>m.id==='decay-90').first200.draws,200);
assert.equal(fair.periodEnd,rows.at(-1).period);
assert.equal(JSON.stringify(rows),original,'source history must remain unchanged');
const weight=decayWeights(rows,1200,DECAY_CANDIDATES[0],'front');
assert.equal(weight.length,35);
assert(weight.every(w=>w>=0.8&&w<=1.2));
assert.throws(()=>decayWeights(rows,100,DECAY_CANDIDATES[0],'front'),/配置/);
assert.throws(()=>compareDecayModels(rows.slice(0,800)),/至少1000期/);
const mutated=rows.map((r,i)=>i===1199?{...r,nums:[1,2,3,4,5,7,8]}:r);
const later=compareDecayModels(mutated);
assert.equal(later.selectedByEarly200,fair.selectedByEarly200,'final test draw must not change early model selection');
for(let j=0;j<fair.models.length;j++)
 assert.equal(later.models[j].first200.mean,fair.models[j].first200.mean,'late result cannot leak to early test');
const biased=rows.map((r,i)=>{
 if(i<800)return r;
 const f=r.nums.slice(0,5).filter(n=>n!==29);
 const b=r.nums.slice(5).filter(n=>n!==7);
 while(f.length<4)for(let n=1;n<=35&&f.length<4;n++)if(n!==29&&!f.includes(n))f.push(n);
 while(b.length<1)for(let n=1;n<=12&&b.length<1;n++)if(n!==7&&!b.includes(n))b.push(n);
 return{...r,nums:[...f.slice(0,4),29].sort((a,b)=>a-b).concat([...b.slice(0,1),7].sort((a,b)=>a-b))};
});
const b=compareDecayModels(biased);
assert(b.models.some(m=>m.id.startsWith('decay-')&&m.first200.mean>0),'persistent synthetic new bias should be visible to at least one fixed decay model');
assert(b.selectedByEarly200!=='uniform','planted draw bias should be selected over fair at fixed seed');
assert(b.late200Advantage>0,'positive synthetic bias should remain visible in last 200');
assert.deepEqual(compareDecayModels(rows).models,fair.models,'reproducible fixed model scores');
console.log('V4.6 decay: fixed candidate models, disjoint 200/200 temporal split, fair fallback, planted drift, no-lookahead PASS');
