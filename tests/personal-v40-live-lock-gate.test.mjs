import assert from 'node:assert/strict';
import{verifyLiveLockGate}from '../personal/v40-live-lock-gate.mjs';
const draw={period:'26129',date:'2026-11-11',front:[2,12,14,17,33],back:[7,8]};
const payload={records:[draw],latestPeriod:'26129',latestDate:'2026-11-11',checkedAt:'2026-11-12T00:00:00Z',
 crossPageAgreement:true,source:'https://www.gstc.org.cn/wanfa/dlt_history',
 diagnostics:{agreement:'same-site-match'}};
const input={payload,period:'26130',drawAt:'2026-11-14T20:30:00+08:00',now:'2026-11-12T00:01:00Z'};
const verified=verifyLiveLockGate(input);
assert.equal(verified.latestPublished,'26129');
assert.equal(verified.period,'26130');
assert.equal(verified.officialNextIssueConfirmed,false);
assert.equal(verified.officialScheduleConfirmed,false);
assert.throws(()=>verifyLiveLockGate({...input,period:'26129'}),/不是官网最新开奖/);
assert.throws(()=>verifyLiveLockGate({...input,period:'26131'}),/不是官网最新开奖/);
assert.throws(()=>verifyLiveLockGate({...input,payload:{...payload,latestPeriod:'26130',latestDate:'2026-11-14',
 records:[{...draw,period:'26130',date:'2026-11-14'}]}}),/期号和历史记录不一致|不是官网最新开奖/);
assert.throws(()=>verifyLiveLockGate({...input,payload:{...payload,crossPageAgreement:false}}),/未获同站双页面/);
assert.throws(()=>verifyLiveLockGate({...input,payload:{...payload,checkedAt:'2026-11-11T23:50:00Z'}}),/刚刚/);
assert.throws(()=>verifyLiveLockGate({...input,payload:{...payload,checkedAt:'2026-11-12T00:03:00Z'}}),/刚刚/);
assert.throws(()=>verifyLiveLockGate({...input,drawAt:'2026-11-14T20:30:00Z'}),/北京时间/);
assert.throws(()=>verifyLiveLockGate({...input,drawAt:'2026-11-16T20:30:00+08:00'}),/常规开奖日/);
assert.throws(()=>verifyLiveLockGate({...input,now:'2026-11-14T13:00:00Z',payload:{...payload,checkedAt:'2026-11-14T13:00:00Z'}}),/计划开奖时间已到/);
console.log('V4.0 official live lock gate: fresh agreement, stale, past, wrong issue, timezone checks passed');
