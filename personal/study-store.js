'use strict';
const StudyStore = (() => {
  let db;
  const names=['snapshots','jobs','models','reports','simulations','chunks'];
  function open() {return new Promise((resolve,reject)=>{if(!globalThis.indexedDB)return reject(Error('IndexedDB不可用；不在内存中假装保存'));const q=indexedDB.open('lottery_personal_bc_stage2',1);q.onupgradeneeded=()=>names.forEach(n=>q.result.createObjectStore(n));q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('独立研究库被其他页面阻塞'));q.onsuccess=()=>{db=q.result;db.onversionchange=()=>db.close();resolve()}})}
  function all(name) {return new Promise((resolve,reject)=>{const tx=db.transaction(name),q=tx.objectStore(name).getAll();tx.oncomplete=()=>resolve(q.result.sort((a,b)=>Date.parse(a.createdAt||a.at||a.completedAt||a.generatedAt||a.savedAt)-Date.parse(b.createdAt||b.at||b.completedAt||b.generatedAt||b.savedAt)));tx.onabort=()=>reject(tx.error||Error('读取事务中断'))})}
  function add(name,value) {return new Promise((resolve,reject)=>{const tx=db.transaction(name,'readwrite');tx.objectStore(name).add(value,value.id);tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error||Error('保存事务中断，原数据保留'));tx.onerror=()=>{}})}
  function commit(result,artifact) {return new Promise((resolve,reject)=>{
    const {job,start,items}=result,stores=['jobs','chunks'];if(artifact)stores.push(job.type==='train'?'models':'reports');
    const tx=db.transaction(stores,'readwrite');let reason;
    const q=tx.objectStore('jobs').get(job.id);
    q.onsuccess=()=>{if(!q.result||q.result.cursor!==start){reason=Error('其他页面已推进此任务，请刷新恢复');tx.abort();return}tx.objectStore('jobs').put(job,job.id);if(items.length)tx.objectStore('chunks').add({id:job.id+':'+start,jobId:job.id,start,items},job.id+':'+start);if(artifact)tx.objectStore(job.type==='train'?'models':'reports').add(artifact,artifact.id)};
    tx.oncomplete=()=>resolve(job);tx.onabort=()=>reject(reason||tx.error||Error('事务保存失败；本批未提交，进度未前移'));tx.onerror=()=>{};
  })}
  return {open,all,add,commit,names};
})();
