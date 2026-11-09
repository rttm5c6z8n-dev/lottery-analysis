'use strict';
const V27 = (() => {
  const day = s => {if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;const t=Date.parse(s+'T12:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===s?t:NaN};
  const same = (r,e) => r.date===e.date&&Array.isArray(r.nums)&&r.nums.length===7&&r.nums.every((n,i)=>n===e.nums[i]);
  function analyze(data){
    if(!Array.isArray(data))throw Error('历史缓存不是数组');
    const counts=new Map();data.forEach(r=>{const p=String(r?.period??'');counts.set(p,(counts.get(p)||0)+1)});
    const rows=data.map((raw,i)=>{
      const r=raw&&typeof raw==='object'?raw:{},p=String(r.period??''),y=/^\d{5}$/.test(p)?2000+Number(p.slice(0,2)):null,n=r.nums,t=day(r.date),issues=[];
      const format=/^\d{5}$/.test(p)&&y>=2007&&y<=2026&&Number(p.slice(2))>0&&Number.isFinite(t)&&Array.isArray(n)&&n.length===7&&n.every(Number.isInteger)&&n.slice(0,5).every(x=>x>=1&&x<=35)&&n.slice(5).every(x=>x>=1&&x<=12)&&new Set(n.slice(0,5)).size===5&&new Set(n.slice(5)).size===2;
      if(!format)issues.push('格式异常');if(counts.get(p)>1)issues.push('重复期号');if(Number.isFinite(t)&&y&&new Date(t).getUTCFullYear()!==y)issues.push('期号年度与日期不符');
      const ref=V27_OFFICIAL.find(e=>e.period===p),third=V27_THIRD.find(e=>e[0]===p),tr=third?{date:third[1],nums:(third[2]+' '+third[3]).split(' ').map(Number)}:null;
      if(ref&&!same(r,ref))issues.push('官方样本冲突');if(tr&&!same(r,tr))issues.push('第三方快照冲突');
      return {index:i+1,period:p,date:String(r.date??''),nums:Array.isArray(n)?n.join(' '):'未知',year:y>=2007&&y<=2026?y:null,t,format,issues,grade:issues.length?'D':ref?'A':tr?'B':'C',url:ref?.url||(p==='20009'?'https://www.js-lottery.com/cms/post-89757.html':p==='26127'?'https://api.js-lottery.com/cms/post-148210.html':''),source:ref?'V11—V14 官方公告样本':tr?'V19 东方财富第三方快照':'未知',holiday:[],pending:[]};
    });
    const gaps=[];
    for(let y=2007;y<=2026;y++){
      const group=rows.filter(r=>r.year===y&&Number.isFinite(r.t)&&/^\d{5}$/.test(r.period)).sort((a,b)=>Number(a.period)-Number(b.period));
      for(let i=1;i<group.length;i++){
        const a=group[i-1],b=group[i],days=(b.t-a.t)/86400000;
        if(days<=0||Number(b.period)-Number(a.period)>1){for(const r of [a,b]){r.pending.push(days<=0?'日期逆序或同日':'期号跳跃');r.grade='D'}}
        if(days<=10)continue;
        const e=V27_HOLIDAYS[y],overlap=e&&a.t<day(e.end)&&b.t>day(e.start),gap={year:y,period:a.period+' → '+b.period,dates:a.date+' → '+b.date,days,e:overlap?e:null,status:overlap?'休市区间重叠；公告原文及相邻期号码待核':'休市来源未知；待核'};
        gaps.push(gap);for(const r of [a,b]){if(overlap)r.holiday.push(e);else {r.pending.push('长间隔来源未知');r.grade='D'}}
      }
    }
    const years=Array.from({length:20},(_,i)=>{const year=2007+i,a=rows.filter(r=>r.year===year);return {year,total:a.length,...Object.fromEntries('ABCD'.split('').map(g=>[g,a.filter(r=>r.grade===g).length]))}});
    return {rows,gaps,years,total:rows.length,format:rows.filter(r=>r.format).length,A:rows.filter(r=>r.grade==='A').length,holiday:rows.filter(r=>r.holiday.length&&r.grade!=='A'&&r.grade!=='B').length,pending:rows.filter(r=>r.grade!=='A').length,abnormal:rows.filter(r=>r.issues.length).length,unknownYear:rows.filter(r=>r.year===null).length};
  }
  const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
  function csv(result){return '\ufeff'+[
    ['V27 历史证据报告','只读本地快照；A沿用V11—V14四期样本；休市不认证号码'],
    ['总记录数','格式通过数','A','仅有休市证据记录数','待核（非A）','异常数'],[result.total,result.format,result.A,result.holiday,result.pending,result.abnormal],
    ['年份','总期数','A','B','C','D','官方覆盖率'],...result.years.map(y=>[y.year,y.total,y.A,y.B,y.C,y.D,y.total?(100*y.A/y.total).toFixed(2)+'%':'未知']),['无法归年',result.unknownYear],
    ['行号','期号','日期','七个号码','等级','格式通过','证据来源','原公告链接（可访问性未知）','休市来源','异常','待核状态'],
    ...result.rows.map(r=>[r.index,r.period,r.date,r.nums,r.grade,r.format?'是':'否',r.source,r.url||'未知',r.holiday.map(e=>e.url).join('；')||'未知',r.issues.join('；'),r.pending.join('；')||(r.grade==='A'?'沿用既有公告样本，未在线复核':'待逐期官方核验')]),
    ['间隔年份','相邻期号','相邻日期','间隔天数','公告来源','状态'],...result.gaps.map(g=>[g.year,g.period,g.dates,g.days,g.e?.url||'未知',g.status])
  ].map(r=>r.map(cell).join(',')).join('\r\n')}
  return {analyze,csv};
})();
if(typeof document!=='undefined'){
  const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const link=(u,title)=>u?'<a target="_blank" rel="noopener noreferrer" href="'+esc(u)+'">'+esc(title)+'</a>':'未知';
  const table=(heads,rows)=>'<table><thead><tr>'+heads.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  let report=null;
  function run(){report=null;$('export').disabled=true;for(const id of ['stats','years','gaps','latest','issues'])$(id).textContent='暂无结果';$('gapStatus').textContent='未知';try{
    const raw=localStorage.getItem('lottery_v2_dlt');if(raw===null)throw Error('未找到本地历史缓存。请在原网站域名、原浏览器打开；本页不会自动下载或补造数据');
    report=V27.analyze(JSON.parse(raw));const r=report;
    $('status').textContent='已读取本地快照：'+r.total+' 期。'+(r.total===2945?'数量与既有2945期一致；数量一致不证明完整真实。':'与既有2945期数量不符，请核查；未补录或覆盖。');
    $('stats').innerHTML=[['总记录数',r.total],['格式通过数',r.format],['逐期官方公告核验数 A',r.A],['仅有休市证据数（记录）',r.holiday],['待核数（非 A）',r.pending],['异常数',r.abnormal]].map(([k,v])=>'<div class="stat">'+k+'<b>'+v+'</b></div>').join('');
    $('years').innerHTML=table(['年度','总期数','A','B','C','D','官方覆盖率'],r.years.map(y=>[y.year,y.total,y.A,y.B,y.C,y.D,y.total?(100*y.A/y.total).toFixed(2)+'%':'未知']))+'<p>无法归年：'+r.unknownYear+' 条。</p>';
    $('gapStatus').textContent='实际发现 '+r.gaps.length+' 处超过10天的同年度相邻期号间隔。'+(r.gaps.length===7?'与V24报告的7处数量一致。':'与既有7处数量不符，按实际展示，不补造清单。')+'公告仅复用V25、V26来源，日期重叠不等于原文核验通过。';
    $('gaps').innerHTML=r.gaps.length?table(['年份 / 期号','相邻日期','间隔天数','公告来源 / 状态'],r.gaps.map(g=>[g.year+'<br>'+esc(g.period),esc(g.dates),g.days,link(g.e?.url,g.e?.title)+'<br>'+esc(g.status)])):'本地快照未识别到长间隔；既有7处的具体记录当前未知。';
    $('latest').innerHTML=table(['期号 / 日期','号码','等级 / 核验详情','原公告'],r.rows.filter(x=>Number.isFinite(x.t)).sort((a,b)=>b.t-a.t||b.period.localeCompare(a.period)).slice(0,5).map(x=>[esc(x.period)+'<br>'+esc(x.date),esc(x.nums),x.grade+'<br>'+esc(x.source)+'<br>'+esc([...x.issues,...x.pending].join('；')|| (x.grade==='A'?'既有公告样本一致':'待逐期官方核验')),link(x.url,'原公告线索（未在线复核）')]));
    const issues=r.rows.filter(x=>x.issues.length||x.pending.length);$('issues').innerHTML=issues.length?table(['行号 / 期号','问题'],issues.slice(0,100).map(x=>[x.index+' / '+esc(x.period),esc([...x.issues,...x.pending].join('；'))]))+'<p>共 '+issues.length+' 条，页面最多显示100条，CSV包含全部。</p>':'未发现已定义的异常线索；不等于全量官方认证。';$('export').disabled=false;
  }catch(e){$('status').textContent='无法分析：'+e.message}}
  $('refresh').onclick=run;$('export').onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([V27.csv(report)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='V27-历史数据证据核验报告.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)};run();
}
