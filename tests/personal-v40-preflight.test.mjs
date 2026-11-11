import assert from 'node:assert/strict';
import{latestLocalHistory,describeFivePicks,preflightTarget}from '../personal/v40-preflight.mjs';
import{chooseResult,bridgeRecord}from '../personal/v40-core.mjs';
const model={id:'r',version:'BC-exhaustive-3.1',generatedAt:'2026-11-11T06:32:54Z',throughPeriod:'26128',picks:[
 {nums:[2,7,25,26,31,5,9]},
 {nums:[2,6,25,26,31,5,9]},
 {nums:[2,7,25,26,33,5,9]},
 {nums:[2,7,25,26,32,5,9]},
 {nums:[7,10,20,25,26,5,9]}
]};
const history=latestLocalHistory(JSON.stringify([{period:'26128',nums:[3,13,20,25,34,9,12],date:'2026-11-09'}]));
assert.equal(history.latest,'26128');
const concentration=describeFivePicks(model);
assert.equal(concentration.distinctBackPairs,1);
assert.equal(concentration.tickets,5);
assert.equal(concentration.uniqueFrontNumbers,11);
const args={result:model,period:'26130',drawAt:'2026-11-14T20:30:00+08:00',now:'2026-11-11T14:30:00Z',history};
assert.equal(preflightTarget(args).ok,true);
assert.equal(preflightTarget({...args,period:'26128'}).ok,false);
assert.equal(preflightTarget({...args,period:'26129',history:{...history,latest:'26129'}}).ok,false);
assert.equal(preflightTarget({...args,drawAt:'2026-11-11T20:30:00+08:00'}).ok,false);
assert.equal(preflightTarget({...args,history:{state:'invalid'}}).ok,false);
assert(preflightTarget({...args,history:{...history,latest:'26129'}}).warnings.some(x=>x.includes('旧模型')));
const selected=chooseResult([model],'r',0);
assert.throws(()=>bridgeRecord({result:selected,period:'26128',now:args.now,drawAt:args.drawAt,sourceUrl:'https://www.sport.gov.cn/notice'}),/历史截止/);
console.log('Model history and future draw preflight checks passed');
