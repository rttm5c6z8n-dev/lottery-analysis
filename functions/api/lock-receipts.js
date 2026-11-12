import{HISTORY_URL,LATEST_URL,officialResultResponse}from '../../personal/dlt-results-core.mjs';
import{assessOfficialDrawPayload}from '../../personal/v42-official-check.mjs';
import{validateReceiptRequest,validateReceiptData}from '../../personal/v40-server-receipt-core.mjs';
const headers={'Cache-Control':'no-store','Content-Type':'application/json;charset=utf-8'};
function respond(data,status=200){return Response.json(data,{status,headers})}
function dbFrom(context){
 const db=context.env?.LOCK_DB;
 if(!db||typeof db.prepare!=='function')throw Object.assign(new Error('服务器尚未绑定独立D1存储LOCK_DB，不能签发持久化回执'),{code:'STORAGE_NOT_CONFIGURED'});
 return db;
}
function sameOrigin(request){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 return !origin||origin===url.origin;
}
async function html(url,signal){
 const response=await fetch(url,{signal,redirect:'follow',headers:{Accept:'text/html'},cf:{cacheTtl:0}});
 if(!response.ok)throw Error('体彩官网HTTP '+response.status);
 if(!response.headers.get('content-type')?.toLowerCase().includes('html'))throw Error('体彩官网内容不是HTML');
 const content=await response.text();if(content.length>2000000)throw Error('体彩官网返回过大页面');
 return content;
}
async function currentOfficial(now,signal){
 const [history,latest]=await Promise.all([html(HISTORY_URL,signal),html(LATEST_URL,signal)]);
 const payload=officialResultResponse(history,latest,now);
 const quality=assessOfficialDrawPayload(payload,now);
 if(!quality.canPrefill)throw Error('体彩官网两处最新开奖号未通过同站一致性检查：'+quality.status);
 return quality.latest;
}
export async function onRequestPost(context){
 const{request}=context;
 if(!sameOrigin(request))return respond({error:'拒绝跨站提交',code:'CROSS_ORIGIN'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return respond({error:'仅支持JSON提交',code:'BAD_REQUEST'},400);
 let db;
 try{db=dbFrom(context)}catch(e){return respond({error:e.message,code:e.code},503)}
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),10000);
 try{
  const raw=await request.text();
  if(raw.length>2048)throw Error('提交内容超过2KB');
  let input;try{input=JSON.parse(raw)}catch{throw Error('JSON格式错误')}
  const now=new Date().toISOString();
  const latest=await currentOfficial(now,ctl.signal);
  const normalized=validateReceiptRequest(input,latest,new Date().toISOString());
  const id=crypto.randomUUID(),receivedAt=new Date().toISOString();
  if(Date.parse(receivedAt)>=Date.parse(normalized.plannedDrawAt))throw Error('数据库写入前开奖时间已到，已拒绝提交');
  const written=await db.prepare('INSERT INTO lock_receipts (id,period,digest,scope,planned_draw_at,received_at,latest_official_period,latest_official_date,source_url) VALUES (?,?,?,?,?,?,?,?,?)')
   .bind(id,normalized.period,normalized.digest,normalized.scope,normalized.plannedDrawAt,receivedAt,normalized.latestOfficialPeriod,normalized.latestOfficialDate,HISTORY_URL).run();
  if(written?.success!==true)throw Error('D1没有确认数据库写入成功，拒绝签发回执');
  return respond({receipt:validateReceiptData({id,period:normalized.period,digest:normalized.digest,scope:normalized.scope,
   planned_draw_at:normalized.plannedDrawAt,received_at:receivedAt,latest_official_period:normalized.latestOfficialPeriod,
   latest_official_date:normalized.latestOfficialDate,source_url:HISTORY_URL}),persisted:true,thirdPartyNotarization:false},201);
 }catch(e){
  return respond({error:'服务器留档失败：'+String(e?.message||e),code:ctl.signal.aborted?'TIMEOUT':'RECEIPT_REJECTED',
   persisted:false},503);
 }finally{clearTimeout(timer)}
}
export async function onRequestGet(context){
 const{request}=context;
 if(!sameOrigin(request))return respond({error:'拒绝跨站查询',code:'CROSS_ORIGIN'},403);
 const id=new URL(request.url).searchParams.get('id');
 if(!/^[0-9a-f-]{36}$/i.test(id||''))return respond({error:'必须提供有效的回执ID',code:'BAD_ID'},400);
 let db;try{db=dbFrom(context)}catch(e){return respond({error:e.message,code:e.code},503)}
 try{
  const row=await db.prepare('SELECT id,period,digest,scope,planned_draw_at,received_at,latest_official_period,latest_official_date,source_url FROM lock_receipts WHERE id=?').bind(id).first();
  if(!row)return respond({error:'服务器没有找到该回执',code:'NOT_FOUND'},404);
  return respond({receipt:validateReceiptData(row),persisted:true,thirdPartyNotarization:false});
 }catch(e){return respond({error:'服务器回执查询失败：'+e.message,code:'STORAGE_ERROR'},503)}
}
