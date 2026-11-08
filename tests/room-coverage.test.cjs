const {test}=require('node:test'),assert=require('node:assert/strict');const {scan}=require('../app/room-coverage.js');
test('a matching room on the second page is found before absence is inferred',async()=>{
 const calls=[];const result=await scan({periods:[1],query:{week:7},read:async p=>{calls.push(p.page);return{total:3,pageSize:2,rooms:p.page===1?[{id:'a'},{id:'b'}]:[{id:'target'}]}},matches:x=>x.id==='target'});
 assert.deepEqual(calls,[1,2]);assert.equal(result.rooms[0].states[1],'free');assert.equal(result.complete,true);
});
test('truncation keeps missing periods unknown rather than occupied',async()=>{
 const r=await scan({periods:[1,2],query:{},seed:[{id:'target'}],maxPages:1,read:async()=>({total:50,pageSize:1,rooms:[{id:'other'}]}),matches:x=>x.id==='target'});
 assert.equal(r.complete,false);assert.deepEqual(r.rooms[0].states,{1:'unknown',2:'unknown'});
});
test('missing total metadata cannot establish full coverage',async()=>{const r=await scan({periods:[1],query:{},seed:[{id:'target'}],read:async()=>({total:0,totalKnown:false,rooms:[]})});assert.equal(r.complete,false);assert.equal(r.rooms[0].states[1],'unknown');});
test('closing the dialog while a page is pending discards it and stops pagination',async()=>{
 let live=true,calls=0;const r=await scan({periods:[1,2],query:{},current:()=>live,read:async()=>{calls++;live=false;return{total:100,pageSize:1,rooms:[{id:1}]}}});assert.equal(r,null);assert.equal(calls,1);
});
test('a repeated server page is partial and does not loop indefinitely',async()=>{let calls=0;const r=await scan({periods:[1],query:{},seed:[{id:'target'}],read:async()=>{calls++;return{total:100,pageSize:1,rooms:[{id:'other'}]}},matches:x=>x.id==='target'});assert.equal(calls,2);assert.equal(r.complete,false);assert.equal(r.rooms[0].states[1],'unknown');});
test('known free states survive a later partial period failure',async()=>{const r=await scan({periods:[1,2,3],query:{},seed:[{id:'target'}],read:async p=>{if(p.periods[0]===2)throw Error('offline');return{total:1,pageSize:300,rooms:[{id:'target'}]}}});assert.equal(r.rooms[0].states[1],'free');assert.equal(r.rooms[0].states[2],'unknown');assert.equal(r.rooms[0].states[3],'unknown');});
test('query conditions are snapshotted across pages',async()=>{const query={week:7};const weeks=[];await scan({periods:[1],query,read:async p=>{weeks.push(p.week);query.week=9;return{total:2,pageSize:1,rooms:[{id:p.page}]}}});assert.deepEqual(weeks,[7,7]);});
