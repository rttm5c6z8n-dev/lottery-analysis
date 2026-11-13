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

export function nextStepForCandidate(candidatePeriod,candidateDate,rounds){
 if(!/^\d{5}$/.test(String(candidatePeriod||''))||!/^\d{4}-\d{2}-\d{2}$/.test(String(candidateDate||''))||
  !Array.isArray(rounds))throw Error('候选期号、日期或实验列表不合法');
 const item=rounds.find(r=>r.period===candidatePeriod);
 if(!item)return {stage:'unlocked',message:'下一常规候选：'+candidatePeriod+'期（'+candidateDate+'，北京时间）\n尚无该期完整配对实验记录。需先独立核实官方期号、开奖日期和具体时间，再依次完成研究、V4.0事前锁定和V4.7随机对照。'};
 if(item.status==='awaiting-draw'||item.status==='official-unavailable')
  return {stage:'ready-awaiting',message:'当前待开奖实验：'+candidatePeriod+'期（'+candidateDate+'，北京时间）\n已找到并验证模型5注和随机5注的配对记录。不要重复锁定或随机重抽；等官方公布该期开奖结果后点击“重新核验全部留档与开奖结果”。\n只有确认本期开奖后，才考虑新的下一期实验。'};
 if(item.status==='locked-only')
  return {stage:'model-only',message:'当前候选'+candidatePeriod+'期已有模型留档，但未发现随机对照。\n仅在官方实际开奖前，且满足V4.7事前核验条件时才能完成随机对照；开奖后不得补记。'};
 if(item.status==='scored')
  return {stage:'already-scored',message:'候选'+candidatePeriod+'期已得到官方历史开奖并完成核验，最新期号或常规日期可能尚未同步。\n请确认官方最新公告，不能按旧候选再登记。'};
 return {stage:'review-required',message:'当前候选'+candidatePeriod+'期存在待核实状态：'+statusLabel(item.status)+'。\n请先检查第二栏原始凭证状态，勿重新抽号或覆盖旧记录。'};
}
