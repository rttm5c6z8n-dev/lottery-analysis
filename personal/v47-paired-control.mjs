import{validateTicket,verifyTicket}from './v38-core.mjs';
import{inspectLockProof}from './v40-lock-proof.mjs';
import{auditMarkedBatches}from './five-batch-audit.mjs';
export const PAIRED_VERSION='V4.7-paired-control-v1';
export const CONTROL_ALGORITHM='sha256-counter-unbiased-fisher-yates-v1';
const MAX32=4294967296;
function hex(bytes){return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('')}
function unhex(value){
 if(typeof value!=='string'||!/^[0-9a-f]{64}$/.test(value))throw Error('随机种子必须为64位十六进制');
 return Uint8Array.from(value.match(/.{2}/g),s=>parseInt(s,16));
}
function digestApi(subtle=globalThis.crypto?.subtle){
 if(!subtle?.digest)throw Error('需要浏览器SHA-256支持');
 return subtle;
}
async function hashObject(obj,subtle){
 const bytes=new TextEncoder().encode(JSON.stringify(obj));
 return hex(new Uint8Array(await digestApi(subtle).digest('SHA-256',bytes)));
}
async function seededRng(seed,subtle){
 const bytes=unhex(seed),buffer=new Uint8Array(36);buffer.set(bytes,0);
 let words=[],offset=0,counter=0;
 async function nextUint32(){
  if(offset>=words.length){
   if(counter>10000)throw Error('随机序列生成超过安全上限');
   new DataView(buffer.buffer).setUint32(32,counter++,false);
   const raw=await digestApi(subtle).digest('SHA-256',buffer);
   const view=new DataView(raw);
   words=Array.from({length:8},(_,i)=>view.getUint32(i*4,false));
   offset=0;
  }
  return words[offset++];
 }
 return async n=>{
  if(!Number.isInteger(n)||n<1||n>35)throw Error('随机抽样范围无效');
  const ceiling=Math.floor(MAX32/n)*n;
  for(;;){const raw=await nextUint32();if(raw<ceiling)return raw%n;}
 };
}
async function drawTicket(rand){
 async function choose(max,k){
  const nums=Array.from({length:max},(_,i)=>i+1);
  for(let j=0;j<k;j++){
   const pick=j+await rand(max-j);
   [nums[j],nums[pick]]=[nums[pick],nums[j]];
  }
  return nums.slice(0,k).sort((a,b)=>a-b);
 }
 return{front:await choose(35,5),back:await choose(12,2)};
}
export async function generateFairControl(seed,subtle=globalThis.crypto?.subtle){
 const next=await seededRng(seed,subtle),results=[],seenFront=new Set();
 for(let i=0;i<100&&results.length<5;i++){
  const t=await drawTicket(next),f=t.front.join(',');
  if(seenFront.has(f))continue;
  seenFront.add(f);results.push(t);
 }
 if(results.length!==5)throw Error('未能生成5个不同的前区组合');
 return results;
}
function sortedModel(group){
 if(!Array.isArray(group)||group.length!==5)throw Error('需要完整5注正式锁定的模型预测');
 const ordered=[...group].sort((a,b)=>(a.batch?.rank??0)-(b.batch?.rank??0));
 if(ordered.some((r,i)=>r.batch?.rank!==i+1||r.batch?.size!==5))throw Error('缺少完整的五注批次序号');
 const audit=auditMarkedBatches(ordered);
 if(audit.invalidIndices.size)throw Error('五注批次结构完整性检查失败');
 const period=ordered[0].period,createdAt=ordered[0].createdAt;
 if(!/^\d{5}$/.test(period||'')||ordered.some(r=>r.period!==period||r.createdAt!==createdAt))throw Error('模型锁定期号或保存时间不一致');
 const planned=ordered[0].targetEvidence?.plannedDrawAt;
 if(!Number.isFinite(Date.parse(planned))||!Number.isFinite(Date.parse(createdAt))||Date.parse(createdAt)>=Date.parse(planned))throw Error('没有有效的事前计划开奖时间');
 if(ordered.some(r=>r.targetEvidence?.plannedDrawAt!==planned||r.source?.type!=='v31-result'||Number(r.source?.throughPeriod)>=Number(period)||
   !Number.isFinite(Date.parse(r.source?.generatedAt))||Date.parse(r.source.generatedAt)>Date.parse(createdAt)||
   !r.targetEvidence?.sourceUrl?.startsWith('https://')))throw Error('模型来源、生成时间、公告或截止期号不符合事前要求');
 const tickets=ordered.map(r=>validateTicket(r.ticket.front.join(' '),r.ticket.back.join(' ')));
 if(new Set(tickets.map(t=>t.front.join(','))).size!==5)throw Error('模型5注前区组合不互异，不能和5注随机对照做等覆盖比较');
 return{ordered,period,modelCreatedAt:createdAt,plannedDrawAt:planned,tickets};
}
export async function verifyLockedModel(group,subtle=globalThis.crypto?.subtle){
 const validated=sortedModel(group);
 const proof=await inspectLockProof(validated.ordered,subtle);
 if(!proof.valid)throw Error('模型5注本机锁定指纹校验失败，禁止登记对照');
 return{...validated,modelDigest:proof.digest};
}
export async function createPairRecord({locked,seed,createdAt,officialGate},subtle=globalThis.crypto?.subtle){
 const when=Date.parse(createdAt);
 if(!locked||!Number.isFinite(when)||when<Date.parse(locked.modelCreatedAt)||when>=Date.parse(locked.plannedDrawAt))throw Error('随机对照必须在模型锁定后、计划开奖前生成');
 if(officialGate?.period!==locked.period||!/^\d{5}$/.test(officialGate?.latestPublished||'')||
 Number(officialGate.latestPublished)>=Number(locked.period))throw Error('服务器最新开奖信息不足以支持该未来期号');
 const controls=await generateFairControl(seed,subtle);
 const payload={format:PAIRED_VERSION,period:locked.period,createdAt,modelCreatedAt:locked.modelCreatedAt,
  plannedDrawAt:locked.plannedDrawAt,modelDigest:locked.modelDigest,modelTickets:locked.tickets,
  controlAlgorithm:CONTROL_ALGORITHM,controlSeed:seed,controlTickets:controls,
  gate:{latestPublished:officialGate.latestPublished,checkedAt:officialGate.checkedAt,officialSource:officialGate.officialSource||null},
  primaryMetric:'best-front-hits-per-draw',secondaryMetrics:['first-prize-any','second-prize-any','best-front-tied-back'],
  disclaimer:'仅本地承诺完整性，未取得第三方时间戳。随机对照不能在看过开奖结果后创建或重抽。'};
 const digest=await hashObject(payload,subtle);
 return{payload,proof:{type:'sha256-local-paired-v1',digest}};
}
export async function verifyPairRecord(record,locked,subtle=globalThis.crypto?.subtle){
 if(!record||record.payload?.format!==PAIRED_VERSION||record.proof?.type!=='sha256-local-paired-v1'||
 !/^[a-f0-9]{64}$/.test(record.proof.digest||''))throw Error('随机对照凭证结构无效');
 const p=record.payload;
 if(p.controlAlgorithm!==CONTROL_ALGORITHM||p.period!==locked.period||p.modelDigest!==locked.modelDigest||
 p.modelCreatedAt!==locked.modelCreatedAt||p.plannedDrawAt!==locked.plannedDrawAt||
 JSON.stringify(p.modelTickets)!==JSON.stringify(locked.tickets))throw Error('随机对照与原模型锁定内容不一致');
 if(Date.parse(p.createdAt)<Date.parse(p.modelCreatedAt)||Date.parse(p.createdAt)>=Date.parse(p.plannedDrawAt))throw Error('对照生成时间不在事前窗口');
 const expected=await generateFairControl(p.controlSeed,subtle);
 if(JSON.stringify(expected)!==JSON.stringify(p.controlTickets))throw Error('对照号码不符合原随机种子，可能被修改');
 const digest=await hashObject(p,subtle);
 if(digest!==record.proof.digest)throw Error('随机对照SHA-256摘要不符');
 return{valid:true,digest};
}
function summarize(tickets,draw){
 const scored=tickets.map(t=>verifyTicket(t,draw));
 const best=Math.max(...scored.map(x=>x.frontHits));
 const bestBack=Math.max(...scored.filter(x=>x.frontHits===best).map(x=>x.backHits));
 return{bestFront:best,bestBackAtBestFront:bestBack,firstPrize:scored.some(x=>x.frontHits===5&&x.backHits===2),
  secondPrize:scored.some(x=>x.frontHits===5&&x.backHits===1),
  ticketScores:scored};
}
export function evaluatePair(record,draw){
 const p=record?.payload;
 if(!p||!Array.isArray(p.modelTickets)||p.modelTickets.length!==5||!Array.isArray(p.controlTickets)||p.controlTickets.length!==5)throw Error('配对实验数据不完整');
 const actual=validateTicket(draw.front.join(' '),draw.back.join(' '));
 const model=summarize(p.modelTickets,actual),control=summarize(p.controlTickets,actual);
 return{period:p.period,model,control,bestFrontDelta:model.bestFront-control.bestFront,
  verdict:model.bestFront>control.bestFront?'模型优于本期随机对照':model.bestFront<control.bestFront?'模型低于本期随机对照':'本期前区指标打平',
  caveat:'每一期仅算一次实验；同一期的五注相互关联。单期胜出不代表模型具有预测优势，奖级命中极为稀有。'};
}
export function summarizePairedRounds(rounds){
 if(!Array.isArray(rounds))throw Error('配对观察列表无效');
 const valid=rounds.filter(r=>r&&Number.isInteger(r.bestFrontDelta)&&r.bestFrontDelta>=-5&&r.bestFrontDelta<=5);
 const wins=valid.filter(r=>r.bestFrontDelta>0).length,losses=valid.filter(r=>r.bestFrontDelta<0).length;
 return{periods:valid.length,modelWins:wins,controlWins:losses,ties:valid.length-wins-losses,
  meanBestFrontDifference:valid.length?valid.reduce((s,r)=>s+r.bestFrontDelta,0)/valid.length:null,
  notice:'同期开奖中两组号码相关，不能直接假设每一期模型胜率应是50%，也不能把5注当5次独立试验。'};
}
