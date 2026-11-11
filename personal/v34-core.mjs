import {auditPeriods,segments} from './v33-core.mjs';
export const VERSION='V3.4-integrity';
export function inspectHistory(rows){
 const a=auditPeriods(rows), problems=[...a.issues], byYear=[];
 for(const y of a.years){
  const sorted=[...y.rows].sort((x,z)=>Number(x.period)-Number(z.period));
  const numbers=sorted.map(r=>Number(r.period));
  const gaps=[];
  for(let i=1;i<numbers.length;i++){
   const delta=numbers[i]-numbers[i-1];
   if(delta>1&&delta<1000)gaps.push({after:sorted[i-1].period,before:sorted[i].period,count:delta-1});
   if(delta<=0)problems.push({reason:'期号不递增',period:sorted[i].period});
  }
  const mismatched=sorted.filter(r=>String(r.period).slice(0,2)!==String(r.date).slice(2,4)).map(r=>r.period);
  if(mismatched.length)problems.push({reason:'期号年份与开奖日期年份不一致',periods:mismatched});
  byYear.push({year:y.year,count:y.count,first:y.first,last:y.last,gaps,missingCandidateCount:gaps.reduce((s,g)=>s+g.count,0),mismatched});
 }
 return{version:VERSION,total:a.total,valid:a.valid,problems,byYear,disclaimer:'缺期仅是期号跳跃候选，不等于真实漏采；需对照官方开奖日历。数据格式合格不等于官方真实性已核实。'};
}
export function adjustHolm(items){
 const sorted=items.map((x,i)=>({i,p:x.pValue})).filter(x=>Number.isFinite(x.p)&&x.p>=0&&x.p<=1).sort((a,b)=>a.p-b.p);
 let prev=0;const out=items.map(()=>null);
 for(let k=0;k<sorted.length;k++){const adjusted=Math.min(1,(sorted.length-k)*sorted[k].p);prev=Math.max(prev,adjusted);out[sorted[k].i]=prev}
 return out;
}
export function yearlyReview(rows,zone=0,simulations=2000){
 const r=segments(rows,{zone,simulations}), adjusted=adjustHolm(r.years.map(y=>({pValue:y.test?.pValue??null})));
 return{version:VERSION,zone:r.zone,years:r.years.map((y,i)=>({year:y.year,count:y.count,statistic:y.test?.statistic??null,pValue:y.test?.pValue??null,holmAdjustedP:adjusted[i]})),disclaimer:'Holm修正控制本次年度检验家族的多重比较风险；统计显著不证明可预测，也不证明设备因果。'};
}
