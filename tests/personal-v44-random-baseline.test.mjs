import assert from 'node:assert/strict';
import{simulateFixedFive}from '../personal/v44-random-baseline.mjs';
const original=[
 {nums:[2,7,25,26,31,5,9]},
 {nums:[2,6,25,26,31,5,9]},
 {nums:[2,7,25,26,33,5,9]},
 {nums:[2,7,25,26,32,5,9]},
 {nums:[7,10,20,25,26,5,9]}
];
const draw={front:[2,12,14,17,33],back:[7,8]};
const a=simulateFixedFive({picks:original,actualDraw:draw,rounds:10000,seed:20261112});
const b=simulateFixedFive({picks:original,actualDraw:draw,rounds:10000,seed:20261112});
assert.deepEqual(a,b,'固定随机种子应该完全可复现');
assert.equal(a.histogram.reduce((x,y)=>x+y,0),10000);
assert.equal(a.distinctBackPairs,1,'后区相同不能当成5个独立后区实验');
assert.equal(a.observed.bestFront,2);
assert.equal(a.observed.bestBack,0);
assert.equal(a.observed.exact,0);
assert.equal(a.exactJackpotProbability,5/21425712);
assert(a.meanBestFront>0.5&&a.meanBestFront<5);
assert(a.observed.empiricalTail>0&&a.observed.empiricalTail<=1);
assert.equal(simulateFixedFive({picks:original,rounds:100,seed:1}).observed,null);
assert.throws(()=>simulateFixedFive({picks:original.slice(0,4)}),/完整/);
assert.throws(()=>simulateFixedFive({picks:[original[0],original[0],...original.slice(2)]}),/重复/);
assert.throws(()=>simulateFixedFive({picks:original,rounds:10}),/100/);
assert.throws(()=>simulateFixedFive({picks:original,actualDraw:{front:[2,2,3,4,5],back:[1,2]}}),/不重复/);
console.log('V4.4 fixed five-ticket baseline Monte Carlo deterministic tests passed');
