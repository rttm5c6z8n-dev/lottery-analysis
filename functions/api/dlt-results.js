import{HISTORY_URL,LATEST_URL,officialResultResponse}from '../../personal/dlt-results-core.mjs';
const safeHeaders={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'};
async function fetchOfficial(url,signal){
 const response=await fetch(url,{signal,redirect:'follow',headers:{Accept:'text/html,application/xhtml+xml'},cf:{cacheTtl:0}});
 if(!response.ok)throw Error(new URL(url).pathname+' HTTP '+response.status);
 const type=response.headers.get('content-type')?.toLowerCase()||'';
 if(!type.includes('html'))throw Error(new URL(url).pathname+' 非HTML响应：'+type);
 const html=await response.text();
 if(html.length>2_000_000)throw Error(new URL(url).pathname+' 页面超过大小限制');
 return html;
}
export async function onRequestGet({request}){
 const url=new URL(request.url);
 if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return Response.json({error:'不接受跨站请求',code:'CROSS_ORIGIN'},{status:403,headers:safeHeaders});
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),11000);
 try{
  const [historyResult,latestResult]=await Promise.allSettled([fetchOfficial(HISTORY_URL,controller.signal),fetchOfficial(LATEST_URL,controller.signal)]);
  if(historyResult.status!=='fulfilled')throw Error('历史开奖页获取失败：'+String(historyResult.reason?.message||historyResult.reason));
  const latest=latestResult.status==='fulfilled'?latestResult.value:null;
  let data;
  try{data=officialResultResponse(historyResult.value,latest,new Date().toISOString(),url.searchParams.get('all')==='1'?5000:25)}
  catch(e){return Response.json({error:'官网历史开奖解析失败：'+e.message,code:'PARSE_ERROR',source:HISTORY_URL,records:[],crossPageAgreement:false,verifiedByIndependentPublisher:false},{status:503,headers:safeHeaders})}
  const diagnostics={historyPage:'ok',latestPage:latestResult.status==='fulfilled'?'ok':'unavailable',latestPageError:latestResult.status==='rejected'?String(latestResult.reason?.message||latestResult.reason):null,agreement:data.crossPageAgreement?'same-site-match':'unconfirmed'};
  return Response.json({...data,diagnostics},{headers:safeHeaders});
 }catch(e){
  const timedOut=controller.signal.aborted;
  return Response.json({error:(timedOut?'官方查询超时：':'官网获取失败：')+String(e?.message||e),code:timedOut?'UPSTREAM_TIMEOUT':'UPSTREAM_UNAVAILABLE',
   source:HISTORY_URL,records:[],crossPageAgreement:false,verifiedByIndependentPublisher:false,
   note:'没有使用旧缓存或猜测号码；不会修改本机历史数据和预测记录。'},
   {status:503,headers:safeHeaders});
 }finally{clearTimeout(timeout)}
}
