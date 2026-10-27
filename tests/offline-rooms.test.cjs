const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../app/core.js');
// 合成数据：3 间教室、4 节；第 2 天没同步（测推算）。
const P=[1,2,3,4];
const rooms=[['r1','1号楼 101','1号楼',60],['r2','1号楼 102','1号楼',80],['r3','3号楼 301','3号楼',120]];
const states=new Map([['r1',{1:'1',2:'1',3:'1'}],['r2',{1:'1',2:'2',4:'1'}],['r3',{2:'1',3:'1',4:'1'}]]);
const data={v:1,year:'2026',term:'3',campus:'1',campusLabel:'长清校区',periods:P,base:{day:'2026-10-21',week:7},
 buildings:[{value:'',label:'全部教学楼'},{value:'a',label:'1号楼'},{value:'c',label:'3号楼'}],rooms,
 days:{'2026-10-21':{week:7,weekday:3,at:1,s:C.packRoomDay(rooms,P,states)}}};
test('week of a date is the inverse of weekDate',()=>{
 assert.equal(C.weekOf('2026-10-21',7,'2026-10-21'),7);
 assert.equal(C.weekOf('2026-10-25',7,'2026-10-21'),7);
 assert.equal(C.weekOf('2026-10-26',7,'2026-10-21'),8);
 assert.equal(C.weekOf('2026-10-19',7,'2026-10-21'),7);
 assert.equal(C.weekOf('2026-10-18',7,'2026-10-21'),6);
 for(const d of ['2026-10-20','2026-10-27','2026-11-08'])assert.equal(C.weekDate(C.weekOf(d,7,'2026-10-21'),new Date(d+'T12:00:00+08:00').getUTCDay()||7,7,'2026-10-21'),d);
});
test('a day is packed as one character per room and period',()=>{
 assert.equal(data.days['2026-10-21'].s,'1110'+'1201'+'0111');
});
test('offline query matches the online rule: every chosen period free, borrowed rooms flagged',()=>{
 const r=C.offlineRooms(data,{week:7,weekday:3,periods:[2]});
 assert.deepEqual(r.rooms.map(x=>[x.id,x.reserved]),[['r1',false],['r2',true],['r3',false]]);
 assert.equal(r.approx,false);
 assert.deepEqual(C.offlineRooms(data,{week:7,weekday:3,periods:[1,2]}).rooms.map(x=>x.id),['r1','r2']);
 assert.deepEqual(C.offlineRooms(data,{week:7,weekday:3,periods:[1,4]}).rooms.map(x=>x.id),['r2']);
});
test('building and name filters work offline',()=>{
 assert.deepEqual(C.offlineRooms(data,{week:7,weekday:3,periods:[3],building:'c'}).rooms.map(x=>x.id),['r3']);
 assert.deepEqual(C.offlineRooms(data,{week:7,weekday:3,periods:[2],building:''}).rooms.length,3);
 assert.deepEqual(C.offlineRooms(data,{week:7,weekday:3,periods:[2],name:'1-01'}).rooms.map(x=>x.id),['r1']);
 assert.equal(C.offlineRooms(data,{week:7,weekday:3,periods:[2]}).rooms[0].campus,'长清校区');
});
test('offline results know how long each free room stays free',()=>{
 const r=C.offlineRooms(data,{week:7,weekday:3,periods:[2]});
 assert.equal(r.until.final.r1,3);
 assert.equal(r.until.final.r3,4);
 assert.equal(r.until.final.r2,undefined);
 assert.equal(r.until.last,4);
});
test('a date outside the saved days is estimated from the same weekday',()=>{
 const r=C.offlineRooms(data,{week:9,weekday:3,periods:[2]});
 assert.equal(r.approx,true);assert.equal(r.date,'2026-11-04');assert.equal(r.source,'2026-10-21');
 assert.equal(C.offlineRooms(data,{week:7,weekday:4,periods:[2]}),null);
});
test('rooms first seen after a day was saved count as busy on that day',()=>{
 const more={...data,rooms:rooms.concat([['r4','5号楼 501','5号楼',40]])};
 assert.deepEqual(C.offlineRooms(more,{week:7,weekday:3,periods:[2]}).rooms.map(x=>x.id),['r1','r2','r3']);
});
test('seven days of a large campus stay small',()=>{
 const big=Array.from({length:900},(_,i)=>['id'+i,'教学楼 '+i,'教学楼'+(i%20),60]),P12=Array.from({length:12},(_,i)=>i+1);
 const st=new Map(big.map((r,i)=>[r[0],Object.fromEntries(P12.filter(p=>(i+p)%3).map(p=>[p,'1']))]));
 const days={};for(let i=0;i<7;i++)days['2026-10-2'+i]={week:7,weekday:1,at:1,s:C.packRoomDay(big,P12,st)};
 assert.ok(JSON.stringify({rooms:big,days}).length<200000);
});
