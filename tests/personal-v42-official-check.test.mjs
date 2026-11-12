import assert from 'node:assert/strict';
import{assessOfficialDrawPayload}from '../personal/v42-official-check.mjs';
const now='2026-11-12T00:30:00Z';
const item={period:'26129',date:'2026-11-11',front:[2,12,14,17,33],back:[7,8]};
const data={records:[item],latestPeriod:item.period,latestDate:item.date,checkedAt:'2026-11-12T00:00:00Z',crossPageAgreement:true,
 diagnostics:{historyPage:'ok',latestPage:'ok',agreement:'same-site-match'}};
assert.equal(assessOfficialDrawPayload(data,now).canPrefill,true);
assert.equal(assessOfficialDrawPayload({...data,crossPageAgreement:false},now).canPrefill,false);
assert.equal(assessOfficialDrawPayload({...data,diagnostics:{...data.diagnostics,agreement:'unconfirmed'}},now).canPrefill,false);
assert.equal(assessOfficialDrawPayload(data,'2026-11-22T00:00:00Z').canPrefill,false);
assert.equal(assessOfficialDrawPayload({...data,checkedAt:null},now).canPrefill,false);
assert.throws(()=>assessOfficialDrawPayload({...data,latestPeriod:'26128'},now),/期号和历史记录不一致/);
assert.throws(()=>assessOfficialDrawPayload({...data,records:[{...item,front:[2,2,14,17,33]}]},now),/不重复/);
assert.throws(()=>assessOfficialDrawPayload({...data,records:[{...item,date:'2026-11-31'}]},now),/日期不合法/);
assert.throws(()=>assessOfficialDrawPayload({...data,error:'官网获取失败'},now),/获取失败/);
console.log('Official draw payload freshness and integrity tests passed');
