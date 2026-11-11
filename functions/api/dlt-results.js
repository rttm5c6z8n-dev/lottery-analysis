import{HISTORY_URL,LATEST_URL,officialResultResponse}from '../../personal/dlt-results-core.mjs';
const safeHeaders={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'};
async function fetchOfficial(url,signal){
 const res=await fetch(url,{signal,redirect:'follow',headers:{Accept:'text/html'},cf:{cacheTtl:0}});
 if(!res.ok)throw Error('官方页面 '+new URL(url).pathname+' HTTP '+res.status);
 if(!res.headers.get('content-type')?.toLowerCase().includes('html'))throw Error('官方页面非HTML，停止自动解析');
 const html=await res.text();
 if(html.length>2_000_000)throw Error('官方页面内容过大');
 return html;
}
export async function onRequestGet({request}){
 const url=new URL(request.url);
 if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return Response.json({error:'不接受跨站请求'},{status:403,headers:safeHeaders});
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),8000);
 try{
  const history=await fetchOfficial(HISTORY_URL,controller.signal);
  // The secondary page is a corroboration check, not required to return raw history records.
  const latest=await fetchOfficial(LATEST_URL,controller.signal).catch(()=>null);
  const data=officialResultResponse(history,latest,new Date().toISOString());
  return Response.json(data,{headers:safeHeaders});
 }catch(e){
  return Response.json({error:'官方历史开奖结果查询失败：'+(e?.message||String(e)),
   source:HISTORY_URL,records:[],crossPageAgreement:false,
   note:'未猜测也未缓存号码。不会修改本机历史或预测记录。'},
  {status:503,headers:safeHeaders});
 }finally{clearTimeout(timeout)}
}
