'use strict';
const V3 = (()=>{
 const version='BC-deterministic-3.0',equal=[.2,.2,.2,.2,.2],variants=[equal,...Array.from({length:5},(_,i)=>equal.map((_,j)=>i===j?.4:.15))];
 const names=['频率','冷热遗漏','组合结构','时间序列','异常稳健性'];
 function analytics(rows){
  const windows=[0,300,100,30].map(size=>{const a=size?rows.slice(-size):rows,zones=[[35,0,5],[12,5,7]].map(([max,start,end])=>{
   const frequency=Array(max).fill(0),gap=Array(max).fill(a.length),association={};a.forEach((r,i)=>{const n=r.nums.slice(start,end);n.forEach(v=>{frequency[v-1]++;gap[v-1]=a.length-i-1});for(let j=0;j<n.length;j++)for(let k=j+1;k<n.length;k++){const key=n[j]+'+'+n[k];association[key]=(association[key]||0)+1}});
   const p=(end-start)/max,expected=a.length*p,variance=a.length*p*(1-p);return {frequency,gap,association,hot:frequency.map((n,i)=>({number:i+1,count:n})).sort((a,b)=>b.count-a.count||a.number-b.number).slice(0,5),cold:frequency.map((n,i)=>({number:i+1,count:n})).sort((a,b)=>a.count-b.count||a.number-b.number).slice(0,5),z:frequency.map(n=>variance?(n-expected)/Math.sqrt(variance):0)};
  });
  const series=a.map((r,i)=>{const f=r.nums.slice(0,5),prev=a[i-1]?.nums.slice(0,5)||[];return {period:r.period,odd:f.filter(n=>n%2).length,big:f.filter(n=>n>17).length,sum:f.reduce((x,y)=>x+y,0),span:f[4]-f[0],consecutive:f.slice(1).filter((n,i)=>n===f[i]+1).length,repeated:f.filter(n=>prev.includes(n)).length}});
  const means={};for(const k of ['odd','big','sum','span','consecutive','repeated'])means[k]=series.length?series.reduce((n,r)=>n+r[k],0)/series.length:null;
  return {window:size||'全历史',count:a.length,zones,means,series};
 });return {version,windows,notice:'频率Z值为公平独立开奖下的探索性边际诊断，未校正多重比较；关联与时间走势不证明预测优势或人为操纵。'};
 }
 function pool(rows){
  if(rows.length<120||rows.some(r=>!Research.valid(r)))throw Error('V3至少需要120条合法且已校验记录');
  const stats=analytics(rows).windows,zoneScores=(nums,z)=>{
   const frequency=stats.reduce((s,w)=>s+nums.reduce((t,n)=>t+w.zones[z].frequency[n-1]/Math.max(1,...w.zones[z].frequency),0)/nums.length,0)/stats.length;
   const cold=nums.reduce((s,n)=>s+stats[0].zones[z].gap[n-1]/Math.max(1,...stats[0].zones[z].gap),0)/nums.length;
   const trend=nums.reduce((s,n)=>s+(stats[3].zones[z].frequency[n-1]/Math.max(1,...stats[3].zones[z].frequency)+1-stats[0].zones[z].frequency[n-1]/Math.max(1,...stats[0].zones[z].frequency))/2,0)/nums.length;
   const robust=nums.reduce((s,n)=>s+1/(1+Math.abs(stats[0].zones[z].z[n-1])),0)/nums.length;
   const structure=z===0?((1-Math.abs(nums.filter(n=>n%2).length-2.5)/2.5)+Math.max(0,1-Math.abs(nums.reduce((a,b)=>a+b,0)-90)/90))/2:0;
   return [frequency/2,cold/2,structure,trend/2,robust/2];
  };
  const fronts=[];let rank=0;
  for(let a=1;a<=31;a++)for(let b=a+1;b<=32;b++)for(let c=b+1;c<=33;c++)for(let d=c+1;d<=34;d++)for(let e=d+1;e<=35;e++){if(rank%137===0||e===d+1&&d===c+1&&c===b+1&&b===a+1){const nums=[a,b,c,d,e];fronts.push({nums,s:zoneScores(nums,0)})}rank++}
  const bases=[...Array.from({length:5},(_,i)=>equal.map((_,j)=>i===j?1:0)),...variants],chosen=new Map();
  const dot=(a,w)=>a.reduce((s,v,i)=>s+v*w[i],0),lex=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0};
  for(const w of bases)fronts.slice().sort((a,b)=>dot(b.s,w)-dot(a.s,w)||lex(a.nums,b.nums)).slice(0,5).forEach(f=>chosen.set(f.nums.join(','),f));
  const backs=[];for(let a=1;a<=11;a++)for(let b=a+1;b<=12;b++)backs.push({nums:[a,b],s:zoneScores([a,b],1)});
  const result=[];for(const f of chosen.values())for(const b of backs){const scores=Object.fromEntries(names.map((n,i)=>[n,f.s[i]+b.s[i]]));result.push({nums:[...f.nums,...b.nums],scores,score:100*dot(Object.values(scores),equal)})}
  return result.sort((a,b)=>b.score-a.score||lex(a.nums,b.nums));
 }
 function compare(a,b){for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0}
 function select(pool,w){return pool.map(p=>({...p,score:Object.values(p.scores).reduce((s,v,i)=>s+v*w[i]*100,0),contributions:Object.fromEntries(names.map((n,i)=>[n,p.scores[n]*w[i]*100]))})).sort((a,b)=>b.score-a.score||compare(a.nums,b.nums)).slice(0,5)}
 function calibrate(rows,testIndex){
  const before=rows.slice(0,testIndex).filter(r=>r.date<rows[testIndex].date),targets=Study.plan(before,30),scores=variants.map(w=>({weights:w,first:0,second:0}));
  for(const i of targets){const p=pool(before.slice(0,i).filter(r=>r.date<before[i].date));scores.forEach(s=>{const m=Study.outcome(select(p,s.weights).map(p=>p.nums),before[i]);s.first+=m.firstPrizeHits;s.second+=m.prizes[2]})}
  const best=scores.slice().sort((a,b)=>b.first-a.first||b.second-a.second)[0];
  return {weights:targets.length>=10?best.weights:equal,trainingPeriods:targets.map(i=>before[i].period),testStarts:rows[testIndex].period,scores,mode:targets.length>=10?'训练期滚动留出按5+2优先、5+1次之选择；平局等权，冻结后独立测试':'训练留出不足10期，使用等权研究基线，未优化',advantage:'未验证预测优势'};
 }
 function generate(rows){if(rows.length<150)throw Error('V3需要至少150条有效历史：120条起步训练加30条独立留出；不能补造回测成绩');const split=rows.length-30,c=calibrate(rows,split),picks=select(pool(rows),c.weights);const heldOut={draws:0,first:0,second:0,byRank:Array.from({length:5},()=>({draws:0,first:0,second:0}))};for(let i=split;i<rows.length;i++){const tickets=select(pool(rows.slice(0,i).filter(r=>r.date<rows[i].date)),c.weights).map(p=>p.nums),m=Study.outcome(tickets,rows[i]);tickets.forEach((t,k)=>{const a=Study.outcome([t],rows[i]),r=heldOut.byRank[k];r.draws++;r.first+=a.firstPrizeHits;r.second+=a.prizes[2]});heldOut.draws++;heldOut.first+=m.firstPrizeHits;heldOut.second+=m.prizes[2]}
 return {picks,weights:c.weights,calibration:c,heldOut,analytics:analytics(rows),version,search:'按字典序每137个前区组合取1个，并纳入连续五数层；后区66种全部遍历。对5模型与6候选权重分别保留前区前5，与全部后区交叉；仅保证该确定性分层空间、这些权重下的前5，不保证全组合全局最优。',advantage:'未验证预测优势'};
 }
 return {version,equal,variants,analytics,pool,select,calibrate,generate};
})();
