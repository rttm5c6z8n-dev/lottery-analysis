import{chooseResult,bridgeRecord,eligibleArchivedResults,buildFiveRecords,appendFiveRecords}from './v40-core.mjs';
import{readResearchData}from './real-data-check.mjs';
import{latestLocalHistory,describeFivePicks,preflightTarget}from './v40-preflight.mjs';
import{proposeUpcomingDraw,applyCandidatePeriod}from './v40-next-draw.mjs';
import{verifyLiveLockGate}from './v40-live-lock-gate.mjs';
import{stampLockedRecords,inspectLockProof,exportLockEvidence}from './v40-lock-proof.mjs';
const $=id=>document.getElementById(id),KEY='lottery_v38_predictions';
let results=[],busy=false;
function status(message){$('status').textContent=message}
function readJournal(){const raw=localStorage.getItem(KEY);if(raw===null)return [];let a;try{a=JSON.parse(raw)}catch{throw Error('本机留档无法解析，已拒绝覆盖')}if(!Array.isArray(a))throw Error('本机留档结构异常，已拒绝覆盖');return a}
function selected(){return results.find(x=>x.id===$('result').value)}
function refresh(){
 const r=selected();
 if(!r){$('preview').textContent='没有可用的完整模型存档。';return}
 const pad=n=>String(n).padStart(2,'0'),rank=Number($('rank').value);
 const lines=r.picks.map((p,i)=>(i===rank?'▶ ':'  ')+'第'+(i+1)+'组 '+p.nums.slice(0,5).map(pad).join(' ')+' + '+p.nums.slice(5).map(pad).join(' '));
 $('preview').textContent='历史截止：'+r.throughPeriod+'\n模型结果：'+r.id+'\n生成时间：'+r.generatedAt+'\n\n已保存的5组研究号码：\n'+lines.join('\n')+'\n\n历史截止不代表已更新至下一期；研究评分不代表中奖概率。';
 const stats=describeFivePicks(r);
 $('concentration').textContent=stats?'5组号码集中度：前区合计只使用 '+stats.uniqueFrontNumbers+' 个不同号码；后区共有 '+stats.distinctBackPairs+' 种组合；两组前区平均重合 '+stats.meanPairwiseFrontOverlap.toFixed(1)+' 个号码。5注不是5个独立期开奖。':'';
}
function updateRanks(){
 const r=selected(),prior=$('rank').value;
 $('rank').replaceChildren();
 for(let i=0;i<(r?.picks?.length||0);i++){const o=document.createElement('option');o.value=String(i);o.textContent='第'+(i+1)+'组';$('rank').append(o)}
 if([...$('rank').options].some(x=>x.value===prior))$('rank').value=prior;
 refresh();
}
async function load(){
 if(busy)return;busy=true;$('load').disabled=true;
 status('正在读取已保存的V3.1结果……');
 try{
  const data=await readResearchData(globalThis.indexedDB);
  const inspected=eligibleArchivedResults(data);
  results=inspected.map(x=>x.result).sort((a,b)=>String(b.generatedAt).localeCompare(String(a.generatedAt)));
  $('result').replaceChildren();
  for(const r of results){const o=document.createElement('option');o.value=r.id;o.textContent=r.throughPeriod+' · '+r.id;$('result').append(o)}
  updateRanks();
  if(!results.length){
   const count=data.results?.length||0;
   status('读取成功，发现'+count+'份选号存档，但0份通过完整覆盖和来源校验。请在V3.1只读存档查看该结果；不要重跑搜索。');
  }else{
   status('读取成功：'+results.length+'份完整且来源一致的选号存档，已显示5组号码；原数据未修改。');
  }
 }catch(e){
  status('读取失败：'+(e?.message||String(e))+'。可刷新重试；不要清空网站数据。');
  $('preview').textContent='存档读取未完成，不能锁定预测。';
 }finally{busy=false;$('load').disabled=false}
}
function checkPreflight(){
 const history=latestLocalHistory(localStorage.getItem('lottery_v2_dlt'));
 const result=preflightTarget({result:selected(),period:$('period').value,drawAt:$('drawAt').value,now:new Date().toISOString(),history});
 $('preflightStatus').textContent=(result.ok?'本机时间与历史期号检查通过（非官方认证）':'不能作为事前预测锁定')+'\n'+result.errors.map(x=>'错误：'+x).concat(result.warnings.map(x=>'提醒：'+x)).join('\n');
 return result;
}
let saving=false;
function lockInputs(){
 if(saving)throw Error('已有锁定流程正在执行');
 if(!checkPreflight().ok)throw Error('本机期号或时间预检查未通过');
 if(!$('confirmed').checked)throw Error('请先独立核实官方目标期号、开奖时间和公告链接');
 return{resultId:$('result').value,rank:Number($('rank').value),
  period:$('period').value,drawAt:$('drawAt').value,sourceUrl:$('sourceUrl').value};
}
function sameInputs(v){
 return $('result').value===v.resultId&&Number($('rank').value)===v.rank&&$('period').value===v.period&&
  $('drawAt').value===v.drawAt&&$('sourceUrl').value===v.sourceUrl&&$('confirmed').checked;
}
async function lockedSave(all){
 let inputs;
 try{inputs=lockInputs()}catch(e){$('saved').textContent='未保存：'+e.message;return}
 saving=true;
 $('save').disabled=true;$('saveFive').disabled=true;
 $('saved').textContent='正在重新查询官网最新开奖期号并检查锁定条件……';
 try{
  const res=await fetch('/api/dlt-results',{cache:'no-store',headers:{Accept:'application/json'}});
  const data=await res.json();
  if(!res.ok)throw Error(data.error||'官网开奖结果查询不可用');
  const now=new Date().toISOString(),gate=verifyLiveLockGate({payload:data,period:inputs.period,drawAt:inputs.drawAt,now});
  if(!sameInputs(inputs))throw Error('查询期间表单发生变化，请重新检查再保存');
  if(!checkPreflight().ok)throw Error('网络查询后原计划时间已不符合事前检查');
  const original=readJournal();
  if(original.some(x=>x?.period===inputs.period))throw Error('该期已经存在留档，禁止覆盖或事后追加');
  if(all){
   const batch=buildFiveRecords({results,resultId:inputs.resultId,period:inputs.period,now,
    drawAt:inputs.drawAt,sourceUrl:inputs.sourceUrl});
   const stamped=batch.map(x=>({...x,liveGate:gate}));
   const locked=await stampLockedRecords(stamped);
   if(!sameInputs(inputs))throw Error('指纹生成期间表单发生变化，已取消保存');
   const next=appendFiveRecords(original,locked.records);
   localStorage.setItem(KEY,JSON.stringify(next));
   $('saved').textContent='已一次性锁定完整5组；SHA-256指纹：'+locked.proof.digest+'。锁定时重新读取官网最近已开奖 '+gate.latestPublished+
    ' 期；仅为本机候选留档，不是独立可信时间公证。';
  }else{
   const chosen=chooseResult(results,inputs.resultId,inputs.rank);
   const item=bridgeRecord({result:chosen,period:inputs.period,now,drawAt:inputs.drawAt,sourceUrl:inputs.sourceUrl});
   const locked=await stampLockedRecords([{...item,liveGate:gate}]);
   if(!sameInputs(inputs))throw Error('指纹生成期间表单发生变化，已取消保存');
   localStorage.setItem(KEY,JSON.stringify([...original,...locked.records]));
   $('saved').textContent='已保存该期单组；SHA-256指纹：'+locked.proof.digest+'。锁定时官网最近已开奖 '+gate.latestPublished+
    ' 期；该期之后不能再补充其他组。';
  }
 }catch(e){$('saved').textContent='锁定未执行，原始数据未修改：'+(e?.message||String(e))}
 finally{saving=false;$('save').disabled=false;$('saveFive').disabled=false}
}
function saveAll(){return lockedSave(true)}
function saveOne(){return lockedSave(false)}
function currentLockedPeriod(){
 const period=$('period').value.trim();
 if(!/^\d{5}$/.test(period))throw Error('请先填写或选中已锁定的五位期号');
 const rows=readJournal().filter(x=>x.period===period);
 if(!rows.length)throw Error('该期没有正式锁定留档；V3.1研究存档不等于锁定证明');
 return rows;
}
async function inspectCurrentProof(){
 const out=$('proofStatus');
 try{
  const records=currentLockedPeriod();
  const result=await inspectLockProof(records);
  out.textContent=result.status==='valid'?'本机SHA-256指纹校验一致：'+result.digest+'（仅说明当前内容与留档指纹一致，无法证明何时保存）':
   result.status==='legacy'?'该期为旧单组留档，没有SHA-256指纹，不能追补为已公证记录。':
   '指纹检查失败：'+result.reason;
  return result;
 }catch(e){out.textContent='指纹检查未完成：'+e.message;return{status:'error'}}
}
async function downloadLockEvidence(){
 const status=$('proofStatus');
 try{
  const rows=currentLockedPeriod(),check=await inspectLockProof(rows);
  if(!check.valid)throw Error('当前留档指纹不一致或为旧格式，禁止导出证明文件');
  const evidence=exportLockEvidence(rows);
  const blob=new Blob([JSON.stringify(evidence,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download='lottery-lock-'+rows[0].period+'-sha256.json';
  anchor.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  status.textContent='已请求导出第'+rows[0].period+'期锁定凭证。请在开奖前保存到独立位置；本机哈希不是第三方公证。';
 }catch(e){status.textContent='导出失败：'+e.message}
}
const SERVER_RECEIPTS='lottery_lock_server_receipts_v1';
function getReceiptIndex(){
 const raw=localStorage.getItem(SERVER_RECEIPTS);
 if(!raw)return{};
 let data;
 try{data=JSON.parse(raw)}catch{throw Error('本机服务器回执索引无法解析，未覆盖')}
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('本机服务器回执索引结构异常');
 return data;
}
async function submitServerReceipt(){
 const out=$('serverReceiptStatus'),btn=$('serverSubmit');
 btn.disabled=true;out.textContent='正在检查本机指纹并向服务器提交……';
 try{
  const records=currentLockedPeriod(),check=await inspectLockProof(records);
  if(!check.valid)throw Error('本机指纹未通过检查，禁止提交服务器');
  const period=records[0].period,index=getReceiptIndex();
  if(index[period])throw Error('该期已经保存回执索引，请先执行“查询服务器留档回执”');
  const res=await fetch('/api/lock-receipts',{method:'POST',cache:'no-store',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({period,digest:check.digest,scope:records.length===5?'five-tickets':'single-ticket',
    plannedDrawAt:records[0].targetEvidence?.plannedDrawAt})});
  const data=await res.json();
  if(!res.ok||!data.persisted||!data.receipt)throw Error(data.error||'服务器未确认持久化保存');
  if(data.receipt.digest!==check.digest||data.receipt.period!==period)throw Error('服务器回执和本机指纹不一致，已拒绝存入索引');
  index[period]={id:data.receipt.id,digest:check.digest,receivedAt:data.receipt.receivedAt};
  localStorage.setItem(SERVER_RECEIPTS,JSON.stringify(index));
  out.textContent='服务器已确认持久化接收指纹。回执ID：'+data.receipt.id+
    '\n服务器记录时间：'+data.receipt.receivedAt+'\nSHA-256：'+check.digest+
    '\n仅证明服务器数据库收到该摘要的时间，不是第三方法定公证。';
 }catch(e){out.textContent='服务器凭证未建立：'+(e?.message||String(e))+'。本机预测不变。'}
 finally{btn.disabled=false}
}
async function checkServerReceipt(){
 const out=$('serverReceiptStatus'),btn=$('serverCheck');
 btn.disabled=true;out.textContent='正在核查服务器原始回执……';
 try{
  const records=currentLockedPeriod(),local=await inspectLockProof(records);
  if(!local.valid)throw Error('本机指纹无效，先检查原始留档');
  const saved=getReceiptIndex()[records[0].period];
  if(!saved?.id)throw Error('当前浏览器未保存该期回执ID；不能据此断言服务器没有记录');
  const res=await fetch('/api/lock-receipts?id='+encodeURIComponent(saved.id),{cache:'no-store'});
  const data=await res.json();
  if(!res.ok||!data.persisted||!data.receipt)throw Error(data.error||'服务器未返回持久化回执');
  if(data.receipt.id!==saved.id||data.receipt.period!==records[0].period||data.receipt.digest!==local.digest)
   throw Error('服务器回执与本机记录不一致');
  out.textContent='服务器回执查询一致。第'+data.receipt.period+'期\n回执ID：'+saved.id+
   '\n服务器接收时间：'+data.receipt.receivedAt+'\n摘要：'+data.receipt.digest+
   '\n该验证不构成对真实开奖计划和历史时间的独立法定公证。';
 }catch(e){out.textContent='服务器回执未通过验证：'+(e?.message||String(e))}
 finally{btn.disabled=false}
}
async function refreshOfficial(){
 const btn=$('officialRefresh'),out=$('officialStatus');btn.disabled=true;out.textContent='正在尝试读取官网公告标题……';
 try{
  const response=await fetch('/api/dlt-announcements',{cache:'no-store',headers:{Accept:'application/json'}});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'官网查询不可用');
  const lines=[
   '官方公告页：'+data.source,
   '查询时间：'+data.observedAt,
   '官网已发布最新识别期号：'+data.latestPublished,
   '下一期候选期号（未经官方确认）：'+(data.tentativeNextPeriod||'无法计算'),
   '下一常规开奖日候选（未核实休市及具体时间）：'+(data.tentativeNextRegularDate||'无法计算'),
   '最新公告：'+data.latestBulletin?.title,
   '',
   '注意：网站结构可能改变，公告期号也可能不是当前最新；休市和开奖时间均未核实。',
   '不自动填入正式锁定资料，不自动确认开奖号码，不会更新历史库。'];
  out.textContent=lines.join('\n');
 }catch(e){
  out.textContent='自动查询失败：'+(e?.message||String(e))+'。请直接打开下方官方网站公告链接人工核对。';
 }finally{btn.disabled=false}
}
let suggested=null;
async function nextDrawRefresh(){
 const btn=$('nextDrawRefresh'),out=$('nextDrawStatus');
 btn.disabled=true;$('useNextPeriod').disabled=true;suggested=null;out.textContent='正在读取官网最新开奖和推算下一常规期号……';
 try{
  const response=await fetch('/api/dlt-results',{cache:'no-store',headers:{Accept:'application/json'}});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'官方开奖接口暂不可用');
  suggested=proposeUpcomingDraw(data,new Date().toISOString());
  out.textContent='官网最近期号：'+suggested.latestOfficialPeriod+'（'+suggested.latestOfficialDate+'）\n下一期候选：'+suggested.candidatePeriod+'\n常规开奖日候选：'+suggested.candidateDate+'（北京时间日期）\n\n'+suggested.notice;
  $('useNextPeriod').disabled=false;
 }catch(e){
  out.textContent='无法自动确认下一期：'+(e?.message||String(e))+'。请人工核实官方开奖公告，未填写任何正式锁定数据。';
 }finally{btn.disabled=false}
}
function useNextPeriod(){
 try{
  const next=applyCandidatePeriod($('period').value,suggested);
  $('period').value=next;$('confirmed').checked=false;
  $('preflightStatus').textContent='候选期号'+next+'已填入，但还需独立核实正式期号、开奖时刻、来源公告；当前不能直接锁定。';
  $('nextDrawStatus').textContent+='\n\n已将候选期号填入下方（仅期号），未自动填写开奖时间或证明链接。';
  $('useNextPeriod').disabled=true;
 }catch(e){$('nextDrawStatus').textContent='未填入：'+(e?.message||String(e))}
}
export function init(){
 $('load').onclick=load;
 $('result').onchange=updateRanks;
 $('rank').onchange=refresh;
 $('save').onclick=saveOne;
 $('saveFive').onclick=saveAll;
 $('preflight').onclick=checkPreflight;
 $('officialRefresh').onclick=refreshOfficial;
 $('nextDrawRefresh').onclick=nextDrawRefresh;
 $('useNextPeriod').onclick=useNextPeriod;
 $('proofVerify').onclick=inspectCurrentProof;
 $('proofExport').onclick=downloadLockEvidence;
 $('serverSubmit').onclick=submitServerReceipt;
 $('serverCheck').onclick=checkServerReceipt;
 load();
 nextDrawRefresh();
}
