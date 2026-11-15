import{VERSION}from '../../personal/v31-core.mjs';
import{V50_SEARCH_VERSION,candidateBatch}from '../../personal/v50-search-core.mjs';
export async function onRequestPost({request}){
 try{
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'不接受跨站计算请求'},{status:403});
  if(!request.headers.get('content-type')?.includes('application/json'))throw Error('需要JSON参数');
  const body=await request.text();if(body.length>200000)throw Error('请求超过200KB');
  const input=JSON.parse(body);
  if(input.searchVersion!==V50_SEARCH_VERSION)throw Error('V5.0搜索版本不匹配');
  const canonical=JSON.stringify(input.config);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
  const configDigest=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
  const result=candidateBatch(input.config,input.startFront,input.candidates||[],256);
  return Response.json({version:VERSION,searchVersion:V50_SEARCH_VERSION,configDigest,...result},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e.message},{status:400,headers:{'Cache-Control':'no-store'}})}
}
