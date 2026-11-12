import{validateTicket,verifyTicket}from './v38-core.mjs';
export const MONTE_CARLO_VERSION='V4.4-fixed-set-random-draw-v1';
function generator(seed){
 let state=Number(seed)>>>0;if(!state)state=0x9e3779b9;
 return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};
}
function sample(count,max,rng){
 const values=Array.from({length:max},(_,i)=>i+1);
 for(let i=0;i<count;i++){const j=i+Math.floor(rng()*(max-i));[values[i],values[j]]=[values[j],values[i]]}
 return values.slice(0,count).sort((a,b)=>a-b);
}
function normalizedPicks(picks){
 if(!Array.isArray(picks)||picks.length!==5)throw Error('随机基准必须使用完整的5组研究号码');
 const groups=picks.map(p=>{
  const front=p?.front??p?.nums?.slice(0,5),back=p?.back??p?.nums?.slice(5);
  if(!Array.isArray(front)||!Array.isArray(back))throw Error('某组研究号码不完整');
  const normalized=validateTicket(front.join(' '),back.join(' '));
  return normalized;
 });
 const unique=new Set(groups.map(p=>p.front.join(',')+'|'+p.back.join(',')));
 if(unique.size!==5)throw Error('5组中含重复组合，拒绝用5注唯一号码模型计算');
 return groups;
}
function statistic(groups,draw){
 let bestFront=0,bestBack=0,exact=0,frontTotal=0,backTotal=0;
 for(const ticket of groups){
  const m=verifyTicket(ticket,draw);
  if(m.frontHits>bestFront){bestFront=m.frontHits;bestBack=m.backHits}
  else if(m.frontHits===bestFront&&m.backHits>bestBack)bestBack=m.backHits;
  frontTotal+=m.frontHits;backTotal+=m.backHits;if(m.exact)exact++;
 }
 return{bestFront,bestBack,exact,frontTotal,backTotal};
}
export function simulateFixedFive({picks,actualDraw=null,rounds=20000,seed=20261112}){
 const groups=normalizedPicks(picks);
 if(!Number.isInteger(rounds)||rounds<100||rounds>100000)throw Error('模拟次数必须在100至100000之间');
 const rng=generator(seed),hist=Array(6).fill(0);
 let meanBest=0,meanTotalFront=0;
 for(let i=0;i<rounds;i++){
  const d={front:sample(5,35,rng),back:sample(2,12,rng)};
  const hit=statistic(groups,d);
  hist[hit.bestFront]++;meanBest+=hit.bestFront;meanTotalFront+=hit.frontTotal;
 }
 let observed=null;
 if(actualDraw){
  const actual=validateTicket(actualDraw.front.join(' '),actualDraw.back.join(' '));
  observed=statistic(groups,actual);
  const tail=hist.slice(observed.bestFront).reduce((a,b)=>a+b,0);
  observed.empiricalTail=(tail+1)/(rounds+1);
  observed.tailCount=tail;
 }
 const backPatterns=new Set(groups.map(g=>g.back.join(',')));
 return{version:MONTE_CARLO_VERSION,rounds,seed:Number(seed)>>>0,
  histogram:hist,probabilityByBestFront:hist.map(n=>n/rounds),
  meanBestFront:meanBest/rounds,meanTotalFront:meanTotalFront/rounds,
  observed,distinctBackPairs:backPatterns.size,
  exactJackpotProbability:5/21425712,
  expectedExactJackpotTicketsPerDraw:5/21425712,
  caveat:'原5注固定，随机抽取同一次开奖的5+2；共享号码和相同后区完整保留。经验尾概率只描述随机开奖下出现至少同样最佳前区命中的频率；不证明模型有预测优势。一等奖理论概率按5组互异组合精确计算，不能用有限模拟估计极罕见事件。'};
}
