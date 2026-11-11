import{chooseResult,bridgeRecord,eligibleArchivedResults,buildFiveRecords,appendFiveRecords}from './v40-core.mjs';
import{readResearchData}from './real-data-check.mjs';
import{latestLocalHistory,describeFivePicks,preflightTarget}from './v40-preflight.mjs';
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
function saveAll(){
 try{
  if(!checkPreflight().ok)throw Error('期号或计划时间检查未通过，请先纠正');
  if(!$('confirmed').checked)throw Error('先核实未来期号、计划开奖时间及公告链接');
  const batch=buildFiveRecords({results,resultId:$('result').value,period:$('period').value,now:new Date().toISOString(),drawAt:$('drawAt').value,sourceUrl:$('sourceUrl').value});
  const next=appendFiveRecords(readJournal(),batch);
  localStorage.setItem(KEY,JSON.stringify(next));
  $('saved').textContent='已一次性保存该期全部5组研究号码（本机留档，不是独立时间公证）。';
 }catch(e){$('saved').textContent='5组保存未执行：'+e.message}
}
function saveOne(){
 try{
  if(!checkPreflight().ok)throw Error('期号或计划时间检查未通过，请先纠正');
  if(!$('confirmed').checked)throw Error('先核实未来期号、计划开奖时间及公告链接');
  const chosen=chooseResult(results,$('result').value,Number($('rank').value));
  const item=bridgeRecord({result:chosen,period:$('period').value,now:new Date().toISOString(),drawAt:$('drawAt').value,sourceUrl:$('sourceUrl').value});
  const existing=readJournal();
  if(existing.some(x=>x.period===item.period))throw Error('该期已有留档，不允许追加或覆盖');
  localStorage.setItem(KEY,JSON.stringify([...existing,item]));
  $('saved').textContent='已保存第'+chosen.rank+'组。该期不能再追加其他组。';
 }catch(e){$('saved').textContent='单组保存未执行：'+e.message}
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
   '最新公告：'+data.latestBulletin?.title,
   '',
   '注意：网站结构可能改变，公告期号也可能不是当前最新；休市和开奖时间均未核实。',
   '不自动填入正式锁定资料，不自动确认开奖号码，不会更新历史库。'];
  out.textContent=lines.join('\n');
 }catch(e){
  out.textContent='自动查询失败：'+(e?.message||String(e))+'。请直接打开下方官方网站公告链接人工核对。';
 }finally{btn.disabled=false}
}
export function init(){
 $('load').onclick=load;
 $('result').onchange=updateRanks;
 $('rank').onchange=refresh;
 $('save').onclick=saveOne;
 $('saveFive').onclick=saveAll;
 $('preflight').onclick=checkPreflight;
 $('officialRefresh').onclick=refreshOfficial;
 load();
}
