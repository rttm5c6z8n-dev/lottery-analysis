import assert from 'node:assert/strict';
import{runSelfTests}from '../personal/browser-self-test.mjs';
const report=runSelfTests();
for(const item of report.cases){console.log((item.ok?'PASS':'FAIL')+' '+item.name+(item.detail?' — '+item.detail:''))}
assert.equal(report.passed,8,'All 8 browser module integration tests must pass');
assert.equal(report.total,8);
console.log('Browser self-test suite passed');
