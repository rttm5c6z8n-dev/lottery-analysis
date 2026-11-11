import{validateImportedRecord}from './v39-core.mjs';
import{verifyTicket,validateTicket}from './v38-core.mjs';
export const VERSION='V4.1-evidence-audit';
export function auditJournal(records){
 if(!Array.isArray(records))throw Error('预测记录必须为数组');
 const seen=new Set(),issues=[],valid=[],stats={total:records.length,formatValid:0,verified:0,unverified:0,modelLinked:0,manual:0,confirmedOfficial:0,prospectiveEligible:0,prospectiveExact:0,prospectiveFrontHits:0,prospectiveBackHits:0,exact:0,frontHits:0,backHits:0};
 for(const [index,r]of records.entries()){
  if(!validateImportedRecord(r)){issues.push({index,reason:'记录格式不合法'});continue}
  const key=r.period+'|'+(r.source?.resultId||'manual')+'|'+(r.source?.rank||0);
  if(seen.has(key)){issues.push({index,reason:'相同来源及期号重复'});continue}seen.add(key);
  stats.formatValid++;
  if(r.source?.type==='v31-result')stats.modelLinked++;else stats.manual++;
  if(!r.verification){stats.unverified++;valid.push({index,period:r.period,status:'待核验',source:r.source?.type||'手工'});continue}
  try{
   const d=r.verification.draw;
   const draw=validateTicket(d.front.join(' '),d.back.join(' '));
   const actual=verifyTicket(r.ticket,draw),claimed=r.verification.result;
   if(!claimed||actual.frontHits!==claimed.frontHits||actual.backHits!==claimed.backHits||actual.exact!==claimed.exact){issues.push({index,reason:'保存的命中数与号码重算不一致'});continue}
   const saved=Date.parse(r.createdAt),checked=Date.parse(r.verification.verifiedAt),generated=r.source?.generatedAt?Date.parse(r.source.generatedAt):null;
   if(!Number.isFinite(saved)||!Number.isFinite(checked)||checked<saved||(generated!==null&&(!Number.isFinite(generated)||generated>saved))){issues.push({index,reason:'记录时间顺序异常'});continue}
   stats.verified++;stats.frontHits+=actual.frontHits;stats.backHits+=actual.backHits;if(actual.exact)stats.exact++;
   if(r.verification.officiallyVerified===true)stats.confirmedOfficial++;
   const planned=r.targetEvidence?.plannedDrawAt?Date.parse(r.targetEvidence.plannedDrawAt):NaN;
   const prospectiveEligible=r.source?.type==='v31-result'&&Number.isFinite(planned)&&saved<planned&&generated!==null&&Number.isFinite(generated)&&generated<=saved&&typeof r.targetEvidence?.sourceUrl==='string'&&r.targetEvidence.sourceUrl.startsWith('https://');
   if(prospectiveEligible){stats.prospectiveEligible++;stats.prospectiveFrontHits+=actual.frontHits;stats.prospectiveBackHits+=actual.backHits;if(actual.exact)stats.prospectiveExact++;}
   valid.push({index,period:r.period,status:'核验完成（未独立确认官方来源）',source:r.source?.type||'手工',frontHits:actual.frontHits,backHits:actual.backHits,prospectiveEligible});
  }catch(e){issues.push({index,reason:'核验数据异常：'+e.message})}
 }
 return{version:VERSION,stats,issues,valid,baselines:{frontPerTicket:5*5/35,backPerTicket:2*2/12,exactPerTicket:1/21425712},limitations:['本机时间戳可以修改，不能独立证明开奖前保存','实际开奖号码目前由用户输入，未建立自动官方数据校验','未完成核验或数据不一致的记录不计入命中成绩','事前候选记录只做本机时间和官方计划字段的结构检查，不代表有第三方时间证明','均匀选号数学期望不是提高中奖概率的证据']};
}
