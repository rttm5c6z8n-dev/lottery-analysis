import{parseMachineBulletin}from '../../personal/v45-ballset-core.mjs';
const known={
 '26129':'https://api.js-lottery.com/cms/post-148233.html',
 '26128':'https://www.js-lottery.com/cms/post-148224.html'
};
const headers={'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'};
export async function onRequestGet({request}){
 const url=new URL(request.url),period=url.searchParams.get('period');
 if(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)return Response.json({error:'拒绝跨站请求'},{status:403,headers});
 if(!/^\d{5}$/.test(period||'')||Number(period)<26001||Number(period)>26199)return Response.json({error:'当前自动采集仅支持2026年明确范围内的已开奖期号'},{status:400,headers});
 const source=known[period]||'https://www.gdlottery.cn/f_html/kjgg/P085_'+period+'.html';
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),9000);
 try{
  const fetched=await fetch(source,{signal:ctl.signal,headers:{Accept:'text/html'},redirect:'follow',cf:{cacheTtl:0}});
  if(!fetched.ok)throw Error('官方公告HTTP '+fetched.status);
  if(!fetched.headers.get('content-type')?.toLowerCase().includes('html'))throw Error('官网未返回HTML格式公告');
  const html=await fetched.text();
  const parsed=parseMachineBulletin(html,period,source);
  return Response.json({...parsed,readAt:new Date().toISOString(),officialPublisherCrossCheck:false,
   notice:'球组是该期开奖后公开的信息，不表示能在未来开奖前预测球组选择。请和官网原文核实。'},{headers});
 }catch(e){
  return Response.json({error:'无法验证第'+period+'期球组公告：'+String(e.message||e),source,
   stored:false,note:'公告未获取或结构已变化，不猜测球组和出球顺序，也不写入历史库。'},
  {status:503,headers});
 }finally{clearTimeout(timer)}
}
