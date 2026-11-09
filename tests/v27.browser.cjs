// Integration fixture comes from the original third-party source; never a production cache.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const done=()=>page.waitForFunction(()=>document.getElementById('status').getAttribute('aria-busy')==='false');
 await page.goto('http://127.0.0.1:8000/v27.html');await done();assert.match(await page.locator('#status').innerText(),/未找到/);assert(await page.locator('#export').isDisabled());
 const fixture=JSON.parse(fs.readFileSync('/tmp/v27-third-party.json','utf8')).map(x=>({period:String(x.issue),date:x.date,nums:[...x.front,...x.back].map(Number)}));
 const storage={lottery_v2_dlt:JSON.stringify(fixture),lottery_v17_forward_records_1:'[{"fixture":"locked-sentinel"}]',lottery_v21_logs:'[]',lottery_v2_3d:'[]'};
 await page.evaluate(values=>{for(const [k,v] of Object.entries(values))localStorage.setItem(k,v)},storage);
 await page.addInitScript(()=>{Storage.prototype.setItem=Storage.prototype.removeItem=Storage.prototype.clear=()=>{throw Error('Forbidden storage mutation')}});
 await page.reload();await done();const before=await page.evaluate(()=>({...localStorage}));
 await page.locator('#refresh').click();await done();assert.equal(await page.locator('#years tbody tr').count(),20);assert.equal(await page.locator('#latest tbody tr').count(),5);
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;await download.saveAs('/tmp/v27-report.csv');
 assert.match(fs.readFileSync('/tmp/v27-report.csv','utf8'),/休市不认证号码/);assert.deepEqual(await page.evaluate(()=>({...localStorage})),before);assert.deepEqual(before,storage);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'/tmp/v27-mobile.png',fullPage:true});
 assert.equal(await page.locator('#status').innerText(),'核验完成，本次数据无变化');
 assert.match(await page.locator('#runDetails').innerText(),/完成时间：.+本次核验记录数量：2945 条/);
 // Count both reads and full analysis calls, and observe running state synchronously.
 await page.evaluate(()=>{globalThis.calls={reads:0,analyses:0};const get=Storage.prototype.getItem,analyze=V27.analyze;Storage.prototype.getItem=function(k){calls.reads++;return get.call(this,k)};V27.analyze=function(data){calls.analyses++;return analyze(data)};document.getElementById('refresh').click()});
 assert(await page.locator('#status').getAttribute('aria-busy')==='true');await done();
 assert.deepEqual(await page.evaluate(()=>calls),{reads:1,analyses:1});
 assert.equal(await page.locator('#status').innerText(),'核验完成，本次数据无变化');
 console.log(await page.locator('#status').innerText());console.log(await page.locator('#stats').innerText());console.log(await page.locator('#gapStatus').innerText());
 assert.deepEqual(errors,[]);
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'/tmp/v27-desktop.png',fullPage:true});
 // Inject changed read results without writing any stored data.
 await page.evaluate(()=>{globalThis.actualRead=Storage.prototype.getItem;const changed=JSON.parse(actualRead.call(localStorage,'lottery_v2_dlt'));changed.pop();Storage.prototype.getItem=()=>JSON.stringify(changed)});
 await page.locator('#refresh').click();await done();assert.equal(await page.locator('#status').innerText(),'核验完成，本次数据有变化');assert.match(await page.locator('#runDetails').innerText(),/总记录 2945 → 2944/);
 await page.evaluate(()=>{Storage.prototype.getItem=actualRead});await page.locator('#refresh').click();await done();assert.match(await page.locator('#runDetails').innerText(),/总记录 2944 → 2945/);
 assert.deepEqual(await page.evaluate(()=>({...localStorage})),storage);
 // Corrupt/missing caches clear previously rendered totals and disable exports.
 await page.evaluate(()=>{Object.defineProperty(Storage.prototype,'getItem',{value:()=>'{bad json'})});await page.locator('#refresh').click();await done();assert.match(await page.locator('#status').innerText(),/核验失败：历史缓存 JSON 解析失败/);assert(await page.locator('#export').isDisabled());assert.equal(await page.locator('#stats').innerText(),'暂无结果');
 console.log('Browser passed: actual read/analyze invocation, running state, unchanged and changed results, completion metadata, JSON error, mobile/desktop, CSV download, no writes to any storage key, error handling.');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
