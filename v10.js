(()=>{'use strict';const $=id=>document.getElementById(id);const b=$('v10run'),o=$('v10out');if(!b||!o)return;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
b.addEventListener('click',()=>{b.disabled=true;o.textContent='正在审计本地历史数据……';setTimeout(()=>{try{
const g=$('game').value,d=JSON.parse(localStorage.getItem('lottery_v2_'+g)||'[]');if(!Array.isArray(d)||!d.length)throw Error('没有找到当前彩种的本地记录，请先导入或加载历史数据。');
const issues=[],seen=new Map(),dateSeen=new Map(),yearCount={},examples=[],counts={duplicate:0,invalidDate:0,invalidNumbers:0,reverse:0,duplicateDate:0,periodGap:0,nonNumeric:0};
const add=(type,index,msg)=>{counts[type]++;if(examples.length<30)examples.push({index:index+1,msg})};
const isDate=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const t=new Date(s+'T00:00:00Z');return Number.isFinite(t.getTime())&&t.toISOString().slice(0,10)===s};
const valid=a=>{if(!Array.isArray(a))return false;if(g==='dlt')return a.length===7&&a.slice(0,5).every(x=>Number.isInteger(x)&&x>=1&&x<=35)&&a.slice(5).every(x=>Number.isInteger(x)&&x>=1&&x<=12)&&new Set(a.slice(0,5)).size===5&&new Set(a.slice(5)).size===2;return a.length===3&&a.every(x=>Number.isInteger(x)&&x>=0&&x<=9)};
let min=null,max=null,prev=null,yearTransitions=0;
for(let i=0;i<d.length;i++){
const r=d[i]||{},period=String(r.period??''),date=String(r.date??'');
if(seen.has(period))add('duplicate',i,'重复期号 '+period+'（首次在第'+seen.get(period)+'条）');else seen.set(period,i+1);
if(!isDate(date))add('invalidDate',i,'非法日历日期 '+date);
else{yearCount[date.slice(0,4)]=(yearCount[date.slice(0,4)]||0)+1;if(min===null||date<min)min=date;if(max===null||date>max)max=date;
if(dateSeen.has(date))add('duplicateDate',i,'同一日期多条记录 '+date+'（需人工核查）');else dateSeen.set(date,i+1);
if(prev&&isDate(prev.date)&&date<prev.date)add('reverse',i,'日期逆序 '+date);
}
if(!valid(r.nums))add('invalidNumbers',i,'号码范围、长度、整数性或重复异常');
if(!/^\d+$/.test(period))add('nonNumeric',i,'期号不是纯数字 '+period);
if(prev&&/^\d+$/.test(period)&&/^\d+$/.test(String(prev.period))&&isDate(date)&&isDate(String(prev.date))){const a=String(prev.period),c=period;if(a.length===c.length&&a.length>=4&&a.slice(0,-3)===c.slice(0,-3)){const gap=Number(c.slice(-3))-Number(a.slice(-3));if(gap>1)add('periodGap',i,'同年度疑似跳期 '+a+' → '+c+'（缺'+(gap-1)+'期，待核实）');}}
prev=r;
}
const lines=[['总记录数',d.length+'期'],['最早/最晚日期',(min||'未知')+' / '+(max||'未知')],['重复期号',counts.duplicate],['非法日期',counts.invalidDate],['号码格式异常',counts.invalidNumbers],['日期逆序',counts.reverse],['同日多记录（待核）',counts.duplicateDate],['同年度疑似期号跳跃',counts.periodGap],['非数字期号',counts.nonNumeric]];
const serious=counts.duplicate+counts.invalidDate+counts.invalidNumbers+counts.reverse;
let html='<p><b>V10审计完成</b>：'+(serious?'发现'+serious+'处基础异常，请优先修复。':'基础格式、重复期号和日期顺序检查未发现异常。')+'</p><div class="scroll"><table><tr><th>检查项</th><th>结果</th></tr>'+lines.map(([a,v])=>'<tr><td>'+escape(a)+'</td><td>'+escape(v)+'</td></tr>').join('')+'</table></div>';
html+='<h3>年度记录数量（仅供排查）</h3><div class="scroll"><table><tr><th>年份</th><th>记录数</th></tr>'+Object.keys(yearCount).sort().map(y=>'<tr><td>'+y+'</td><td>'+yearCount[y]+'</td></tr>').join('')+'</table></div>';
html+='<h3>异常样例（最多30条）</h3>'+(examples.length?'<div class="scroll"><table><tr><th>行号</th><th>问题</th></tr>'+examples.map(x=>'<tr><td>'+x.index+'</td><td>'+escape(x.msg)+'</td></tr>').join('')+'</table></div>':'<p>未发现本工具所检查的异常。</p>');
html+='<p><b>审计边界：</b>这是浏览器内本地数据检查，不是官方开奖核验。同日多条、期号跳跃可能是数据错误，也可能涉及规则或发行安排变化，需要人工核实。无法单凭本地记录确认遗漏的首尾期数、开奖公告一致性、完整性或未来预测能力。</p>';
o.innerHTML=html;
}catch(e){o.textContent='V10未完成：'+e.message}finally{b.disabled=false}},30)});
})();