import {inspectHistory,yearlyReview} from './v34-core.mjs';
import {analyze,outOfSample} from './v35-core.mjs';
export const VERSION='V3.6-report';
export const EVENTS=[
 {date:'2007-05-10',title:'维纳斯3代亮相（历史资料）',status:'公开报道',source:'https://www.sport.gov.cn/n20001280/n20745751/n20767297/c21164292/content.html',note:'并非证明此后所有期次使用同一球组或同一机具'},
 {date:'2019',title:'新一代维纳斯更换报道',status:'确切启用日期待核实',source:'https://www.sport.gov.cn/n20001280/n20745751/n20767297/c21145013/content.html',note:'不得以2019-07-01等任意日期当作实际换机日'},
 {date:'未知',title:'EDITEC与AKANIS关系及2026现役机具',status:'待核实',source:'https://www.akanis.tech/',note:'厂家系列能力不能等同中国体彩现役设备配置'}
];
export function createReport(rows,{zone=0}={}){
 const audit=inspectHistory(rows),review=yearlyReview(rows,zone,2000),anomaly=analyze(rows,{zone}),validation=outOfSample(rows,{zone});
 return {version:VERSION,createdAt:new Date().toISOString(),source:'浏览器本机V3.1历史快照（只读；未完成逐期官方核验）',zone:zone?'后区':'前区',audit:{total:audit.total,valid:audit.valid,problemCount:audit.problems.length,years:audit.byYear.map(y=>({year:y.year,count:y.count,gapCandidates:y.missingCandidateCount}))},yearly:review.years,selectedYears:anomaly.years,anomalyTop:anomaly.numbers.slice(0,10).map(x=>({number:x.number,actual:x.total,expected:x.expected,positiveYears:x.positiveYears,negativeYears:x.negativeYears})),outOfSample:validation,events:EVENTS,limitations:['异常年份系事后选取，不能当作独立发现','年度P值经过Holm修正，模拟仅2000次，分辨率有限','设备更换准确启用日期、逐期官方结果、开奖视频与机具编号尚未交叉核验','样本外计数差值不代表已证实的预测优势','本报告不构成中奖预测或购买建议']};
}
export function formatReport(r){
 const lines=['# '+r.version+' · '+r.zone+'研究报告','生成时间：'+r.createdAt,'数据：'+r.source,'','## 数据审计','总记录 '+r.audit.total+'；格式有效 '+r.audit.valid+'；待核问题 '+r.audit.problemCount,'','## 年度统计（Holm修正）','年份 | 期数 | 原始P值 | 修正P值','---|---:|---:|---:'];
 for(const y of r.yearly)lines.push([y.year,y.count,y.pValue===null?'NA':y.pValue.toFixed(5),y.holmAdjustedP===null?'NA':y.holmAdjustedP.toFixed(5)].join(' | '));
 lines.push('','## 异常年份号码贡献（探索性）','号码 | 实际 | 期望 | 偏多年份数 | 偏少年份数','---|---:|---:|---:|---:');
 for(const n of r.anomalyTop)lines.push([n.number,n.actual,n.expected.toFixed(2),n.positiveYears,n.negativeYears].join(' | '));
 const v=r.outOfSample;lines.push('','## 样本外对照','训练期数 '+v.trainDraws+'；验证期数 '+v.testDraws,'训练选择号码 '+v.selectedNumbers.join(', '),'验证实际次数 '+v.observed+'；均匀模型期望 '+v.expected.toFixed(2),'','## 设备证据时间轴');
 for(const e of r.events)lines.push('- '+e.date+' '+e.title+'（'+e.status+'） '+e.source+'；'+e.note);
 lines.push('','## 局限与下一步',...r.limitations.map(x=>'- '+x));
 return lines.join('\n');
}
