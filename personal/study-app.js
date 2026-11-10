'use strict';
(() => {
  const P=Study,S=StudyStore,$=id=>document.getElementById(id),esc=v=>String(v??'未知').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let ready=false,busy=false,pause=false,snapshot=null,model=null,jobs=[],worker=null,workerSnapshot=null,seq=0;
  const pending=new Map();
  const id=()=>crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2);
  function status(node,text){$(node).textContent=text}
  function controls(){
    for(const n of ['studyRead','studyTrain','studyRetrain','studyReplay','studyResume'])$(n).disabled=!ready||busy;
    $('studyPause').disabled=!busy;$('studySimulate').disabled=!ready||busy||!model||model.snapshotId!==snapshot?.id;
    $('studyExport').disabled=!ready||busy;
  }
  function connect(){
    if(worker)return;
    if(!globalThis.Worker)throw Error('当前浏览器不支持Web Worker，无法安全运行长任务；请使用支持Worker的Safari/Chrome');
    worker=new Worker('study-worker.js');
    worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.value)};
    worker.onerror=e=>{for(const p of pending.values())p.reject(Error('研究Worker失败：'+e.message));pending.clear();worker.terminate();worker=null;workerSnapshot=null};
  }
  function compute(data){connect();return new Promise((resolve,reject)=>{const n=++seq;pending.set(n,{resolve,reject});worker.postMessage({id:n,...data})})}
  function bridge(){if(model&&snapshot&&model.snapshotId===snapshot.id)window.dispatchEvent(new CustomEvent('research-trained',{detail:{at:snapshot.at,hash:snapshot.hash,rows:snapshot.rows,trainingId:model.id}}))}
  async function refresh(preserveProgress=false){
    jobs=await S.all('jobs');$('studyJobs').innerHTML=jobs.slice().reverse().map(j=>'<option value="'+esc(j.id)+'">'+esc((j.type==='train'?'训练':'回测'+(j.scope||'全部'))+' '+j.cursor+'/'+j.total+' '+j.status+' '+Research.bj(Date.parse(j.savedAt||j.createdAt)))+'</option>').join('');
    const reports=await S.all('reports');if(reports.length)renderReport(reports.at(-1));
    const sims=await S.all('simulations');if(sims.length)renderSimulation(sims.at(-1));
    const models=await S.all('models');model=models.filter(m=>m.snapshotId===snapshot?.id).at(-1)||null;
    if(model){if(!preserveProgress)status('studyTrainStatus','已完成训练：已扫描 '+model.totalProcessed+' 条；实际模型窗口 '+model.totalUsed+' 条；截止期号 '+model.model.trainedThroughPeriod+'；完成时间 '+Research.bj(Date.parse(model.completedAt))+'。下一步可回测或模拟，均不要求官方目标。');bridge()}
    if(!preserveProgress){
      const train=jobs.filter(j=>j.type==='train'&&j.snapshotId===snapshot?.id).at(-1),replay=jobs.filter(j=>j.type==='replay'&&j.snapshotId===snapshot?.id).at(-1);
      if(train&&train.status!=='completed')status('studyTrainStatus','未完成任务：已成功保存 '+train.cursor+'/'+train.total+'；可选择断点续跑。'+(model?'旧模型继续保留，不视为本次训练完成。':''));
      if(replay)status('studyReplayStatus',(replay.status==='completed'?'已完成':'可恢复')+' '+replay.cursor+'/'+replay.total+'；最后成功保存 '+Research.bj(Date.parse(replay.savedAt))+'。');
    }
    controls();
  }
  async function read(){
    const raw=localStorage.getItem('lottery_v2_dlt');if(!raw)throw Error('未找到本机历史缓存 lottery_v2_dlt；不会初始化或伪造历史');
    const values=JSON.parse(raw),at=P.stamp(),audit=P.audit(values,at);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))).map(n=>n.toString(16).padStart(2,'0')).join('');
    const s={id:id(),at,hash,raw:values,...audit};await S.add('snapshots',s);snapshot=s;model=null;
    renderRead();status('studyTrainStatus','尚未训练此快照。下一步：训练五种策略；也可直接滚动回测。');await refresh();
  }
  function renderRead(){
    if(!snapshot)return;
    status('studyReadStatus','已持久保存只读快照：总数 '+snapshot.total+'；有效 '+snapshot.valid+'；异常/排除 '+snapshot.abnormal+'；读取截止 '+Research.bj(Date.parse(snapshot.at))+'。下一步：训练。');
    $('studyIssues').innerHTML='<summary>逐条数据校验：'+snapshot.issues.length+' 项</summary><pre>'+esc(JSON.stringify(snapshot.issues,null,2))+'</pre>';
  }
  async function start(type,retrain=false){
    if(busy)return;busy=true;pause=false;controls();status('studyError','');
    try{
      if(!snapshot)await read();
      if(snapshot.rows.length<120)throw Error('至少需要120条实际读取截止之前的完整、唯一且合法历史记录');
      const scope=Number($('studyScope').value);
      let job=!retrain?jobs.filter(j=>j.type===type&&j.snapshotId===snapshot.id&&j.status!=='completed'&&(type==='train'||j.scope===scope)).at(-1):null;
      if(!job){
        const targets=type==='replay'?P.plan(snapshot.rows,scope):null;
        if(type==='replay'&&!targets.length)throw Error('没有足够的下一期留出样本；至少121条且目标前有120条合格历史');
        job={id:id(),type,snapshotId:snapshot.id,hash:snapshot.hash,scope,createdAt:P.stamp(),savedAt:P.stamp(),cursor:0,total:targets?targets.length:snapshot.rows.length,status:'ready',targets,seed:20261110,totals:type==='replay'?P.initialTotals():null};
        await S.add('jobs',job);
      }
      await run(job);
    }catch(e){status('studyError','已停止：'+e.message+'。仅已成功事务有效；可刷新后恢复，原数据不变。')}
    finally{busy=false;await refresh(true).catch(e=>status('studyError',e.message));controls()}
  }
  async function run(job){
    const snapshots=await S.all('snapshots'),input=snapshots.find(s=>s.id===job.snapshotId);if(!input)throw Error('任务原始研究快照缺失，不能用新快照替代');
    if(job.status==='completed')throw Error('此任务已完成；需要重新训练/回测请新建任务，保留旧结果');
    const node=job.type==='train'?'studyTrainStatus':'studyReplayStatus';
    try {while(job.cursor<job.total){
      status(node,'运行中：已成功保存 '+job.cursor+'/'+job.total+'；正在计算下一批，可暂停。');
      const send=workerSnapshot!==input.id;const result=await compute({job,snapshot:send?{id:input.id,rows:input.rows}:undefined});workerSnapshot=input.id;
      result.job.savedAt=P.stamp();let artifact;
      if(result.job.status==='completed')artifact=job.type==='train'?{id:job.id,snapshotId:input.id,hash:input.hash,trainingCutoff:input.at,completedAt:result.job.savedAt,totalProcessed:input.rows.length,totalUsed:result.job.model.rows.length,model:result.job.model}:{id:job.id,...P.report(result.job)};
      await S.commit(result,artifact);job=result.job;
      status(node,'已成功事务保存 '+job.cursor+'/'+job.total+'；最后成功保存 '+Research.bj(Date.parse(job.savedAt)));
      if(job.status==='completed'){status(node,(job.type==='train'?'已完成训练 ':'已完成 ')+job.cursor+'/'+job.total+'；完成时间 '+Research.bj(Date.parse(job.savedAt))+'。'+(job.type==='train'?'下一步：回测或模拟。':'完整结果已独立保存，下一步可模拟。'));if(artifact&&job.type==='replay')renderReport(artifact);break}
      if(pause){status(node,'已暂停；最后成功保存 '+job.cursor+'/'+job.total+'。点击断点续跑，刷新后亦可恢复。');break}
      await new Promise(resolve=>setTimeout(resolve,0));
    }} catch(e) {status(node,'已停止；最近成功保存 '+job.cursor+'/'+job.total+'；原因：'+e.message+'。可从任务列表断点续跑。');throw e}
  }
  function renderReport(r){
    status('studyReportInfo',r.mode+'；来源快照 '+r.snapshotId+'；完成时间 '+Research.bj(Date.parse(r.completedAt))+'；SHA256 '+r.hash+'；样本 '+r.folds+' 期；每策略每期5注；版本 '+r.version+'；'+r.prizeRule+'。'+r.availability);
    const f=n=>Number(n).toFixed(3),range=a=>a?a.map(f).join(' 至 '):'样本不足/不适用';
    $('studyReport').innerHTML=r.strategies.map(m=>'<article class="pick"><h3>'+esc(m.name)+'</h3><p>一等奖完整5＋2命中：'+m.firstPrizeHits+' 注 / '+m.winningDraws+' 期；共 '+m.draws+' 期、'+m.tickets+' 注。</p><p>命中期率95%区间：'+esc(m.firstPrizeDrawRate95?.map(n=>(n*100).toFixed(4)+'%').join(' 至 ')||'无样本')+'</p><p>前区累计命中 '+m.front+'；后区累计命中 '+m.back+'</p><details><summary>辅助匹配档位及相对随机差异</summary><p>统一研究口径2—9档：'+esc(m.prizes.slice(2).map((n,i)=>(i+2)+'档 '+n).join('；'))+'</p><p>'+esc(['front','back'].map((k,i)=>(i?'后区':'前区')+'每期命中差 '+f(m.pairedDifferencePerDraw[k].mean)+'；近似95%区间 '+range(m.pairedDifferencePerDraw[k].approx95)).join('。'))+'</p><p>一等奖差值不使用稀疏样本正态近似区间；辅助指标不证明预测能力。</p></details></article>').join('');
    status('studyRandom','随机基准：每期100组、每组5注。累计命中均值及模拟95%范围：'+[['front','前区'],['back','后区'],['firstPrizeHits','一等奖']].map(([k,n])=>n+' '+f(r.random[k].mean)+'（'+range(r.random[k].empirical95)+'）').join('；')+'。'+r.conclusion+'。'+r.uncertainty);

  }
  function renderSimulation(s){
    status('studySimStatus','已保存模拟快照：模拟研究，不对应已确认的正式开奖期号。来源快照 '+s.snapshotId+'；生成时间 '+Research.bj(Date.parse(s.generatedAt))+'；历史数据截止期号 '+s.throughPeriod+'；训练快照 '+s.trainingId+'；模型 '+s.version+'。第一组仅融合分最高，不代表中奖概率更高。');
    $('studySimPicks').innerHTML=s.picks.map((p,i)=>'<article class="pick"><strong>第'+(i+1)+'组 · '+p.nums.slice(0,5).map(n=>String(n).padStart(2,'0')).join(' ')+' ＋ '+p.nums.slice(5).map(n=>String(n).padStart(2,'0')).join(' ')+'</strong><p>综合研究评分 '+p.score+' / 100</p><p>'+esc(Object.entries(p.scores).map(([k,v])=>k+' '+(v*100).toFixed(2)).join('；'))+'</p><small>北京时间 '+esc(Research.bj(Date.parse(s.generatedAt)))+'；历史截止 '+esc(s.throughPeriod)+'</small></article>').join('');
  }
  $('studyRead').onclick=async()=>{if(busy||!ready)return;busy=true;controls();try{await read()}catch(e){status('studyReadStatus','读取失败：'+e.message)}finally{busy=false;controls()}};
  $('studyTrain').onclick=()=>start('train');$('studyRetrain').onclick=()=>start('train',true);$('studyReplay').onclick=()=>start('replay');
  $('studyPause').onclick=()=>{pause=true;status('studyError','已收到暂停请求；等当前批事务确认后停止。尚未保存的计算不会计入进度。')};
  $('studyResume').onclick=async()=>{if(busy||!ready)return;const j=jobs.find(x=>x.id===$('studyJobs').value);if(!j){status('studyError','没有可恢复的任务，请先训练或回测');return}busy=true;pause=false;controls();status('studyError','正在恢复所选任务…');try{await run(j)}catch(e){status('studyError','未恢复：'+e.message)}finally{busy=false;await refresh(true);controls()}};
  $('studySimulate').onclick=async()=>{
    if(busy||!ready)return;busy=true;controls();try{
      if(!model||model.snapshotId!==snapshot?.id)throw Error('先完成当前快照训练');
      const generatedAt=P.stamp();if(Date.parse(model.completedAt)>Date.parse(generatedAt))throw Error('设备时间早于训练完成时间，请核实设备时间');
      const seed=crypto.getRandomValues(new Uint32Array(1))[0],picks=await compute({kind:'simulate',rows:model.model.rows,seed});
      const s={id:id(),kind:'模拟研究，不对应已确认的正式开奖期号',version:P.version,engine:Research.VERSION,generatedAt,throughPeriod:model.model.trainedThroughPeriod,trainingId:model.id,snapshotId:snapshot.id,hash:snapshot.hash,seed,picks,weights:P.weights};
      await S.add('simulations',s);renderSimulation(s);
    }catch(e){status('studySimStatus','模拟未保存：'+e.message)}finally{busy=false;controls()}
  };
  $('studyExport').onclick=async()=>{if(busy||!ready)return;busy=true;controls();try{const out={version:P.version,exportedAt:P.stamp()};for(const name of S.names)out[name]=await S.all(name);const u=URL.createObjectURL(new Blob([await compute({kind:'export',exportData:out})],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='BC第二阶段-训练回测模拟研究.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000)}catch(e){status('studyError','导出失败：'+e.message)}finally{busy=false;controls()}};
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&busy)pause=true});
  (async()=>{try{await S.open();ready=true;const snapshots=await S.all('snapshots');snapshot=snapshots.at(-1)||null;renderRead();await refresh();const unfinished=jobs.filter(j=>j.status!=='completed');if(unfinished.length)status('studyError','发现 '+unfinished.length+' 个可续跑任务；选择任务后点击断点续跑，不会重复计数。')}catch(e){status('studyError','研究存储不可用：'+e.message)}controls()})();
})();
