const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../app/core.js');
test('room snapshot keeps only display fields and caps the room count',()=>{
 const rooms=Array.from({length:400},(_,i)=>({id:'r'+i,name:'101',building:'1号楼',campus:'长清',capacity:60,reserved:false,cd_extra:'x'.repeat(50),query:{week:7}}));
 const snap=C.roomSnapshot(rooms);
 assert.equal(snap.length,300);
 assert.deepEqual(Object.keys(snap[0]).sort(),['building','campus','capacity','id','name','reserved']);
 assert.ok(JSON.stringify(snap).length<30000);
 assert.deepEqual(C.roomSnapshot([{id:1,name:'A',states:{1:'free'}}],12),[{id:1,name:'A',states:{1:'free'}}]);
});
test('cache age counts Beijing calendar days and flags data three days old',()=>{
 const now=Date.parse('2026-10-21T08:00:00+08:00');
 assert.deepEqual(C.cacheAge(Date.parse('2026-10-20T23:50:00+08:00'),now),{days:1,stale:false});
 assert.deepEqual(C.cacheAge(Date.parse('2026-10-18T09:00:00+08:00'),now),{days:3,stale:true});
 assert.deepEqual(C.cacheAge(now,now),{days:0,stale:false});
});
test('daily pick is fixed within a day and moves on the next day',()=>{
 const list=['a','b','c'];
 assert.equal(C.dailyPick(list,'2026-10-21'),C.dailyPick(list,'2026-10-21'));
 assert.notEqual(C.dailyPick(list,'2026-10-21'),C.dailyPick(list,'2026-10-22'));
 assert.equal(C.dailyPick([], '2026-10-21'),null);
});
