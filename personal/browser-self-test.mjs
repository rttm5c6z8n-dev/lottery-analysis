import{buildRecord,parseDraw,verifyRecord,validateTicket}from './v38-core.mjs';
import{makeBackup,mergeBackup}from './v38-backup.mjs';
import{summarize}from './v39-core.mjs';
import{chooseResult,bridgeRecord}from './v40-core.mjs';
import{auditJournal}from './v41-core.mjs';
import{prepareEvidence,applyEvidence}from './v42-core.mjs';
import{inspectPredictionText}from './storage-health.mjs';
function assert(ok,msg){if(!ok)throw Error(msg)}
function expectThrow(fn,msg){let thrown=false;try{fn()}catch{thrown=true}assert(thrown,msg)}
export function runSelfTests(){
 const cases=[];
 function test(name,fn){try{fn();cases.push({name,ok:true})}catch(e){cases.push({name,ok:false,detail:e.message})}}
 const when='2026-11-11T00:00:00Z';
 test('V3.8号码校验',()=>{assert(validateTicket('5 1 2 3 4','7 6').front.join(',')==='1,2,3,4,5','排序错误');expectThrow(()=>validateTicket('1 1 2 3 4','6 7'),'重复号码未阻止')});
 test('V3.8开奖核验',()=>{const r=buildRecord({period:'26135',front:'1 2 3 4 5',back:'6 7',method:'自测',createdAt:when});const v=verifyRecord(r,parseDraw('1 2 3 4 5 6 7'),'2026-11-12T00:00:00Z');assert(v.verification.result.exact,'未判定完整命中');expectThrow(()=>verifyRecord(v,v.ticket,'x'),'覆盖核验未阻止')});
 test('V3.8备份合并不覆盖',()=>{const r=buildRecord({period:'26135',front:'1 2 3 4 5',back:'6 7',method:'自测',createdAt:when});const b=buildRecord({period:'26136',front:'2 3 4 5 6',back:'7 8',method:'自测',createdAt:when});const result=mergeBackup([r],makeBackup([r,b],when));assert(result.added===1&&result.skipped===1&&result.records[0]===r,'合并结果错误')});
 test('V3.9成绩基础计算',()=>{const r={period:'26135',ticket:{front:[1,2,3,4,5],back:[6,7]},verification:{result:{frontHits:5,backHits:2}}};assert(summarize([r]).exact===1,'统计错误')});
 const model={id:'selftest',generatedAt:'2026-11-10T01:00:00Z',picks:[{nums:[1,2,3,4,5,6,7]}],throughPeriod:'26120',version:'自测'};
 const source='https://www.sport.gov.cn/selftest';
 let record;
 test('V4.0模型结果读取及锁定条件',()=>{const selected=chooseResult([model],'selftest',0);record=bridgeRecord({result:selected,period:'26135',now:when,drawAt:'2026-11-14T20:30:00+08:00',sourceUrl:source});assert(record.source.resultId==='selftest','来源信息缺失');expectThrow(()=>bridgeRecord({result:selected,period:'26135',now:when,drawAt:'2026-11-10T20:30:00+08:00',sourceUrl:source}),'过期计划未阻止')});
 test('V4.2公告辅助匹配',()=>{assert(record,'上一项测试未通过');const evidence=prepareEvidence({period:'26135',numbers:'1 2 3 4 5 6 7',url:source,title:'模拟数据（非真实开奖）',observedAt:'2026-11-15T00:00:00Z'});const verified=applyEvidence([record],evidence);assert(verified.matched===1&&verified.records[0].verification.result.exact,'核验失败');assert(verified.records[0].verification.officiallyVerified===false,'错误宣称官方认证');record=verified.records[0]});
 test('V4.1全流程审计',()=>{assert(record?.verification,'上一项测试未通过');const audit=auditJournal([record]);assert(audit.stats.prospectiveEligible===1&&audit.stats.prospectiveExact===1,'事前候选成绩未识别');assert(audit.stats.confirmedOfficial===0,'人工数据误标官方认证');const manual={...record,period:'26136',source:undefined,targetEvidence:undefined};assert(auditJournal([record,manual]).stats.prospectiveEligible===1,'手工记录混入事前成绩')});
 test('本机预测存储格式检查',()=>{assert(inspectPredictionText(null).state==='empty','空存储检查失败');assert(inspectPredictionText('{bad').state==='error','损坏数据检查失败')});
 return{passed:cases.filter(x=>x.ok).length,total:cases.length,cases,ranAt:new Date().toISOString(),notice:'全部使用临时模拟数据；不会读取或修改本机历史数据库、预测留档或真实开奖结果。'};
}
