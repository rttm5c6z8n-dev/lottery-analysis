/* V28: imports are untrusted evidence; only UI-reviewed original draw notices may receive A. */
'use strict';
const V28Core=(()=>{
 const MAX=20000,KEY='lottery_v28_verification_1';
 const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
 function https(s){try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}}
 function official(s){try{const u=new URL(s);return !!https(s)&&!u.port&&['lottery.gov.cn','sporttery.cn','gdlottery.cn','js-lottery.com','sport.gov.cn','gstc.org.cn'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h))&&u.pathname!=='/'}catch{return false}}
 function normal(x){
  if(!x||typeof x!=='object')throw Error('记录必须是对象');
  const period=String(x.period??x.issue??'').trim(),d=String(x.date??'').trim();
  const numbers=a=>Array.isArray(a)?a:typeof a==='string'?a.trim().split(/[\s|]+/):[];
  const nums=x.nums!==undefined?numbers(x.nums):[...numbers(x.front),...numbers(x.back)];
  if(!/^\d{5}$/.test(period)||+period.slice(2)<1||+period.slice(0,2)<7||!date(d))throw Error('期号或日期无效');
  if(nums.some(n=>!/^\d{1,2}$/.test(String(n))))throw Error('号码必须是整数');
  const n=nums.map(Number);if(n.length!==7||n.slice(0,5).some(n=>n<1||n>35)||n.slice(5).some(n=>n<1||n>12)||new Set(n.slice(0,5)).size!==5||new Set(n.slice(5)).size!==2)throw Error('须有5个不同的前区1—35及2个不同的后区1—12号码');
  if(+d.slice(0,4)!==2000+Number(period.slice(0,2)))throw Error('期号年度与日期不一致');
  return {period,date:d,nums:n,url:https(String(x.url??x.evidenceUrl??'')),kind:['draw','holiday','third-party'].includes(x.kind)?x.kind:'unknown'};
 }
 function csvRows(text){const rows=[],row=[];let value='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++}else if(quoted)quoted=false;else if(value==='')quoted=true;else throw Error('CSV引号位置错误')}else if(c===','&&!quoted){row.push(value);value=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row.splice(0));else row.length=0;value=''}else value+=c}if(quoted)throw Error('CSV引号未闭合');row.push(value);if(row.some(v=>v.trim()))rows.push(row);return rows}
 function parse(text){
  if(text.length>5*1024*1024)throw Error('文件超过5MB');text=text.replace(/^\uFEFF/,'').trim();let a;
  if(text.startsWith('[')||text.startsWith('{')){let j;try{j=JSON.parse(text)}catch(e){throw Error('JSON解析失败：'+e.message)}a=Array.isArray(j)?j:j.data;if(!Array.isArray(a))throw Error('JSON须为数组或含data数组的对象')}
  else {const rows=csvRows(text),h=(rows.shift()||[]).map(s=>s.trim());if(!h.includes('date')||(!h.includes('period')&&!h.includes('issue')))throw Error('CSV须有period（或issue）、date列');if(new Set(h).size!==h.length)throw Error('CSV列名重复');a=rows.map((r,i)=>{if(r.length!==h.length)throw Error('CSV第'+(i+2)+'行列数不符');let o=Object.fromEntries(h.map((k,i)=>[k,r[i]]));if(h.includes('front1')){o.front=[1,2,3,4,5].map(n=>o['front'+n]);o.back=[1,2].map(n=>o['back'+n])}return o})}
  if(!a.length||a.length>MAX)throw Error('须包含1—20000条记录');return a.map((x,i)=>{try{return normal(x)}catch(e){throw Error('第'+(i+1)+'条：'+e.message)}})
 }
 const equal=(a,b)=>a.date===b.date&&a.nums.length===7&&a.nums.every((n,i)=>n===b.nums[i]);
 const id=r=>JSON.stringify([r.period,r.date,r.nums,r.url,r.kind]);
 function merge(old,added){const map=new Map(old.map(r=>[id(r),r]));let duplicates=0;for(const r of added){const k=id(r);if(map.has(k)){duplicates++;continue}map.set(k,{...r,review:null})}if(map.size>MAX)throw Error('累计证据超过20000条');return {queue:[...map.values()],duplicates}}
 function index(queue,history){const refs=new Map(),locals=new Map();for(const [rows,map] of [[queue,refs],[history,locals]])for(const r of rows){const p=String(r?.period??'');if(!map.has(p))map.set(p,[]);map.get(p).push(r)}return {refs,locals}}
 function verify(period,queue,history,at,prepared){
  const refs=prepared?prepared.refs.get(period)||[]:queue.filter(r=>r.period===period),locals=prepared?prepared.locals.get(period)||[]:history.filter(r=>String(r?.period)===period),errors=[];let local=null;
  if(locals.length!==1)errors.push(locals.length?'本地期号重复':'本地记录缺失');else try{local=normal(locals[0])}catch(e){errors.push('本地格式异常：'+e.message)}
  if(refs.some(r=>!equal(r,refs[0])))errors.push('导入证据相互冲突');
  if(local&&refs.some(r=>!equal(local,r)))errors.push('日期或七个号码不一致');
  const reviewed=refs.filter(r=>r.kind==='draw'&&official(r.url)&&r.review?.method==='manual-original-notice'&&r.review?.identity===id(r)&&date(r.review.at?.slice(0,10)));
  return {period,grade:errors.length?'D':reviewed.length?'A':'来源待核',state:errors.length?'异常':reviewed.length?'全部字段一致；原公告已人工核实':'字段一致，来源待核',errors,local:local?{date:local.date,nums:local.nums}:null,evidence:refs.map(r=>({date:r.date,nums:r.nums,url:r.url||'未知',kind:r.kind,review:r.review||null})),at};
 }
 function csv(result){const rows=[['期号','等级','状态','本地日期','本地号码','核验时间','证据链接','来源种类','原文人工核实时间','异常'],...Object.values(result).sort((a,b)=>b.period.localeCompare(a.period)).map(r=>[r.period,r.grade,r.state,r.local?.date||'未知',r.local?.nums.join(' ')||'未知',r.at,r.evidence.map(e=>e.url).join('；'),r.evidence.map(e=>e.kind).join('；'),r.evidence.map(e=>e.review?.at||'未知').join('；'),r.errors.join('；')])];return '\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"').join(',')).join('\r\n')}
 return {KEY,normal,official,https,parse,equal,id,merge,index,verify,csv};
})();
if(typeof module!=='undefined')module.exports=V28Core;
