(()=>{'use strict';
const el=id=>document.getElementById(id);
const btn=el('v9run'),out=el('v9out');
if(!btn||!out)return;
btn.addEventListener('click',async()=>{
btn.disabled=true;out.textContent='正在检查数据并执行验证……';
try{
const g=el('game').value;
const data=JSON.parse(localStorage.getItem('lottery_v2_'+g)||'[]');
if(data.length<400)throw Error('至少需要400期有效记录，请先导入数据。');
const seen=new Set();
for(let i=0;i<data.length;i++){
const r=data[i],a=r.nums;
if(!r||!Array.isArray(a)||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||seen.has(String(r.period))||(i&&data[i-1].date>r.date))throw Error('第'+(i+1)+'条存在重复或日期异常');
if(g==='dlt'&&(a.length!==7||a.slice(0,5).some(x=>!Number.isInteger(x)||x<1||x>35)||a.slice(5).some(x=>!Number.isInteger(x)||x<1||x>12)||new Set(a.slice(0,5)).size!==5||new Set(a.slice(5)).size!==2))throw Error('第'+(i+1)+'条号码无效');
if(g==='3d'&&(a.length!==3||a.some(x=>!Number.isInteger(x)||x<0||x>9)))throw Error('第'+(i+1)+'条号码无效');
seen.add(String(r.period));
}
const split=Math.floor(data.length*.7),w=100;
if(split<w+1)throw Error('研究区不足100期');
const hot=(hist)=>{
if(g==='3d')return [0,1,2].map(p=>{const counts=Array(10).fill(0);hist.forEach(r=>counts[r.nums[p]]++);return counts.map((c,n)=>({c,n})).sort((a,b)=>b.c-a.c||a.n-b.n)[0].n});
const front=Array(35).fill(0),back=Array(12).fill(0);
hist.forEach(r=>{r.nums.slice(0,5).forEach(x=>front[x-1]++);r.nums.slice(5).forEach(x=>back[x-1]++)});
const pick=(a,n)=>a.map((c,i)=>({c,n:i+1})).sort((a,b)=>b.c-a.c||a.n-b.n).slice(0,n).map(x=>x.n);
return [...pick(front,5),...pick(back,2)];
};
const test=data.slice(split),n=test.length;
let observed=0,backHits=0,complete=0,distribution=Array(g==='dlt'?6:4).fill(0);
for(let i=split;i<data.length;i++){
const pick=hot(data.slice(i-w,i)),actual=data[i].nums;
const front=g==='dlt'?pick.slice(0,5).filter(x=>actual.slice(0,5).includes(x)).length:pick.filter((x,j)=>x===actual[j]).length;
observed+=front;distribution[front]++;
if(g==='dlt'){const back=pick.slice(5).filter(x=>actual.slice(5).includes(x)).length;backHits+=back;if(front===5&&back===2)complete++}
else if(front===3)complete++;
}
const choose=(n,k)=>{if(k<0||k>n)return 0;let x=1;for(let i=1;i<=k;i++)x=x*(n-i+1)/i;return x};
const prob=distribution.map((_,k)=>g==='dlt'?choose(5,k)*choose(30,5-k)/choose(35,5):choose(3,k)*Math.pow(.1,k)*Math.pow(.9,3-k));
const meanPer=g==='dlt'?25/35:.3;
const variancePer=prob.reduce((s,p,k)=>s+p*(k-meanPer)**2,0);
const expected=n*meanPer,sd=Math.sqrt(n*variancePer),z=(observed-expected)/sd;
let seed=20261109;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const cdf=[];prob.reduce((s,p,i)=>cdf[i]=s+p,0);
let exceed=0,simulations=10000;
for(let t=0;t<simulations;t++){
let total=0;for(let i=0;i<n;i++){const u=rand();let k=0;while(k<cdf.length-1&&u>cdf[k])k++;total+=k}
if(total>=observed)exceed++;
if(t%500===0)await new Promise(resolve=>setTimeout(resolve,0));
}
const p=(exceed+1)/(simulations+1);
const fmt=x=>x.toFixed(2);
const row=(a,b)=>'<tr><td>'+a+'</td><td>'+b+'</td></tr>';
out.innerHTML='<p><b>V9计算完成：仅在后30%时段评分</b></p><div class="scroll"><table>'+
row('总记录',data.length+'期')+row('研究区',split+'期（'+data[0].date+' 至 '+data[split-1].date+'）')+
row('验证区',n+'期（'+test[0].date+' 至 '+test[n-1].date+'）')+
row('固定规则','此前100期频率最高号码；并列取较小号码')+
row('验证区前区/逐位累计命中',observed)+row('随机理论期望',fmt(expected))+
row('标准化差异 Z',fmt(z))+row('单侧模拟 P 值',p.toFixed(5))+
(g==='dlt'?row('后区累计命中',backHits):'')+
row('完整号码命中',complete)+
'</table></div><p>逐期命中分布：</p><div class="scroll"><table><tr><th>命中个数</th><th>策略期数</th><th>随机理论期数</th></tr>'+
distribution.map((v,k)=>'<tr><td>'+k+'</td><td>'+v+'</td><td>'+(n*prob[k]).toFixed(1)+'</td></tr>').join('')+
'</table></div><p><b>解读：</b>'+(p<.05?'此固定规则在验证区的累计命中偏高，值得进一步核对数据与模型选择偏差。':'当前验证区未显示该固定规则的累计命中显著高于随机基准。')+
' 这不代表未来中奖概率提高。</p><small>重要限制：V5—V8已经使用过这些历史数据，因此此70/30划分只是回顾性时间留出验证，并非真正未接触的前瞻样本。模拟假定公平独立开奖；未校正此前尝试过的窗口、策略和指标。数据尚未逐条与官方公告核对。P值不是中奖概率；后区及完整号码命中仅作描述统计，未做显著性检验。</small>';
}catch(err){out.textContent='V9未完成：'+err.message}
finally{btn.disabled=false}
});
})();