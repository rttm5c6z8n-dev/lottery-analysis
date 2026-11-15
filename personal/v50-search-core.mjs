import{VERSION,TOTAL_FRONT,TOTAL,checkConfig,unrank,rankFront,backs,zoneScore,dot,materialize,valid,compare}from './v31-core.mjs';
export const V50_SEARCH_VERSION='V5.0-candidate-pool-1';
export const POOL_SIZE=100;
function add(top,p){if(top.length===POOL_SIZE&&compare(p,top[top.length-1])>=0)return;top.push(p);top.sort(compare);if(top.length>POOL_SIZE)top.pop()}
export function candidateBatch(config,start,previous=[],limit=256){
 checkConfig(config);
 if(!Number.isInteger(start)||start<0||start>=TOTAL_FRONT||!Number.isInteger(limit)||limit!==256||!Array.isArray(previous)||previous.length>POOL_SIZE)throw Error('V5.0游标、批次或候选池非法');
 if((start===0&&previous.length)||(start>0&&previous.length!==POOL_SIZE))throw Error('V5.0断点候选数量不完整');
 const seen=new Set(),top=[];
 for(const old of previous){
  if(!Array.isArray(old?.nums)||!valid({period:'26128',date:'2026-11-09',nums:old.nums})||old.nums.slice(0,5).some((n,i,a)=>i&&n<=a[i-1])||old.nums[5]>=old.nums[6]||rankFront(old.nums.slice(0,5))>=start)throw Error('断点号码不合法');
  const key=old.nums.join(',');if(seen.has(key))throw Error('断点候选重复');seen.add(key);
  const expected=materialize(old.nums.slice(0,5),old.nums.slice(5),config.prepared,config.weights);
  if(!Number.isFinite(old.score)||Math.abs(expected.score-old.score)>1e-8)throw Error('断点评分与模型参数不一致');
  add(top,expected);
 }
 const end=Math.min(TOTAL_FRONT,start+limit),back=backs(config.prepared);
 for(let rank=start;rank<end;rank++){
  const front=unrank(rank),f=zoneScore(front,0,config.prepared);
  for(const b of back){
   const score=dot(f.map((x,i)=>x+b.s[i]),config.weights);
   if(top.length<POOL_SIZE||score>=top[top.length-1].score)add(top,materialize(front,b.nums,config.prepared,config.weights));
  }
 }
 return{startFront:start,endFront:end,processedCombinations:(end-start)*66,totalCovered:end*66,total:TOTAL,completed:end===TOTAL_FRONT,poolSize:POOL_SIZE,candidates:top};
}
export function selectCoverage(pool,lambda){
 if(!Array.isArray(pool)||pool.length<5||!Number.isFinite(lambda)||lambda<0)throw Error('候选池或重复惩罚参数非法');
 const remaining=[...pool].sort(compare),selected=[];
 for(let i=0;i<5;i++){
  let bestIndex=-1,bestValue=-Infinity;
  for(let j=0;j<remaining.length;j++){
   const p=remaining[j],overlap=selected.reduce((sum,s)=>sum+p.nums.slice(0,5).filter(n=>s.nums.slice(0,5).includes(n)).length,0);
   const value=p.score-lambda*overlap;
   if(value>bestValue+1e-10){bestValue=value;bestIndex=j}
  }
  if(bestIndex<0)throw Error('B轨选择失败');
  selected.push(remaining.splice(bestIndex,1)[0]);
 }
 return selected;
}
