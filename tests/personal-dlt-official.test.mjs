import assert from 'node:assert/strict';
import{extractDltBulletins,tentativeNextPeriod,nextRegularDrawDate}from '../personal/dlt-official-core.mjs';
const html=`<div><a href="/newsDetail/070100/80717">超级大乐透游戏第26128期开奖公告</a></div>
<div><a href="/newsDetail/070100/80726">超级大乐透游戏第26129期开奖公告</a></div>
<div><a href="/newsDetail/070100/80726">超级大乐透游戏第26129期开奖公告</a></div>
<div><a href="/newsDetail/100100/88888">7星彩游戏第26129期开奖公告</a></div>`;
const x=extractDltBulletins(html);
assert.deepEqual(x.map(r=>r.period),['26129','26128']);
assert.equal(x[0].link,'https://www.gstc.org.cn/newsDetail/070100/80726');
assert.equal(tentativeNextPeriod(x[0].period),'26130');
assert.equal(nextRegularDrawDate('2026-11-11'),'2026-11-14');
assert.equal(nextRegularDrawDate('2026-11-14'),'2026-11-16');
assert.equal(tentativeNextPeriod('26199'),null);
assert.equal(tentativeNextPeriod('bad'),null);
assert.throws(()=>extractDltBulletins('x'.repeat(2000001)),/过大/);
console.log('Official-title discovery and tentative-period tests passed');
