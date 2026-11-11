import{validateTicket,validatePeriod,verifyTicket}from './v38-core.mjs';
export const BACKUP_FORMAT='lottery-personal-journal-backup-v1';
const hasOwn=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
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
 const present=new Set();
 for(const r of current){validateBackupRecord(r);if(present.has(r.period))throw Error('本机有重复期号，请先核对');present.add(r.period)}
 const incoming=new Set(),added=[];
 for(const r of backup.records){
  validateBackupRecord(r);
  if(incoming.has(r.period))throw Error('备份文件含重复期号'+r.period);
  incoming.add(r.period);
  if(present.has(r.period))continue;
  added.push(r);
 }
 return{records:[...current,...added],added:added.length,skipped:backup.records.length-added.length};
}
export function makeBackup(records,exportedAt){
 if(!Array.isArray(records))throw Error('存储格式异常');
 for(const r of records)validateBackupRecord(r);
 return{format:BACKUP_FORMAT,exportedAt,records};
}
