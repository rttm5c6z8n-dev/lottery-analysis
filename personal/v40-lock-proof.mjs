// SHA-256 protects against accidental/inconsistent edits while the original
// digest remains available. Local storage and the digest can both be rewritten:
// NOT a trusted third-party timestamp or tamper-proof notarization.
export const LOCK_PROOF_VERSION='local-sha256-v1';
const fields=r=>({
  period:r.period,
  ticket:r.ticket,
  method:r.method,
  createdAt:r.createdAt,
  batch:r.batch??null,
  source:r.source??null,
  targetEvidence:r.targetEvidence??null,
  liveGate:r.liveGate??null
});
export function canonicalLockedRecords(records){
 if(!Array.isArray(records)||!(records.length===1||records.length===5))throw Error('锁定指纹只能针对1注或完整5注');
 const list=records.map(fields);
 const period=list[0].period;
 if(!/^\d{5}$/.test(String(period))||list.some(x=>x.period!==period))throw Error('锁定指纹包含多个期号');
 const ranks=records.map(x=>x.batch?.rank??x.source?.rank??0);
 if(records.length===5){
  if(new Set(ranks).size!==5||[1,2,3,4,5].some(n=>!ranks.includes(n)))throw Error('指纹缺少完整5组');
  if(records.some(x=>x.batch?.id!==records[0].batch?.id||x.batch?.size!==5))throw Error('五组批次标识不一致');
 }
 list.sort((a,b)=>(a.batch?.rank??a.source?.rank??0)-(b.batch?.rank??b.source?.rank??0));
 return JSON.stringify({format:LOCK_PROOF_VERSION,records:list});
}
function toHex(bytes){return[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function digestLockedRecords(records,subtle=globalThis.crypto?.subtle){
 if(!subtle?.digest)throw Error('当前浏览器不支持SHA-256指纹，未保存任何预测');
 const data=new TextEncoder().encode(canonicalLockedRecords(records));
 const digest=await subtle.digest('SHA-256',data);
 return toHex(new Uint8Array(digest));
}
export async function stampLockedRecords(records,subtle=globalThis.crypto?.subtle){
 if(records.some(x=>x.lockProof))throw Error('记录已存在指纹，禁止覆盖');
 const digest=await digestLockedRecords(records,subtle);
 const proof={version:LOCK_PROOF_VERSION,digest,scope:records.length===5?'five-tickets':'single-ticket'};
 return{records:records.map(r=>({...r,lockProof:proof})),proof};
}
export async function inspectLockProof(records,subtle=globalThis.crypto?.subtle){
 if(!Array.isArray(records)||!records.length)throw Error('没有待检查的记录');
 const proof=records[0].lockProof;
 if(!proof)return{status:'legacy',valid:null,reason:'旧留档没有本机SHA-256指纹'};
 if(proof.version!==LOCK_PROOF_VERSION||!/^([a-f0-9]{64})$/.test(proof.digest))return{status:'invalid',valid:false,reason:'指纹格式异常'};
 if(records.some(x=>JSON.stringify(x.lockProof)!==JSON.stringify(proof)))return{status:'invalid',valid:false,reason:'同一期记录的指纹不一致'};
 if(proof.scope!==(records.length===5?'five-tickets':'single-ticket'))return{status:'invalid',valid:false,reason:'锁定注数发生变化'};
 try{
  const actual=await digestLockedRecords(records,subtle);
  return actual===proof.digest?{status:'valid',valid:true,digest:actual}:{status:'invalid',valid:false,reason:'当前预测内容与原始指纹不匹配',expected:proof.digest,actual};
 }catch(e){return{status:'invalid',valid:false,reason:e.message}}
}
export function exportLockEvidence(records){
 const raw=canonicalLockedRecords(records);
 const proof=records[0]?.lockProof;
 if(!proof||proof.version!==LOCK_PROOF_VERSION)throw Error('未找到有效锁定指纹');
 return{format:'lottery-lock-evidence-v1',notice:'仅本机哈希校验，不是独立第三方时间证明。请将文件在开奖前备份到独立位置。',proof,canonical:JSON.parse(raw)};
}
