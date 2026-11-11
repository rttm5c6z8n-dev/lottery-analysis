import{parseDraw,validatePeriod,verifyRecord}from './v38-core.mjs';
export const VERSION='V4.2-evidence-assisted';
export function prepareEvidence({period,numbers,url,title,observedAt}){
 const p=validatePeriod(period),draw=parseDraw(numbers);
 let u;try{u=new URL(url)}catch{throw Error('请填写有效的官方开奖公告链接')}
 if(u.protocol!=='https:')throw Error('公告链接必须是HTTPS');
 const host=u.hostname.toLowerCase();
 if(!(host==='sport.gov.cn'||host.endsWith('.sport.gov.cn')||host==='lottery.gov.cn'||host.endsWith('.lottery.gov.cn')||host==='cwl.gov.cn'||host.endsWith('.cwl.gov.cn')))throw Error('目前仅允许政府/彩票主管部门域名；不能自动证明公告真实性');
 if(!title.trim())throw Error('请输入公告标题');
 if(!Number.isFinite(Date.parse(observedAt)))throw Error('核验时间无效');
 return{period:p,draw,url:u.href,title:title.trim().slice(0,180),observedAt,sourceStatus:'人工摘录，尚未自动验证网页内容'};
}
export function applyEvidence(records,evidence){
 if(!Array.isArray(records))throw Error('预测记录结构错误');
 const matched=records.filter(r=>r.period===evidence.period);
 if(!matched.length)throw Error('找不到该期预测记录');
 if(matched.some(r=>r.verification))throw Error('该期存在已核验记录；为防覆盖，已停止');
 const output=records.map(r=>r.period!==evidence.period?r:{...verifyRecord(r,evidence.draw,evidence.observedAt),verification:{...verifyRecord(r,evidence.draw,evidence.observedAt).verification,officialSourceUrl:evidence.url,officialSourceTitle:evidence.title,sourceStatus:evidence.sourceStatus}});
 return{records:output,matched:matched.length};
}
export function findConflicts(records){
 const byPeriod=new Map(),conflicts=[];
 for(const r of records){if(!r.verification?.draw)continue;const key=r.period,nums=[...r.verification.draw.front,...r.verification.draw.back].join(',');
 if(byPeriod.has(key)&&byPeriod.get(key)!==nums)conflicts.push(key);else byPeriod.set(key,nums)}
 return[...new Set(conflicts)];
}
