import{tentativeNextPeriod,nextRegularDrawDate}from './dlt-official-core.mjs';
export function validateReceiptRequest(input,latest,now){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('提交内容必须是对象');
 const{period,digest,scope,plannedDrawAt}=input;
 if(!/^\d{5}$/.test(period||''))throw Error('目标期号格式异常');
 if(!/^[a-f0-9]{64}$/.test(digest||''))throw Error('SHA-256摘要格式异常');
 if(!['single-ticket','five-tickets'].includes(scope))throw Error('锁定注数范围不合法');
 if(typeof plannedDrawAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?\+08:00$/.test(plannedDrawAt))throw Error('计划时间必须使用北京时间+08:00');
 const nowMs=Date.parse(now),drawMs=Date.parse(plannedDrawAt);
 if(!Number.isFinite(nowMs)||!Number.isFinite(drawMs)||drawMs<=nowMs)throw Error('计划开奖时间已经到达，拒绝事后提交');
 if(!latest||!/^\d{5}$/.test(latest.period||'')||!/^\d{4}-\d\d-\d\d$/.test(latest.date||''))throw Error('缺少有效官方最新开奖');
 const next=tentativeNextPeriod(latest.period),regularDate=nextRegularDrawDate(latest.date);
 if(!next||period!==next)throw Error('提交期号不是官方已公布最新期号的下一期候选');
 if(!regularDate||plannedDrawAt.slice(0,10)!==regularDate)throw Error('目标开奖日期与常规日期不一致，需官方进一步核实');
 const remaining=drawMs-nowMs;
 if(remaining<60000)throw Error('距离计划开奖不到一分钟，拒绝临近开奖的留档');
 return{period,digest,scope,plannedDrawAt,latestOfficialPeriod:latest.period,latestOfficialDate:latest.date};
}
export function validateReceiptData(row){
 if(!row||!/^[0-9a-f-]{36}$/i.test(row.id||''))throw Error('回执标识无效');
 if(!/^\d{5}$/.test(row.period||'')||!/^[a-f0-9]{64}$/.test(row.digest||''))throw Error('服务器返回无效回执');
 if(!Number.isFinite(Date.parse(row.received_at||'')))throw Error('服务器接收时间异常');
 return{id:row.id,period:row.period,digest:row.digest,scope:row.scope,receivedAt:row.received_at,
  plannedDrawAt:row.planned_draw_at,latestOfficialPeriod:row.latest_official_period,
  latestOfficialDate:row.latest_official_date,source:row.source_url,
  notice:'此为服务器数据库接收指纹的时间记录；不是法定公证，不证明独立权威开奖计划，也不证明号码有预测优势。'};
}
