const {test}=require('node:test'),assert=require('node:assert/strict');
const {agent,schoolDocument,response}=require('./helpers/agent-harness.cjs');
const C=require('../app/core.js');
// 取消预约：只用模拟的学校响应，不连接学校。
function cancelFixture({status='2',oksign,after='4',failVerify=false}={}){
 let cancelled=false,reads=0;
 const row=s=>({id:7001,no:'118',nameMerge:'二楼 · 中文阅览区',beginTime:'2026-10-22 08:00:00',endTime:'2026-10-22 11:30:00',status:s,status_name:s==='2'?'预约成功':'已取消',...(oksign==null?{}:{oksign})});
 const a=agent({fetcher:async path=>{
  if(path==='/v4/member/seat'){reads++;if(failVerify&&cancelled)return{ok:false,status:502,json:async()=>({})};return response({data:[cancelled?row(after):row(status),{id:7002,no:'120',status:'1',status_name:'已完成'}]});}
  if(path==='/v4/space/cancel'){cancelled=true;return response({});}
  return response({});
 }});
 return{a,posts:()=>a.calls.filter(x=>x.path==='/v4/space/cancel').length,reads:()=>reads};
}
test('cancel posts the record id once and verifies it in the school records',async()=>{
 const {a,posts}=cancelFixture();
 const r=await a.run('cancelBooking',{id:'7001'});
 assert.equal(r.data.verified,true);assert.equal(posts(),1);
 assert.deepEqual(JSON.parse(a.calls.find(x=>x.path==='/v4/space/cancel').opts.body),{id:7001});
 assert.ok(!('aesjson' in JSON.parse(a.calls.find(x=>x.path==='/v4/space/cancel').opts.body)));
});
test('records the school marks as not cancellable are never posted',async()=>{
 for(const opts of [{status:'1'},{status:'4'},{status:'2',oksign:0}]){const {a,posts}=cancelFixture(opts);assert.equal((await a.run('cancelBooking',{id:'7001'})).error.code,'SCHOOL');assert.equal(posts(),0);}
 const {a,posts}=cancelFixture({status:'9',oksign:1});assert.equal((await a.run('cancelBooking',{id:'7001'})).data.verified,true);assert.equal(posts(),1);
});
test('unknown or malformed ids are rejected before any cancel request',async()=>{
 const {a,posts}=cancelFixture();
 assert.equal((await a.run('cancelBooking',{id:'9999'})).error.code,'STALE');
 assert.equal((await a.run('cancelBooking',{id:'1;drop'})).error.code,'INVALID');
 assert.equal(posts(),0);
});
test('a failed re-read after cancelling is reported as uncertain, not retried',async()=>{
 const {a,posts}=cancelFixture({failVerify:true});
 const r=await a.run('cancelBooking',{id:'7001'});
 assert.equal(r.error.code,'UNCERTAIN');assert.equal(r.error.uncertain,true);assert.equal(posts(),1);
});
test('school still listing the booking as cancellable is not claimed as verified',async()=>{
 const {a}=cancelFixture({after:'2'});
 assert.equal((await a.run('cancelBooking',{id:'7001'})).data.verified,false);
});
test('room search sends the school room-name field and a larger page',async()=>{
 const teach='https://jw.qlu.edu.cn/jwglxt/cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155';
 const a=agent({url:teach,document:schoolDocument(),fetcher:async()=>({ok:true,json:async()=>({items:[{cd_id:'1',cdmc:'3-301'}],totalResult:1})})});
 const r=await a.run('rooms',{year:'2026',term:'3',campus:'1',week:7,weekday:2,periods:[5],name:'3-301<script>'});
 const body=a.calls[0].opts.body;
 assert.equal(body.get('cdmc'),'3-301script');assert.equal(body.get('jcd'),String(2**4));assert.equal(body.get('queryModel.showCount'),'300');assert.equal(r.data.pageSize,300);
 const b=agent({url:teach,document:schoolDocument(),fetcher:async()=>({ok:true,json:async()=>({items:[],totalResult:0})})});
 await b.run('rooms',{year:'2026',term:'3',campus:'1',week:7,weekday:2,periods:[1]});
 assert.equal(b.calls[0].opts.body.get('queryModel.showCount'),'100');
});
test('current booking is matched to its school record by seat and start time',()=>{
 const records=[{id:1,no:'118',beginTime:'2026-10-21 14:00:00',endTime:'2026-10-21 18:00:00',status:'2'},{id:2,no:'118',beginTime:'2026-10-22 08:00:00',endTime:'2026-10-22 12:00:00',status:'2'},{id:3,no:'A203',beginTime:'2026-10-23 08:00:00',endTime:'2026-10-23 12:00:00',status:'9'},{id:4,no:'120',beginTime:'2026-10-24 08:00:00',endTime:'2026-10-24 12:00:00',status:'1'}];
 const current=[{id:'c1',no:'118',beginTime:'2026-10-21 14:00:00',endTime:'2026-10-21 18:00:00'}];
 assert.equal(C.matchRecord(records,current[0],'2026-10-21').id,1);
 const now=Date.parse('2026-10-21T15:00:00+08:00');
 assert.deepEqual(C.upcomingBookings(records,current,now,'2026-10-21').map(x=>x.id),[2,3]);
 assert.equal(C.cancellableRecord({status:'2',oksign:0}),false);assert.equal(C.cancellableRecord({status:9}),true);
});
test('cancelled bookings no longer produce a booked seat or a check-in reminder',()=>{
 const now=Date.parse('2026-10-21T07:00:00+08:00');
 const t={id:'t',status:'succeeded',accountId:'default',day:'2026-10-21',start:'08:00',end:'12:00',bookedSeat:{id:1,no:'118'},areaName:'二楼'};
 assert.equal(C.bookedTask([t],'default',now)?.id,'t');
 assert.equal(C.checkinReminders({tasks:[t],now,today:'2026-10-21'}).length,1);
 const gone={...t,bookingCancelled:true};
 assert.equal(C.bookedTask([gone],'default',now),null);
 assert.equal(C.checkinReminders({tasks:[gone],now,today:'2026-10-21'}).length,0);
});
test('a booking made elsewhere (only in the school records) still gets a check-in reminder, once',()=>{
 const now=Date.parse('2026-10-21T20:00:00+08:00'),r={id:9,space:1,no:'118',nameMerge:'二楼',status:'2',beginTime:'2026-10-22 08:00:00',endTime:'2026-10-22 12:00:00',status_name:'预约成功'};
 const list=C.checkinReminders({records:[r],now,today:'2026-10-21'});
 assert.equal(list.length,1);assert.equal(list[0].at,Date.parse('2026-10-22T07:45:00+08:00'));
 const t={status:'succeeded',accountId:'default',areaName:'二楼',day:'2026-10-22',start:'08:00',end:'12:00',bookedSeat:{id:1,no:'118'}};
 assert.equal(C.checkinReminders({records:[r],tasks:[t],now,today:'2026-10-21'}).length,1,'the same booking from a local task is not reminded twice');
 assert.equal(C.checkinReminders({records:[{...r,status:'4',status_name:'已取消'}],now,today:'2026-10-21'}).length,0);
});
test('room day merges consecutive periods into readable ranges',()=>{
 const d=C.roomDay([1,2,3,4,5,6,7,8,9,10,11,12],{3:'free',4:'free',5:'borrowed',9:'free',10:'free',11:'free',12:'free'});
 assert.deepEqual(d.segments.map(x=>[x.from,x.to,x.state]),[[1,2,'busy'],[3,4,'free'],[5,5,'borrowed'],[6,8,'busy'],[9,12,'free']]);
 assert.equal(d.text,'空闲：第 3–4、9–12 节');
 assert.equal(C.roomDay([1,2],{}).text,'这一天没有空闲的节次');
 assert.equal(d.freeCount,6);
});
test('teaching week and weekday convert to a calendar date',()=>{
 // 2026-10-21 是星期三。
 assert.equal(C.weekDate(7,3,7,'2026-10-21'),'2026-10-21');
 assert.equal(C.weekDate(7,1,7,'2026-10-21'),'2026-10-19');
 assert.equal(C.weekDate(8,7,7,'2026-10-21'),'2026-11-01');
 assert.equal(C.weekDate(6,5,7,'2026-10-21'),'2026-10-16');
 assert.equal(C.weekDate(7,3,null,'2026-10-21'),'');
});
test('no check-in reminder for a booking that is already in use',()=>{
 const now=Date.parse('2026-10-21T07:00:00+08:00'),r={id:1,no:'118',nameMerge:'二楼',beginTime:'2026-10-21 08:00:00',endTime:'2026-10-21 12:00:00'};
 assert.equal(C.checkinReminders({current:[r],now,today:'2026-10-21'}).length,1);
 assert.equal(C.checkinReminders({current:[{...r,statusMsg:'使用中'}],now,today:'2026-10-21'}).length,0);
 const t={status:'succeeded',accountId:'default',areaName:'二楼',day:'2026-10-21',start:'08:00',end:'12:00',bookedSeat:{id:1,no:'118'}};
 assert.equal(C.checkinReminders({current:[{...r,statusMsg:'已签到'}],tasks:[t],now,today:'2026-10-21'}).length,0,'the same booking from a local task is skipped too');
});
