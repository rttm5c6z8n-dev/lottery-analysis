import{valid}from './v31-core.mjs';
export const SERIAL_VERSION='V4.5-pairwise-overlap-v1';
const THRESHOLD_TWO_TESTS=2.241402727604947; // normal two-sided 0.05/2 Bonferroni.
function countOverlap(a,b){
 const set=new Set(b);return a.filter(x=>set.has(x)).length;
}
export function serialOverlapAudit(input){
 if(!Array.isArray(input)||input.length<300||input.some(r=>!valid(r)))throw Error('相邻开奖检验至少需要300期有效记录');
 const rows=[...input].sort((a,b)=>String(a.period).localeCompare(String(b.period)));
 if(new Set(rows.map(r=>r.period)).size!==rows.length)throw Error('相邻开奖检验期号重复，停止');
 let pairs=0,skipped=0,totalFront=0,totalBack=0;
 // Disjoint pairs reduce dependencies from reusing the same lottery draw twice.
 for(let i=0;i+1<rows.length;i+=2){
  const a=rows[i],b=rows[i+1];
  const sameYear=a.period.slice(0,2)===b.period.slice(0,2);
  if(!sameYear||Number(b.period)-Number(a.period)!==1){skipped++;continue}
  totalFront+=countOverlap(a.nums.slice(0,5),b.nums.slice(0,5));
  totalBack+=countOverlap(a.nums.slice(5),b.nums.slice(5));
  pairs++;
 }
 if(pairs<100)throw Error('连续相邻且互不重叠的开奖样本少于100对');
 const zones=[{name:'前区',hits:totalFront,k:5,pool:35},{name:'后区',hits:totalBack,k:2,pool:12}].map(x=>{
  const expected=x.k*x.k/x.pool;
  const variance=x.k*(x.k/x.pool)*(1-x.k/x.pool)*(x.pool-x.k)/(x.pool-1);
  const mean=x.hits/pairs,z=(mean-expected)/Math.sqrt(variance/pairs);
  return{zone:x.name,pairs,observedMean:mean,expectedMean:expected,zScore:z,
   passesCorrectedThreshold:Math.abs(z)>THRESHOLD_TWO_TESTS,
   correction:'两项检验Bonferroni, 双侧家族α=0.05, 近似正态Z'};
 });
 return{version:SERIAL_VERSION,pairs,skippedPairs:skipped,throughPeriod:rows.at(-1).period,zones,
  significant:zones.filter(x=>x.passesCorrectedThreshold),
  note:'只分析两个连续且互不重叠的期次对，避免同期开奖被反复作为两个相邻样本。理论均值和方差来自公平无放回的超几何分布。Z值是近似检验，异常重复仅表示应复核数据/设备记录，不能直接证明人为控制或未来开奖号码可预测；与94项频率检验属于另一探索性检验家族。'};
}
