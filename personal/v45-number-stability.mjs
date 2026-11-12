import{valid}from './v31-core.mjs';
export const STABILITY_VERSION='V4.5-number-29-temporal-v1';
function orderedHistory(input){
 if(!Array.isArray(input)||input.length<1100||input.length>12000)throw Error('研究号码的时间稳定性至少需要1100期有效历史');
 const rows=[...input].sort((a,b)=>String(a.period).localeCompare(String(b.period)));
 const used=new Set();
 for(const row of rows){
  if(!valid(row)||used.has(row.period))throw Error('异常号码研究发现重复期号或格式错误');
  used.add(row.period);
 }
 for(let i=1;i<rows.length;i++)if(rows[i].date<rows[i-1].date)throw Error('历史期号与日期不一致');
 return rows;
}
function zoneInfo(zone){
 if(zone==='front')return{start:0,k:5,total:35};
 if(zone==='back')return{start:5,k:2,total:12};
 throw Error('号码区域必须是前区或后区');
}
function appears(row,n,zone){const {start,k}=zoneInfo(zone);return row.nums.slice(start,start+k).includes(n)?1:0}
function windowSummary(rows,zone,number,name){
 const hits=rows.reduce((s,r)=>s+appears(r,number,zone),0);
 const probability=zoneInfo(zone).k/zoneInfo(zone).total;
 return{name,periodStart:rows[0].period,periodEnd:rows.at(-1).period,draws:rows.length,hits,
   expectedHits:rows.length*probability,observedRate:hits/rows.length,fairRate:probability,
   excessRelative:hits/(rows.length*probability)-1};
}
function predictiveSequence(rows,number,zone,holdout,trainWindow,priorStrength){
 const {k,total}=zoneInfo(zone),baseline=k/total,begin=rows.length-holdout;
 let trainingHits=rows.slice(begin-trainWindow,begin).reduce((s,row)=>s+appears(row,number,zone),0);
 const scores=[];
 for(let i=begin;i<rows.length;i++){
  const probability=Math.max(baseline*0.8,Math.min(baseline*1.2,
   (trainingHits+priorStrength*baseline)/(trainWindow+priorStrength)));
  const actual=appears(rows[i],number,zone);
  const advantage=actual?Math.log(probability/baseline):Math.log((1-probability)/(1-baseline));
  scores.push({period:rows[i].period,estimatedProbability:probability,observed:actual,logAdvantage:advantage});
  trainingHits-=appears(rows[i-trainWindow],number,zone);
  trainingHits+=actual;
 }
 const delta=scores.reduce((s,r)=>s+r.logAdvantage,0),n=scores.length;
 const mean=delta/n,variance=scores.reduce((s,r)=>s+(r.logAdvantage-mean)**2,0)/(n-1);
 const half=n/2,split=Math.floor(half);
 const first=scores.slice(0,split).reduce((s,r)=>s+r.logAdvantage,0)/split;
 const second=scores.slice(split).reduce((s,r)=>s+r.logAdvantage,0)/(n-split);
 const margin=1.96*Math.sqrt(variance/n);
 return{number,zone,testDraws:n,firstPeriod:scores[0].period,lastPeriod:scores.at(-1).period,
  observedHits:scores.reduce((s,r)=>s+r.observed,0),
  meanLogAdvantage:mean,interval95Approx:[mean-margin,mean+margin],
  firstHalfMean:first,secondHalfMean:second,
  preliminaryPositive:mean-margin>0&&first>0&&second>0,
  firstEstimatedProbability:scores[0].estimatedProbability,
  lastEstimatedProbability:scores.at(-1).estimatedProbability,
  scores};
}
export function analyzeTemporalStability(input,{number=29,zone='front',holdout=400,trainWindow=600,priorStrength=1800}={}){
 const rows=orderedHistory(input),{total,k}=zoneInfo(zone);
 if(!Number.isInteger(number)||number<1||number>total)throw Error('研究号码超出区域范围');
 if(!Number.isInteger(holdout)||holdout<100||holdout>800||!Number.isInteger(trainWindow)||
 trainWindow<300||trainWindow>2000||!Number.isFinite(priorStrength)||priorStrength<100||priorStrength>10000||
 rows.length<holdout+trainWindow)throw Error('时间切分参数异常或历史不足');
 const begin=rows.length-holdout,past=rows.slice(0,begin),future=rows.slice(begin);
 const all=windowSummary(rows,zone,number,'全部历史（发现阶段）');
 const before=windowSummary(past,zone,number,'前'+past.length+'期');
 const recent=windowSummary(future,zone,number,'最近'+holdout+'期');
 const blocks=[];
 for(let start=0;start<rows.length;start+=300)blocks.push(windowSummary(rows.slice(start,start+300),zone,number,'按时间第'+(blocks.length+1)+'段'));
 const lastTraining=rows.slice(begin-trainWindow,begin);
 const counts=Array(total).fill(0);
 for(const r of lastTraining)for(const n of r.nums.slice(zoneInfo(zone).start,zoneInfo(zone).start+k))counts[n-1]++;
 const selected=counts.map((hits,i)=>({number:i+1,hits})).sort((a,b)=>b.hits-a.hits||a.number-b.number)[0];
 const discovered=predictiveSequence(rows,number,zone,holdout,trainWindow,priorStrength);
 const pretestSelected=predictiveSequence(rows,selected.number,zone,holdout,trainWindow,priorStrength);
 return{version:STABILITY_VERSION,number,zone,throughPeriod:rows.at(-1).period,
  all,before,recent,blocks,selectedBeforeHoldout:selected,discoveredNumberForwardScore:discovered,
  pretestSelectedForwardScore:pretestSelected,
  selectedAtPeriod:rows[begin-1].period,holdoutFirstPeriod:rows[begin].period,
  interpretation:'发现的号码由全2946期选出，最近400期虽然可回放逐期预测，但已用于发现该号码，绝不是独立样本外确认。另一个“历史切点之前确定的最热号码”只使用切点前600期决定号码，滚动评分时也不查看当期开奖；但该研究设计在事后进行，仍属探索性分析，需要未来事前验证。',
  warning:'整个历史期内出现频率显著、近期仍偏热、或滚动对数评分偶然为正，都不能单独证明下期更容易开出该号码，更不能证明有人操作。'};
}
