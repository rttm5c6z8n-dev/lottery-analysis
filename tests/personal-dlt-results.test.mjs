import assert from 'node:assert/strict';
import{parseOfficialHistoryHtml,parseOfficialLatestHtml,officialResultResponse,sameDraw}from '../personal/dlt-results-core.mjs';
const history=`<html><body><h2>超级大乐透历史开奖数据</h2><table><tr><th>开奖日期</th><th>开奖期次</th><th>开奖号码</th></tr>
<tr><td>2026-11-11</td><td>26129</td><td>02121417330708</td></tr>
<tr><td>2026-11-09</td><td>26128</td><td><span>03</span><span>13</span><span>20</span><span>25</span><span>34</span><span>09</span><span>12</span></td></tr>
<tr><td>2026-11-07</td><td>26127</td><td>05061718270312</td></tr>
</table>当前第 1 / 58 页</body></html>`;
const latest=`<section><div>超级大乐透</div><b>26129</b><span>期</span>开奖日期：2026-11-11 开奖日：每周一、三、六 开奖号码： 02 12 14 17 33 07 08 奖池：7.76亿元</section>`;
const parsed=parseOfficialHistoryHtml(history);
assert.equal(parsed.length,3);
assert.deepEqual(parsed.map(x=>x.period),['26129','26128','26127']);
assert.deepEqual(parsed[0].front,[2,12,14,17,33]);
assert.deepEqual(parsed[0].back,[7,8]);
assert.deepEqual(parsed[1].front,[3,13,20,25,34]);
const newest=parseOfficialLatestHtml(latest);
assert(newest);
assert.equal(newest.period,'26129');
assert(sameDraw(parsed[0],newest));
const result=officialResultResponse(history,latest,'2026-11-11T23:00:00+08:00');
assert.equal(result.crossPageAgreement,true);
assert.equal(result.verifiedByIndependentPublisher,false);
assert.equal(result.records.length,3);
assert.equal(officialResultResponse(history,latest.replace('07 08','07 09'),'2026-11-11T23:00:00+08:00').crossPageAgreement,false);
assert.equal(officialResultResponse(history,null,'2026-11-11T23:00:00+08:00').crossPageAgreement,false);
assert.throws(()=>officialResultResponse('<p>no draw here</p>',latest,'x'),/未解析出/);
assert.equal(parseOfficialHistoryHtml(history.replace('02121417330708','02121417330707')).some(x=>x.period==='26129'),false);
assert.equal(parseOfficialLatestHtml(latest.replace('26129','25129')),null);
assert.throws(()=>parseOfficialHistoryHtml('x'.repeat(2000001)),/过大/);
console.log('Official DLT history parsing, validation and cross-page agreement tests passed');
