import{nextRegularDrawDate,tentativeNextPeriod}from './dlt-official-core.mjs';
import{assessOfficialDrawPayload}from './v42-official-check.mjs';
function beijingDay(iso){
 const ms=Date.parse(iso);
 if(!Number.isFinite(ms))throw Error('客户端时间无效');
 return new Date(ms+8*3600000).toISOString().slice(0,10);
}
export function proposeUpcomingDraw(data,now=new Date().toISOString()){
 const checked=assessOfficialDrawPayload(data,now);
 if(!checked.canPrefill)throw Error('官网最新开奖数据未通过双页面一致性及新鲜度检查：'+checked.status);
 const item=checked.latest,proposed=tentativeNextPeriod(item.period),nextDate=nextRegularDrawDate(item.date);
 if(!proposed||!nextDate)throw Error('无法根据官网最新期开奖信息生成候选期号');
 const today=beijingDay(now);
 if(nextDate<today)throw Error('下一常规开奖日已经过去，官网最新期可能已滞后；禁止推测未来正式期号');
 return{latestOfficialPeriod:item.period,latestOfficialDate:item.date,candidatePeriod:proposed,candidateDate:nextDate,
  isDateToday:nextDate===today,
  officialScheduleConfirmed:false,officialNextIssueConfirmed:false,
  source:data.source||'https://www.gstc.org.cn/wanfa/dlt_history',
  notice:'期号+1和下一周一/三/六开奖日仅为规则推算，官方休市、具体时间、实际期号尚未确认。禁止自动填写计划开奖时刻或勾选确认。'};
}
export function applyCandidatePeriod(currentValue,candidate){
 if(!candidate||candidate.officialNextIssueConfirmed!==false||!/^\d{5}$/.test(candidate.candidatePeriod||''))throw Error('缺少待核实的下期候选期号');
 if(String(currentValue||'').trim())throw Error('当前期号已有填写内容，禁止自动覆盖');
 return candidate.candidatePeriod;
}
