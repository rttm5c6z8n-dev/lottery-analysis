import{VERSION,TOTAL_FRONT,TOTAL,checkConfig,materialize,compare}from './v31-core.mjs';
import{V50_SEARCH_VERSION,POOL_SIZE,candidateBatch,selectCoverage}from './v50-search-core.mjs';
export function verifyBatch({input,output}){
 if(output?.version!==VERSION||output?.searchVersion!==V50_SEARCH_VERSION)throw Error('搜索版本不一致');
 const start=input.startFront,end=Math.min(TOTAL_FRONT,start+256);
 if(output.startFront!==start||output.endFront!==end||output.total!==TOTAL||output.totalCovered!==end*66||output.processedCombinations!==(end-start)*66||output.completed!==(end===TOTAL_FRONT)||output.poolSize!==POOL_SIZE)throw Error('游标或覆盖声明错误');
 if(!Array.isArray(output.candidates)||output.candidates.length!==POOL_SIZE)throw Error('候选数量不是100');
 const keys=new Set();
 for(let i=0;i<output.candidates.length;i++){
  const p=output.candidates[i],key=p.nums?.join(',');
  if(!key||keys.has(key))throw Error('候选重复或无效');
  keys.add(key);
  if(i&&compare(output.candidates[i-1],p)>0)throw Error('候选排序异常');
  const actual=materialize(p.nums.slice(0,5),p.nums.slice(5),input.config.prepared,input.config.weights);
  if(!Number.isFinite(p.score)||Math.abs(actual.score-p.score)>1e-8)throw Error('候选评分不一致');
 }
 return true;
}
export function selectWithFixedLambda(pool,lambda){
 if(!Number.isFinite(lambda)||lambda<0)throw Error('惩罚参数未固定');
 const chosen=selectCoverage(pool,lambda);
 if(chosen.length!==5||new Set(chosen.map(p=>p.nums.join(','))).size!==5)throw Error('B轨组合重复');
 return chosen;
}
