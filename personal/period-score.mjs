import{auditJournal}from './v41-core.mjs';
export function scoreByDraw(records){
 const audit=auditJournal(records),groups=new Map();
 for(const item of audit.valid){
  if(!item.prospectiveEligible||!item.status.startsWith('核验完成'))continue;
  if(!groups.has(item.period))groups.set(item.period,[]);
  groups.get(item.period).push(item);
 }
 const draws=[...groups].map(([period,items])=>{
  const exact=items.filter(x=>x.frontHits===5&&x.backHits===2).length;
  const sorted=[...items].sort((a,b)=>b.frontHits-a.frontHits||b.backHits-a.backHits);
  return{period,tickets:items.length,bestFront:sorted[0].frontHits,bestBack:sorted[0].backHits,
   exactHits:exact,anyExact:exact>0,frontHits:items.reduce((a,x)=>a+x.frontHits,0),
   backHits:items.reduce((a,x)=>a+x.backHits,0)};
 }).sort((a,b)=>a.period.localeCompare(b.period));
 const tickets=draws.reduce((n,x)=>n+x.tickets,0);
 const exactTickets=draws.reduce((n,x)=>n+x.exactHits,0);
 return{draws,periods:draws.length,tickets,exactTickets,drawsWithJackpot:draws.filter(x=>x.anyExact).length,
  baselineExpectedExact:tickets/21425712,
  notes:'仅基于本机人工输入开奖并通过内部一致性校验的事前候选记录；同一期5注属于1期开奖，不代表5个独立期次。理论期望不等于预测优势，也不是官方核实。',issues:audit.issues};
}
