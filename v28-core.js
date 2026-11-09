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
 const equal=(a,b)=>a.period===b.period&&a.date===b.date&&a.nums.length===7&&b.nums.length===7&&a.nums.every((n,i)=>n===b.nums[i]);
 const id=r=>JSON.stringify([r.period,r.date,r.nums,r.url,r.kind]);
 const iso=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
 function acquisition(x){return {channel:['file','https','bundled-reference'].includes(x?.channel)?x.channel:'unknown',sourceUrl:https(x?.sourceUrl)||null,requestedUrl:https(x?.requestedUrl)||null,fileName:typeof x?.fileName==='string'?x.fileName:null,readAt:iso(x?.readAt)?x.readAt:null}}
 function capture(rows,info){const a=acquisition(info);return rows.map(r=>({...r,acquisition:{...a}}))}
 const recordKey=r=>JSON.stringify([id(r),acquisition(r.acquisition).channel,acquisition(r.acquisition).sourceUrl,acquisition(r.acquisition).fileName]);
 function merge(old,added){const map=new Map(old.map(r=>[recordKey(r),r]));let duplicates=0;for(const r of added){const k=recordKey(r);if(map.has(k)){duplicates++;continue}map.set(k,{...r,review:null,acquisition:acquisition(r.acquisition)})}if(map.size>MAX)throw Error('累计证据超过20000条');return {queue:[...map.values()],duplicates}}
 function index(queue,history){const refs=new Map(),locals=new Map();for(const [rows,map] of [[queue,refs],[history,locals]])for(const r of rows){const p=String(r?.period??'');if(!map.has(p))map.set(p,[]);map.get(p).push(r)}return {refs,locals}}
 function snapshot(r){
  if(!r||typeof r!=='object')return null;
  const raw=Array.isArray(r.nums)?r.nums:null,front=raw?raw.slice(0,5):Array.isArray(r.front)?r.front.slice():null,back=raw?raw.slice(5):Array.isArray(r.back)?r.back.slice():null;
  return {period:r.period??r.issue??null,date:r.date??null,front,back,nums:raw?raw.slice():front&&back?[...front,...back]:[]};
 }
 function fields(local,external){
  const values=r=>r?[r.period,r.date,...Array.from({length:5},(_,i)=>r.front?.[i]),...Array.from({length:2},(_,i)=>r.back?.[i])]:Array(9).fill(null);
  const a=values(local),b=values(external),names=['期号','日期','前区1','前区2','前区3','前区4','前区5','后区1','后区2'];
  return names.map((name,i)=>{const left=a[i]??null,right=b[i]??null,missing=left===null||right===null||left===''||right==='';const same=!missing&&(i<2?String(left)===String(right):Number(left)===Number(right));return {field:name,local:left,external:right,result:missing?'未比对':same?'一致':'不一致',reason:missing?(!external?'未读取到外部记录':!local?'无唯一可用本地记录':'字段缺失'):same?'':name+'不一致'}});
 }
 const isReviewed=r=>!!r&&r.kind==='draw'&&official(r.url)&&r.review?.method==='manual-original-notice'&&r.review?.identity===id(r)&&iso(r.review.at);
 function verify(period,queue,history,at,prepared){
  const refs=prepared?prepared.refs.get(period)||[]:queue.filter(r=>r.period===period),locals=prepared?prepared.locals.get(period)||[]:history.filter(r=>String(r?.period)===period),errors=[];
  const localRecords=locals.map(snapshot);let local=null;
  if(locals.length!==1)errors.push(locals.length?'本地期号重复':'本地记录缺失');else {local=localRecords[0];try{normal(locals[0])}catch(e){errors.push('本地格式异常：'+e.message)}}
  if(!refs.length)errors.push('未读取到外部记录');
  if(refs.length&&refs.some(r=>!equal(r,refs[0])))errors.push('导入证据相互冲突');
  const details=(refs.length?refs:[null]).flatMap(ref=>(localRecords.length?localRecords:[null]).map(loc=>{
   const external=snapshot(ref),comparison=fields(loc,external),allMatch=!!loc&&!!ref&&comparison.every(f=>f.result==='一致');
   const grade=!ref?'未比对':errors.length||!allMatch?'D':isReviewed(ref)?'A':'来源待核';
   const sourceReason=!ref?'未读取到外部记录':ref.kind==='holiday'?'仅有休市证据，不能认证开奖号码':ref.kind==='third-party'?'第三方整理数据不能作为官方A级':ref.kind==='unknown'?'来源类型未知':!official(ref.url)?'官方来源无法确认':!isReviewed(ref)?'未人工核实该期原始开奖公告':'';
   return {grade,sourceReason,local:loc,external,sourceUrl:acquisition(ref?.acquisition).sourceUrl,readAt:acquisition(ref?.acquisition).readAt,acquisition:acquisition(ref?.acquisition),sourceType:ref?.kind||'unknown',evidenceUrl:ref?.url||null,review:ref?.review||null,fields:comparison,allMatch,failureReasons:[...new Set([...errors,...comparison.filter(f=>f.result!=='一致').map(f=>f.reason),...(sourceReason?[sourceReason]:[])])]};
  }));
  for(const detail of details)for(const f of detail.fields)if(f.result!=='一致')errors.push(f.reason);
  const failures=[...new Set(errors)],allMatch=refs.length>0&&locals.length===1&&details.every(d=>d.allMatch)&&!failures.length;
  const reviewed=refs.filter(isReviewed);
  const grade=!refs.length?'未比对':failures.length?'D':allMatch&&reviewed.length?'A':'来源待核';
  return {traceVersion:2,period,grade,state:!refs.length?'未比对：未读取到外部记录':failures.length?'异常':grade==='A'?'九个字段逐项一致；原公告已人工核实':'九个字段逐项一致，来源待核',errors:failures,local,localRecords,evidence:refs.map(r=>({...snapshot(r),url:r.url||'未知',kind:r.kind,review:r.review||null,acquisition:acquisition(r.acquisition)})),details,at};
 }
 // Lossless shared snapshots keep full 2945-draw traces within localStorage quota.
 function packResult(r){
  if(r?.traceEncoding==='shared-snapshots-v1'||r?.traceVersion!==2||!r.details?.length)return r;
  const packed={...r,traceEncoding:'shared-snapshots-v1'};delete packed.evidence;
  if(!r.localRecords.length||(r.local!==null&&r.localRecords.length===1&&r.localRecords[0]===r.local))delete packed.localRecords;
  packed.details=r.details.map(d=>{const x={...d,fields:d.fields.map(({field,result,reason})=>[field,result,reason])};if(d.local===r.local){delete x.local;x.localFromResult=true}delete x.sourceUrl;delete x.readAt;return x});return packed;
 }
 function unpackResult(r){
  if(r?.traceEncoding!=='shared-snapshots-v1')return r;
  const full={...r};delete full.traceEncoding;
  full.localRecords=r.localRecords||(r.local?[r.local]:[]);
  full.details=r.details.map(d=>{const local=d.localFromResult?r.local:d.local,observed=fields(local,d.external),x={...d,local,sourceUrl:acquisition(d.acquisition).sourceUrl,readAt:acquisition(d.acquisition).readAt,fields:d.fields.map(entry=>{const f=Array.isArray(entry)?{field:entry[0],result:entry[1],reason:entry[2]}:entry;return {...f,local:observed.find(v=>v.field===f.field)?.local??null,external:observed.find(v=>v.field===f.field)?.external??null}})};delete x.localFromResult;return x});
  const evidence=new Map();for(const d of full.details)if(d.external){const e={...d.external,url:d.evidenceUrl||'未知',kind:d.sourceType,review:d.review||null,acquisition:acquisition(d.acquisition)},key=JSON.stringify(e);if(!evidence.has(key))evidence.set(key,e)}full.evidence=[...evidence.values()];return full;
 }
 function packState(state){
  const sources=[],ids=new Map(),share=a=>{const source=acquisition(a),key=JSON.stringify(source);if(!ids.has(key)){ids.set(key,sources.length);sources.push(source)}return ids.get(key)};
  const queue=state.queue.map(r=>{const x={...r,acquisitionRef:share(r.acquisition)};delete x.acquisition;return x});
  const records=map=>Object.fromEntries(Object.entries(map||{}).map(([p,r])=>{const packed=packResult(r);return [p,{...packed,details:packed.details?.map(d=>{const x={...d,acquisitionRef:share(d.acquisition)};delete x.acquisition;return x})}]}));
  const results=records(state.results),inspections=records(state.inspections);return {...state,queue,results,inspections,traceAcquisitions:sources};
 }
 function unpackState(state,expandResults=true){
  const source=r=>Number.isInteger(r.acquisitionRef)?acquisition(state.traceAcquisitions?.[r.acquisitionRef]):acquisition(r.acquisition);
  const queue=state.queue.map(r=>{const x={...r,acquisition:source(r)};delete x.acquisitionRef;return x});
  const records=map=>Object.fromEntries(Object.entries(map||{}).map(([p,r])=>[p,expandResults?unpackResult({...r,details:r.details?.map(d=>{const x={...d,acquisition:source(d)};delete x.acquisitionRef;return x})}):r]));
  const full={...state,queue,results:records(state.results),inspections:records(state.inspections)};delete full.traceAcquisitions;return full;
 }
 function csv(result){
  const names=['期号','日期','前区1','前区2','前区3','前区4','前区5','后区1','后区2'];
  const heads=['核验任务期号','期号综合等级','本条证据等级','状态',...names.map(n=>'本地'+n),...names.map(n=>'外部'+n),'实际数据来源URL','请求URL','读取方式','文件名','外部读取时间','来源类型','公告证据链接','原文人工核实时间','核验时间',...names.map(n=>n+'比对结果'),'字段失败原因','失败原因'];
  const values=r=>r?[r.period,r.date,...Array.from({length:5},(_,i)=>r.front?.[i]??null),...Array.from({length:2},(_,i)=>r.back?.[i]??null)]:Array(9).fill(null);
  const rows=[heads];
  for(const r of Object.values(result).map(unpackResult).sort((a,b)=>b.period.localeCompare(a.period))){
   // Never reconstruct missing old details from the local record or invent read timestamps.
   const hasTrace=r.traceVersion===2&&r.details?.length;
   const details=hasTrace?r.details:[{local:r.local?{...r.local,front:r.local.nums?.slice(0,5),back:r.local.nums?.slice(5)}:null,external:null,fields:[],failureReasons:['旧结果缺少独立比对明细，请重新核验']}];
   for(const d of details){const a=acquisition(d.acquisition);rows.push([r.period,hasTrace?r.grade:'未比对',d.grade||'未比对',hasTrace?r.state:'旧结果缺少独立逐字段明细，未比对',...values(d.local),...values(d.external),a.sourceUrl,a.requestedUrl,a.channel,a.fileName,a.readAt,d.sourceType||'unknown',d.evidenceUrl,d.review?.at,r.at,...names.map(n=>d.fields?.find(f=>f.field===n)?.result||'未比对'),d.fields?.filter(f=>f.reason).map(f=>f.field+'：'+f.reason).join('；')||'',(d.failureReasons||r.errors||[]).join('；')])}
  }
  return '\ufeff'+rows.map(r=>r.map(v=>'"'+String(v===null||v===undefined?'未知':v).replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"').join(',')).join('\r\n');
 }
 return {KEY,normal,official,https,parse,equal,id,recordKey,acquisition,capture,merge,index,snapshot,fields,verify,packResult,unpackResult,packState,unpackState,csv};
})();
if(typeof module!=='undefined')module.exports=V28Core;
