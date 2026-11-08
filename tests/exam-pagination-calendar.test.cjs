const {test}=require('node:test'),assert=require('node:assert/strict');
const {readPages,calendarKeys}=require('../app/exams.js');
test('exam pages require an explicit stable total before becoming complete',async()=>{
 let calls=0;const r=await readPages(async page=>{calls++;return{exams:page===1?[{kch:'a'}]:[{kch:'b'}],totalKnown:true,total:2};});
 assert.equal(calls,2);assert.equal(r.complete,true);assert.equal(r.exams.length,2);
 const unknown=await readPages(async()=>({exams:[],totalKnown:false}));assert.equal(unknown.complete,false);
});
test('repeated or missing pages remain partial; changing totals preserve the old cache via failure',async()=>{
 const repeated=await readPages(async()=>({exams:[{kch:'a'}],totalKnown:true,total:2}));assert.equal(repeated.complete,false);assert.equal(repeated.exams.length,1);
 const missing=await readPages(async page=>({exams:page===1?[{kch:'a'}]:[],totalKnown:true,total:2}));assert.equal(missing.complete,false);
 await assert.rejects(readPages(async page=>({exams:[{kch:String(page)}],totalKnown:true,total:page+1})),{code:'PARSE'});
});
test('identity invalidation stops pagination before another dispatch',async()=>{
 let current=true,calls=0;await assert.rejects(readPages(async()=>{calls++;current=false;return{exams:[],totalKnown:true,total:0};},()=>current),{code:'STALE'});assert.equal(calls,1);
});
test('calendar identities survive reorder and time changes and fail closed on ambiguous duplicates',()=>{
 const c={year:'2026',term:'3'},row=(k,batch)=>({x:{kch:k,ksmc:'期末',sjbh:batch,kssj:'old'}}),a=row('A','1'),b=row('A','2');
 const first=calendarKeys(c,[a,b]);a.x.kssj='new';assert.deepEqual(calendarKeys(c,[b,a]),[first[1],first[0]]);
 assert.throws(()=>calendarKeys(c,[a,a]),/重复考试/);
});

test('exam changes compare stable identities and present exact old and new arrangements',()=>{
 const {examChanges}=require('../app/exams.js');const a={kch:'QA',ksmc:'期末',kssj:'2099-12-01(09:00-11:00)',cdmc:'A楼'},b={...a,kssj:'2099-12-02(10:00-12:00)',cdmc:'B楼'};
 const changes=examChanges([a],[b]);assert.equal(changes.length,1);assert.ok(changes[0].before.includes('A楼')&&changes[0].after.includes('B楼'));assert.deepEqual(examChanges([a],[a]),[]);assert.deepEqual(examChanges([a,a],[b]),[]);
});
