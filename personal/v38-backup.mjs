import{validateTicket,validatePeriod,verifyTicket}from './v38-core.mjs';
import{auditMarkedBatches}from './five-batch-audit.mjs';
export const BACKUP_FORMAT='lottery-personal-journal-backup-v1';
export function recordIdentity(r){
 const period=validatePeriod(r.period);
 if(r.source?.type==='v31-result'){
  const id=r.source.resultId,rank=r.source.rank;
  if(typeof id!=='string'||!id.trim()||!Number.isInteger(rank)||rank<1||rank>5)throw Error('期号'+period+'模型来源或组别无效');
  return period+'|model|'+id+'|'+rank;
 }
 return period+'|manual';
}
export function validateBackupRecord(r){
 if(!r||typeof r!=='object'||Array.isArray(r))throw Error('备份中包含非对象记录');
 const period=validatePeriod(r.period);
 if(!r.ticket||!Array.isArray(r.ticket.front)||!Array.isArray(r.ticket.back))throw Error('期号'+period+'缺少完整选号');
 const canonical=validateTicket(r.ticket.front.join(' '),r.ticket.back.join(' '));
 if(canonical.front.join(',')!==r.ticket.front.join(',')||canonical.back.join(',')!==r.ticket.back.join(','))throw Error('期号'+period+'选号不是规范升序');
 if(!r.createdAt||!Number.isFinite(Date.parse(r.createdAt)))throw Error('期号'+period+'缺少有效保存时间');
 if(typeof r.method!=='string'||!r.method.trim())throw Error('期号'+period+'缺少策略名称');
 if(r.verification){
  const v=r.verification;
  if(!v.draw||!Array.isArray(v.draw.front)||!Array.isArray(v.draw.back))throw Error('期号'+period+'开奖核验结构错误');
  const actual=verifyTicket(r.ticket,v.draw),claimed=v.result;
  if(!claimed||actual.frontHits!==claimed.frontHits||actual.backHits!==claimed.backHits||actual.exact!==claimed.exact)throw Error('期号'+period+'核验数据不一致');
  if(!v.verifiedAt||!Number.isFinite(Date.parse(v.verifiedAt))||Date.parse(v.verifiedAt)<Date.parse(r.createdAt))throw Error('期号'+period+'核验时间异常');
 }
 return r;
}
export function mergeBackup(current,backup){
 if(!Array.isArray(current))throw Error('本机记录损坏，停止恢复以防覆盖');
 if(!backup||typeof backup!=='object'||!Array.isArray(backup.records))throw Error('文件不是预测记录备份');
 if(backup.format&&backup.format!==BACKUP_FORMAT)throw Error('未知备份格式');
 if(backup.records.length>50000)throw Error('备份记录过多，停止导入');
 const present=new Set(),periods=new Set();
 for(const r of current){validateBackupRecord(r);const key=recordIdentity(r);if(present.has(key))throw Error('本机有重复记录：'+key);present.add(key);periods.add(r.period)}
 const currentBatchAudit=auditMarkedBatches(current);
 if(currentBatchAudit.issues.length)throw Error('本机存在不完整的5组锁定批次，已停止备份恢复以防覆盖');
 const incomingBatchAudit=auditMarkedBatches(backup.records);
 if(incomingBatchAudit.issues.length)throw Error('备份中含不完整或混合的5组锁定批次，已拒绝导入');
 const incoming=new Set(),added=[],incomingPeriods=new Map();
 for(const r of backup.records){
  validateBackupRecord(r);const key=recordIdentity(r);
  if(incoming.has(key))throw Error('备份文件含重复记录：'+key);
  incoming.add(key);
  const group=incomingPeriods.get(r.period)||[];group.push(r);incomingPeriods.set(r.period,group);
 }
 for(const [period,group]of incomingPeriods){
  if(periods.has(period)){continue}
  if(group.length>1){
   const source=group[0].source?.resultId,ranks=new Set(group.map(x=>x.source?.rank));
   if(group.length!==5||!source||ranks.size!==5||group.some(x=>x.source?.resultId!==source||x.source?.type!=='v31-result')||[1,2,3,4,5].some(n=>!ranks.has(n)))throw Error('备份中的'+period+'期不是完整5组原始批次');
  }
  for(const r of group)added.push(r);
 }
 const skipped=backup.records.length-added.length;
 return{records:[...current,...added],added:added.length,skipped};
}
export function makeBackup(records,exportedAt){
 if(!Array.isArray(records))throw Error('存储格式异常');
if(auditMarkedBatches(records).issues.length)throw Error('存在不完整或混合的5组锁定批次，停止备份导出');
 const seen=new Set();for(const r of records){validateBackupRecord(r);const key=recordIdentity(r);if(seen.has(key))throw Error('备份存在重复记录：'+key);seen.add(key)}
 return{format:BACKUP_FORMAT,exportedAt,records};
}
