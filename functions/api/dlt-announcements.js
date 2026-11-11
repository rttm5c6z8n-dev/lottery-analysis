import{extractDltBulletins,tentativeNextPeriod}from '../../personal/dlt-official-core.mjs';
const SOURCE='https://www.gstc.org.cn/newsList/070100';
export async function onRequestGet({request}){
 const origin=new URL(request.url).origin;
 if(request.headers.get('origin')&&request.headers.get('origin')!==origin)return Response.json({error:'不允许跨站调用'},{status:403,headers:{'Cache-Control':'no-store'}});
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),6500);
 try{
  const res=await fetch(SOURCE,{headers:{'Accept':'text/html','User-Agent':'LotteryResearchReadOnly/1.0'},redirect:'follow',signal:controller.signal,cf:{cacheTtl:180,cacheEverything:false}});
  if(!res.ok)throw Error('官方公告站点返回HTTP '+res.status);
  if(!res.headers.get('content-type')?.includes('html'))throw Error('公告源没有返回HTML');
  const html=await res.text();
  if(html.length>2_000_000)throw Error('公告源内容过大');
  const announcements=extractDltBulletins(html).slice(0,12);
  if(!announcements.length)throw Error('未从官方页面识别出大乐透公告；网站结构可能变化');
  const latest=announcements[0];
  return Response.json({source:SOURCE,sourceType:'provincial-sports-lottery-official-website',observedAt:new Date().toISOString(),
   latestPublished:latest.period,latestBulletin:latest,
   tentativeNextPeriod:tentativeNextPeriod(latest.period),
   announcements,
   officialWinningNumbersVerified:false,
   officialNextDrawScheduleVerified:false,
   note:'仅识别官网公告标题里的已发布期号；下一期号码是按顺序推算的候选值，不含官方下期确认、休市核实或开奖号码。请自行核实。'},
   {headers:{'Cache-Control':'public, max-age=90','Content-Type':'application/json;charset=utf-8'}});
 }catch(e){
  return Response.json({error:e.message,source:SOURCE,officialWinningNumbersVerified:false,officialNextDrawScheduleVerified:false,
   note:'自动获取失败。没有使用缓存或猜测替代官方信息；请手动打开官方页面核对。'},
   {status:503,headers:{'Cache-Control':'no-store'}});
 }finally{clearTimeout(timeout)}
}
