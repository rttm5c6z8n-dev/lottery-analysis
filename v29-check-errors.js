'use strict';
const V29CheckErrors=(()=>{
 function classify(e){const issue=e?.issue||'',reason=e?.reason||'',attempts=e?.attempts||[];if(issue==='PERIOD_MISMATCH'||e?.observedPeriod&&e.observedPeriod!==e.period)return {kind:'PERIOD_MISMATCH',blocked:true,retryable:false};if(issue==='ACCESS_RESTRICTED'||attempts.some(a=>[403,429,567].includes(a.status)))return {kind:'ACCESS_RESTRICTED',blocked:true,retryable:false};if(['NETWORK_ERROR','TIMEOUT','HTTP_ERROR'].includes(issue))return {kind:issue,blocked:true,retryable:issue!=='HTTP_ERROR'||attempts.some(a=>a.status>=500&&a.status!==567)};if(issue==='ANNOUNCEMENT_NOT_FOUND')return {kind:issue,blocked:false,retryable:false};if(['FORMAT_CHANGED','TITLE_UNRECOGNIZED'].includes(issue)||/标题与期号未匹配|结构变化|访问验证/.test(reason))return {kind:issue||'LEGACY_TITLE_ERROR',blocked:true,retryable:false};return {kind:issue||(!e?.fieldsExtracted?'INSUFFICIENT':'NONE'),blocked:false,retryable:false}}
 return {classify};
})();
