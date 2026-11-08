const {test}=require('node:test'),assert=require('node:assert/strict');
const {agent,schoolDocument,response}=require('./helpers/agent-harness.cjs');
const C=require('../app/core.js');
const teaching='https://jw.qlu.edu.cn/jwglxt/cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155';
const params={year:'2026',term:'3',week:7,weekday:1,periods:[1],seatId:1,day:'2026-11-01',kind:3,start:'09:00',end:'10:00'};
for(const method of ['status','reserve','rooms','exams'])test(method+' keeps timeout active until body consumption ends',async()=>{
 let pending,bodyReject,bodyStarted=false;const a=agent({url:['rooms','exams'].includes(method)?teaching:undefined,document:schoolDocument(),fetcher:async(_p,o)=>{
  const body=()=>{bodyStarted=true;return new Promise((resolve,reject)=>{bodyReject=reject;o.signal.addEventListener('abort',()=>reject(Object.assign(Error('synthetic abort'),{name:'AbortError'})),{once:true});});};
  return {ok:true,status:200,json:body,text:body};
 }});
 a.ctx.setTimeout=fn=>{pending=fn;return 1;};a.ctx.clearTimeout=()=>{pending=null;};
 const run=a.run(method,params);for(let i=0;i<30&&!bodyStarted;i++)await new Promise(setImmediate);
 assert.equal(bodyStarted,true);const timerWasActive=!!pending;
 if(pending)pending();else bodyReject(Object.assign(Error('synthetic abort'),{name:'AbortError'}));
 const r=await run;assert.equal(timerWasActive,true);assert.equal(r.ok,false);assert.equal(r.error.code,method==='reserve'?'UNCERTAIN':'TIMEOUT');assert.equal(pending,null);assert.equal(a.calls.length,1);
});
for(const code of [null,false,'',[],{},' ',undefined])test('invalid response code '+JSON.stringify(code)+' is rejected',async()=>{
 const a=agent({fetcher:async()=>({ok:true,status:200,json:async()=>({code,data:[]})})});const r=await a.run('records');assert.equal(r.ok,false);assert.equal(r.error.code,'PARSE');
});
for(const data of [null,{}, {data:null},[null],{list:'broken'}])test('malformed records are not an empty success: '+JSON.stringify(data),async()=>{
 const r=await agent({fetcher:async()=>response(data)}).run('records');assert.equal(r.ok,false);assert.equal(r.error.code,'PARSE');
});
test('all supported empty record envelopes remain successful',async()=>{
 for(const data of [[],{data:[]},{list:[]}]){const r=await agent({fetcher:async()=>response(data)}).run('records');assert.equal(r.ok,true);assert.deepEqual(r.data,[]);}
});
test('a malformed current-booking response cannot clear current reservations',async()=>{
 const r=await agent({fetcher:async()=>response({})}).run('current');assert.equal(r.ok,false);assert.equal(r.error.code,'PARSE');
});
test('revoked bookings never prove an ordinary or historical booking succeeded',()=>{
 const r={space:1,beginTime:'2026-11-01 09:00:00',endTime:'2026-11-01 10:00:00',status_name:'已撤销'};
 for(const loose of [false,true])assert.equal(C.recordMatches(r,params,{id:1},loose),false);
 assert.equal(C.recordMatches({...r,status_name:'预约成功'},params,{id:1}),true);
});
