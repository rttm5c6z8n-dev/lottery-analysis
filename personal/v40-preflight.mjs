import{validatePeriod,validateTicket}from './v38-core.mjs';
export function latestLocalHistory(raw){
 if(raw===null)return{latest:null,count:0,state:'missing',note:'当前浏览器未找到原始历史缓存，不能据此判定数据丢失'};
 let rows;
 try{rows=JSON.parse(raw)}catch{return{latest:null,count:0,state:'invalid',note:'原始历史缓存损坏或无法解析，无法排除已开奖期号'}};
 if(!Array.isArray(rows))return{latest:null,count:0,state:'invalid',note:'原始历史缓存不是数组'};
 let max=null,valid=0;
 for(const r of rows){const p=String(r?.period||'');if(/^\d{5}$/.test(p)&&Array.isArray(r?.nums)&&r.nums.length===7){
  try{validateTicket(r.nums.slice(0,5).join(' '),r.nums.slice(5).join(' '));valid++;if(max===null||Number(p)>Number(max))max=p}catch{}
 }}
 return{latest:max,count:valid,state:'ok',note:'本机历史缓存期号不能代替实时官方开奖结果'};
}
export function describeFivePicks(result){
 if(!Array.isArray(result?.picks)||result.picks.length!==5)return null;
 const picks=result.picks.map(p=>p.nums);
 if(picks.some(n=>!Array.isArray(n)||n.length!==7))return null;
 const backs=new Set(picks.map(n=>[...n.slice(5)].sort((a,b)=>a-b).join(',')));
 const fronts=picks.map(n=>new Set(n.slice(0,5))),union=new Set(fronts.flatMap(s=>[...s]));
 const intersections=[];
 for(let i=0;i<fronts.length;i++)for(let j=i+1;j<fronts.length;j++)intersections.push([...fronts[i]].filter(n=>fronts[j].has(n)).length);
 return{tickets:5,uniqueFrontNumbers:union.size,distinctBackPairs:backs.size,meanPairwiseFrontOverlap:intersections.reduce((a,b)=>a+b,0)/intersections.length,warning:'5注同期开奖结果相关，特别是后区相同时，不能按5次独立开奖估计统计显著性；模型评分不等于中奖概率'};
}
export function preflightTarget({result,period,drawAt,now,history}){
 const errors=[],warnings=[];
 if(!result)return{ok:false,errors:['没有选中的完整模型存档'],warnings};
 let target;try{target=validatePeriod(period)}catch{errors.push('请填5位官方目标期号')}
 const through=String(result.throughPeriod||'');
 if(!/^\d{5}$/.test(through))errors.push('模型历史截止期号无效');
 else if(target&&Number(target)<=Number(through))errors.push('目标期号不得早于或等于模型历史截止 '+through);
 const nowMs=Date.parse(now),drawMs=Date.parse(drawAt);
 if(!Number.isFinite(nowMs))errors.push('当前设备时间无效');
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/.test(drawAt||'')||!Number.isFinite(drawMs))errors.push('请输入包含时区的官方计划开奖时间');
 else if(Number.isFinite(nowMs)&&drawMs<=nowMs)errors.push('计划开奖时间已过，不能补记为事前预测');
 if(history?.state==='invalid')errors.push('本机原始历史缓存无法核验，请先核实，不要覆盖数据');
 if(history?.latest&&target&&Number(target)<=Number(history.latest))errors.push('目标期号 '+target+' 已包含在当前浏览器的历史缓存中，禁止补记');
 if(history?.latest&&/^\d{5}$/.test(through)&&Number(history.latest)>Number(through))warnings.push('本机历史最新为 '+history.latest+'，模型仅截至 '+through+'，这是旧模型预测，不是最新训练');
 if(history?.state==='missing')warnings.push('当前浏览器无原始历史缓存，无法交叉核对目标期号');
 warnings.push('官方期号、实际开奖时间与开奖结果仍须独立确认；本机时间不具第三方公证效力');
 return{ok:errors.length===0,errors,warnings,modelThrough:through,latestLocalHistory:history?.latest||null};
}
