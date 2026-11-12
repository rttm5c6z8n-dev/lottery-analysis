// Classify the current official-history observation without modifying predictions.
// "Observed" is not independently notarized prospective performance.
export function summarizeObservations(report,nowIso){
 if(!report||!Array.isArray(report.rows))throw Error('缺少连续观察报告');
 const now=Date.parse(nowIso);
 if(!Number.isFinite(now))throw Error('当前时间无效');
 const groups={pending:[],doublePage:[],historyOnly:[],rejected:[],notInPage:[]};
 let observedTickets=0,observedPeriods=0,totalFront=0,totalBack=0,exactTickets=0;
 const historyLimit=Number(report.latestOfficialPeriod);
 for(const row of report.rows){
  const target=row.period;
  const entries=row.modelScores||[];
  const valid=entries.filter(x=>x.score&&Number.isInteger(x.score.frontHits)&&Number.isInteger(x.score.backHits));
  if(row.eligibleTickets===0){
   groups.rejected.push(target);
   continue;
  }
  if(!row.officialDraw){
   if(Number.isFinite(historyLimit)&&Number(target)<=historyLimit)groups.notInPage.push(target);
   else groups.pending.push(target);
   continue;
  }
  const category=row.sourceCorroborated?'doublePage':'historyOnly';
  groups[category].push(target);
  if(!valid.length)continue;
  observedPeriods++;
  observedTickets+=valid.length;
  for(const x of valid){totalFront+=x.score.frontHits;totalBack+=x.score.backHits;if(x.score.exact)exactTickets++}
 }
 return{
  groups,
  periods:report.periods,
  pendingPeriods:groups.pending.length,
  doublePagePeriods:groups.doublePage.length,
  historyOnlyPeriods:groups.historyOnly.length,
  rejectedPeriods:groups.rejected.length,
  missingHistoryPeriods:groups.notInPage.length,
  observedPeriods,observedTickets,totalFront,totalBack,exactTickets,
  meanFront:observedTickets?totalFront/observedTickets:null,
  meanBack:observedTickets?totalBack/observedTickets:null,
  baselineMeanFront:5*5/35,baselineMeanBack:2*2/12,
  limitations:'只读观察统计；往期开奖可能只有官网历史页单一来源。不能把这些结果作为第三方时间公证，也不能把5注当成5次独立期开奖。若开奖已发生但历史列表缺该期，明确显示未覆盖而非待开奖。'
 };
}
