export const DB_NAME='lottery_personal_v31';
export const LOCAL_KEY='lottery_v38_predictions';
export function inspectPredictionText(raw){
 if(raw===null)return {state:'empty',count:0,verified:0,message:'未发现V3.8本机预测记录（不代表历史库丢失）'};
 let data;
 try{data=JSON.parse(raw)}catch{return {state:'error',count:0,verified:0,message:'预测记录格式异常；请勿清除网站数据或尝试覆盖'}};
 if(!Array.isArray(data))return{state:'error',count:0,verified:0,message:'预测记录结构异常；为保护数据，请勿写入'};
 return{state:'ok',count:data.length,verified:data.filter(x=>x&&x.verification).length,message:'预测记录读取成功'};
}
export function readV31StoreCounts(idb){
 return new Promise((resolve,reject)=>{
  if(!idb){reject(Error('当前浏览器不支持IndexedDB'));return}
  let created=false,settled=false;
  const q=idb.open(DB_NAME);
  function fail(e){if(!settled){settled=true;reject(e)}}
  q.onupgradeneeded=()=>{created=true;q.transaction.abort()};
  q.onerror=()=>{
   const name=q.error?.name||'未知错误';
   fail(Error(created?'未发现原V3.1数据库；未新建任何研究数据':'无法读取研究数据库：'+name))
  };
  q.onblocked=()=>fail(Error('研究数据库被其他标签页占用'));
  q.onsuccess=()=>{
   if(settled){q.result.close();return}
   const db=q.result;
   db.onversionchange=()=>db.close();
   const stores=['snapshots','trains','reports','results','searches'];
   const available=stores.filter(n=>db.objectStoreNames.contains(n));
   if(!available.length){db.close();fail(Error('研究库没有可识别的数据表'));return}
   const counts={};
   try{
    const tx=db.transaction(available,'readonly');
    for(const name of available){
     const request=tx.objectStore(name).count();
     request.onsuccess=()=>counts[name]=request.result;
    }
    tx.oncomplete=()=>{db.close();if(!settled){settled=true;resolve(counts)}};
    tx.onabort=()=>{db.close();fail(Error('只读检查事务中断'))};
   }catch(e){db.close();fail(e)}
  };
 });
}
