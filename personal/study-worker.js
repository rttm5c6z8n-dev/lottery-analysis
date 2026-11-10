'use strict';
importScripts('core.js','study-core.js','v3-core.js');
let snapshot;
onmessage = ({data}) => {
  try {if(data.snapshot)snapshot=data.snapshot;postMessage({id:data.id,value:data.kind==='export'?JSON.stringify(data.exportData,null,2):data.kind==='simulate'||data.kind==='v3formal'?V3.generate(data.rows):Study.batch(data.job,snapshot)})}
  catch(e) {postMessage({id:data.id,error:e.name+': '+e.message})}
};
