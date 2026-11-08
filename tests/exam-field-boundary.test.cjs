const {test}=require('node:test'),assert=require('node:assert/strict');const {agent,schoolDocument}=require('./helpers/agent-harness.cjs');
test('unknown school fields never cross the exam adapter boundary',async()=>{
 const a=agent({url:'https://jw.qlu.edu.cn/jwglxt/cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155',document:schoolDocument(),fetcher:async()=>({ok:true,status:200,json:async()=>({items:[{kcmc:'合成考试',kch:'QA',xh:'synthetic-private',future_secret:'synthetic-private',jxbmc:'synthetic-class',ksmc:'期末考试'}]})})});
 const r=await a.run('exams',{year:'2026',term:'3'});assert.equal(r.ok,true);assert.deepEqual(Object.keys(r.data.exams[0]).sort(),['kch','kcmc','ksmc']);
});
