import{validateTicket,verifyTicket}from './v38-core.mjs';
export function buildProspectiveMonitor(journal,official){
 if(!Array.isArray(journal))throw Error('本机预测留档不是数组，已停止只读分析');
 if(!official||!Array.isArray(official.records))throw Error('官网接口未返回开奖列表');
 const current=String(official.latestPeriod||''),latest=official.records[0];
 const latestTrusted=official.crossPageAgreement===true&&latest?.period===current;
 const byPeriod=new Map();
 for(const item of official.records){
  if(!item||!/^\d{5}$/.test(String(item.period||'')))continue;
  if(byPeriod.has(item.period))continue;
  try{
   const d=validateTicket(item.front.join(' '),item.back.join(' '));
   if(d.front.join(',')!==item.front.join(',')||d.back.join(',')!==item.back.join(','))continue;
   byPeriod.set(item.period,{date:item.date,front:d.front,back:d.back});
  }catch{}
 }
 const groups=new Map();let unsafe=0;
 for(const item of journal){
  const period=String(item?.period||'');
  if(!/^\d{5}$/.test(period)){unsafe++;continue}
  if(!groups.has(period))groups.set(period,[]);
  groups.get(period).push(item);
 }
 const rows=[...groups].map(([period,items])=>{
  const draw=byPeriod.get(period);
  const consistentSource=period===current&&latestTrusted;
  const scored=[];
  let rejected=0;
  for(const record of items){
   try{
    if(!record?.ticket)throw Error('选号记录缺少组合');
    const t=validateTicket(record.ticket.front.join(' '),record.ticket.back.join(' '));
    const saved=Date.parse(record.createdAt);
    const planned=Date.parse(record.targetEvidence?.plannedDrawAt||'');
    const generated=Date.parse(record.source?.generatedAt||'');
    if(record.source?.type!=='v31-result'||!Number.isFinite(saved)||!Number.isFinite(planned)||!Number.isFinite(generated)||generated>saved||saved>=planned||!record.targetEvidence?.sourceUrl?.startsWith('https://'))throw Error('不是结构一致的事前模型候选');
    if(Number(period)<=Number(record.source.throughPeriod||0))throw Error('目标期号不晚于模型历史截止');
    if(record.verification?.draw){
     const checked=validateTicket(record.verification.draw.front.join(' '),record.verification.draw.back.join(' '));
     const result=verifyTicket(t,checked);
     const claimed=record.verification.result;
     if(!claimed||claimed.frontHits!==result.frontHits||claimed.backHits!==result.backHits||claimed.exact!==result.exact)throw Error('既有核验得分不一致');
     if(draw&&(checked.front.join(',')!==draw.front.join(',')||checked.back.join(',')!==draw.back.join(',')))throw Error('本机核验号码与官网历史数据冲突');
    }
    scored.push({rank:record.source.rank||null,ticket:t,score:draw?verifyTicket(t,draw):null,alreadyVerified:!!record.verification});
   }catch{rejected++}
  }
  const status=!draw?'官网当前列表尚无该期':!consistentSource?'官网历史页单一来源，尚未双页面确认':!scored.length?'预测记录未通过事前结构检查':'最新期同站双页面一致，当前为只读对照';
  return{period,drawDate:draw?.date||null,sourceStatus:status,sourceCorroborated:consistentSource,storedTickets:items.length,eligibleTickets:scored.length,rejectedTickets:rejected,
    modelScores:scored,officialDraw:draw||null,verifiedLocally:scored.filter(x=>x.alreadyVerified).length,
    bestFront:draw&&scored.length?Math.max(...scored.map(x=>x.score.frontHits)):null,
    exactTickets:draw?scored.filter(x=>x.score?.exact).length:null};
 }).sort((a,b)=>b.period.localeCompare(a.period));
 return{rows,periods:rows.length,storedTickets:journal.length,unsafeRecords:unsafe,periodsWithOfficialData:rows.filter(x=>x.officialDraw).length,
  latestOfficialPeriod:current||null,latestCrossPageAgreement:latestTrusted,
  notes:'只读预测监测。官网历史期号可能只有单页来源；仅最新期在两处同一官网页面一致时有双页面校验。所有比分均为观察计算，不会自动写入正式成绩或证明事前可信时间。'};
}
