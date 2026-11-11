// Public announcement discovery. A notice title proves a publication exists,
// NOT that the 7 winning numbers were independently verified.
const PATTERN=/超级大乐透游戏第\s*([0-9]{5})\s*期开奖公告/g;
export function extractDltBulletins(html){
 if(typeof html!=='string'||html.length>2_000_000)throw Error('官网公告文本不合法或过大');
 const entries=new Map();
 for(const match of html.matchAll(PATTERN)){
  const period=match[1],position=match.index||0;
  const leading=html.slice(Math.max(0,position-750),position);
  // Only trust explicit nearby official-site links, never a third-party URL.
  let link=null;
  const hits=[...leading.matchAll(/href\s*=\s*["']([^"'<>]{1,400})["']/gi)];
  for(const item of hits.slice(-3).reverse()){
   const href=item[1];
   if(/^\/newsDetail\/070100\/[0-9]+(?:\?[^"'<>]*)?$/.test(href)){link='https://www.gstc.org.cn'+href;break}
   if(/^https:\/\/www\.gstc\.org\.cn\/newsDetail\/070100\/[0-9]+(?:\?[^"'<>]*)?$/.test(href)){link=href;break}
  }
  entries.set(period,{period,title:'超级大乐透游戏第'+period+'期开奖公告',link});
 }
 return [...entries.values()].sort((a,b)=>Number(b.period)-Number(a.period));
}
export function tentativeNextPeriod(latestPublished){
 if(!/^\d{5}$/.test(String(latestPublished||'')))return null;
 const year=Number(String(latestPublished).slice(0,2)),seq=Number(String(latestPublished).slice(2));
 if(seq<=0||seq>=199||year<7)return null;
 return String(year).padStart(2,'0')+String(seq+1).padStart(3,'0');
}
export function nextRegularDrawDate(startIso){
 // Monday, Wednesday, Saturday in Beijing, no holiday/cancellation inference.
 if(!/^\d{4}-\d\d-\d\d$/.test(String(startIso||'')))return null;
 const d=new Date(startIso+'T00:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==startIso)return null;
 for(let i=1;i<=7;i++){
  d.setUTCDate(d.getUTCDate()+1);
  if([1,3,6].includes(d.getUTCDay()))return d.toISOString().slice(0,10);
 }
 return null;
}
