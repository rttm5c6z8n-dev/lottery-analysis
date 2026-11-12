import{valid}from './v31-core.mjs';
export const MECHANICAL_VERSION='V4.5-bias-audit-v1';
export const NUMBER_OF_TESTS=94; // 35+12 full history, and 35+12 recent (two families).
export const EXACT_COMBINATIONS=21425712;
function logFactorials(n){
 const out=new Float64Array(n+1);
 for(let i=2;i<=n;i++)out[i]=out[i-1]+Math.log(i);
 return out;
}
function tail(n,p,start,end,logs){
 let max=-Infinity,sum=0;
 for(let j=start;j<=end;j++){
  const v=logs[n]-logs[j]-logs[n-j]+j*Math.log(p)+(n-j)*Math.log1p(-p);
  if(v>max){sum=sum*Math.exp(max-v)+1;max=v}
  else sum+=Math.exp(v-max);
 }
 return Math.min(1,Math.exp(max)*sum);
}
export function exactBinomialTwoTail(n,k,p,logs=logFactorials(n)){
 if(!Number.isInteger(n)||n<1||!Number.isInteger(k)||k<0||k>n||!(p>0&&p<1))throw Error('二项检验参数非法');
 return Math.min(1,2*Math.min(tail(n,p,0,k,logs),tail(n,p,k,n,logs)));
}
function canonicalHistory(input){
 if(!Array.isArray(input)||input.length<1100||input.length>12000)throw Error('需要1100至12000期已核验格式的历史开奖数据');
 const rows=input.slice().sort((a,b)=>String(a.period).localeCompare(String(b.period)));
 const seen=new Set();
 for(const row of rows){
  if(!valid(row)||seen.has(row.period))throw Error('历史期号重复或号码、年份、日期不合法；分析已停止');
  seen.add(row.period);
 }
 for(let i=1;i<rows.length;i++){
  if(rows[i].date<rows[i-1].date)throw Error('历史期号与日期顺序冲突，拒绝分析');
 }
 return rows;
}
export function countZone(rows,offset,k,max){
 const counts=Array(max).fill(0);
 for(const row of rows)for(const n of row.nums.slice(offset,offset+k))counts[n-1]++;
 return counts;
}
export function biasFrequencyTests(input){
 const rows=canonicalHistory(input);
 const recentSize=Math.min(300,Math.floor(rows.length/3));
 const windows=[{name:'全部历史',rows},{name:'最近'+recentSize+'期',rows:rows.slice(-recentSize)}];
 const tests=[];
 for(const win of windows){
  const logs=logFactorials(win.rows.length);
  for(const zone of [{name:'前区',offset:0,k:5,max:35},{name:'后区',offset:5,k:2,max:12}]){
   const counts=countZone(win.rows,zone.offset,zone.k,zone.max),p=zone.k/zone.max;
   counts.forEach((count,i)=>{
    const raw=exactBinomialTwoTail(win.rows.length,count,p,logs);
    tests.push({window:win.name,zone:zone.name,number:i+1,count,n:win.rows.length,
     expected:win.rows.length*p,deviation:count-win.rows.length*p,
     rawP:raw,adjustedP:Math.min(1,raw*NUMBER_OF_TESTS),
     crossesFamilyAlpha:raw*NUMBER_OF_TESTS<0.05});
   });
  }
 }
 tests.sort((a,b)=>a.adjustedP-b.adjustedP||Math.abs(b.deviation)-Math.abs(a.deviation));
 return{version:MECHANICAL_VERSION,throughPeriod:rows.at(-1).period,
  length:rows.length,testsExecuted:tests.length,alphaFamily:0.05,
  significant:tests.filter(x=>x.crossesFamilyAlpha),all:tests,
  caveat:'二项分布假设各期独立且同分布，并对两段时间窗口的47个号码共94次检验进行Bonferroni校正；结果仅能提示边际频率异常，不能证明某个球组/设备造成偏差，也不能证明异常可预测。'};
}
function inclusionWeights(counts,draws,p,priorStrength,limit){
 return counts.map(count=>{
  const estimated=(count+priorStrength*p)/(draws+priorStrength);
  return Math.max(1-limit,Math.min(1+limit,estimated/p));
 });
}
export function probabilityUnorderedDraw(values,weights){
 const n=weights.length,k=values.length;
 if(!Number.isInteger(n)||n<2||k<1||k>7||k>n||weights.some(w=>!Number.isFinite(w)||w<=0)||new Set(values).size!==k||values.some(x=>!Number.isInteger(x)||x<1||x>n))throw Error('加权无放回抽样的参数不合法');
 const total=weights.reduce((a,b)=>a+b,0),maskMax=1<<k;
 const subset=new Float64Array(maskMax),dp=new Float64Array(maskMax);
 for(let mask=1;mask<maskMax;mask++){
  const bit=Math.floor(Math.log2(mask&-mask)),before=mask^(1<<bit);
  subset[mask]=subset[before]+weights[values[bit]-1];
 }
 dp[0]=1;
 for(let mask=0;mask<maskMax-1;mask++){
  const denom=total-subset[mask];
  if(denom<=0)throw Error('剩余权重总和异常');
  for(let j=0;j<k;j++)if(!(mask&(1<<j)))dp[mask|(1<<j)]+=dp[mask]*weights[values[j]-1]/denom;
 }
 return dp[maskMax-1];
}
function logRatio(row,frontCounts,backCounts,nWindow,priorStrength,limit){
 const wf=inclusionWeights(frontCounts,nWindow,5/35,priorStrength,limit);
 const wb=inclusionWeights(backCounts,nWindow,2/12,priorStrength,limit);
 const front=probabilityUnorderedDraw(row.nums.slice(0,5),wf);
 const back=probabilityUnorderedDraw(row.nums.slice(5),wb);
 if(!(front>0&&back>0))throw Error('滚动预测概率无效');
 return Math.log(front*back*EXACT_COMBINATIONS);
}
export function walkForwardBiasTest(input,{testDraws=400,trainWindow=600,priorStrength=1800,weightLimit=0.2}={}){
 const rows=canonicalHistory(input);
 if(!Number.isInteger(testDraws)||testDraws<100||testDraws>800||!Number.isInteger(trainWindow)||trainWindow<300||trainWindow>2000||
 !Number.isFinite(priorStrength)||priorStrength<100||priorStrength>10000||!Number.isFinite(weightLimit)||weightLimit<=0||weightLimit>0.5)throw Error('滚动盲测参数无效');
 if(rows.length<testDraws+trainWindow)throw Error('历史数据不足以独立预留样本外区间');
 const begin=rows.length-testDraws,first=begin-trainWindow;
 const frontCounts=countZone(rows.slice(first,begin),0,5,35),backCounts=countZone(rows.slice(first,begin),5,2,12);
 const perDraw=[];
 for(let i=begin;i<rows.length;i++){
  const delta=logRatio(rows[i],frontCounts,backCounts,trainWindow,priorStrength,weightLimit);
  perDraw.push({period:rows[i].period,logLikelihoodAdvantage:delta});
  for(const num of rows[i-trainWindow].nums.slice(0,5))frontCounts[num-1]--;
  for(const num of rows[i-trainWindow].nums.slice(5))backCounts[num-1]--;
  for(const num of rows[i].nums.slice(0,5))frontCounts[num-1]++;
  for(const num of rows[i].nums.slice(5))backCounts[num-1]++;
 }
 const vals=perDraw.map(x=>x.logLikelihoodAdvantage),n=vals.length;
 const sum=vals.reduce((a,b)=>a+b,0),mean=sum/n,variance=vals.reduce((s,x)=>s+(x-mean)**2,0)/(n-1);
 const standardError=Math.sqrt(variance/n),half=Math.floor(n/2);
 const firstHalf=vals.slice(0,half).reduce((a,b)=>a+b,0)/half;
 const secondHalf=vals.slice(half).reduce((a,b)=>a+b,0)/(n-half);
 const lower=mean-1.96*standardError,upper=mean+1.96*standardError;
 // Fixed algorithm, no hyperparameter selection on these test draws.
 return{
  version:MECHANICAL_VERSION,trainingIsPastOnly:true,firstTestPeriod:perDraw[0].period,lastTestPeriod:perDraw.at(-1).period,
  evaluatedDraws:n,trainWindow,priorStrength,weightLimit,
  totalLogAdvantage:sum,meanLogAdvantage:mean,standardError,interval95:[lower,upper],
  firstHalfMean:firstHalf,secondHalfMean:secondHalf,
  preliminarySignal:lower>0&&firstHalf>0&&secondHalf>0,
  scores:perDraw,
  interpretation:lower>0&&firstHalf>0&&secondHalf>0?'固定规则的样本外对数评分出现初步正向差异，仍需新开奖事前复核；不能宣布可以预测一等奖或二等奖':
   '未在预设样本外检验中获得稳健的正向证据；不应把历史热号视为可提高中奖概率',
  caveat:'本测试使用过去600期频率、预设平滑和限幅预测下一期，逐期滚动更新；对照公平随机模型的完整无序5+2开奖概率。区间使用近似标准误，历史期次可能不独立；若反复改参数、重复试验，须另留全新数据检验。没有每期球组和设备标识，不能做设备归因。'};
}
export function prizeOdds(ticketCount=1){
 if(!Number.isInteger(ticketCount)||ticketCount<1||ticketCount>5)throw Error('仅计算1至5注且前区组合互异的策略');
 const first=ticketCount/EXACT_COMBINATIONS,second=ticketCount*20/EXACT_COMBINATIONS;
 return{firstProbability:first,secondProbability:second,firstOdds:1/first,secondOdds:1/second,
  disclaimer:'要求各注前区5号组合互异；公平开奖下任何具体号码的概率相同，数学计算不证明选中的号码更容易中一、二等奖。'};
}
