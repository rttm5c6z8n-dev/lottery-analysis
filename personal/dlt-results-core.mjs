import{validateTicket}from './v38-core.mjs';
export const HISTORY_URL='https://www.gstc.org.cn/wanfa/dlt_history';
export const LATEST_URL='https://www.gstc.org.cn/wanfa/dlt';
function normalizedText(html){
 if(typeof html!=='string'||html.length>2_000_000)throw Error('官方页面文本非法或过大');
 return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<!--[^]*?-->/g,' ').replace(/<[^>]*>/g,' ')
  .replace(/&nbsp;|&#160;|&ensp;|&emsp;/gi,' ').replace(/&amp;/gi,'&')
  .replace(/\s+/g,' ').trim();
}
function makeDraw(period,date,digits){
 if(!/^\d{5}$/.test(period)||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 const parsed=new Date(date+'T00:00:00Z');if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)return null;
 if(!/^\d{14}$/.test(digits))return null;
 const nums=digits.match(/\d{2}/g).map(Number);
 try{
  const ticket=validateTicket(nums.slice(0,5).join(' '),nums.slice(5).join(' '));
  if(ticket.front.join(',')!==nums.slice(0,5).join(',')||ticket.back.join(',')!==nums.slice(5).join(','))return null;
  if(date.slice(2,4)!==period.slice(0,2))return null;
  return{period,date,front:ticket.front,back:ticket.back};
 }catch{return null}
}
export function parseOfficialHistoryHtml(html){
 const text=normalizedText(html);
 const marker=text.indexOf('超级大乐透历史开奖数据');
 const start=marker>=0?marker:0;
 const end=text.indexOf('当前第',start);
 const body=text.slice(start,end>start?end:Math.min(start+90000,text.length));
 const re=/(\d{4}-\d{2}-\d{2})\s+(\d{5})\s+((?:\d{2}\s*){7})(?!\d)/g;
 const found=[],seen=new Set();
 for(const m of body.matchAll(re)){
  const raw=m[3].replace(/\s/g,'');
  const draw=makeDraw(m[2],m[1],raw);
  if(draw&&!seen.has(draw.period)){seen.add(draw.period);found.push(draw)}
 }
 return found.sort((a,b)=>Number(b.period)-Number(a.period));
}
export function parseOfficialLatestHtml(html){
 const text=normalizedText(html);
 const re=/超级大乐透\s+(\d{5})\s+期\s+开奖日期[:：]\s*(\d{4}-\d{2}-\d{2})[\s\S]{0,220}?开奖号码[:：]\s*((?:\d{1,2}\s+){6}\d{1,2})\b/;
 const match=text.match(re);if(!match)return null;
 const nums=match[3].trim().split(/\s+/).map(Number);
 if(nums.length!==7||nums.some(n=>n<0||n>99))return null;
 return makeDraw(match[1],match[2],nums.map(n=>String(n).padStart(2,'0')).join(''));
}
export function sameDraw(a,b){
 return !!a&&!!b&&a.period===b.period&&a.date===b.date&&a.front.join(',')===b.front.join(',')&&a.back.join(',')===b.back.join(',');
}
export function officialResultResponse(history,latest,checkedAt,maxRecords=25){
 const records=parseOfficialHistoryHtml(history);
 if(!records.length)throw Error('历史开奖页未解析出有效的大乐透期号和7个号码，禁止猜测或沿用缓存');
 const pageLatest=latest?parseOfficialLatestHtml(latest):null;
 const latestHistory=records[0];
 const corroborated=sameDraw(latestHistory,pageLatest);
 return{
  source:HISTORY_URL,secondarySource:LATEST_URL,checkedAt,
  records:records.slice(0,Number.isInteger(maxRecords)&&maxRecords>=1&&maxRecords<=5000?maxRecords:25),
  latestPeriod:latestHistory.period,latestDate:latestHistory.date,
  crossPageAgreement:corroborated,
  secondaryPageParsed:!!pageLatest,
  verifiedByIndependentPublisher:false,
  notice:corroborated?'两处同一官方省级网站页面的最新期号和号码一致；不是两个独立发布机构的交叉认证':'官方两页未取得一致结果；可能存在更新时间差或页面结构变化，不可自动确认'
 };
}
