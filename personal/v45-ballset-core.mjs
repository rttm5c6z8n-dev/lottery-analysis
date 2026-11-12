import{validateTicket}from './v38-core.mjs';
function plain(html){
 if(typeof html!=='string'||html.length>2000000)throw Error('体彩公告文本异常或过大');
 return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;|&ensp;|&emsp;/gi,' ').replace(/\s+/g,' ').trim();
}
function numbersBetween(text,start,next){
 const a=text.indexOf(start);if(a<0)throw Error('官方公告缺少'+start);
 const b=text.indexOf(next,a+start.length);if(b<0)throw Error('官方公告缺少'+next);
 const excerpt=text.slice(a+start.length,b);
 if(excerpt.length>400)throw Error('号码表行结构不符');
 const matches=excerpt.match(/(?:^|\D)(\d{2})(?=\D|$)/g)||[];
 const nums=matches.map(x=>Number(x.match(/\d{2}/)[0]));
 if(nums.length!==7)throw Error('官方公告的'+start+'必须恰好包含7个号码');
 return{front:nums.slice(0,5),back:nums.slice(5)};
}
function sorted(x){return[...x].sort((a,b)=>a-b)}
export function parseMachineBulletin(html,requestedPeriod,source){
 const text=plain(html);
 const header=text.match(/第\s*(\d{5})\s*期开奖(?:结果)?公告/);
 if(!header||header[1]!==requestedPeriod)throw Error('官方公告期号与请求不一致');
 const set=text.match(/本期使用第\s*([123])\s*套摇奖球/);
 if(!set)throw Error('公告未披露正式球组编号');
 const order=numbersBetween(text,'本期出球顺序：','本期开奖号码：');
 const a=text.indexOf('本期开奖号码：'),b=text.indexOf('本期中奖情况',a);
 if(a<0||b<0)throw Error('缺少开奖号码段落');
 const official=numbersBetween(text.slice(a,b)+' 本期中奖情况','本期开奖号码：','本期中奖情况');
 const canonical=validateTicket(official.front.join(' '),official.back.join(' '));
 if(canonical.front.join(',')!==official.front.join(',')||canonical.back.join(',')!==official.back.join(','))throw Error('官方开奖号码排序异常');
 const drawn=validateTicket(order.front.join(' '),order.back.join(' '));
 if(drawn.front.join(',')!==canonical.front.join(',')||drawn.back.join(',')!==canonical.back.join(','))throw Error('出球顺序与官方开奖号码不一致');
 const rawDate=text.match(/开奖日期[:：]\s*(\d{4})[年-](\d{1,2})[月-](\d{1,2})日?/);
 const date=rawDate?[rawDate[1],rawDate[2].padStart(2,'0'),rawDate[3].padStart(2,'0')].join('-'):null;
 if(!date)throw Error('官方公告缺少可识别日期');
 if(date.slice(2,4)!==requestedPeriod.slice(0,2))throw Error('公告年份与期号不符');
 return{period:requestedPeriod,date,ballSet:Number(set[1]),drawOrder:order,numbers:canonical,
  source,confidence:'同一省级体彩机构开奖公告；球组及出球顺序仅在该期开奖后公开'};
}
export function summarizeBallSetMetadata(records){
 const groups=new Map(),seen=new Set();
 for(const item of records||[]){
  if(!item||!/^\d{5}$/.test(item.period||'')||![1,2,3].includes(item.ballSet)||seen.has(item.period))continue;
  seen.add(item.period);
  const id=item.ballSet;if(!groups.has(id))groups.set(id,[]);
  groups.get(id).push(item);
 }
 return[1,2,3].map(set=>({ballSet:set,issues:groups.get(set)?.length||0,
  enoughForExploratoryFrequency:(groups.get(set)?.length||0)>=100}));
}
