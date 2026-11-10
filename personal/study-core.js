'use strict';
const Study = (() => {
  const version = 'BC-research-2.1', weights = [0.25, 0.2, 0.2, 0.2, 0.15];
  const strategies = ['频率', '冷热遗漏', '组合结构', '时间序列', '异常稳健性', '融合'];
  const stamp = () => new Date(Date.now() + 28800000).toISOString().replace('Z', '+08:00');
  function audit(raw, at) {
    if (!Array.isArray(raw)) throw Error('历史数据不是数组');
    const counts = new Map(), validRows = [], issues = [];
    raw.forEach(r => counts.set(String(r?.period), (counts.get(String(r?.period)) || 0) + 1));
    raw.forEach((r, index) => {
      const reasons = [];
      if (!r || !r.period || !r.date || !Array.isArray(r.nums) || r.nums.length !== 7) reasons.push('缺失必要字段/完整七个号码');
      if (!Research.valid(r)) reasons.push('期号、年份、日历日期或号码格式异常');
      if (counts.get(String(r?.period)) > 1) reasons.push('重复期号（全部副本排除）');
      if (Research.valid(r) && Date.parse(r.date + 'T23:59:59+08:00') >= Date.parse(at)) reasons.push('当日尚未结束或未来日期，保守排除');
      if (r?.availableAt && (!Number.isFinite(Date.parse(r.availableAt)) || Date.parse(r.availableAt) > Date.parse(at))) reasons.push('可用时间异常或晚于读取截止');
      if (reasons.length) issues.push({row: index + 1, period: r?.period ?? null, reasons});
      else validRows.push({period: String(r.period), date: r.date, nums: [...r.nums.slice(0,5).sort((a,b)=>a-b), ...r.nums.slice(5).sort((a,b)=>a-b)], availableAt: at});
    });
    validRows.sort((a,b) => a.date.localeCompare(b.date) || a.period.localeCompare(b.period));
    const bad = new Set();
    for (let i=1;i<validRows.length;i++) if (Number(validRows[i].period) <= Number(validRows[i-1].period)) {bad.add(validRows[i].period);bad.add(validRows[i-1].period)}
    for (const period of bad) issues.push({period,reasons:['期号与日期顺序冲突，排除']});
    const rows = validRows.filter(r=>!bad.has(r.period));
    return {total:raw.length, valid:rows.length, abnormal:raw.length-rows.length, issues, rows};
  }
  function fit(rows) {
    const window = rows.slice(-200);
    const zones = [[35,5,0],[12,2,5]].map(([max,count,start])=>{
      const frequency=Array(max).fill(0), recent=Array(max).fill(0), gap=Array(max).fill(window.length);
      window.forEach((r,i)=>r.nums.slice(start,start+count).forEach(n=>{frequency[n-1]++;gap[n-1]=window.length-i-1;if(i>=window.length-30)recent[n-1]++}));
      return {frequency,recent,gap};
    });
    return {version,engine:Research.VERSION,weights,rows:window,statistics:zones,trainedThroughPeriod:window.at(-1)?.period ?? null,window:200};
  }
  function plan(rows, scope) {
    if (![30,100,300,0].includes(Number(scope))) throw Error('未知回测范围');
    const targets=[];let past=0;
    // audit guarantees chronological dates and strictly increasing issue numbers.
    for(let i=0;i<rows.length;i++){while(past<i&&rows[past].date<rows[i].date)past++;if(past>=120)targets.push(i)}
    return Number(scope)?targets.slice(-Number(scope)):targets;
  }
  function trainFor(rows,index) {const target=rows[index];return rows.slice(0,index).filter(r=>r.date<target.date&&Number(r.period)<Number(target.period)).slice(-200)}
  function random(seed) {let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296}}
  function ticket(rand) {return [[35,5],[12,2]].flatMap(([max,n])=>{const a=Array.from({length:max},(_,i)=>i+1);for(let i=max-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n).sort((a,b)=>a-b)})}
  function tier(f,b) {return f===5?(b===2?1:b===1?2:3):f===4?(b===2?4:b===1?5:7):f===3?(b===2?6:b===1?8:9):f===2?(b===2?8:b===1?9:0):b===2?9:0}
  function empty() {return {draws:0,tickets:0,firstPrizeHits:0,winningDraws:0,secondWinningDraws:0,front:0,back:0,prizes:Array(10).fill(0),matches:{}}}
  function outcome(picks,target) {
    const m=empty();m.draws=1;m.tickets=picks.length;
    picks.forEach(nums=>{const f=nums.slice(0,5).filter(n=>target.nums.slice(0,5).includes(n)).length,b=nums.slice(5).filter(n=>target.nums.slice(5).includes(n)).length,t=tier(f,b);m.front+=f;m.back+=b;m.prizes[t]++;m.matches[f+'+'+b]=(m.matches[f+'+'+b]||0)+1;if(t===1)m.firstPrizeHits++});m.winningDraws=Number(m.firstPrizeHits>0);m.secondWinningDraws=Number(m.prizes[2]>0);return m;
  }
  function merge(a,b) {for(const k of ['draws','tickets','firstPrizeHits','winningDraws','front','back'])a[k]+=b[k];a.secondWinningDraws=(a.secondWinningDraws||0)+(b.secondWinningDraws||0);b.prizes.forEach((n,i)=>a.prizes[i]+=n);for(const[k,v]of Object.entries(b.matches))a.matches[k]=(a.matches[k]||0)+v;return a}
  function fold(rows,index,seed,fusionWeights=weights,v3=false) {
    const target=rows[index],train=v3?rows.slice(0,index).filter(r=>r.date<target.date&&Number(r.period)<Number(target.period)):trainFor(rows,index),pool=v3?V3.pool(train):Research.generate(train,(Number(target.period)^seed)>>>0,true);
    const selections=strategies.map((name,i)=>i===5?(v3?V3.select(pool,fusionWeights):fuse(pool,fusionWeights)):pool.slice().sort((a,b)=>b.scores[name]-a.scores[name]||b.score-a.score).slice(0,5));
    const metrics=selections.map(s=>outcome(s.map(p=>p.nums),target));
    const baselines=Array.from({length:100},(_,i)=>{const rand=random((Number(target.period)^seed^Math.imul(i+1,2654435761))>>>0),seen=new Set(),p=[];while(p.length<5){const nums=ticket(rand),key=nums.join(',');if(!seen.has(key)){seen.add(key);p.push(nums)}}return outcome(p,target)});
    return {period:target.period,date:target.date,targetNums:[...target.nums],trainPeriods:train.map(r=>r.period),lastTrainDate:train.at(-1).date,cutoff:target.date+'T00:00:00+08:00',availability:'可用性未证实',diagnostics:selections.map(x=>diagnose(x.map(p=>p.nums))),picks:selections.map(s=>s.map(p=>p.nums)),metrics,baselines};
  }
  function fuse(pool,w) {return pool.map(p=>({...p,score:Number(Object.values(p.scores).reduce((a,v,i)=>a+v*w[i]*100,0).toFixed(4))})).sort((a,b)=>b.score-a.score||a.nums.join(',').localeCompare(b.nums.join(','))).slice(0,5)}
  function diagnose(picks) {
    const seen=new Set(),counts=new Map();let duplicateTickets=0,pairSimilaritySum=0,pairs=0;
    picks.forEach(p=>{const k=p.join(',');if(seen.has(k))duplicateTickets++;seen.add(k);p.forEach((n,i)=>{const z=(i<5?'F':'B')+n;counts.set(z,(counts.get(z)||0)+1)})});
    for(let i=0;i<picks.length;i++)for(let j=i+1;j<picks.length;j++){let common=0;for(const [a,b]of [[0,5],[5,7]])common+=picks[i].slice(a,b).filter(n=>picks[j].slice(a,b).includes(n)).length;pairSimilaritySum+=common/7;pairs++}
    return {duplicateTickets,repeatedNumbers:[...counts.values()].filter(n=>n>1).length,pairSimilaritySum,pairs};
  }
  function calibrate(rows,testIndex,seed) {
    const testPeriod=rows[testIndex].period,testDate=rows[testIndex].date;rows=rows.slice(0,testIndex).filter(r=>r.date<testDate);const trainingTargets=plan(rows,30),variants=[weights,[.4,.15,.15,.15,.15],[.15,.4,.15,.15,.15],[.15,.15,.4,.15,.15],[.15,.15,.15,.4,.15],[.15,.15,.15,.15,.4]];
    if(trainingTargets.length<10)throw Error('独立训练集可回测期不足10期；请关闭权重研究，不得借用测试期');
    const scores=variants.map(w=>({weights:w,first:0,second:0}));
    for(const i of trainingTargets){const pool=Research.generate(trainFor(rows,i),(Number(rows[i].period)^seed)>>>0,true);scores.forEach(c=>{const m=outcome(fuse(pool,c.weights).map(p=>p.nums),rows[i]);c.first+=m.firstPrizeHits;c.second+=m.prizes[2]})}
    const winner=scores.slice().sort((a,b)=>b.first-a.first||b.second-a.second)[0];
    return {mode:'仅测试开始前的独立训练折研究；一等奖优先、二等奖次之，平局保留预设；冻结后不按测试结果调参',weights:winner.weights,trainingPeriods:trainingTargets.map(i=>rows[i].period),testStarts:testPeriod,scores};
  }
  function initialTotals() {return {strategies:strategies.map(empty),random:Array.from({length:100},empty),paired:strategies.map(()=>({n:0,front:0,front2:0,back:0,back2:0,first:0,first2:0}))}}
  function accumulate(t,f) {
    const mean=k=>f.baselines.reduce((s,r)=>s+r[k],0)/f.baselines.length;
    f.metrics.forEach((m,i)=>{merge(t.strategies[i],m);const p=t.paired[i];p.n++;for(const [key,metric] of [['front','front'],['back','back'],['first','firstPrizeHits']]){const d=m[metric]-mean(metric);p[key]+=d;p[key+'2']+=d*d}});
    f.baselines.forEach((r,i)=>merge(t.random[i],r));
  }
  function wilson(hits,n) {if(!n)return null;const z=1.9599639845,p=hits/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,c-h),Math.min(1,c+h)]}
  function report(job) {
    const randomSummary={replicates:100};for(const k of ['front','back','firstPrizeHits','secondPrizeHits']) {const a=job.totals.random.map(r=>k==='secondPrizeHits'?r.prizes[2]:r[k]).sort((a,b)=>a-b);randomSummary[k]={mean:a.reduce((x,y)=>x+y,0)/a.length,empirical95:[a[2],a[97]]};if(k==='firstPrizeHits'||(k==='secondPrizeHits'&&job.protocol)){const ci=job.totals.random.map(r=>wilson(k==='firstPrizeHits'?r.winningDraws:r.secondWinningDraws,r.draws));randomSummary[k].drawRate95Envelope=[Math.min(...ci.map(x=>x[0])),Math.max(...ci.map(x=>x[1]))]}}
    return {version:job.protocol===4?V3.version:version,advantage:'未验证预测优势',scope:job.scope,snapshotId:job.snapshotId,hash:job.hash,completedAt:job.savedAt,folds:job.cursor,window:job.protocol===4?'全历史/300/100/30四窗':'200',weights:job.weights||weights,calibration:job.calibration||{mode:'固定预设参数；没有用测试集调参'},availabilityStatus:'可用性未证实',unprovenFolds:job.cursor,targetPeriods:job.testPeriods||null,overfitting:'使用独立训练/测试边界，测试后不得反向调参；反复历史研究与多重比较风险仍在，尚未排除过拟合。',diagnostics:job.diagnostics||null,mode:'历史开奖顺序滚动重放；非当时实际发布的预测',prizeRule:'统一按现行9档号码匹配口径研究；不冒充2007年以来实际历史奖级、追加奖或奖金',strategies:job.totals.strategies.map((m,i)=>{const p=job.totals.paired[i],difference={};for(const k of ['front','back','first']){const mean=p[k]/p.n,variance=p.n>1?Math.max(0,(p[k+'2']-p[k]*p[k]/p.n)/(p.n-1)):NaN,half=1.96*Math.sqrt(variance/p.n);difference[k]={mean,approx95:k!=='first'&&p.n>=30&&variance>0?[mean-half,mean+half]:null}}return {name:strategies[i],...m,firstPrizeDrawRate95:wilson(m.winningDraws,m.draws),secondPrizeHits:m.prizes[2],secondPrizeDrawRate95:job.protocol?wilson(m.secondWinningDraws,m.draws):null,pairedDifferencePerDraw:difference}}),conclusion:'此报告不构成优于随机的可靠证明；辅助命中差异不能代替一等奖指标或前瞻验证。',random:randomSummary,theoreticalFirstPrizePerTicket:1/21425712,uncertainty:'一等奖5+2为第一指标，二等奖5+1为第二指标；随机基准每期100组各5注。前后区为辅助。配对差区间是近似描述，重叠窗口可能相关、五策略多重比较未校正；一等奖差值不使用稀疏样本正态区间，零方差辅助区间也不报告；极少/零一等奖命中无法证明优势，随机样本零命中不代表概率为零。参数与候选数固定，未据测试折调参。',availability:'可用性未证实：旧历史没有当时版本/发布时间证据；仅假设既往开奖记录当时已公开。只按目标前的期号和开奖日期训练，不回填实际可用时间，不作为事前认证成绩。'};
  }
  function batch(job,snapshot) {
    const start=job.cursor,items=[];if(job.protocol===4&&job.type==='replay'&&job.cursor===0&&!job.calibration){job.calibration=V3.calibrate(snapshot.rows,job.targets[0]);job.weights=job.calibration.weights;}if(job.type==='replay'&&job.protocol&&job.cursor===0)job.testPeriods=job.targets.map(i=>snapshot.rows[i].period);if(job.type==='replay'&&job.cursor===0&&job.tune&&!job.calibration){const c=calibrate(snapshot.rows,job.targets[0],job.seed);job.weights=c.weights;job.calibration=c;}
    if(job.type==='train') {const end=Math.min(snapshot.rows.length,start+100);job.cursor=end;job.window=snapshot.rows.slice(0,end).slice(-200);job.model=fit(job.window);job.status=end===snapshot.rows.length?'completed':'running'}
    else {const end=Math.min(job.targets.length,start+5);for(let i=start;i<end;i++){const f=fold(snapshot.rows,job.targets[i],job.seed,job.weights||weights,job.protocol===4);accumulate(job.totals,f);if(job.protocol){if(!job.diagnostics)job.diagnostics=strategies.map(()=>({duplicateTickets:0,frontHistogram:Array(6).fill(0),backHistogram:Array(3).fill(0),pairSimilaritySum:0,pairs:0,repeatedNumbers:0,leakageViolations:0}));f.diagnostics.forEach((d,j)=>{const t=job.diagnostics[j];for(const k of ['duplicateTickets','pairSimilaritySum','pairs','repeatedNumbers'])t[k]+=d[k];for(const [match,n]of Object.entries(f.metrics[j].matches)){const [a,b]=match.split('+').map(Number);t.frontHistogram[a]+=n;t.backHistogram[b]+=n}if(!(f.lastTrainDate<f.date)||f.trainPeriods.some(p=>Number(p)>=Number(f.period)))t.leakageViolations++})}items.push({...f,baselines:undefined})}job.cursor=end;job.status=end===job.targets.length?'completed':'running'}
    return {start,job,items};
  }
  return {version,weights,strategies,fuse,diagnose,calibrate,stamp,audit,fit,plan,trainFor,tier,outcome,fold,initialTotals,accumulate,report,batch};
})();
