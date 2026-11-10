import {prepare,validationStep}from'./v31-core.mjs';
onmessage=({data})=>{try{postMessage({id:data.id,value:data.kind==='train'?prepare(data.rows):validationStep(data.job,data.rows)})}catch(e){postMessage({id:data.id,error:e.message})}};
