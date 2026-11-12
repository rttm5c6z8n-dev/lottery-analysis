// Pre-registered conditional exit-order contrast.
// Under an exchangeable physical draw, conditional on the five selected
// numbers, any one of those numbers is equally likely to exit first.
// The same applies independently to the two back-zone balls.
export function exitOrderByBallSet(records){
 const results=[];
 for(const ballSet of [1,2,3])for(const zone of ['front','back']){
  let count=0,sum=0,variance=0,skipped=0;
  for(const r of records||[]){
   if(r?.ballSet!==ballSet)continue;
   const observed=r.numbers?.[zone],order=r.drawOrder?.[zone];
   const countRequired=zone==='front'?5:2;
   if(!Array.isArray(observed)||!Array.isArray(order)||observed.length!==countRequired||order.length!==countRequired||
    [...observed].sort((a,b)=>a-b).join(',')!==[...order].sort((a,b)=>a-b).join(',')||
    !observed.every(Number.isInteger)||!order.every(Number.isInteger)){skipped++;continue}
   const m=observed.reduce((a,b)=>a+b,0)/countRequired;
   const v=observed.reduce((s,n)=>s+(n-m)**2,0)/countRequired;
   sum+=order[0]-m;
   variance+=v;
   count++;
  }
  const z=variance>0?sum/Math.sqrt(variance):null;
  const enough=count>=100;
  results.push({ballSet,zone,issues:count,skipped,firstMinusSelectedMean:count?sum/count:null,
   zScore:z,eligibleForExploratoryTest:enough,
   crossesApproxBonferroniThreshold:enough&&z!==null&&Math.abs(z)>2.64,
   note:enough?'对每期已摇出的球组条件化比较第一个出球与当期号码均值；Z近似、仅探索，设备历史变化和相关性仍须控制':'样本不足100期，不给出统计异常判定'});
 }
 return{results,tests:6,thresholdAbsZ:2.64,
  caveat:'本检验关注首个出球的条件偏差，需每期真实出球顺序及球组编号。3套球×前后区共6次探索比较，阈值约为Bonferroni两侧5%显著性水平。偏差不是提前知道下一期使用的球组，也不等于能预测一等奖二等奖。'};
}
