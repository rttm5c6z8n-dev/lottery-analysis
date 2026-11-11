import{valid}from './v31-core.mjs';
export function diagnoseResearch({snapshots=[],trains=[],reports=[],results=[],searches=[]}){
 const errors=[],warnings=[];
 const add=(severity,message)=>{(severity==='error'?errors:warnings).push(message)};
 const byId=(items,label)=>{const out=new Map();for(const item of items){if(!item||typeof item.id!=='string'){add('error',label+'存在缺失ID的记录');continue}if(out.has(item.id))add('error',label+'存在重复ID：'+item.id);out.set(item.id,item)}return out};
 const snaps=byId(snapshots,'历史快照'),training=byId(trains,'训练记录'),rep=byId(reports,'报告');byId(results,'选号结果');
 const unhealthySnapshots=new Set(),unhealthyTrains=new Set(),unhealthyReports=new Set();
 let latestSnapshot=null;
 for(const s of snapshots){
  if(!Array.isArray(s?.rows)){add('error','快照 '+String(s?.id||'?')+' 没有历史号码数组');unhealthySnapshots.add(s?.id);continue}
  const seen=new Set();let invalid=0,dupes=0,badOrder=0,lastDate='',lastPeriod='';
  for(const r of s.rows){
   if(!valid(r))invalid++;
   const id=String(r?.period??''),date=String(r?.date??'');
   if(seen.has(id))dupes++;seen.add(id);
   if(lastDate&&(date<lastDate||(date===lastDate&&id<=lastPeriod)||Number(id)<=Number(lastPeriod)))badOrder++;
   lastDate=date;lastPeriod=id;
  }
  const info={id:s.id,rows:s.rows.length,invalid,duplicates:dupes,orderErrors:badOrder,start:s.rows[0]?.period||null,end:s.rows.at(-1)?.period||null,sourceHash:s.sourceHash||null,createdAt:s.createdAt||null};
  if(!latestSnapshot||String(s.createdAt||'')>String(latestSnapshot.createdAt||''))latestSnapshot=info;
  if(invalid||dupes||badOrder){unhealthySnapshots.add(s.id);add('error','历史快照 '+String(s.id)+'：格式异常'+invalid+'，重复期号'+dupes+'，排序问题'+badOrder)}
 }
 for(const t of trains){
  const snap=snaps.get(t.snapshotId);let bad=false;
  if(!snap){bad=true;add('error','训练 '+String(t.id)+' 找不到对应历史快照')}
  else if(unhealthySnapshots.has(t.snapshotId)){bad=true;add('error','训练 '+String(t.id)+' 关联的历史快照有结构错误')}
  if(snap&&t.sourceHash&&snap.sourceHash&&t.sourceHash!==snap.sourceHash){bad=true;add('error','训练 '+String(t.id)+' 的历史数据指纹不一致')}
  if(bad)unhealthyTrains.add(t.id);
 }
 for(const r of reports){
  const snap=snaps.get(r.snapshotId),train=training.get(r.trainId);let bad=false;
  if(!snap){bad=true;add('error','报告 '+String(r.id)+' 找不到历史快照')}
  if(!train){bad=true;add('error','报告 '+String(r.id)+' 找不到训练记录')}
  if(snap&&unhealthySnapshots.has(r.snapshotId)){bad=true;add('error','报告 '+String(r.id)+' 的快照有结构错误')}
  if(train&&unhealthyTrains.has(r.trainId)){bad=true;add('error','报告 '+String(r.id)+' 的训练记录有结构错误')}
  if(train&&train.snapshotId!==r.snapshotId){bad=true;add('error','报告 '+String(r.id)+' 的训练与报告快照不一致')}
  if(snap&&r.sourceHash&&snap.sourceHash&&r.sourceHash!==snap.sourceHash){bad=true;add('error','报告 '+String(r.id)+' 的历史数据指纹不一致')}
  if(bad)unhealthyReports.add(r.id);
 }
 let validResults=0;
 for(const r of results){
  const snap=snaps.get(r.snapshotId),train=training.get(r.trainId),report=rep.get(r.reportId);
  let bad=false;
  function issue(message){bad=true;add('error','选号结果 '+String(r.id)+' '+message)}
  if(!snap)issue('找不到历史快照');
  if(!train)issue('找不到训练记录');
  if(!report)issue('找不到验证报告');
  if(snap&&unhealthySnapshots.has(r.snapshotId))issue('关联的历史快照有结构错误');
  if(train&&unhealthyTrains.has(r.trainId))issue('关联的训练记录有结构错误');
  if(report&&unhealthyReports.has(r.reportId))issue('关联的验证报告有结构错误');
  if(train&&train.snapshotId!==r.snapshotId)issue('训练与选号的快照不一致');
  if(report&&(report.snapshotId!==r.snapshotId||report.trainId!==r.trainId))issue('验证报告与选号的快照或训练不一致');
  if(snap&&r.sourceHash&&snap.sourceHash&&r.sourceHash!==snap.sourceHash)issue('历史数据指纹不一致');
  if(!Array.isArray(r.picks)||r.picks.length===0)issue('缺少组合');
  else if(r.picks.some(x=>!Array.isArray(x.nums)||x.nums.length!==7||!valid({period:'26001',date:'2026-01-01',nums:x.nums})))issue('有非法组合');
  if(!bad)validResults++;
 }
 if(!snapshots.length)add('warning','没有历史数据快照');
 if(!trains.length)add('warning','没有训练结果');
 if(!reports.length)add('warning','没有验证报告');
 if(!results.length)add('warning','没有保存的完整选号结果；不代表数据丢失');
 return{counts:{snapshots:snapshots.length,trains:trains.length,reports:reports.length,results:results.length,searches:searches.length},latestSnapshot,validResults,errors,warnings,checkedAt:new Date().toISOString(),disclaimer:'只读检查本机研究库的结构和关联，不等于每期开奖已获官方认证，也不能证明预测能力'};
}
export async function verifySnapshotFingerprints(snapshots=[],digest=globalThis.crypto?.subtle){
 if(!digest?.digest)return {checked:0,matched:0,mismatches:[],unsupported:true};
 const mismatches=[];let checked=0,matched=0;
 for(const s of snapshots){
  if(!s?.sourceHash||!Array.isArray(s.rows))continue;
  const canonical=s.rows.map(r=>({period:r.period,date:r.date,nums:r.nums}));
  const bytes=new Uint8Array(await digest.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical))));
  const hash=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
  checked++;
  if(hash===s.sourceHash)matched++;else mismatches.push(String(s.id));
 }
 return{checked,matched,mismatches,unsupported:false};
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
