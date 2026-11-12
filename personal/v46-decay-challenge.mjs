import{valid}from './v31-core.mjs';
import{probabilityUnorderedDraw,EXACT_COMBINATIONS,walkForwardBiasTest}from './v45-mechanical-bias.mjs';
export const VERSION='V4.6-decay-challenge-v1';
// Fixed, transparent hypotheses. Do not tune these on the 400 evaluated draws.
export const DECAY_CANDIDATES=Object.freeze([
 Object.freeze({id:'decay-90',label:'近期衰减90期',halfLife:90,prior:300,limit:0.2}),
 Object.freeze({id:'decay-300',label:'中期衰减300期',halfLife:300,prior:600,limit:0.2})
]);
const P_FRONT=5/35,P_BACK=2/12,TRAIN=600,TEST=400,SPLIT=200;
const norm=(n)=>String(n).padStart(2,'0');
function checkedRows(input){
 if(!Array.isArray(input)||input.length<TRAIN+TEST||input.length>12000)throw Error('需要至少1000期完整历史用于历史时间切分');
 const rows=[...input].sort((a,b)=>String(a.period).localeCompare(String(b.period)));
 let lastPeriod='',lastDate='';
 for(const r of rows){
  if(!valid(r)||String(r.period)<=lastPeriod||r.date<lastDate)throw Error('存在无效、重复或逆序的历史期号');
  lastPeriod=r.period;lastDate=r.date;
 }
 return rows;
}
export function decayWeights(rows,end,config,zone){
 const{halfLife,prior,limit}=config||{};
 if(!Array.isArray(rows)||!Number.isInteger(end)||end<TRAIN||end>rows.length||
 !Number.isFinite(halfLife)||halfLife<30||halfLife>800||
 !Number.isFinite(prior)||prior<50||prior>3000||
 !Number.isFinite(limit)||limit<=0||limit>0.4||
 !['front','back'].includes(zone))throw Error('时间衰减权重配置不合法');
 const n=zone==='front'?35:12,base=zone==='front'?P_FRONT:P_BACK;
 const start=zone==='front'?0:5,k=zone==='front'?5:2;
 const counts=Array(n).fill(0);let total=0;
 for(let i=end-TRAIN;i<end;i++){
  const age=end-i-1,w=Math.exp(-Math.LN2*age/halfLife);total+=w;
  for(const ball of rows[i].nums.slice(start,start+k))counts[ball-1]+=w;
 }
 return counts.map(count=>Math.max(1-limit,Math.min(1+limit,((count+prior*base)/(total+prior))/base)));
}
function logFairRelative(observed,front,back){
 const p=probabilityUnorderedDraw(observed.nums.slice(0,5),front)*
   probabilityUnorderedDraw(observed.nums.slice(5),back);
 if(!(p>0))throw Error('模型对数概率不合法');
 return Math.log(p*EXACT_COMBINATIONS);
}
function stats(scores){
 const n=scores.length,sum=scores.reduce((a,b)=>a+b,0),mean=sum/n;
 const variance=scores.reduce((a,b)=>a+(b-mean)**2,0)/(n-1),stderr=Math.sqrt(variance/n);
 return{draws:n,mean,total:sum,stderr,interval95:[mean-1.96*stderr,mean+1.96*stderr],
  positiveLowerBound:mean-1.96*stderr>0};
}
function makeRows(rows){
 const start=rows.length-TEST,outputs=Object.fromEntries(DECAY_CANDIDATES.map(c=>[c.id,[]]));
 for(let i=start;i<rows.length;i++){
  for(const c of DECAY_CANDIDATES){
   const fw=decayWeights(rows,i,c,'front'),bw=decayWeights(rows,i,c,'back');
   outputs[c.id].push({period:rows[i].period,advantage:logFairRelative(rows[i],fw,bw)});
  }
 }
 return outputs;
}
export function compareDecayModels(input){
 const rows=checkedRows(input);
 const current=walkForwardBiasTest(rows,{testDraws:TEST,trainWindow:TRAIN,priorStrength:1800,weightLimit:0.2});
 if(current.evaluatedDraws!==TEST||current.lastTestPeriod!==rows.at(-1).period)throw Error('历史基准回测区间不一致');
 const traces=makeRows(rows);
 const models=[
  {id:'uniform',label:'公平随机零偏差',scores:Array(TEST).fill(0)},
  {id:'fixed-600',label:'原600期固定窗口',scores:current.scores.map(x=>x.logLikelihoodAdvantage)},
  ...DECAY_CANDIDATES.map(x=>({id:x.id,label:x.label,scores:traces[x.id].map(v=>v.advantage)}))
 ];
 const data=models.map(model=>({
  id:model.id,label:model.label,
  first200:stats(model.scores.slice(0,SPLIT)),last200:stats(model.scores.slice(SPLIT)),
  all400:stats(model.scores),scores:model.scores
 }));
 // First 200 rounds choose algorithm; last 200 evaluate it without re-choosing.
 const selected=[...data].sort((a,b)=>b.first200.mean-a.first200.mean||a.id.localeCompare(b.id))[0];
 const holdout=selected.last200;
 const frontDecay=DECAY_CANDIDATES.map(x=>({
  id:x.id,front29Weight:decayWeights(rows,rows.length,x,'front')[28],
  back07Weight:decayWeights(rows,rows.length,x,'back')[6]
 }));
 return{version:VERSION,periodStart:rows.at(-TEST).period,periodCut:rows.at(-SPLIT-1).period,
  selectionEndPeriod:rows.at(-SPLIT-1).period,validationStartPeriod:rows.at(-SPLIT).period,
  periodEnd:rows.at(-1).period,trainingWindow:TRAIN,selectionDraws:SPLIT,validationDraws:SPLIT,
  testDraws:TEST,models:data.map(({scores,...rest})=>rest),
  selectedByEarly200:selected.id,selectedLabel:selected.label,
  late200Advantage:holdout.mean,late200Interval95:holdout.interval95,
  exploratoryPassed: selected.id!=='uniform'&&holdout.positiveLowerBound,
  latestBiasWeights:frontDecay,
  disclaimer:'模型及参数是在看过历史整体规律后设计的，虽在代码内固定前200期选模型、后200期评估，并且每一期只使用之前600期数据，仍不是未接触过的独立验证。不能根据这400期再次挑最佳模型并声称已证明优势。极低概率的一、二等奖不能只靠400期奖级命中次数验证；本检验采用完整5+2开奖结果的对数概率评分。'};
}
