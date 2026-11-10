'use strict';
importScripts('core.js','study-core.js');
let snapshot;
onmessage = ({data}) => {
  try {if(data.snapshot)snapshot=data.snapshot;postMessage({id:data.id,value:data.kind==='export'?JSON.stringify(data.exportData,null,2):data.kind==='simulate'?Research.generate(data.rows,data.seed):Study.batch(data.job,snapshot)})}
  catch(e) {postMessage({id:data.id,error:e.name+': '+e.message})}
};
