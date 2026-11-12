// Only V4.0's new five-pick locks have explicit batch metadata.
// Legacy single tickets must remain readable and are not treated as missing batches.
export function auditMarkedBatches(records){
 if(!Array.isArray(records))throw Error('预测留档不是数组');
 const groups=new Map(),issues=[],invalidIndices=new Set();
 for(const [index,r]of records.entries()){
  if(!r?.batch)continue;
  const key=String(r.batch.id||'');
  if(!key||r.batch.size!==5||!Number.isInteger(r.batch.rank)||r.batch.rank<1||r.batch.rank>5){
   issues.push({period:r.period||'?',index,reason:'五组锁定批次元数据不合法'});invalidIndices.add(index);continue;
  }
  const group=groups.get(key)||[];group.push({index,r});groups.set(key,group);
 }
 for(const [batchId,items]of groups){
  const first=items[0].r;
  const ranks=new Set(items.map(x=>x.r.batch.rank));
  const numbers=new Set(items.map(x=>{
   const t=x.r.ticket;
   return Array.isArray(t?.front)&&Array.isArray(t?.back)?t.front.join(',')+'|'+t.back.join(','):'invalid';
  }));
  const valid=items.length===5&&ranks.size===5&&numbers.size===5&&[1,2,3,4,5].every(n=>ranks.has(n))&&items.every(({r})=>
   r.batch.id===batchId&&r.batch.size===5&&r.batch.rank===r.source?.rank&&
   r.period===first.period&&r.source?.resultId===first.source?.resultId&&
   r.createdAt===first.createdAt&&
   r.targetEvidence?.plannedDrawAt===first.targetEvidence?.plannedDrawAt&&
   r.targetEvidence?.sourceUrl===first.targetEvidence?.sourceUrl
  );
  if(!valid){
   issues.push({period:first.period,index:items[0].index,reason:'五组批次不完整、重复或元数据不一致，整批排除'});
   for(const item of items)invalidIndices.add(item.index);
  }
 }
 // An unmarked record sharing a period with a marked batch is suspicious too.
 const periods=new Set([...groups.values()].map(items=>items[0].r.period));
 for(const [index,r]of records.entries()){
  if(r&&!r.batch&&periods.has(r.period)){
   issues.push({period:r.period,index,reason:'同一期混入未标记记录，整期批次排除'});
   for(const [groupId,items]of groups)if(items[0].r.period===r.period)for(const item of items)invalidIndices.add(item.index);
   invalidIndices.add(index);
  }
 }
 return{invalidIndices,issues,markedBatches:groups.size};
}
