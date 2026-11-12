import{assessOfficialDrawPayload}from './v42-official-check.mjs';
import{tentativeNextPeriod,nextRegularDrawDate}from './dlt-official-core.mjs';
// Recheck the provider immediately before any local candidate lock.
// A page read is not proof of an unpublished draw or third-party timestamp.
export function verifyLiveLockGate({payload,period,drawAt,now}){
 const quality=assessOfficialDrawPayload(payload,now);
 if(!quality.canPrefill)throw Error('最新官网开奖数据未获同站双页面确认，停止锁定：'+quality.status);
 const checkedMs=Date.parse(payload.checkedAt),nowMs=Date.parse(now);
 if(!Number.isFinite(checkedMs)||checkedMs>nowMs+30000||nowMs-checkedMs>120000)throw Error('官网查询时间不是刚刚取得的结果，请重新查询');
 if(!/^\d{5}$/.test(String(period||'')))throw Error('锁定期号必须是5位数字');
 const next=tentativeNextPeriod(quality.latestPeriod);
 if(!next||String(period)!==next)throw Error('目标期号不是官网最新开奖 '+quality.latestPeriod+' 的下一期候选 '+(next||'未知')+'，为防止补记已开奖数据，已停止');
 const date=nextRegularDrawDate(quality.latestDate);
 if(!date)throw Error('无法检查下一常规开奖日期');
 if(typeof drawAt!=='string'||!/\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?\+08:00$/.test(drawAt))throw Error('计划开奖时间需要明确北京时间+08:00');
 if(drawAt.slice(0,10)!==date)throw Error('计划开奖日期与常规开奖日 '+date+' 不同。若官方有休市调整，请停止使用当前自动检查流程并核实');
 const planned=Date.parse(drawAt);
 if(!Number.isFinite(planned)||planned<=nowMs)throw Error('计划开奖时间已到或时间无效，禁止事后补记');
 return{latestPublished:quality.latestPeriod,latestDrawDate:quality.latestDate,checkedAt:payload.checkedAt,
  officialSource:payload.source,period,date,officialNextIssueConfirmed:false,officialScheduleConfirmed:false,
  disclaimer:'只核验刚查询到的官网已开奖期号、常规日历和本机时间。目标期号、未开奖状态及具体开奖时间仍需人工核实，未提供独立时间公证。'};
}
