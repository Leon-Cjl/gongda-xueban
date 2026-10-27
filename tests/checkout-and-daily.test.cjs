const {test}=require('node:test'),assert=require('node:assert/strict');
const {agent,schoolDocument,response}=require('./helpers/agent-harness.cjs');
const C=require('../app/core.js');
// 结束使用：模拟学校响应，不连接学校。配置 notice.leave 控制学校是否开放签退。
function checkoutFixture({leave=1,inSeat=true,stays=false,failVerify=false}={}){
 let ended=false;
 const row={id:'r-1',type:1,no:'118',flag_out:inSeat?1:0,flag_leave:0};
 const a=agent({fetcher:async path=>{
  if(path==='/v4/index/subscribe'){if(failVerify&&ended)return{ok:false,status:502,json:async()=>({})};return response(ended&&!stays?[]:[row]);}
  if(path==='/v4/index/peizhi')return response({notice:{leave,rightback:1}});
  if(path==='/v4/space/checkout'){ended=true;return response({});}
  return response({});
 }});
 return{a,posts:()=>a.calls.filter(x=>x.path==='/v4/space/checkout').length};
}
test('checkout posts the reservation id once and verifies it left the current list',async()=>{
 const {a,posts}=checkoutFixture();
 const r=await a.run('checkout',{id:'r-1'});
 assert.equal(r.data.verified,true);assert.equal(posts(),1);
 assert.deepEqual(JSON.parse(a.calls.find(x=>x.path==='/v4/space/checkout').opts.body),{id:'r-1'});
});
test('checkout is never posted when the school has not opened it or the seat is not in use',async()=>{
 for(const opts of [{leave:0},{inSeat:false}]){const {a,posts}=checkoutFixture(opts);assert.equal((await a.run('checkout',{id:'r-1'})).error.code,'SCHOOL');assert.equal(posts(),0);}
 const {a,posts}=checkoutFixture();assert.equal((await a.run('checkout',{id:'other'})).error.code,'STALE');assert.equal(posts(),0);
});
test('checkout reports uncertainty instead of retrying, and does not claim success while still listed',async()=>{
 const f=checkoutFixture({failVerify:true});const r=await f.a.run('checkout',{id:'r-1'});assert.equal(r.error.code,'UNCERTAIN');assert.equal(f.posts(),1);
 const g=checkoutFixture({stays:true});assert.equal((await g.a.run('checkout',{id:'r-1'})).data.verified,false);
});
test('current reservations expose the official checkout condition',async()=>{
 const {a}=checkoutFixture();const r=await a.run('current');assert.equal(r.data[0].canCheckout,true);
 const b=checkoutFixture({leave:0});assert.equal((await b.a.run('current')).data[0].canCheckout,false);
});
test('room queries can ask for a larger page, capped at 500',async()=>{
 const teach='https://jw.qlu.edu.cn/jwglxt/cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155';
 for(const [want,got] of [[500,'500'],[9999,'500'],[undefined,'100']]){
  const a=agent({url:teach,document:schoolDocument(),fetcher:async()=>({ok:true,json:async()=>({items:[],totalResult:0})})});
  await a.run('rooms',{year:'2026',term:'3',campus:'1',week:7,weekday:2,periods:[3],pageSize:want});
  assert.equal(a.calls[0].opts.body.get('queryModel.showCount'),got);
 }
});
