/* Phone preview fixture, synthetic data only. Never shipped; never contacts the school. */
(()=>{
 const params=new URLSearchParams(location.search),scenario=params.get('s')||'connected';
 // 验收按“今天”的合成数据写的：晚上 10 点后跑测试也别自动切到明天（latenight=1 时测试这个行为）。
 if(!params.get('latenight'))window.CampusFixedDay=true;
 // edition=public：按发布版界面运行（构建时由 edition.js 设定）。
 if(params.get('edition')==='public'){window.CampusEdition='public';window.CampusEditionVersion='1.0.0';}
 const key='qa-android-'+scenario;
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
 const later=(min)=>new Date(Date.now()+min*60000).toISOString();
 const seed={tasks:scenario==='tasks'?[
  {id:'t1',accountId:'default',accountName:'我的账号',areaId:'12',areaName:'三楼东 · 自习区',day,start:'08:00',end:'22:00',kind:3,seats:[{id:203,no:'A203'},{id:204,no:'A204'}],fireAt:later(95),status:'pending',message:'等待执行',createdAt:later(-10)},
  {id:'t2',accountId:'default',accountName:'我的账号',areaId:'11',areaName:'二楼 · 中文阅览区',day,start:'08:00',end:'22:00',kind:3,seats:[{id:118,no:'118'}],fireAt:later(-600),status:'succeeded',message:'预约已核验，请按学校要求及时入馆',bookedSeat:{id:118,no:'118'},createdAt:later(-700)},
  {id:'t3',accountId:'default',accountName:'我的账号',areaId:'11',areaName:'二楼 · 中文阅览区',day,start:'08:00',end:'22:00',kind:3,seats:[{id:120,no:'120'}],fireAt:later(-1500),status:'uncertain',message:'提交已响应，但记录尚未匹配；请到官方记录核对，已停止重试',createdAt:later(-1600)}
 ]:[],favorites:scenario==='fresh'?[]:[{key:'seat:12:203',type:'seat',id:'203',no:'A203',areaId:'12',areaName:'三楼东 · 自习区',libraryId:'1',createdAt:later(-3000)},{key:'seat:12:204',type:'seat',id:'204',no:'A204',areaId:'12',areaName:'三楼东 · 自习区',libraryId:'1',createdAt:later(-2900)}],preferences:{}};
 // 两条旧的“确认中”任务：昨天那条在学校记录里有（应改为已约到），三天前那条没有（应判定没约上）。
 if(scenario==='tasks'){const past=n=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(Date.now()-n*86400000));seed.tasks.push({id:'t4',accountId:'default',accountName:'我的账号',areaId:'12',areaName:'三楼东 · 自习区',day:past(1),start:'08:00',end:'11:30',kind:3,seats:[{id:200,no:'201'}],fireAt:later(-1500),status:'uncertain',message:'提交已响应，但记录尚未匹配；请到官方记录核对，已停止重试',createdAt:later(-1600)},{id:'t5',accountId:'default',accountName:'我的账号',areaId:'12',areaName:'三楼东 · 自习区',day:past(3),start:'08:00',end:'10:00',kind:3,seats:[{id:999,no:'999'}],fireAt:later(-4400),status:'uncertain',message:'上次执行中断，请核对官方记录后建立新计划',createdAt:later(-4500)});}
 let saved;try{saved=JSON.parse(localStorage.getItem(key)||'null')||seed;}catch(e){saved=seed;}
 const autologin=params.get('autologin');let autoRan=false;
 let connected=scenario!=='fresh'&&!autologin,teaching=scenario!=='fresh'&&params.get('teach')!=='menu'&&params.get('teach')!=='off',away=false,booked=[];
 const areas=[{id:'11',name:'二楼 · 中文阅览区',floor:'二层',free:37,total:120},{id:'12',name:'三楼东 · 自习区',floor:'三层',free:12,total:96},{id:'13',name:'三楼西 · 考研自习室（靠窗）',floor:'三层',free:0,total:64},{id:'14',name:'四楼 · 外文期刊阅览区',floor:'四层',free:58,total:72},{id:'15',name:'借还书业务',floor:'二层',free:250,total:300}];
 const seatsFor=id=>{const a=areas.find(x=>x.id===id)||areas[0];return Array.from({length:a.total},(_,i)=>{const n=id==='12'?'A'+String(201+i):String(101+i);const free=a.free&&((i*7+3)%Math.ceil(a.total/a.free)===0);return{id:id==='12'?201+i:101+i,no:n,status:free?1:2,available:!!free};});};
 const stamp=min=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'medium'}).format(new Date(Date.now()+min*60000));
 // 当前预约在 3 小时后开始，但不跨过零点（晚上跑测试时不能变成“明天的预约”）。
 const toLate=Math.max(20,Math.floor((Date.parse(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date())+'T23:30:00+08:00')-Date.now())/60000)),begin=stamp(Math.min(180,toLate)),end=stamp(Math.min(360,toLate+25));
 const cancelled=new Set();let ended=false;let cancels=0,haptics=[];
 const tomorrow=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(Date.now()+86400000));
 const current=()=>connected&&scenario!=='fresh'&&scenario!=='tasks'&&!cancelled.has(9001)&&!ended?[{id:'qa-r1',type:1,no:'118',nameMerge:'二楼 · 中文阅览区',area_id:'11',beginTime:begin,endTime:end,statusMsg:away?'暂离中':'待签到',status_name:away?'暂离':'预约成功',canTemporaryLeave:!away,temporarilyAway:away,canCheckout:true}]:[];
 // ?rooms=600 模拟真实规模（几百间教室、八栋楼），用来测渲染和交互速度。
 const roomCount=Number(params.get('rooms'))||14,blds=roomCount>14?['1号教学楼','2号教学楼','3号教学楼','4号教学楼','5号教学楼','实验楼','图书馆','综合楼']:['1号教学楼','3号教学楼','实验楼'];
 const rooms=[...Array(roomCount)].map((_,i)=>({id:'r'+i,name:blds[i%blds.length]+' '+(101+i*3),campus:'长清校区',building:blds[i%blds.length],capacity:[60,120,80,45][i%4],reserved:i===4}));
 // 逐节占用（合成）：教室 i 在第 p 节空闲当且仅当 (i+p)%3!==0；带名称时按名称过滤。
 const roomQuery=p=>{if(!p.name&&(p.periods||[]).length!==1)return{total:rooms.length,page:1,pageSize:100,rooms};if(!p.name){const per=p.periods[0],list=rooms.filter((r,i)=>(i+per)%3!==0);return{total:list.length,page:1,pageSize:Number(p.pageSize)||100,rooms:list};}const per=(p.periods||[])[0],list=rooms.filter((r,i)=>r.name.includes(p.name)&&(i+per)%3!==0);return{total:list.length,page:1,pageSize:300,rooms:list};};
 const opts={xnm:[{value:'2026',label:'2026–2027',selected:true}],xqm:[{value:'3',label:'第 1 学期',selected:true}],xqh_id:[{value:'1',label:'长清校区',selected:true},{value:'2',label:'彩石校区',selected:false}],jxl_id:[{value:'',label:'全部教学楼',selected:true},{value:'a',label:'1号教学楼',selected:false}],currentWeek:7,periods:Array.from({length:12},(_,i)=>({value:i+1,label:String(i+1)}))};
 const past=n=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(Date.now()-n*86400000));
 const history=scenario==='fresh'?[]:[0,1,2,4,8,15].map((n,i)=>({space:200+i,beginTime:past(n+1)+' 08:00:00',endTime:past(n+1)+' 11:30:00',status_name:i===3?'已取消':'已完成',nameMerge:i%2?'二楼 · 中文阅览区':'三楼东 · 自习区',no:String(201+i)}));
 // 可取消的学校记录：当前预约对应 9001，明天还有一个 9002。
 const bookings=()=>scenario==='fresh'||scenario==='tasks'?[]:[{id:9001,no:'118',nameMerge:'二楼 · 中文阅览区',beginTime:begin,endTime:end},{id:9002,no:'A205',nameMerge:'三楼东 · 自习区',beginTime:tomorrow+' 08:00:00',endTime:tomorrow+' 12:00:00'}].map(x=>({...x,status:cancelled.has(x.id)?'4':ended&&x.id===9001?'5':'2',status_name:cancelled.has(x.id)?'已取消':ended&&x.id===9001?'已结束':'预约成功'}));
 let reminders=[],connectCalls=0;
 const lib=(m,p)=>{switch(m){
  // 模拟原生后台自动登录：未连接时先报“开始”，随后成功（或需要本人验证）。
  case'status':if(!connected&&autologin&&!autoRan){autoRan=true;setTimeout(()=>Campus.receive({event:'libraryLogin',state:'started'}),80);setTimeout(()=>{if(autologin==='ok'){connected=true;Campus.receive({event:'libraryLogin',state:'done'});Campus.receive({event:'sessionChanged',system:'library',connected:true});}else Campus.receive({event:'libraryLogin',state:'failed',needsUser:true});},700);}return{connected};
  case'catalog':return{libraries:[{id:'1',name:'长清校区图书馆'},{id:'2',name:'彩石校区图书馆'}]};
  case'areas':return{areas};
  case'seats':{const a=areas.find(x=>x.id===String(p.areaId));return{areaId:p.areaId,name:a?.name||'阅览区',kind:3,start:'08:00',end:'22:00',segments:[],seats:seatsFor(String(p.areaId))};}
  case'records':return[...bookings(),...booked.map((b,i)=>({id:'b'+i,status:'2',space:b.seatId,beginTime:b.day+' '+b.start+':00',endTime:b.day+' '+b.end+':00',status_name:'已预约',nameMerge:b.areaName,no:b.no})),...history];
  case'profile':return{name:'测试同学',card:'2024000000',dept:'测试学部',status:params.get('ban')?'3':'1',statusText:params.get('ban')?'临时禁止':'正常',validUntil:'2028-06-30'};
  case'violations':return params.get('vio')?{total:2,items:[{area:'二楼 · 中文阅览区',seat:'118',time:past(3)+' 08:30:00',status:'未签到'},{area:'三楼东 · 自习区',seat:'A203',time:past(9)+' 14:30:00',status:'未签到'}]}:{total:0,items:[]};
  case'rules':return{text:['模拟预约须知（合成数据）：','1. 预约开始后请按时签到。','2. 暂离请按时回座。'].join('\n')};
  case'current':return current();
  case'reserve':booked.push({seatId:p.seatId,day:p.day,start:p.start,end:p.end,areaName:p.areaName,no:(p.seats||[]).find(s=>String(s.id)===String(p.seatId))?.no});return{accepted:true};
  case'temporaryLeave':away=true;return{verified:true,current:current()};
  case'checkout':if(String(p.id)!=='qa-r1'||ended)throw Object.assign(Error('该预约已不在当前预约中'),{code:'STALE'});ended=true;window.__checkouts=1;return{verified:true,current:current()};
  case'cancelBooking':{const id=Number(p.id);if(!bookings().some(x=>x.id===id&&x.status==='2'))throw Object.assign(Error('学校当前不允许取消这个预约'),{code:'SCHOOL'});cancelled.add(id);window.__cancels=++cancels;return{verified:true,records:lib('records')};}
 }throw Object.assign(Error('未知操作'),{code:'INVALID'});};
 window.__setTeaching=v=>{teaching=v;};
 let allowed=params.get('notify')==='on',shown=false;
 const notify=()=>({allowed,permissionMissing:!allowed,sdk:Number(params.get('sdk')||36),liveUpdates:params.get('live')==='off'?false:true,xiaomi:true,focusProtocol:3,island:true,osName:'OS3.0',seatShown:shown});
 const fail=(id,code,message)=>setTimeout(()=>Campus.receive({id,ok:false,error:{code,message}}),60);
 window.NativeHost={post(text){const m=JSON.parse(text);let data=true;try{switch(m.cmd){
  case'ready':data={platform:params.get('platform')||'android',state:saved,username:scenario==='fresh'?'':'2024000000',hasCredentials:scenario!=='fresh'};break;
  case'saveState':saved=m.data;window.__saved=saved;try{localStorage.setItem(key,JSON.stringify(saved));}catch(e){}break;
  case'library':window.__schoolCalls=(window.__schoolCalls||0)+1;data=lib(m.data.method,m.data.params||{});break;
  case'teaching':if(!teaching){if(m.data.method==='status'){data={connected:false,page:'/jwglxt/xtgl/index_initMenu.html'};break;}return fail(m.id,'PAGE','未找到已加载的空闲教室页面，请在学生菜单打开后返回');}if(m.data.method==='rooms'){window.__roomCalls=(window.__roomCalls||0)+1;if(window.__netDown)return fail(m.id,'NETWORK','网络连接失败');}data=m.data.method==='options'?opts:m.data.method==='status'?{connected:true,page:'/jwglxt/cdjy/cdjy_cxKxcdlb.html'}:roomQuery(m.data.params||{});break;
  case'openLogin':case'openOfficial':window.__official=m.data;setTimeout(()=>{if(m.data.system==='library'||m.data.target==='library'){connected=true;Campus.receive({event:'sessionChanged',system:'library',connected:true});}if(m.data.system==='teaching'||m.data.target==='teaching'){teaching=true;Campus.receive({event:'sessionChanged',system:'teaching',connected:true});}},400);break;
  case'notify':window.__notified=(window.__notified||[]).concat(m.data.title);data={shown:true};break;
  case'exitApp':window.__exited=true;break;
  case'resetAll':window.__reset=true;break;
  case'saveDonate':window.__donateSaved=true;data={saved:true};break;
  case'credentials':case'forgetCredentials':case'appearance':case'openNotifySettings':break;
  case'haptic':haptics.push(m.data.kind);window.__haptics=haptics;break;
  case'reminders':reminders=m.data.items||[];window.__reminders=reminders;data={scheduled:reminders.length,exact:false,allowed};break;
  case'connectTeaching':{connectCalls++;window.__connectCalls=connectCalls;const need=params.get('teachauto')==='need';setTimeout(()=>{if(params.get('teachauto')==='menu')Campus.receive({id:m.id,ok:true,data:{connected:true}});else if(need)Campus.receive({id:m.id,ok:true,data:{connected:false,needsUser:true,page:'sso.qlu.edu.cn/login'}});else if(params.get('teach')==='off'||window.__offline)Campus.receive({id:m.id,ok:true,data:{connected:false,offline:true,page:'jw.qlu.edu.cn/sso/ddlogin'}});else{teaching=true;Campus.receive({event:'sessionChanged',system:'teaching',connected:true,probe:true});Campus.receive({id:m.id,ok:true,data:{connected:true}});}},scenario==='slow'?900:300);return;}
  case'notifyState':data=notify();break;
  case'requestNotify':allowed=true;data=notify();break;
  case'liveSeat':window.__live=m.data.clear?null:m.data;shown=!m.data.clear&&allowed;data=notify();break;
 }}catch(e){return fail(m.id,e.code||'ERROR',e.message);}setTimeout(()=>Campus.receive({id:m.id,ok:true,data}),scenario==='slow'?900:60);}};
 // Screenshot helpers: ?theme=dark&page=rooms&open=12&pick=204,212&query=1
 // badges=none：已用过但还没有勋章，记录读到后会获得“连续 3 天”。
 if(params.get('badges')==='none')seed.preferences.badges={default:{}};
 // 界面本身就是发布版（奶蛙版这类分支）而用例没指定 edition 时，按已同意协议启动，好让个人版用例也能跑。
 if(window.CampusEdition==='public'&&!params.get('edition'))seed.preferences.consent=1;
 // opens=99：已经打开过 99 次、一个月前第一次用（发布版感谢弹窗）；donatehidden=1：收款码已收起。
 if(params.get('opens')){seed.preferences.opens={n:Number(params.get('opens')),first:past(30),at:0};seed.preferences.consent=1;}
 if(params.get('donatehidden'))seed.preferences.donateHidden=true;
 if(params.get('theme'))seed.preferences.theme=params.get('theme');
 if(params.get('motion'))seed.preferences.motion=params.get('motion');
 if(params.get('accent'))seed.preferences.accent=params.get('accent');
 const q=s=>document.querySelector(s),until=async(fn)=>{for(let i=0;i<100&&!fn();i++)await new Promise(r=>setTimeout(r,50));};
 // 截图用：预置一份 4 天前的空教室离线副本。
 // seedcache=1：预置一份 7 天的离线空教室（与 roomQuery 同一套合成规则）；stale=1 时为 4 天前的数据。
 if(params.get('seedcache'))document.addEventListener('DOMContentLoaded',()=>{const C=window.CampusCore,P=[...Array(12)].map((_,i)=>i+1),days={},at=Date.now()-(params.get('stale')?4*86400000:0);for(let i=0;i<7;i++){const d=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(Date.now()+i*86400000)),states=new Map(rooms.map((r,k)=>[r.id,Object.fromEntries(P.filter(p=>(k+p)%3!==0).map(p=>[p,r.reserved?'2':'1']))]));days[d]={week:C.weekOf(d,7,day),weekday:new Date(d+'T12:00:00+08:00').getUTCDay()||7,at,s:C.packRoomDay(rooms.map(r=>[r.id]),P,states)};}try{localStorage.setItem('qlu.roomOffline.v2',JSON.stringify({v:1,year:'2026',term:'3',campus:'1',yearLabel:'2026–2027',termLabel:'第 1 学期',campusLabel:'长清校区',buildings:opts.jxl_id,periods:P,base:{day,week:7},rooms:rooms.map(r=>[r.id,r.name,r.building,r.capacity]),days,at,synced:day}));}catch(e){}});
 window.addEventListener('load',async()=>{
  await until(()=>window.CampusRuntimeReady&&q('#progress').hidden&&q('[data-area]'));
  if(params.get('open')){q('[data-area="'+params.get('open')+'"]')?.click();await until(()=>q('.seat-card')&&q('#progress').hidden);}
  for(const id of (params.get('pick')||'').split(',').filter(Boolean))q('[data-seat="'+id+'"]')?.click();
  if(params.get('page')){q('.nav [data-page="'+params.get('page')+'"]')?.click();}
  if(params.get('page')==='rooms'){q('[data-action="teachingOptions"]')?.click();await until(()=>q('#roomForm'));if(params.get('query')){q('#roomForm').requestSubmit();await until(()=>q('.room-results'));}if(params.get('roomday')){q('#roomFindInput').value=params.get('roomday');q('#roomFind').requestSubmit();}}
  if(params.get('sheet')==='book')q('[data-action="book"]')?.click();
  if(params.get('sheet')==='settings'){q('[data-action="settings"]')?.click();}
  if(!params.get('open'))window.scrollTo(0,0);
  if(params.get('scrollto')){await until(()=>q(params.get('scrollto')));q(params.get('scrollto'))?.scrollIntoView({block:'center'});}
 });
})();
