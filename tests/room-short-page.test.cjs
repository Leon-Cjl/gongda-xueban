const {test}=require('node:test'),assert=require('node:assert/strict'),{scan}=require('../app/room-coverage.js');
test('a short first page cannot prove missing rooms busy merely because page capacity exceeds the total',async()=>{
 const r=await scan({periods:[1],query:{},seed:[{id:'missing'}],read:async()=>({rooms:[{id:'present'}],totalKnown:true,total:100,pageSize:300})});
 assert.equal(r.complete,false);assert.equal(r.rooms.find(x=>x.id==='missing').states[1],'unknown');
});
