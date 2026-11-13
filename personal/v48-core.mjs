import {validateTicket} from './v38-core.mjs';
export const V48_VERSION='V4.8.0';
export const V48_LOCK_KEY='lottery_v38_predictions';
export const V48_PAIR_KEY='lottery_v47_paired_controls';

// V4.8 only reads V4.0/V4.7 storage. It must never reconstruct, overwrite,
// auto-generate or retrospectively pair a ticket after a draw.
export function parseV48LocalState(lockRaw,pairRaw){
 let locks=[],pairs={};
 if(lockRaw!==null&&lockRaw!==undefined){
  try{locks=JSON.parse(lockRaw)}catch{throw Error('V4.0留档JSON损坏；已停止读取，不会覆盖')}
  if(!Array.isArray(locks))throw Error('V4.0留档必须是数组；拒绝操作');
 }
 if(pairRaw!==null&&pairRaw!==undefined){
  try{pairs=JSON.parse(pairRaw)}catch{throw Error('V4.7对照JSON损坏；已停止读取，不会覆盖')}
  if(!pairs||typeof pairs!=='object'||Array.isArray(pairs))throw Error('V4.7对照格式不正确；拒绝操作');
 }
 const groups=new Map();
 for(const row of locks){
  const period=String(row?.period||'');
  if(!/^\d{5}$/.test(period))continue;
  if(!groups.has(period))groups.set(period,[]);
  groups.get(period).push(row);
 }
 return{groups,pairs};
}

export function indexOfficialDraws(payload){
 if(!payload||!Array.isArray(payload.records))throw Error('官方接口没有有效历史开奖结果列表');
 const latest=String(payload.latestPeriod||'');
 if(!/^\d{5}$/.test(latest))throw Error('官网最新期号缺失或格式错误');
 const map=new Map(),conflicts=new Set();
 for(const row of payload.records){
  try{
   const period=String(row.period||'');
   if(!/^\d{5}$/.test(period)||Number(period)>Number(latest))continue;
   if(!Array.isArray(row.front)||!Array.isArray(row.back))continue;
   const t=validateTicket(row.front.join(' '),row.back.join(' '));
   if(JSON.stringify(t.front)!==JSON.stringify(row.front)||JSON.stringify(t.back)!==JSON.stringify(row.back))continue;
   const old=map.get(period);
   if(old&&(JSON.stringify(old)!==JSON.stringify(t)))conflicts.add(period);
   else map.set(period,t);
  }catch{}
 }
 for(const period of conflicts)map.delete(period);
 return{map,conflicts,latest,source:String(payload.source||''),checkedAt:String(payload.checkedAt||''),
  sameSiteLatestConfirmed:payload.crossPageAgreement===true};
}
export function roundStatus({period,hasLock,hasPair,proofValid,draw,latest}){
 if(!/^\d{5}$/.test(String(period)))throw Error('期号格式错误');
 if(!hasLock&&hasPair)return 'missing-model';
 if(!hasLock)return 'missing-model';
 if(!hasPair)return 'locked-only';
 if(!proofValid)return 'invalid-proof';
 if(draw)return 'scored';
 if(!/^\d{5}$/.test(String(latest||'')))return 'official-unavailable';
 return Number(period)>Number(latest)?'awaiting-draw':'official-missing';
}
export function statusLabel(code){
 return({
  'missing-model':'缺少对应模型原始留档',
  'locked-only':'只有模型锁定，尚无随机对照',
  'invalid-proof':'凭证/批次核验未通过',
  'scored':'已取得官方历史开奖并计分',
  'awaiting-draw':'尚无该期已公布开奖结果',
  'official-missing':'期号已不新于官网最新，但历史页缺少该期结果',
  'official-unavailable':'官方接口不可用，暂不评分'
 })[code]||'未知状态';
}
export function summarizeV48Statuses(rows){
 if(!Array.isArray(rows))throw Error('期号表必须是数组');
 const counts={scored:0,pending:0,needsAttention:0};
 for(const row of rows){
  if(row.status==='scored')counts.scored++;
  else if(row.status==='awaiting-draw'||row.status==='official-unavailable')counts.pending++;
  else counts.needsAttention++;
 }
 return{total:rows.length,...counts};
}
