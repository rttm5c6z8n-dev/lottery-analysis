// Integration fixture comes from the original third-party source; never a production cache.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8000/v27.html');assert.match(await page.locator('#status').innerText(),/未找到/);assert(await page.locator('#export').isDisabled());
 const fixture=JSON.parse(fs.readFileSync('/tmp/v27-third-party.json','utf8')).map(x=>({period:String(x.issue),date:x.date,nums:[...x.front,...x.back].map(Number)}));
 const storage={lottery_v2_dlt:JSON.stringify(fixture),lottery_v17_forward_records_1:'[{"fixture":"locked-sentinel"}]',lottery_v21_logs:'[]',lottery_v2_3d:'[]'};
 await page.evaluate(values=>{for(const [k,v] of Object.entries(values))localStorage.setItem(k,v)},storage);
 await page.addInitScript(()=>{Storage.prototype.setItem=Storage.prototype.removeItem=Storage.prototype.clear=()=>{throw Error('Forbidden storage mutation')}});
 await page.reload();const before=await page.evaluate(()=>({...localStorage}));
 await page.locator('#refresh').click();assert.equal(await page.locator('#years tbody tr').count(),20);assert.equal(await page.locator('#latest tbody tr').count(),5);
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;await download.saveAs('/tmp/v27-report.csv');
 assert.match(fs.readFileSync('/tmp/v27-report.csv','utf8'),/休市不认证号码/);assert.deepEqual(await page.evaluate(()=>({...localStorage})),before);assert.deepEqual(before,storage);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'/tmp/v27-mobile.png',fullPage:true});
 console.log(await page.locator('#status').innerText());console.log(await page.locator('#stats').innerText());console.log(await page.locator('#gapStatus').innerText());
 assert.deepEqual(errors,[]);
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'/tmp/v27-desktop.png',fullPage:true});
 // Corrupt/missing caches clear previously rendered totals and disable exports.
 await page.evaluate(()=>{Object.defineProperty(Storage.prototype,'getItem',{value:()=>'{bad json'})});await page.locator('#refresh').click();assert(await page.locator('#export').isDisabled());assert.equal(await page.locator('#stats').innerText(),'暂无结果');
 console.log('Browser passed: mobile/desktop, CSV download, no writes to any storage key, error handling.');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
