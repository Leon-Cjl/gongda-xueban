const {test}=require('node:test');const assert=require('node:assert/strict');
const {Booker,validateTask,permanentRejection,checkinReminders,libraryStats,areaFloors,filterAreas,maskCard,daysUntil,greeting,givenName}=require('../app/core.js');
const at=Date.parse('2026-10-20T07:00:00+08:00'),iso=ms=>new Date(ms).toISOString();
const task=(over={})=>validateTask({areaId:5,areaName:'测试区域',day:'2026-10-20',start:'08:30',end:'12:00',kind:3,fireAt:iso(at),seats:[{id:1,no:'001'},{id:4,no:'004'}],...over},at-1000);
const record={space:1,beginTime:'2026-10-20 08:30:00',endTime:'2026-10-20 12:00:00',status_name:'已预约'};
// 虚拟时钟：sleep 推进时间，不真的等待。
function clocked(t,api){let now=at+1;const calls=[];const s=new Booker({tasks:[t],api:async(m,p)=>{calls.push(m);return api(m,p,()=>now);},now:()=>now,sleep:async ms=>{now+=ms;},save:async()=>{}});return{s,calls,advance:ms=>{now+=ms;}};}

test('no retry window keeps the old single pass',async()=>{
 const t=task();let seatCalls=0;
 const{s}=clocked(t,async m=>{if(m==='status')return{connected:true};if(m==='records')return[];if(m==='seats'){seatCalls++;return{kind:3,seats:[]};}});
 await s.tick();
 assert.equal(t.status,'failed');assert.equal(seatCalls,1);
});
test('a permanent school rejection still tries the backup seats once but starts no new round',async()=>{
 const t=task();let submits=0;
 const{s}=clocked(t,async m=>{if(m==='status')return{connected:true};if(m==='records')return[];if(m==='seats')return{kind:3,seats:[{id:1,available:true},{id:4,available:true}]};if(m==='reserve'){submits++;throw Object.assign(Error('您已有预约，不能重复预约'),{code:'SCHOOL'});}});
 await s.tick();
 assert.equal(t.status,'failed');assert.equal(submits,2,'each seat once, no second round');assert.match(t.message,/已有预约/);
});
test('seat contention keeps the backup order: a taken first seat falls through to the second',async()=>{
 const t=task();let tried=[],booked=false;
 const{s}=clocked(t,async(m,p)=>{if(m==='status')return{connected:true};if(m==='records')return booked?[{...record,space:4}]:[];if(m==='seats')return{kind:3,seats:[{id:1,available:true},{id:4,available:true}]};if(m==='reserve'){tried.push(p.seatId);if(p.seatId===1)throw Object.assign(Error('该座位已有人预约'),{code:'SCHOOL'});booked=true;return{accepted:true};}});
 await s.tick();
 assert.deepEqual(tried,[1,4]);assert.equal(t.status,'succeeded');assert.equal(t.bookedSeat.no,'004');
});
test('permanent rejection patterns',()=>{
 for(const m of ['您已有预约','违约次数过多','账号已被禁止预约','超过预约上限'])assert.equal(permanentRejection(m),true,m);
 for(const m of ['未到预约开放时间','座位已被他人预约','该座位已有人预约','系统繁忙'])assert.equal(permanentRejection(m),false,m);
});


