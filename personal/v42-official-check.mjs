import{validateTicket}from './v38-core.mjs';
export function assessOfficialDrawPayload(data,now=new Date().toISOString()){
 if(!data||typeof data!=='object')throw Error('官方接口没有返回可识别的JSON');
 if(data.error)throw Error(data.error);
 const item=data.records?.[0];
 if(!item||!/^\d{5}$/.test(String(item.period||'')))throw Error('官方接口未返回合法最新期号');
 const date=String(item.date||''),dateMs=Date.parse(date+'T00:00:00+08:00'),nowMs=Date.parse(now);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(dateMs)||new Date(dateMs+8*3600000).toISOString().slice(0,10)!==date)throw Error('官方开奖日期不合法');
 if(!Array.isArray(item.front)||!Array.isArray(item.back))throw Error('开奖号码字段不完整');
 const nums=validateTicket(item.front.join(' '),item.back.join(' '));
 if(nums.front.join(',')!==item.front.join(',')||nums.back.join(',')!==item.back.join(','))throw Error('开奖号码不是标准升序');
 if(data.latestPeriod!==item.period||data.latestDate!==date)throw Error('官网接口的最新期号和历史记录不一致');
 if(!Number.isFinite(nowMs))throw Error('客户端当前时间无效');
 const ageDays=(nowMs-dateMs)/86400000;
 if(ageDays<0)throw Error('官网最新开奖日期晚于当前设备日期，拒绝自动填写');
 const stale=ageDays>8;
 const checked=Number.isFinite(Date.parse(data.checkedAt));
 const matched=data.crossPageAgreement===true&&data.diagnostics?.agreement!=='unconfirmed';
 return{
  latest:item,latestPeriod:item.period,latestDate:date,ageDays,
  canPrefill:matched&&!stale&&checked,
  status:!checked?'接口缺少有效核验时间，拒绝自动填写':stale?'官方结果超过8天，可能是过期页面，拒绝自动填写':matched?'两处同一体彩官网页面最新结果一致，可人工复核后填写':'两处官网页面未确认一致，拒绝自动填写',
  diagnostics:data.diagnostics||null,
  warning:'同一单位两处网页一致不等于第三方独立验证；数据尚未写入任何预测记录。'
 };
}
