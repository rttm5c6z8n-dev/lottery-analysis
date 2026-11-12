import{valid}from './v31-core.mjs';
export const REGIME_VERSION='V4.5-regime-scan-v1';
const ZONES=[{name:'前区',offset:0,size:5,total:35},{name:'后区',offset:5,size:2,total:12}];
const GAUSS=0.3989422804014327;
// A&S 7.1.26 normal upper tail approximation, max error ~7.5e-8.
// Used for exploratory two-sided two-sample Z, not an exact test.
export function normalTwoTail(z){
 if(!Number.isFinite(z))throw Error('统计量非法');
 const t=1/(1+0.2316419*Math.abs(z));
 const survival=GAUSS*Math.exp(-z*z/2)*t*(0.319381530+
  t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
 return Math.max(0,Math.min(1,2*survival));
}
export function scanChronologicalRegimes(history,{minSegment=600,step=300}={}){
 if(!Array.isArray(history)||history.length<minSegment*2||history.length>12000||
 !Number.isInteger(minSegment)||minSegment<300||!Number.isInteger(step)||step<100)throw Error('分段扫描期数或参数不合法');
 const rows=[...history].sort((a,b)=>String(a.period).localeCompare(String(b.period)));
 let last='';
 for(const r of rows){
  if(!valid(r)||r.period<=last)throw Error('分段扫描发现非法或重复期次');
  last=r.period;
 }
 const n=rows.length,cuts=[];
 for(let c=minSegment;c<=n-minSegment;c+=step)cuts.push(c);
 if(!cuts.length)throw Error('没有满足每段最少期次的切点');
 const flat=[...ZONES.flatMap(z=>Array.from({length:z.total},(_,i)=>({zone:z.name,number:i+1,offset:z.offset,size:z.size,total:z.total})))];
 const counts=Array(flat.length).fill(0),checkpoints=new Map();
 const frontPositions=Array(36).fill(0).map((_,i)=>i-1);
 const backPositions=Array(13).fill(0).map((_,i)=>i+34);
 const interested=new Set(cuts);
 for(let i=0;i<n;i++){
  const r=rows[i];
  for(const num of r.nums.slice(0,5))counts[frontPositions[num]]++;
  for(const num of r.nums.slice(5))counts[backPositions[num]]++;
  if(interested.has(i+1))checkpoints.set(i+1,[...counts]);
 }
 const totalTests=flat.length*cuts.length,all=[];
 for(let ci=0;ci<cuts.length;ci++){
  const cut=cuts[ci],early=checkpoints.get(cut);
  for(let i=0;i<flat.length;i++){
   const entry=flat[i],n1=cut,n2=n-cut;
   const a=early[i],b=counts[i]-a,rateA=a/n1,rateB=b/n2,pool=(a+b)/n;
   const denominator=Math.sqrt(pool*(1-pool)*(1/n1+1/n2));
   const z=denominator>0?(rateA-rateB)/denominator:0;
   const rawP=normalTwoTail(z);
   all.push({zone:entry.zone,number:entry.number,cut,firstEndPeriod:rows[cut-1].period,
    secondStartPeriod:rows[cut].period,earlyHits:a,earlyDraws:n1,lateHits:b,lateDraws:n2,
    earlyRate:rateA,lateRate:rateB,delta:rateA-rateB,zScore:z,rawP,
    adjustedP:Math.min(1,rawP*totalTests),signal:rawP*totalTests<0.05});
  }
 }
 all.sort((a,b)=>a.adjustedP-b.adjustedP||Math.abs(b.zScore)-Math.abs(a.zScore));
 const for29=all.filter(x=>x.zone==='前区'&&x.number===29);
 return{version:REGIME_VERSION,throughPeriod:rows.at(-1).period,draws:n,
  cutpoints:cuts,tests:totalTests,all,top:all.slice(0,20),number29:for29,
  correctedSignals:all.filter(x=>x.signal),
  note:'探索性时间变点扫描：预先固定每隔300期一条切线、两端至少600期，并同时扫描前区35和后区12个号码；对所有47×切点数两侧Z检验做Bonferroni校正。Z基于二样本率差正态近似。分段范围由已观察历史激发，且研究过其他检验，不能把校正p值解释成独立预注册发现。显著时间漂移不能证明人为操作、机械故障或下一期可预测。'};
}
