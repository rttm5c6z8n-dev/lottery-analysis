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


// Exact combinatorial calibration for the *pre-registered* best-front metric.
// No historical or future draw is used: enumerate all C(35,5)=324632
// equally likely front outcomes for these two FIXED 5-ticket sets.
function maskForFairFront(front){
 if(!Array.isArray(front)||front.length!==5||front.some(n=>!Number.isInteger(n)||n<1||n>35)||
  new Set(front).size!==5)throw Error('公平基准的前区组合不合法');
 let lo=0,hi=0;
 for(const n of front){if(n<=32)lo|=1<<(n-1);else hi|=1<<(n-33)}
 return{lo,hi};
}
function popCount32(n){
 n=n-((n>>>1)&0x55555555);
 n=(n&0x33333333)+((n>>>2)&0x33333333);
 return (((n+(n>>>4))&0x0f0f0f0f)*0x01010101)>>>24;
}
export function exactFairFrontBenchmark(modelTickets,controlTickets){
 if(!Array.isArray(modelTickets)||modelTickets.length!==5||
  !Array.isArray(controlTickets)||controlTickets.length!==5)throw Error('公平基准需模型与随机各5注');
 const model=modelTickets.map(t=>maskForFairFront(t.front));
 const control=controlTickets.map(t=>maskForFairFront(t.front));
 const bits=Array.from({length:36},(_,n)=>n===0?{lo:0,hi:0}:n<=32?{lo:1<<(n-1),hi:0}:{lo:0,hi:1<<(n-33)});
 let total=0,modelWins=0,controlWins=0,ties=0,modelSum=0,controlSum=0;
 for(let a=1;a<=31;a++)for(let b=a+1;b<=32;b++)for(let c=b+1;c<=33;c++)
 for(let d=c+1;d<=34;d++)for(let e=d+1;e<=35;e++){
  const lo=bits[a].lo|bits[b].lo|bits[c].lo|bits[d].lo|bits[e].lo;
  const hi=bits[a].hi|bits[b].hi|bits[c].hi|bits[d].hi|bits[e].hi;
  let mBest=0,cBest=0;
  for(const t of model){const hits=popCount32(t.lo&lo)+popCount32(t.hi&hi);if(hits>mBest)mBest=hits}
  for(const t of control){const hits=popCount32(t.lo&lo)+popCount32(t.hi&hi);if(hits>cBest)cBest=hits}
  total++;modelSum+=mBest;controlSum+=cBest;
  if(mBest>cBest)modelWins++;else if(mBest<cBest)controlWins++;else ties++;
 }
 if(total!==324632)throw Error('公平基准的组合枚举不完整');
 return{total,modelWins,controlWins,ties,
  modelWinProbability:modelWins/total,controlWinProbability:controlWins/total,tieProbability:ties/total,
  expectedModelBest:modelSum/total,expectedControlBest:controlSum/total,
  expectedDelta:(modelSum-controlSum)/total,
  notice:'本结果是所有公平独立开奖前区组合的精确结构基准，不使用真实开奖结果。原先已预注册的最佳前区命中主指标保持不变；此补充校准不能事后改写原始实验规则，也不能证明预测能力。'};
}


// Portable read-only self-consistency verification for an exported JSON file.
// This does NOT establish trustworthy creation time or prove a matching
// V4.0 local lock; verifyPairRecord is still required before recovery.
export async function verifyExportedPairStandalone(record,subtle=globalThis.crypto?.subtle){
 const p=record?.payload,proof=record?.proof;
 if(!p||p.format!==PAIRED_VERSION||proof?.type!=='sha256-local-paired-v1'||
  !/^[a-f0-9]{64}$/.test(proof.digest||''))throw Error('文件不是有效的V4.7凭证格式');
 if(!/^\d{5}$/.test(String(p.period))||!/^[a-f0-9]{64}$/.test(p.modelDigest||'')||
  p.controlAlgorithm!==CONTROL_ALGORITHM)throw Error('期号、算法或模型摘要格式不匹配');
 const modelAt=Date.parse(p.modelCreatedAt),controlAt=Date.parse(p.createdAt),planned=Date.parse(p.plannedDrawAt);
 if(![modelAt,controlAt,planned].every(Number.isFinite)||modelAt>controlAt||controlAt>=planned)
  throw Error('凭证内时间先后顺序不合法');
 if(!Array.isArray(p.modelTickets)||p.modelTickets.length!==5||
  !Array.isArray(p.controlTickets)||p.controlTickets.length!==5)throw Error('凭证必须包含模型与随机各5注');
 for(const t of [...p.modelTickets,...p.controlTickets]){
  if(!t||!Array.isArray(t.front)||!Array.isArray(t.back))throw Error('存在不完整号码');
  const valid=validateTicket(t.front.join(' '),t.back.join(' '));
  if(JSON.stringify(valid)!==JSON.stringify(t))throw Error('凭证中的号码顺序或结构异常');
 }
 for(const group of [p.modelTickets,p.controlTickets]){
  if(new Set(group.map(t=>t.front.join(','))).size!==5)throw Error('前区组合不满足5注互异要求');
 }
 const expected=await generateFairControl(p.controlSeed,subtle);
 if(JSON.stringify(expected)!==JSON.stringify(p.controlTickets))throw Error('随机5注与种子重放结果不一致');
 const digest=await hashObject(p,subtle);
 if(digest!==proof.digest)throw Error('JSON凭证内容与SHA-256摘要不一致');
 return{valid:true,period:p.period,digest,scope:'standalone-untrusted-time',
  notice:'仅校验JSON内部一致性、号码合法性和随机种子可重现性，不能核实当时是否真在开奖前、模型是否已在其他设备锁定或第三方可信时间。'};
}


