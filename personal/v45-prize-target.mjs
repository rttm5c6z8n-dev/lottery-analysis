import{forwardWeightsAtLatest,probabilityUnorderedDraw,EXACT_COMBINATIONS}from './v45-mechanical-bias.mjs';
export const PRIZE_TARGET_VERSION='V4.5-two-prize-hypotheses-v1';
function combinations(items,k){
 const result=[],tmp=[];
 function walk(start){if(tmp.length===k){result.push([...tmp].sort((a,b)=>a-b));return}
  for(let i=start;i<=items.length-(k-tmp.length);i++){tmp.push(items[i]);walk(i+1);tmp.pop()}
 }
 walk(0);return result;
}
function backPrizeChances(weights){
 const items=[];
 for(let a=1;a<=11;a++)for(let b=a+1;b<=12;b++){
  const pair=[a,b];
  const both=probabilityUnorderedDraw(pair,weights);
  let one=0;
  for(let other=1;other<=12;other++){
   if(other===a||other===b)continue;
   one+=probabilityUnorderedDraw([a,other],weights)+probabilityUnorderedDraw([b,other],weights);
  }
  items.push({back:pair,both,one});
 }
 return items;
}
function topFiveFront(weights){
 // Predeclared pool: every 5-set among the 15 largest model weights,
 // 3003 combinations instead of all 324632. Does not claim exhaustive global optimum.
 const sorted=weights.map((w,i)=>({number:i+1,weight:w})).sort((a,b)=>b.weight-a.weight||a.number-b.number);
 const pool=sorted.slice(0,15).map(x=>x.number);
 const scored=combinations(pool,5).map(front=>({front,p:probabilityUnorderedDraw(front,weights)}));
 scored.sort((a,b)=>b.p-a.p||a.front.join(',').localeCompare(b.front.join(',')));
 return{pool,selected:scored.slice(0,5),evaluated:scored.length};
}
function renderStrategy(front,back,label){
 return{objective:label,weightedFirstProbability:front.selected.reduce((s,f)=>s+f.p*back.both,0),
  weightedSecondProbability:front.selected.reduce((s,f)=>s+f.p*back.one,0),
  picks:front.selected.map((f,i)=>({rank:i+1,front:f.front,back:back.back,
   weightedFirstProbability:f.p*back.both,weightedSecondProbability:f.p*back.one}))};
}
export function buildPrizeHypotheses(rows,backtest){
 if(!backtest||backtest.trainingIsPastOnly!==true||backtest.evaluatedDraws<100)throw Error('必须先通过可复核的历史滚动样本外测试');
 const weights=forwardWeightsAtLatest(rows);
 if(backtest.lastTestPeriod!==weights.throughPeriod)throw Error('模型回测与当前历史截止期号不一致，拒绝使用可能滞后的统计信号');
 if(backtest.trainWindow!==weights.trainWindow||backtest.priorStrength!==weights.priorStrength||
 backtest.weightLimit!==weights.weightLimit)throw Error('候选权重与回测参数不一致，禁止事后调参');
 const front=topFiveFront(weights.front);
 const backs=backPrizeChances(weights.back);
 const first=[...backs].sort((a,b)=>b.both-a.both||a.back[0]-b.back[0]||a.back[1]-b.back[1])[0];
 const second=[...backs].sort((a,b)=>b.one-a.one||a.back[0]-b.back[0]||a.back[1]-b.back[1])[0];
 const firstTarget=renderStrategy(front,first,'一等奖5+2：最大化模型下完整5+2概率');
 const secondTarget=renderStrategy(front,second,'二等奖5+1：最大化模型下后区恰中1个概率');
 const fairFirst=5/EXACT_COMBINATIONS,fairSecond=100/EXACT_COMBINATIONS;
 return{
  version:PRIZE_TARGET_VERSION,historyThroughPeriod:weights.throughPeriod,
  outOfSampleSignal:backtest.preliminarySignal===true,
  evidenceStatus:backtest.preliminarySignal===true?'历史样本外初步有正向统计信号，仍未经过未来开奖事前验证':
    '历史滚动样本外没有通过预设稳健证据门槛：仅输出研究假设，不构成购买或预测优势建议',
  parameterLock:{trainWindow:weights.trainWindow,priorStrength:weights.priorStrength,weightLimit:weights.weightLimit},
  candidatePoolSize:front.evaluated,numberPool:front.pool,backPairCount:backs.length,
  strategies:[firstTarget,secondTarget],fairBaselines:{first:fairFirst,second:fairSecond},
  modelFirstRatios:[firstTarget,secondTarget].map(x=>x.weightedFirstProbability/fairFirst),
  modelSecondRatios:[firstTarget,secondTarget].map(x=>x.weightedSecondProbability/fairSecond),
  note:'只用当时已有历史数据给两种奖级分别排序：后区一等奖需两球全中，二等奖需恰中一个。前区只在权重最高15个号码的3003个五数组合中搜索，并非全空间最优。任何基于未验证加权模型的概率倍率都不是现实中奖概率的可靠提升证据。公平随机开奖下全部组合等概率。'
 };
}
