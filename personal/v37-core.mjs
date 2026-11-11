import {auditPeriods} from './v33-core.mjs';
export const VERSION='V3.7-equipment-timeline';
export const EVIDENCE=[
{id:'e2007',date:'2007-05-10',title:'维纳斯3代亮相的公开报道',type:'报道日期',verifiedCutoff:false,url:'https://www.sport.gov.cn/n20001280/n20745751/n20767297/c21164292/content.html',note:'报道事件日期不等于每期实际设备记录'},
{id:'e2019',date:'2019',title:'新一代维纳斯更换报道',type:'年份线索',verifiedCutoff:false,url:'https://www.sport.gov.cn/n20001280/n20745751/n20767297/c21145013/content.html',note:'尚未核实正式启用的准确日期和期号'},
{id:'unknown',date:'未知',title:'球组、机具编号与维护记录',type:'待补证据',verifiedCutoff:false,url:'https://www.akanis.tech/',note:'厂家通用产品资料不能证明国内每期实际配置'}
];
function makeRng(seed){let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296)}
function counts(rows,zone){const n=zone?12:35,k=zone?2:5,off=zone?5:0,c=Array(n).fill(0);for(const r of rows)for(const x of r.nums.slice(off,off+k))c[x-1]++;return c}
function distance(a,b,zone){const ca=counts(a,zone),cb=counts(b,zone),na=a.length,nb=b.length,k=zone?2:5;let s=0;for(let i=0;i<ca.length;i++){const p=ca[i]/(na*k),q=cb[i]/(nb*k);s+=(p-q)**2}return s}
export function compareAtDate(rows,date,{zone=0,iterations=1000,seed=20261111}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z')))throw Error('需要合法的YYYY-MM-DD日期');
 if(![0,1].includes(zone))throw Error('区域无效');
 if(!Number.isInteger(iterations)||iterations<100||iterations>10000)throw Error('模拟次数应为100至10000');
 const audit=auditPeriods(rows);if(audit.issues.length)throw Error('存在无效或重复记录，须先处理');
 const all=audit.years.flatMap(y=>y.rows),left=all.filter(r=>r.date<date),right=all.filter(r=>r.date>=date);
 if(left.length<30||right.length<30)throw Error('分界日期两侧各需至少30期');
 const observed=distance(left,right,zone),rng=makeRng(seed),n=all.length,idx=Array.from({length:n},(_,i)=>i);let extreme=0;
 for(let t=0;t<iterations;t++){for(let i=n-1;i>0;i--){const j=Math.floor(rng()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]]}const a=idx.slice(0,left.length).map(i=>all[i]),b=idx.slice(left.length).map(i=>all[i]);if(distance(a,b,zone)>=observed-1e-14)extreme++}
 return{version:VERSION,cutoff:date,zone:zone?'后区':'前区',before:left.length,after:right.length,statistic:observed,pValue:(extreme+1)/(iterations+1),iterations,method:'整期号码标签置换检验，保留单期无放回抽取结构',warning:'日期由研究者指定；若根据号码结果挑选分界线，P值不能作为确认性证据。时间趋势与其他因素可能混杂。设备启用日期尚未证实，结果不证明设备因果或未来预测优势。'};
}
