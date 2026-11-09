'use strict';
(()=>{
 const C=V28Core,$=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const stamp=()=>new Date().toISOString();
 const blank=()=>({version:1,queue:[],results:{},inspections:{},cursor:0,historicalRaw:null,updatedAt:null});
 let state=blank(),running=false,stopping=false,importing=false,controller=null,storageError='',savedRaw=null,saving=false;
 function history(){const raw=localStorage.getItem('lottery_v2_dlt');if(raw===null)throw Error('未找到历史缓存，请在原域名、原浏览器访问；本页不补造数据');let rows;try{rows=JSON.parse(raw)}catch(e){throw Error('历史缓存JSON损坏：'+e.message)}if(!Array.isArray(rows))throw Error('历史缓存不是数组');return {raw,rows}}
 const periods=()=>[...new Set(state.queue.map(r=>r.period))].sort();
 async function save(next){if(saving)throw Error('上一保存事务尚未完成，请稍后重试');if(storageError)throw Error(storageError);saving=true;render();try{await V28Storage.save(next);state=next;storageStatus()}catch(e){storageStatus();throw Error('IndexedDB保存失败：'+e.message)}finally{saving=false;render()}}
 function storageStatus(){const d=V28Storage.diagnostic;$('storageStatus').textContent='存储类型：'+d.type+'；实际已持久保存：'+d.saved+' 期；最后成功保存：'+(d.lastSuccess||'未知')+'；'+d.migration+'；失败原因：'+(d.failure||'无')}
 function resetResults(queue){return {...state,queue,results:{},inspections:{},cursor:0,historicalRaw:null,updatedAt:stamp()}}
 function table(heads,rows){return '<table><thead><tr>'+heads.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table>'}
 function link(u){return C.https(u)?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(u)+'</a>':'未知'}
 function fresh(){try{return state.historicalRaw===history().raw}catch{return false}}
 const currentResults=()=>({...state.inspections,...state.results});
 function render(){
  const ps=periods(),valid=fresh(),allResults=currentResults(),results=valid?Object.values(allResults):[],a=results.filter(r=>r.grade==='A').length;
  const periodSet=new Set(ps);let h=[];try{h=history().rows;$('local').textContent='本地历史：'+h.length+' 条；'+(h.length===2945?'数量与既有2945期一致。':'与既有2945期数量不符，按实际读取。')+'本页未修改原始缓存。'}catch(e){$('local').textContent=e.message}
  $('progress').max=Math.max(1,ps.length);$('progress').value=valid?state.cursor:0;
  $('stats').textContent='证据 '+state.queue.length+' 条 / 唯一期号 '+ps.length+'；已核验 '+results.filter(r=>r.grade!=='未比对').length+'；剩余 '+ps.filter(p=>!allResults[p]).length+'；A '+a+'；来源待核 '+results.filter(r=>r.grade==='来源待核').length+'；异常 '+results.filter(r=>r.grade==='D').length+'；未比对明细 '+results.filter(r=>r.grade==='未比对').length+'；本地无外部证据（未比对） '+h.filter(r=>!periodSet.has(String(r?.period))).length+'；A覆盖率 '+(h.length?(100*a/h.length).toFixed(2)+'%':'未知')+'。'+(!valid&&Object.keys(currentResults()).length?'历史已变化或不可读取，旧结果已停止计入覆盖率，请重新核验。':'')+(state.updatedAt?' 最近保存：'+state.updatedAt:'');
  const years=Array.from({length:20},(_,i)=>{const y=2007+i,local=h.filter(r=>/^\d{5}$/.test(String(r?.period))&&2000+Number(String(r.period).slice(0,2))===y),done=results.filter(r=>2000+Number(r.period.slice(0,2))===y),A=done.filter(r=>r.grade==='A').length;return [y,local.length,done.length,A,done.filter(r=>r.grade==='D').length,local.length?(100*A/local.length).toFixed(2)+'%':'未知']});
  $('years').innerHTML=table(['年度','本地记录','已核验','A','异常','A覆盖率'],years);
  const f=$('filter').value,list=results.filter(r=>f==='all'||r.grade===f).sort((a,b)=>b.period.localeCompare(a.period));
  $('trace').textContent='点击明细中的逐字段记录可查看两边实际值；旧记录缺少读取信息时显示未知。';
  $('results').innerHTML=list.length?table(['期号 / 等级','本地日期及号码','参考证据','状态 / 核验时间'],list.slice(0,100).map(r=>[esc(r.period)+'<br>'+esc(r.grade),r.local?esc(r.local.date)+'<br>'+esc(r.local.nums.join(' ')):'未知',r.evidence.map(e=>esc(e.date)+' / '+esc(e.nums.join(' '))+'<br>'+link(e.url)+'<br>'+esc(e.kind)+' / 人工核实：'+esc(e.review?.at||'未知')).join('<hr>')||'未读取到外部记录',esc(r.state)+'<br>'+esc(r.errors.join('；'))+'<br>'+esc(r.at)+'<br><details><summary>独立逐字段明细</summary>'+traceHtml(r)+'</details>'])):'暂无本轮有效结果。';
  for(const id of ['files','importFiles','source','fetch','legacy','batch','showReview','reviewPage','inspectPeriod','inspect'])$(id).disabled=running||importing||saving||!!storageError;
  $('start').disabled=running||importing||saving||!ps.length||!!storageError;$('stop').disabled=!running;$('cancelFetch').disabled=!controller;$('export').disabled=running||importing||!results.length;
  renderReviews();
 }
 function traceHtml(r){return (r.details||[]).map((d,i)=>'<p>比对明细 '+(i+1)+'；本条证据等级：'+esc(d.grade)+'；外部期号：'+esc(d.external?.period??'未知')+'；来源类型：'+esc(d.sourceType)+'<br>实际读取URL：'+link(d.acquisition?.sourceUrl)+'<br>请求URL：'+link(d.acquisition?.requestedUrl)+'<br>读取方式：'+esc(d.acquisition?.channel||'unknown')+'；文件：'+esc(d.acquisition?.fileName||'未知')+'；读取时间：'+esc(d.readAt||'未知')+'<br>公告证据链接（不代表已自动读取公告）：'+link(d.evidenceUrl)+'</p>'+table(['字段','本地实际值','外部实际值','比对结果','失败原因'],d.fields.map(f=>[esc(f.field),esc(f.local??'未知'),esc(f.external??'未知'),esc(f.result),esc(f.reason||'无')]))+'<p>失败原因：'+esc(d.failureReasons.join('；')||'无')+'</p>').join('<hr>')}
 function renderReviews(){
  const page=Math.max(1,Math.floor(Number($('reviewPage').value)||1)),start=(page-1)*20,items=state.queue.slice(start,start+20);
  $('reviews').innerHTML='<p>第 '+page+' 页；共 '+Math.ceil(state.queue.length/20)+' 页 / '+state.queue.length+' 条证据。</p>'+items.map((r,i)=>'<div class="review-row"><strong>'+esc(r.period)+' / '+esc(r.date)+'</strong><br>'+esc(r.nums.slice(0,5).join(' '))+' + '+esc(r.nums.slice(5).join(' '))+'<br>'+link(r.url)+'<br>类型：'+esc(r.kind)+'；原文核实：'+esc(r.review?.at||'未知')+(r.kind==='draw'&&C.official(r.url)?'<button data-review="'+(start+i)+'" '+(running||importing||saving||storageError?'disabled':'')+'>'+(r.review?'撤销本条人工核实':'我已打开并逐项核实此条原始开奖公告')+'</button>':'<p class="warn">来源待核；无 A 级确认入口。若原始文件缺失来源类型，请修正后重新导入。</p>')+'</div>').join('');
  $('reviews').querySelectorAll('button[data-review]').forEach(b=>b.onclick=async()=>{if(running||importing)return;const i=Number(b.dataset.review),r=state.queue[i];if(!r.review&&!confirm('请确认你已打开这条具体原始开奖公告，并核实官方发布机构、期号 '+r.period+'、日期 '+r.date+'、前区 '+r.nums.slice(0,5).join(' ')+'、后区 '+r.nums.slice(5).join(' ')+' 均与公告一致。不能用休市公告或第三方整理代替。未实际核实请取消。'))return;
   const queue=state.queue.map((x,j)=>j===i?{...x,review:x.review?null:{method:'manual-original-notice',identity:C.id(x),at:stamp()}}:x);try{await save(resetResults(queue));$('status').textContent='人工核实状态已保存，请开始核验重新计算等级。';render()}catch(e){$('status').textContent=e.message}});
 }
 async function commitImports(added){const m=C.merge(state.queue,added);if(m.queue.length!==state.queue.length)await save(resetResults(m.queue));$('importStatus').textContent='导入完成：新增 '+(m.queue.length-state.queue.length)+' 条；重复 '+m.duplicates+' 条；累计 '+m.queue.length+' 条。';return m}
 async function importingTask(fn){if(running||importing)return;importing=true;$('importStatus').textContent='读取并检查中…';render();try{const added=await fn();const old=state.queue.length;const m=await commitImports(added);$('importStatus').textContent='导入完成：新增 '+(m.queue.length-old)+' 条；重复 '+m.duplicates+' 条；累计 '+m.queue.length+' 条。'+(m.queue.length>old?'新增证据已清空本轮结果，等待重新核验。':'全部为重复证据，本轮结果及进度保留。')}catch(e){$('importStatus').textContent='导入失败：'+e.message+'。已有V28任务与历史缓存保持不变。'}finally{importing=false;controller=null;render()}}
 $('importFiles').onclick=()=>importingTask(async()=>{const files=[...$('files').files];if(!files.length)throw Error('请选择文件');let all=[];for(const f of files){if(f.size>5*1024*1024)throw Error(f.name+' 超过5MB');try{all.push(...C.capture(C.parse(await f.text()),{channel:'file',fileName:f.name,readAt:stamp()}))}catch(e){throw Error(f.name+'：'+e.message)}if(all.length>20000)throw Error('本批超过20000条')}return all});
 $('fetch').onclick=()=>importingTask(async()=>{const u=C.https($('source').value.trim());if(!u)throw Error('请输入不含账号密码的HTTPS地址');controller=new AbortController();render();let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort()},15000);try{const res=await fetch(u,{signal:controller.signal,cache:'no-store',credentials:'omit',redirect:'follow',referrerPolicy:'no-referrer'});if(!res.ok)throw Error('HTTP '+res.status);if(!C.https(res.url||u))throw Error('响应重定向至非HTTPS地址');if(Number(res.headers.get('content-length'))>5*1024*1024)throw Error('响应超过5MB');const reader=res.body.getReader(),chunks=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>5*1024*1024)throw Error('响应超过5MB');chunks.push(value)}}finally{await reader.cancel()}const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength}return C.capture(C.parse(new TextDecoder().decode(body)),{channel:'https',sourceUrl:res.url||null,requestedUrl:u,readAt:stamp()})}catch(e){if(timedOut)throw Error('请求超时（15秒），可重新读取或改用本地文件');if(controller.signal.aborted)throw Error('用户已取消读取');if(e instanceof TypeError)throw Error('网络或跨域CORS失败：'+e.message+'；请由数据源启用CORS或下载后导入');throw e}finally{clearTimeout(timer)}});
 $('cancelFetch').onclick=()=>controller?.abort();
 $('legacy').onclick=()=>importingTask(async()=>C.capture(V27_OFFICIAL.map(r=>C.normal({...r,kind:'draw'})),{channel:'bundled-reference',sourceUrl:new URL('v27-evidence.js',location.href).href,readAt:null}));
 $('start').onclick=async()=>{
  if(running||importing||storageError)return;running=true;stopping=false;render();$('status').textContent='正在读取历史并准备本轮核验…';
  try{const h=history();if(state.historicalRaw!==h.raw||(state.cursor>0&&state.cursor>=periods().length)){await save({...state,results:{},inspections:{},cursor:0,historicalRaw:h.raw,updatedAt:stamp()})}
   const ps=periods(),batch=Number($('batch').value),prepared=C.index(state.queue,h.rows);while(state.cursor<ps.length&&!stopping){
    if(history().raw!==h.raw)throw Error('运行期间历史缓存发生变化，已暂停；请重新开始以核验新快照');
    const results={...state.results},end=Math.min(state.cursor+batch,ps.length),at=stamp();for(let i=state.cursor;i<end;i++){results[ps[i]]=C.verify(ps[i],state.queue,h.rows,at,prepared)}
    await save({...state,results,cursor:end,updatedAt:stamp()});$('status').textContent='运行中：已核验 '+end+' / '+ps.length+' 期；每批进度已保存。';render();await new Promise(resolve=>setTimeout(resolve,30));
   }
   if(history().raw!==h.raw)throw Error('历史缓存已变化，请重新核验');
   $('status').textContent=(stopping?'已停止，进度已保存，可继续。':'核验完成。')+' '+state.cursor+' / '+ps.length+' 期；时间 '+stamp();
  }catch(e){$('status').textContent='核验中断：'+e.message+'。已成功保存的批次可续跑，未完成记录不计通过。'}finally{running=false;render()}
 };
 $('inspect').onclick=async()=>{
  if(running||importing||storageError)return;
  try{const p=$('inspectPeriod').value.trim();if(!/^\d{5}$/.test(p))throw Error('请输入5位期号');const h=history(),prepared=C.index(state.queue,h.rows);if(!prepared.locals.has(p)&&!prepared.refs.has(p))throw Error('本地与外部均无该期记录，不生成虚假记录');
   const result=C.verify(p,state.queue,h.rows,stamp(),prepared),base=state.historicalRaw===h.raw?state:{...state,results:{},inspections:{},cursor:0,historicalRaw:h.raw};
   const next={...base,inspections:{...base.inspections,[p]:result},updatedAt:stamp()};if(next.results[p])next.results={...next.results,[p]:result};await save(next);render();$('trace').innerHTML='<h3>'+esc(p)+'：'+esc(result.state)+'</h3>'+traceHtml(result);$('status').textContent='已读取实际记录并保存该期独立明细；'+result.state;
  }catch(e){$('trace').textContent='读取明细失败：'+e.message}
 };
 $('stop').onclick=()=>{stopping=true;$('status').textContent='正在停止；保留最近成功保存的批次…'};
 function download(text,name){const u=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}
 $('export').onclick=()=>{if(running||!fresh()){$('status').textContent='历史已变化或任务正在运行，请重新核验后导出';render();return}download(C.csv(currentResults()),'V28-官方开奖号码批量核验.csv')};
 $('template').onclick=()=>download('\ufeffperiod,date,front1,front2,front3,front4,front5,back1,back2,url,kind\r\n','V28-空白导入模板.csv');
 $('showReview').onclick=renderReviews;$('filter').onchange=render;
 window.addEventListener('storage',e=>{if(e.key==='lottery_v2_dlt'){stopping=true;$('status').textContent='检测到其他页面更新历史，旧覆盖率暂不使用，请重新核验。';render()}if(e.key===C.KEY){storageError='另一标签页更新了V28任务，请刷新本页后继续，避免覆盖其结果';stopping=true;$('status').textContent=storageError;render()}});
 async function restore(){
  importing=true;render();
  try{const persisted=await V28Storage.load();const raw=persisted?JSON.stringify(persisted):localStorage.getItem(C.KEY);savedRaw=raw;if(raw){
   const stored=C.unpackState(JSON.parse(raw),false);if(stored.version!==1||!Array.isArray(stored.queue)||stored.queue.length>20000||!Number.isInteger(stored.cursor)||stored.cursor<0)throw Error('独立任务格式不正确');
   const queue=stored.queue.map(r=>({...C.normal(r),review:r.review||null,acquisition:C.acquisition(r.acquisition)}));if(new Set(queue.map(C.recordKey)).size!==queue.length)throw Error('独立任务含重复证据');
   state={...blank(),queue,historicalRaw:stored.historicalRaw,updatedAt:stored.updatedAt};const ps=periods();if(stored.cursor>ps.length)throw Error('进度超出任务范围');
   if(fresh()){
    const h=history(),prepared=C.index(queue,h.rows);
    for(let i=0;i<stored.cursor;i++){
     if(storageError)throw Error(storageError);
     const p=ps[i];state.results[p]=C.verify(p,queue,h.rows,stamp(),prepared);state.cursor=i+1;
     if((i+1)%100===0){$('status').textContent='正在复查已保存进度：'+state.cursor+' / '+stored.cursor+'；原始缓存只读。';await new Promise(resolve=>setTimeout(resolve,0))}
    }
    for(const p of Object.keys(stored.inspections||{})){if(/^\d{5}$/.test(p)&&(prepared.locals.has(p)||prepared.refs.has(p)))state.inspections[p]=C.verify(p,queue,h.rows,stamp(),prepared)}
    if(!fresh()){state.results={};state.inspections={};state.cursor=0;$('status').textContent='恢复期间历史发生变化，请从头核验。'}else $('status').textContent='已恢复 '+state.cursor+' / '+ps.length+' 期进度，点击开始可续跑。';
   }else $('status').textContent='已恢复证据队列；历史已变化或不可读，需从头核验。';
   if(!persisted){await V28Storage.migrate(state)}
  }}catch(e){storageError='无法恢复V28独立任务：'+e.message+'。为避免覆盖，不再写入；请先备份并检查该独立键。';state=blank();$('status').textContent=storageError}
  finally{importing=false;storageStatus();render()}
 }
 $('diagnose').onclick=async()=>{try{const d=await V28Storage.read();V28Storage.diagnostic.saved=d.meta?.state.cursor||0;V28Storage.diagnostic.lastSuccess=d.meta?.state.updatedAt||null}catch(e){V28Storage.diagnostic.failure=e.message}storageStatus()};
 restore();
})();
