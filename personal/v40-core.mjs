import{buildRecord,validatePeriod,validateTicket}from './v38-core.mjs';
import{inspectArchiveResult}from './v31-archive-view.mjs';
export const VERSION='V4.0-bridge-r3';
export function eligibleArchivedResults(data){
 const results=Array.isArray(data?.results)?data.results:[];
 return results.flatMap(result=>{try{const inspection=inspectArchiveResult(result,{snapshots:data.snapshots||[],trains:data.trains||[],reports:data.reports||[]});return inspection.complete&&inspection.sourceConsistent&&inspection.picks.length===5?[{result,inspection}]:[]}catch{return []}});
}

export function chooseResult(results,id,rank){
 const r=results.find(x=>x.id===id);if(!r)throw Error('找不到研究结果');
 if(!r.generatedAt)throw Error('缺少生成时间');
 if(!Array.isArray(r.picks)||!r.picks.length)throw Error('结果没有选号组合');
 if(!Number.isInteger(rank)||rank<0||rank>=r.picks.length)throw Error('选号序号非法');
 const nums=r.picks[rank].nums;if(!Array.isArray(nums)||nums.length!==7)throw Error('组合结构异常');validateTicket(nums.slice(0,5).join(' '),nums.slice(5).join(' '));
 return{resultId:r.id,rank:rank+1,nums,generatedAt:r.generatedAt,trainId:r.trainId,reportId:r.reportId,weightsetId:r.weightsetId,version:r.version,throughPeriod:r.throughPeriod,searchMethod:r.searchMethod};
}
function strictTime(value,label){
 if(typeof value!=='string'||!/\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/.test(value))throw Error(label+'必须包含明确时区');
 const ms=Date.parse(value);if(!Number.isFinite(ms))throw Error(label+'无效');return ms;
}
export function bridgeRecord({result,period,now,drawAt,sourceUrl}){
 validatePeriod(period);
 const generated=strictTime(result.generatedAt,'模型生成时间'),saved=strictTime(now,'预测保存时间');
 if(generated>saved)throw Error('模型生成时间晚于预测保存时间');
 const planned=strictTime(drawAt,'计划开奖时间');
 if(saved>=planned)throw Error('计划开奖时间已经到达或早于保存时间，不允许作为事前预测');
 let official;try{official=new URL(sourceUrl)}catch{throw Error('需要提供目标期号和开奖时间的公告链接')}
 if(official.protocol!=='https:'||official.username||official.password)throw Error('公告必须是有效HTTPS地址');
 const host=official.hostname.toLowerCase();
 if(!(host==='sport.gov.cn'||host.endsWith('.sport.gov.cn')||host==='lottery.gov.cn'||host.endsWith('.lottery.gov.cn')))throw Error('请填写中国体育彩票管理相关官方网站的公告链接');
 const record=buildRecord({period,front:result.nums.slice(0,5).join(' '),back:result.nums.slice(5).join(' '),method:'V3.1 第'+result.rank+'组 / '+String(result.version||'未知'),createdAt:now});
 return{...record,source:{type:'v31-result',resultId:result.resultId,rank:result.rank,generatedAt:result.generatedAt,trainId:result.trainId,reportId:result.reportId,weightsetId:result.weightsetId,throughPeriod:result.throughPeriod,searchMethod:result.searchMethod},
 targetEvidence:{plannedDrawAt:drawAt,sourceUrl:official.href,verification:'人工核实声明，未自动校验公告内容'},
 notice:'本机时间可被修改，不是可信时间戳。仅在目标官方计划独立确认且实际开奖前留档才有事前研究意义。'};
}
