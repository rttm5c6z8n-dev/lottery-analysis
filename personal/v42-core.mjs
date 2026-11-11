import{parseDraw,validatePeriod,verifyRecord}from './v38-core.mjs';
export const VERSION='V4.2-evidence-assisted-r2';
export function prepareEvidence({period,numbers,url,title,observedAt}){
 const p=validatePeriod(period),draw=parseDraw(numbers);
 let u;try{u=new URL(url)}catch{throw Error('请填写有效的官方开奖公告链接')}
 if(u.protocol!=='https:')throw Error('公告链接必须是HTTPS');
 if(u.username||u.password)throw Error('公告链接不能包含账号密码');
 const host=u.hostname.toLowerCase();
 if(!(host==='sport.gov.cn'||host.endsWith('.sport.gov.cn')||host==='lottery.gov.cn'||host.endsWith('.lottery.gov.cn')||host==='cwl.gov.cn'||host.endsWith('.cwl.gov.cn')))throw Error('目前仅允许指定政府或彩票管理网站域名；不能自动证明公告真实性');
 if(!String(title||'').trim())throw Error('请输入公告标题');
 if(!Number.isFinite(Date.parse(observedAt)))throw Error('核验时间无效');
 return{period:p,draw,url:u.href,title:title.trim().slice(0,180),observedAt,sourceStatus:'人工摘录：网站内容与开奖期号尚未独立核实'};
}
export function applyEvidence(records,evidence){
 if(!Array.isArray(records))throw Error('预测记录结构错误');
 const matched=records.filter(r=>r.period===evidence.period);
 if(!matched.length)throw Error('找不到该期预测记录');
 if(matched.some(r=>r.verification))throw Error('该期存在已核验记录；为防覆盖，已停止');
 const observed=Date.parse(evidence.observedAt);
 if(!Number.isFinite(observed))throw Error('核验时间无效');
 for(const r of matched){
  const saved=Date.parse(r.createdAt);
  if(!Number.isFinite(saved)||saved>observed)throw Error('预测保存时间晚于核验时间或无效，拒绝核验');
  if(r.source?.generatedAt){const generated=Date.parse(r.source.generatedAt);if(!Number.isFinite(generated)||generated>saved)throw Error('模型生成时间晚于预测保存时间或无效，拒绝核验')}
 }
 const output=records.map(r=>{
  if(r.period!==evidence.period)return r;
  const verified=verifyRecord(r,evidence.draw,evidence.observedAt);
  return{...verified,verification:{...verified.verification,officialSourceUrl:evidence.url,officialSourceTitle:evidence.title,sourceStatus:evidence.sourceStatus,officiallyVerified:false}};
 });
 return{records:output,matched:matched.length};
}
export function findConflicts(records){
 const byPeriod=new Map(),conflicts=[];
 for(const r of records){if(!r.verification?.draw)continue;const key=r.period,nums=[...r.verification.draw.front,...r.verification.draw.back].join(',');
 if(byPeriod.has(key)&&byPeriod.get(key)!==nums)conflicts.push(key);else byPeriod.set(key,nums)}
 return[...new Set(conflicts)];
}
