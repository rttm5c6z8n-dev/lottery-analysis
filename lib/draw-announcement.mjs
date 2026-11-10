import {parseAnnouncement} from './five-issue.mjs';
export function parseDrawAnnouncement(html,period){const modern=parseAnnouncement(html,period);const bodyPeriod=(modern.originalContent||'').match(/第\s*(\d{5})\s*期主玩法开奖公告/)?.[1];if(bodyPeriod&&bodyPeriod!==period)return {...modern,fieldsExtracted:false,nums:null,drawDate:null,observedPeriod:bodyPeriod,issue:'PERIOD_MISMATCH',reason:'原公告正文主玩法期号与请求不匹配'};if(modern.fieldsExtracted)return {...modern,issue:null};
 if(modern.observedPeriod===period)return {...modern,issue:!modern.drawDate?'DATE_MISSING':!modern.nums?'NUMBERS_MISSING':'FORMAT_CHANGED'};
 const body=modern.originalContent||'',specific=new RegExp('第\\s*'+period+'\\s*期主玩法开奖公告'),observed=modern.observedPeriod||(/^\d{5}$/.test(modern.title||'')?modern.title:null),identity=modern.title===period&&body.includes('超级大乐透')&&specific.test(body);
 if(!identity)return {...modern,observedPeriod:observed,issue:observed&&observed!==period?'PERIOD_MISMATCH':modern.title?.includes(period)?'FORMAT_CHANGED':'TITLE_UNRECOGNIZED',reason:observed&&observed!==period?'原公告实际期号与请求期号不匹配':'原公告身份或格式无法可靠识别，待人工核实'};
 // Both identity checks above remain mandatory. The optional 日 accepts the actual literal 年/月/日-number开奖 wording, never the publication date.
 const date=body.match(new RegExp('第\\s*'+period+'\\s*期于\\s*(\\d{4})年(\\d{1,2})月(\\d{1,2})(?:日)?开奖')),numbers=body.match(/开奖结果[:：]\s*((?:\d{1,2}\s*\+\s*){4}\d{1,2})\s+(\d{1,2}\s*\+\s*\d{1,2})/),base={...modern,observedPeriod:period};
 if(!date)return {...base,issue:'DATE_MISSING',reason:'原公告期号已匹配，但正文开奖日期无法提取；不使用发布日期补填'};
 if(!numbers)return {...base,issue:'NUMBERS_MISSING',reason:'原公告期号已匹配，但主玩法开奖结果不完整'};
 const drawDate=date[1]+'-'+date[2].padStart(2,'0')+'-'+date[3].padStart(2,'0'),front=numbers[1].split('+').map(Number),back=numbers[2].split('+').map(Number);if(!Number.isFinite(Date.parse(drawDate+'T00:00:00Z'))||new Date(drawDate+'T00:00:00Z').toISOString().slice(0,10)!==drawDate||front.some(n=>n<1||n>35)||back.some(n=>n<1||n>12)||new Set(front).size!==5||new Set(back).size!==2)return {...base,issue:'INVALID_FIELDS',reason:'原文日期或号码格式无效，待人工核实'};
 return {...base,issue:null,drawDate,nums:[...front,...back],fieldsExtracted:true,publishedAt:html.match(/发布时间[:：]\s*(\d{4}-\d{2}-\d{2})/)?.[1]||null,reason:'旧版原公告标题、主玩法期号及正文日期/开奖结果均匹配，待人工确认'};
}
