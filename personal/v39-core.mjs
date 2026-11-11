export const VERSION='V3.9-scoreboard';
export function summarize(records){
 const verified=records.filter(r=>r&&r.verification?.result&&r.ticket),pending=records.filter(r=>r&&!r.verification);
 const hist=Array.from({length:6},()=>Array(3).fill(0));let exact=0,front=0,back=0;
 for(const r of verified){const a=r.verification.result,f=a.frontHits,b=a.backHits;if(!Number.isInteger(f)||f<0||f>5||!Number.isInteger(b)||b<0||b>2)throw Error('命中数据异常');hist[f][b]++;front+=f;back+=b;if(f===5&&b===2)exact++}
 const n=verified.length;return{version:VERSION,total:records.length,verified:n,pending:pending.length,exact,frontHits:front,backHits:back,meanFront:n?front/n:null,meanBack:n?back/n:null,baselineFront:25/35,baselineBack:4/12,baselineExactProbability:1/21425712,hist,warning:'随机基准为每注均匀抽样的数学期望。仅统计已核验且有官方结果证据的事前记录；本机时间戳不具第三方证明力。样本少时不能推断预测优势。'}
}
export function validateImportedRecord(r){if(!r||typeof r!=='object'||!/^[0-9]{5}$/.test(r.period||''))return false;const t=r.ticket;if(!t||!Array.isArray(t.front)||!Array.isArray(t.back)||t.front.length!==5||t.back.length!==2)return false;return t.front.every(x=>Number.isInteger(x)&&x>=1&&x<=35)&&new Set(t.front).size===5&&t.back.every(x=>Number.isInteger(x)&&x>=1&&x<=12)&&new Set(t.back).size===2}
