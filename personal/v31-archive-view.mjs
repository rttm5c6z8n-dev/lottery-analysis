import{valid}from './v31-core.mjs';
export function inspectArchiveResult(result,{snapshots=[],trains=[],reports=[]}={}){
 if(!result||typeof result!=='object')throw Error('结果不存在');
 const snapshot=snapshots.find(x=>x.id===result.snapshotId),train=trains.find(x=>x.id===result.trainId),report=reports.find(x=>x.id===result.reportId);
 const warnings=[];
 if(!snapshot)warnings.push('未找到原始历史快照');
 if(!train)warnings.push('未找到对应训练记录');
 if(!report)warnings.push('未找到对应验证报告');
 if(snapshot&&result.sourceHash&&snapshot.sourceHash!==result.sourceHash)warnings.push('历史数据指纹不一致');
 if(train&&train.snapshotId!==result.snapshotId)warnings.push('训练与选号快照不匹配');
 if(report&&(report.trainId!==result.trainId||report.snapshotId!==result.snapshotId))warnings.push('报告与选号来源不匹配');
 if(!Array.isArray(result.picks)||result.picks.length!==5)warnings.push('存档不是5组号码');
 const picks=[];
 for(const [i,p]of (Array.isArray(result.picks)?result.picks:[]).entries()){
  if(!Array.isArray(p?.nums)||!valid({period:'26001',date:'2026-01-01',nums:p.nums})){warnings.push('第'+(i+1)+'组号码格式无效');continue}
  picks.push({rank:i+1,front:[...p.nums.slice(0,5)].sort((a,b)=>a-b),back:[...p.nums.slice(5)].sort((a,b)=>a-b),score:Number.isFinite(p.score)?p.score:null});
 }
 const complete=result.coverage===1&&result.covered===21425712&&result.total===21425712;
 if(!complete)warnings.push('存档未提供完整21425712组合的覆盖证明');
 return{id:result.id,reportId:result.reportId,trainId:result.trainId,snapshotId:result.snapshotId,throughPeriod:result.throughPeriod,generatedAt:result.generatedAt,picks,complete,sourceConsistent:!warnings.length,warnings,notice:'此处只读展示存档，绝不把它自动绑定到当前报告或正式目标期号；评分不代表中奖概率'};
}