// Post-draw descriptive report. The primary preregistered comparison remains
// best-front-hits-per-draw. All other numbers are marked descriptive.
export function formatPairedDrawReport(score,draw,benchmark){
 if(!score||!score.model||!score.control||!Array.isArray(score.model.ticketScores)||!Array.isArray(score.control.ticketScores))
  throw Error('缺少可核验的开奖评分');
 const validDraw=validateTicket(draw.front.join(' '),draw.back.join(' '));
 if(!benchmark||benchmark.total!==324632||!Number.isFinite(benchmark.expectedDelta))
  throw Error('缺少完整的公平开奖结构基准');
 const fmt=n=>String(n).padStart(2,'0');
 const stringify=t=>t.front.map(fmt).join(' ')+' + '+t.back.map(fmt).join(' ');
 const row=(name,side)=>[
  name+'：最佳前区命中 '+side.bestFront+'/5，最佳前区对应后区最高 '+side.bestBackAtBestFront+'/2',
  '  5注命中：'+side.ticketScores.map((x,i)=>(i+1)+'号 '+x.frontHits+'+'+x.backHits).join('；'),
  '  命中一等奖：'+(side.firstPrize?'是':'否')+'；二等奖：'+(side.secondPrize?'是':'否')
 ].join('\n');
 const observed=score.bestFrontDelta,excess=observed-benchmark.expectedDelta;
 const signed=n=>(n>=0?'+':'')+n.toFixed(4);
 return '第'+score.period+'期 · 已开奖配对核对\n'+
  '开奖号码：'+stringify(validDraw)+'\n'+
  row('模型5注',score.model)+'\n'+row('随机5注',score.control)+'\n\n'+
  '【预先设定的主指标】最佳前区命中差（模型−随机）：'+(observed>0?'+':'')+observed+'\n'+
  '【公平开奖结构基准】理论命中差：'+signed(benchmark.expectedDelta)+'\n'+
  '【辅助观察】实际差减理论差：'+signed(excess)+'\n'+
  '【理论胜负分布】模型 '+(benchmark.modelWinProbability*100).toFixed(2)+'%，随机 '+
    (benchmark.controlWinProbability*100).toFixed(2)+'%，平局 '+(benchmark.tieProbability*100).toFixed(2)+'%\n'+
  '说明：本期只是一次观测；理论基准按固定号码精确枚举，不是事后调整预注册主指标。';
}

export function summarizeCalibratedPairedRounds(entries){
 if(!Array.isArray(entries))throw Error('校准统计输入不是数组');
 if(!entries.length)return{periods:0,observedMeanDelta:null,expectedMeanDelta:null,meanExcess:null,
  expectedModelWins:null,expectedControlWins:null,notice:'尚无已开奖且通过完整核验的配对期号。'};
 const seen=new Set();
 let actual=0,expected=0,winExpected=0,lossExpected=0;
 for(const entry of entries){
  const score=entry?.score,b=entry?.benchmark;
  if(!score||!/^\d{5}$/.test(String(score.period))||seen.has(score.period)||
   !Number.isInteger(score.bestFrontDelta)||Math.abs(score.bestFrontDelta)>5||
   !b||b.total!==324632||!Number.isFinite(b.expectedDelta)||
   !Number.isFinite(b.modelWinProbability)||!Number.isFinite(b.controlWinProbability)||
   b.modelWinProbability<0||b.modelWinProbability>1||
   b.controlWinProbability<0||b.controlWinProbability>1)throw Error('存在重复期号或不完整的基准评分');
  seen.add(score.period);
  actual+=score.bestFrontDelta;expected+=b.expectedDelta;
  winExpected+=b.modelWinProbability;lossExpected+=b.controlWinProbability;
 }
 const periods=entries.length,observedMeanDelta=actual/periods,expectedMeanDelta=expected/periods;
 return{periods,observedMeanDelta,expectedMeanDelta,meanExcess:observedMeanDelta-expectedMeanDelta,
  expectedModelWins:winExpected,expectedControlWins:lossExpected,
  notice:'公平基准仅调整不同号码覆盖结构的预期差异；实际超出基准不等于统计显著，也不能证明下一期可预测。请保持原始锁定、原指标和真实成绩可追溯。'};
}