const now=Date.parse('2026-10-20T07:00:00+08:00'),today='2026-10-20';
test('check-in reminders come from upcoming school reservations and verified tasks, deduplicated',()=>{
 const current=[{id:'r1',nameMerge:'三楼东',no:'A203',beginTime:'2026-10-20 08:00:00',endTime:'2026-10-20 12:00:00'}];
 const tasks=[{id:'t1',status:'succeeded',bookedSeat:{no:'A203'},accountId:'default',areaName:'三楼东',day:'2026-10-20',start:'08:00',end:'12:00'},{id:'t2',status:'succeeded',bookedSeat:{no:'118'},accountId:'default',areaName:'二楼',day:'2026-10-21',start:'14:00',end:'18:00'},{id:'t3',status:'failed',bookedSeat:{no:'9'},day:'2026-10-21',start:'08:00',end:'09:00'}];
 const items=checkinReminders({current,tasks,accountIds:['default'],leadMinutes:15,now,today,pass:true});
 assert.equal(items.length,2);
 assert.equal(items[0].at,Date.parse('2026-10-20T07:45:00+08:00'));assert.match(items[0].title,/08:00/);assert.match(items[0].text,/A203 号.*15 分钟/);assert.match(items[0].text,/入馆码/);
 assert.equal(items[1].at,Date.parse('2026-10-21T13:45:00+08:00'));
});
test('reminders skip started, away, other-account, too-late and disabled cases',()=>{
 const cur=[{id:'a',no:'1',beginTime:'2026-10-20 06:00:00',endTime:'2026-10-20 09:00:00'},{id:'b',no:'2',temporarilyAway:true,beginTime:'2026-10-20 09:00:00',endTime:'2026-10-20 10:00:00'},{id:'c',no:'3',beginTime:'2026-10-20 07:10:00',endTime:'2026-10-20 10:00:00'}];
 const tasks=[{id:'x',status:'succeeded',bookedSeat:{no:'5'},accountId:'other',day:'2026-10-20',start:'09:00',end:'10:00'}];
 assert.deepEqual(checkinReminders({current:cur,tasks,accountIds:['default'],leadMinutes:15,now,today}),[]);
 assert.deepEqual(checkinReminders({current:[{id:'d',no:'4',beginTime:'2026-10-20 09:00:00',endTime:'2026-10-20 10:00:00'}],leadMinutes:0,now,today}),[]);
});
test('manual reminders pass through when in the future',()=>{
 const items=checkinReminders({extra:[{id:'leave:1',at:now+1200000,title:'暂离已 20 分钟',text:'回座'},{id:'old',at:now-1000,title:'x'}],now,today});
 assert.deepEqual(items.map(x=>x.id),['leave:1']);
});

test('library stats count only used visits and the current streak',()=>{
 const r=(day,s,e,status='已完成',area='三楼东')=>({beginTime:day+' '+s+':00',endTime:day+' '+e+':00',status_name:status,nameMerge:area});
 const records=[r('2026-10-20','06:00','07:00'),r('2026-10-19','08:00','11:30'),r('2026-10-18','08:00','10:00','已完成','二楼'),r('2026-10-16','08:00','09:00'),r('2026-10-15','08:00','12:00','已取消'),r('2026-10-14','08:00','12:00','违约'),r('2026-09-30','08:00','12:00'),r('2026-10-21','08:00','12:00','已预约')];
 const s=libraryStats(records,now,today);
 assert.equal(s.monthVisits,4);assert.equal(s.monthHours,7.5);assert.equal(s.streak,3);assert.equal(s.topArea,'三楼东');assert.equal(s.visits,5);assert.equal(s.sample,8);
});
test('streak counts from yesterday when there is no visit yet today',()=>{
 const s=libraryStats([{beginTime:'2026-10-19 08:00:00',endTime:'2026-10-19 09:00:00',status_name:'已完成'}],now,today);
 assert.equal(s.streak,1);
});

test('area filter by floor, free seats, name and sort',()=>{
 const areas=[{id:1,name:'二楼阅览区',floor:'二层',free:3},{id:2,name:'三楼东自习区',floor:'三层',free:0},{id:3,name:'三楼西考研区',floor:'三层',free:9},{id:4,name:'四楼期刊',floor:'',free:null}];
 assert.deepEqual(areaFloors(areas),['二层','三层']);
 assert.deepEqual(filterAreas(areas,{floor:'三层'}).map(a=>a.id),[2,3]);
 assert.deepEqual(filterAreas(areas,{freeOnly:true}).map(a=>a.id),[1,3]);
 assert.deepEqual(filterAreas(areas,{query:'考研'}).map(a=>a.id),[3]);
 assert.deepEqual(filterAreas(areas,{sort:'free'}).map(a=>a.id),[3,1,2,4]);
 assert.deepEqual(areas.map(a=>a.id),[1,2,3,4],'input not mutated');
});
test('small helpers: masked card, countdown days, greeting, given name',()=>{
 assert.equal(maskCard('202400001234'),'2024****34');assert.equal(maskCard('1234'),'1234');
 assert.equal(daysUntil('2026-12-26','2026-10-20'),67);assert.equal(daysUntil('2026-10-20','2026-10-20'),0);assert.equal(daysUntil('bad','2026-10-20'),null);
 assert.equal(greeting(7),'早上好');assert.equal(greeting(12),'中午好');assert.equal(greeting(15),'下午好');assert.equal(greeting(20),'晚上好');assert.equal(greeting(2),'夜深了');
 assert.equal(givenName('张小明'),'小明');assert.equal(givenName('欧阳修文'),'修文');assert.equal(givenName('李明'),'李明');assert.equal(givenName('Alex'),'Alex');
});
