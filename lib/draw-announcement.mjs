import {parseAnnouncement} from './five-issue.mjs';
export function parseDrawAnnouncement(html,period){const modern=parseAnnouncement(html,period);if(modern.fieldsExtracted)return modern;
 // Legacy Word-generated originals use a numeric h1 and explicitly labelled main-game paragraphs.
 const body=modern.originalContent||'',specific=new RegExp('第\\s*'+period+'\\s*期主玩法开奖公告'),date=body.match(new RegExp('第\\s*'+period+'\\s*期于\\s*(\\d{4})年(\\d{1,2})月(\\d{1,2})日开奖')),numbers=body.match(/开奖结果[:：]\s*((?:\d{1,2}\s*\+\s*){4}\d{1,2})\s+(\d{1,2}\s*\+\s*\d{1,2})/);
 if(modern.title!==period||!body.includes('超级大乐透')||!specific.test(body)||!date||!numbers)return modern;
 const drawDate=date[1]+'-'+date[2].padStart(2,'0')+'-'+date[3].padStart(2,'0'),front=numbers[1].split('+').map(Number),back=numbers[2].split('+').map(Number);if(!Number.isFinite(Date.parse(drawDate+'T00:00:00Z'))||new Date(drawDate+'T00:00:00Z').toISOString().slice(0,10)!==drawDate||front.some(n=>n<1||n>35)||back.some(n=>n<1||n>12)||new Set(front).size!==5||new Set(back).size!==2)return modern;
 return {...modern,observedPeriod:period,drawDate,nums:[...front,...back],fieldsExtracted:true,publishedAt:html.match(/发布时间[:：]\s*(\d{4}-\d{2}-\d{2})/)?.[1]||null,reason:'已从旧版官方主玩法原公告明确段落提取开奖日期及开奖结果，待人工确认'};
}
