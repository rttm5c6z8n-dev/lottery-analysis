import{inspectArchiveResult}from './v31-archive-view.mjs';
import{verifyTicket}from './v38-core.mjs';
function bjDate(iso){
 const ms=Date.parse(iso);
 if(!Number.isFinite(ms))return null;
 return new Date(ms+8*3600000).toISOString().slice(0,10);
}
export function compareStoredArchiveToDraw(data,official){
 if(!official?.crossPageAgreement||!Array.isArray(official.records)||!official.records.length)throw Error('官网两处页面未确认一致，不进行存档对照');
 const draw=official.records[0];
 if(!/^\d{5}$/.test(String(draw.period||''))||!/^\d{4}-\d{2}-\d{2}$/.test(String(draw.date||'')))throw Error('官网开奖期号或日期格式异常');
 // Actual winning numbers are validated by verifyTicket before comparison.
 const results=Array.isArray(data?.results)?data.results:[];
 const archives=[];
 for(const result of results){
  if(Number(result?.throughPeriod)>=Number(draw.period))continue;
  let check;
  try{check=inspectArchiveResult(result,{snapshots:data.snapshots||[],trains:data.trains||[],reports:data.reports||[]})}catch{continue}
  if(!check.complete||!check.sourceConsistent||check.picks.length!==5)continue;
  const generatedDate=bjDate(result.generatedAt);
  if(!generatedDate||generatedDate>draw.date)continue;
  const picks=check.picks.map(p=>{
   const scores=verifyTicket({front:p.front,back:p.back},{front:draw.front,back:draw.back});
   return{rank:p.rank,front:p.front,back:p.back,...scores};
  });
  archives.push({resultId:result.id,throughPeriod:result.throughPeriod,generatedAt:result.generatedAt,
   timingNote:generatedDate===draw.date?'模型存档与期开奖日相同，缺少可信的准确开奖前时间证明':'模型存档的本机日期早于该期开奖日，但无第三方可信时间证明',
   picks,bestFront:Math.max(...picks.map(x=>x.frontHits)),
   completeHits:picks.filter(x=>x.exact).length});
 }
 archives.sort((a,b)=>String(b.generatedAt).localeCompare(String(a.generatedAt)));
 return{draw:{period:draw.period,date:draw.date,front:draw.front,back:draw.back},
  archives,checkedAt:official.checkedAt||null,
  label:'历史存档对照：不计入正式事前预测成绩',
  note:'只读复算，不修改V3.1历史库或V3.8预测留档，不将开奖前未独立锁定的存档冒充事前预测。两页同属一个发布机构。'};
}
