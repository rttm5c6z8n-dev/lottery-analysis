import{valid}from './v31-core.mjs';
export function diagnoseResearch({snapshots=[],trains=[],reports=[],results=[],searches=[]}){
 const errors=[],warnings=[],latest={};
 const byId=(items)=>new Map(items.filter(x=>x&&typeof x.id==='string').map(x=>[x.id,x]));
 const snaps=byId(snapshots),training=byId(trains),rep=byId(reports);
 const add=(severity,message)=>{(severity==='error'?errors:warnings).push(message)};
 for(const s of snapshots){
  if(!Array.isArray(s?.rows)){add('error','快照 '+String(s?.id||'?')+' 没有历史号码数组');continue}
  const seen=new Set();let invalid=0,dupes=0,badOrder=0;
  let lastDate='',lastPeriod='';
  for(const r of s.rows){
   if(!valid(r))invalid++;
   const id=String(r?.period??'');
   if(seen.has(id))dupes++;seen.add(id);
   if(lastDate&&(String(r?.date)<lastDate||(String(r?.date)===lastDate&&id<=lastPeriod)))badOrder++;
   lastDate=String(r?.date??'');lastPeriod=id;
  }
  const info={id:s.id,rows:s.rows.length,invalid,duplicates:dupes,orderErrors:badOrder,start:s.rows[0]?.period||null,end:s.rows.at(-1)?.period||null,sourceHash:s.sourceHash||null,createdAt:s.createdAt||null};
  latest.snapshot=(!latest.snapshot||String(s.createdAt)>String(latest.snapshot.createdAt))?info:latest.snapshot;
  if(invalid||dupes||badOrder)add('error','历史快照 '+String(s.id)+'：格式异常'+invalid+'，重复期号'+dupes+'，排序问题'+badOrder);
 }
 for(const t of trains){if(!snaps.has(t.snapshotId))add('error','训练 '+String(t.id)+' 找不到对应历史快照');else if(t.sourceHash&&snaps.get(t.snapshotId)?.sourceHash&&t.sourceHash!==snaps.get(t.snapshotId).sourceHash)add('error','训练 '+String(t.id)+' 的历史数据指纹不一致')}
 for(const r of reports){if(!snaps.has(r.snapshotId))add('error','报告 '+String(r.id)+' 找不到历史快照');if(!training.has(r.trainId))add('error','报告 '+String(r.id)+' 找不到训练记录')}
 let validResults=0;for(const r of results){
  if(!snaps.has(r.snapshotId))add('error','选号结果 '+String(r.id)+' 找不到历史快照');
  if(!training.has(r.trainId))add('error','选号结果 '+String(r.id)+' 找不到训练记录');
  if(!rep.has(r.reportId))add('error','选号结果 '+String(r.id)+' 找不到验证报告');
  if(!Array.isArray(r.picks)||r.picks.length===0)add('error','选号结果 '+String(r.id)+' 缺少组合');
  else if(r.picks.some(x=>!Array.isArray(x.nums)||x.nums.length!==7||!valid({period:'26001',date:'2026-01-01',nums:x.nums})))add('error','选号结果 '+String(r.id)+' 有非法组合');
  else validResults++;
 }
 if(!snapshots.length)add('warning','没有历史数据快照');
 if(!trains.length)add('warning','没有训练结果');
 if(!reports.length)add('warning','没有验证报告');
 if(!results.length)add('warning','没有保存的完整选号结果；不代表数据丢失');
 return{counts:{snapshots:snapshots.length,trains:trains.length,reports:reports.length,results:results.length,searches:searches.length},latestSnapshot:latest.snapshot||null,validResults,errors,warnings,checkedAt:new Date().toISOString(),disclaimer:'仅检查当前浏览器本机研究库的结构与记录关联；不校验每期开奖是否与官方一致，也不证明预测能力'};
}
export async function readResearchData(idb){
 if(!idb)throw Error('当前浏览器不支持IndexedDB');
 return await new Promise((resolve,reject)=>{
  let db,settled=false,absent=false;
  const finish=(err,data)=>{if(settled)return;settled=true;if(db)db.close();if(err)reject(err);else resolve(data)};
  const q=idb.open('lottery_personal_v31');
  q.onupgradeneeded=()=>{absent=true;q.transaction.abort()};
  q.onerror=()=>finish(Error(absent?'本机尚无V3.1数据库（没有创建或修改数据）':'打开数据库失败：'+String(q.error?.name||'未知')));
  q.onblocked=()=>finish(Error('数据库被其他页面占用'));
  q.onsuccess=()=>{
   db=q.result;
   const names=['snapshots','trains','reports','results','searches'];
   const available=names.filter(x=>db.objectStoreNames.contains(x));
   if(!available.length){finish(Error('未发现预期的研究数据表'));return}
   try{
    const tx=db.transaction(available,'readonly'),data=Object.fromEntries(names.map(x=>[x,[]]));
    for(const name of available){const rq=tx.objectStore(name).getAll();rq.onsuccess=()=>{data[name]=rq.result};rq.onerror=()=>tx.abort()}
    tx.oncomplete=()=>finish(null,data);
    tx.onabort=()=>finish(tx.error||Error('读取事务中断'));
   }catch(e){finish(e)}
  };
 });
}


export async function inspectOriginalHistory(raw,snapshots=[],digest=globalThis.crypto?.subtle){
 if(raw===null)return{state:'missing',count:0,valid:0,duplicates:0,matches:0,message:'原始历史缓存 lottery_v2_dlt 未找到；不能据此认定V3.1快照丢失'};
 let rows;try{rows=JSON.parse(raw)}catch{return{state:'invalid',message:'原始历史缓存不是有效JSON，未修改原数据'}};
 if(!Array.isArray(rows))return{state:'invalid',message:'原始历史缓存不是记录数组，未修改原数据'};
 const periods=new Set();let validCount=0,duplicates=0;
 for(const r of rows){if(valid(r))validCount++;const key=String(r?.period??'');if(periods.has(key))duplicates++;else periods.add(key)}
 let matches=null,hash=null;
 if(digest&&typeof digest.digest==='function'){
  const data=new TextEncoder().encode(raw);
  const bytes=new Uint8Array(await digest.digest('SHA-256',data));
  hash=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
  matches=snapshots.filter(s=>s&&s.originalCacheHash===hash).length;
 }
 return{state:'present',count:rows.length,valid:validCount,duplicates,matches,hash,
  message:'原始历史缓存已读取。格式有效不等于逐期官方认证；指纹匹配只表示与已有快照创建时的原缓存内容相同'};
}
