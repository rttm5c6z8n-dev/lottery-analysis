import assert from 'node:assert/strict';import{adjustHolm,inspectHistory,yearlyReview}from '../personal/v34-core.mjs';
assert.deepEqual(adjustHolm([{pValue:.01},{pValue:.04},{pValue:.03},{pValue:null}]),[.03,.06,.06,null]);
const rows=[];for(let i=1;i<=35;i++)rows.push({period:'24'+String(i).padStart(3,'0'),date:'2024-01-01',nums:[1,2,3,4,5,6,7]});
assert.equal(inspectHistory(rows).valid,35);
assert.equal(yearlyReview(rows,0,100).years.length,1);
const gap=[rows[0],rows[2]];assert.equal(inspectHistory(gap).byYear[0].missingCandidateCount,1);
console.log('V3.4 tests passed');
