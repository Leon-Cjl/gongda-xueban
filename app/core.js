(function(g){'use strict';
const DTF=new Map(),dtf=(l,o)=>{const k=l+JSON.stringify(o);let f=DTF.get(k);if(!f){f=new Intl.DateTimeFormat(l,o);DTF.set(k,f);}return f;};// 日期格式器建一次反复用（每次 new 很慢，切页时要调几十次）
const active=['pending','checking','submitting','verifying'];
const errorText=e=>e?.message||String(e||'未知错误');
// 今天的日期一次渲染里要用几十次：同一秒内直接复用（真机切一次页要多花约 1ms）
let nowSec=-1,nowDay='';function nowChina(){const s=Math.floor(Date.now()/1000);if(s!==nowSec){nowSec=s;nowDay=dtf('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}return nowDay;}
// 日期要是日历上真有的一天（2 月 30 日这种格式对但不存在的拒掉），时间要是 00:00–23:59。
function validDay(day){if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;const d=new Date(day+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===day;}
function validTime(time){return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);}
function validateTask(t,now=Date.now()){
 if(!t||!Array.isArray(t.seats)||!t.seats.length||t.seats.length>3)throw Error('请选择 1–3 个首选或备选座位');
 if(t.seats.some(x=>!x||x.id==null||String(x.id).trim()===''))throw Error('座位信息不完整，请重新查询选座');
 if(new Set(t.seats.map(x=>String(x.id))).size!==t.seats.length)throw Error('首选和备选座位不能重复');
 if(!t.areaId||!validDay(t.day))throw Error('缺少有效区域或使用日期');
 const fire=Date.parse(t.fireAt);if(!Number.isFinite(fire)||fire<=now)throw Error('提交时间无效');
 if(!validTime(t.start)||!validTime(t.end))throw Error('请选择有效的开始和结束时间');
 const start=Date.parse(t.day+'T'+t.start+':00+08:00'),end=Date.parse(t.day+'T'+t.end+':00+08:00');
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)throw Error('使用结束时间必须晚于开始时间');
 if(fire>=end)throw Error('使用时段已经结束');
 if(t.kind===1&&!t.segment)throw Error('请选择学校提供的固定时段');
 return{...t,accountId:t.accountId||'default',id:t.id||crypto.randomUUID(),status:'pending',message:'正在提交',createdAt:new Date(now).toISOString()};
}
function recordParts(raw,fallbackDay=''){
 if(raw==null)return{day:fallbackDay,time:''};
 if(/^\d{10,13}$/.test(String(raw))){const n=Number(raw)*(String(raw).length===10?1000:1),d=new Date(n);return{day:dtf('sv-SE',{timeZone:'Asia/Shanghai'}).format(d),time:dtf('en-GB',{timeZone:'Asia/Shanghai',hour12:false,hour:'2-digit',minute:'2-digit'}).format(d)};}
 const text=String(raw),date=text.match(/\d{4}-\d{2}-\d{2}/),time=text.match(/(?:^|[ T])(\d{2}:\d{2})/);return{day:date?date[0]:fallbackDay,time:time?time[1]:''};
}
// loose：事后补核对“有没有约上”时，用完了（已结束）、没去（违约、未签到）也说明当时约上了，只有取消、撤销、失效才不算。
function recordMatches(r,t,seat,loose=false){
 const id=r.space??r.seat_id??r.space_id;
 const begin=recordParts(r.beginTime??r.start_time??r.startTime,r.day??r.date??'');
 const end=recordParts(r.endTime??r.end_time,begin.day);
 const bad=(loose?/取消|撤销|失效/:/取消|违约|结束|失效/).test(String(r.status_name||'')+String(r.statusMsg||''));
 if(String(id)!==String(seat.id)||begin.day!==t.day||end.day!==t.day||bad)return false;
 return !!begin.time&&!!end.time&&begin.time<=t.start&&end.time>=t.end;
}
// 学校针对账号的长期性拒绝（已有预约、违约受限、禁止、权限等），用于提示文案。
const PERMANENT=/已有预约|您已有|重复预约|违约|禁止|黑名单|上限|次数|冻结|无权|权限|挂失|注销/;
const permanentRejection=message=>PERMANENT.test(String(message||''));
// 立即预约：确认后马上按顺序试所选的 1–3 个座位，约到一个就停。每次只按顺序试一遍，提交后结果不明时绝不再提交。
class Booker{
 constructor({tasks,api,save,changed,warn,now=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms)),authWait=20000}){this.authWait=authWait;this.tasks=tasks;this.api=api;this.save=save;this.changed=changed||(()=>{});this.warn=warn||(()=>{});this.now=now;this.sleep=sleep;this.running=new Set();}
 async state(t,status,message){t.status=status;t.message=message;t.updatedAt=new Date(this.now()).toISOString();await this.save();this.changed();}
 async recover(){for(const t of this.tasks){if(['checking','submitting','verifying'].includes(t.status))await this.state(t,'uncertain','上次执行被中断，刷新记录时会自动核对结果');else if(t.status==='draft')await this.state(t,'cancelled','任务未完成本机保存，未启用');}}
 async tick(){
  const due=this.tasks.filter(x=>x.status==='pending'&&Date.parse(x.fireAt)<=this.now()),jobs=[];
  for(const t of due){const id=t.accountId||'default';if(this.running.has(id))continue;this.running.add(id);jobs.push(this.run(t).finally(()=>this.running.delete(id)));}
  await Promise.all(jobs);
 }
 async run(t){
  const accountId=t.accountId||'default',api=(method,params)=>this.api(method,params,accountId);
  try{
   // 应用关着、过了很久才轮到的预约不补交。
   if(this.now()-Date.parse(t.fireAt)>60000){await this.state(t,'missed','应用当时没有运行，未提交预约，请重新预约');return;}
   await this.state(t,'checking','正在检查登录和已有预约');
   // 安卓的后台自动登录要几秒：登录还没恢复时最多等 authWait 再判定失效。
   let status=await api('status',{});
   for(let i=0,stop=this.now()+this.authWait;!status.connected&&!t.cancelRequested&&this.now()<stop&&i<Math.ceil(this.authWait/2000);i++){t.message='等待自动登录完成';this.changed();await this.sleep(2000);status=await api('status',{});}
   if(!status.connected)throw Object.assign(Error('登录已失效，请重新登录后再预约'),{code:'AUTH'});
   const before=await api('records',{});
   for(const seat of t.seats)if(before.some(r=>recordMatches(r,t,seat))){t.bookedSeat=seat;await this.state(t,'succeeded','这个座位已经约到了，不用重复提交');return;}
   if(t.cancelRequested){await this.state(t,'cancelled','已取消，本机不再执行');return;}
   const d=await api('seats',t);
   if(d.kind!=null&&Number(d.kind)!==Number(t.kind))throw Error('学校预约规则已变化，请重新选座');
   let reason='所选座位当前不可预约';
   for(const seat of t.seats){
    const found=d.seats.find(x=>String(x.id)===String(seat.id));
    if(!found?.available)continue;
    if(t.cancelRequested){await this.state(t,'cancelled','已取消，本机不再执行');return;}
    await this.state(t,'submitting','正在提交 '+seat.no+' 号座位');
    // 学校拒绝这个座位时按顺序试下一个备选。
    try{await api('reserve',{...t,seatId:seat.id});}
    catch(e){if(e.code==='SCHOOL'){reason=errorText(e);await this.state(t,'checking',reason);continue;}throw e;}
    await this.state(t,'verifying','已提交，正在确认');
    // 学校记录偶尔晚一两秒才出现：最多读 3 次再下结论；仍没有时不再重复提交，之后每次刷新记录都会自动再核对。
    let matched=false;
    for(let k=0;k<3&&!matched;k++){if(k)await this.sleep(2000);let after;try{after=await api('records',{});}catch(e){if(k===2)throw e;continue;}matched=after.some(r=>recordMatches(r,t,seat));}
    if(matched){t.bookedSeat=seat;await this.state(t,'succeeded','约到了，记得按时签到');}
    else await this.state(t,'uncertain','已提交，但预约记录里暂时没有；刷新时会自动再核对');
    return;
   }
   await this.state(t,'failed',reason==='所选座位当前不可预约'?'所选座位当前不可预约，或学校未接受预约':reason);
  }catch(e){const uncertain=t.status==='submitting'||t.status==='verifying'||e.uncertain;await this.state(t,uncertain?'uncertain':e.code==='AUTH'?'needs_auth':'failed',errorText(e));}
 }
}
function validateTaskConflicts(existing,added){
 const checked=existing.filter(t=>active.includes(t.status));
 for(const t of added){
  for(const other of checked){
   if(other.day!==t.day||other.end<=t.start||t.end<=other.start)continue;
   if((other.accountId||'default')===(t.accountId||'default'))throw Error('同一使用时段已有正在进行的预约，请先取消旧的');
  }
  checked.push(t);
 }
 return added;
}
function favoriteKey(type,item){return type==='seat'?'seat:'+String(item.areaId)+':'+String(item.id):'room:'+String(item.campus||item.query?.campus||'')+':'+String(item.id||item.name);}
function addFavorite(items,type,item){
 if(!['seat','room'].includes(type)||!item||!item.id)throw Error('缺少可收藏的位置');
 const key=favoriteKey(type,item),old=items.find(x=>x.key===key);
 const clean=type==='seat'?{id:String(item.id),no:String(item.no),areaId:String(item.areaId),areaName:String(item.areaName||''),libraryId:String(item.libraryId||'')}:{id:String(item.id),name:String(item.name||''),campus:String(item.campus||''),building:String(item.building||''),capacity:item.capacity||'',query:item.query?{...item.query,periods:[...(item.query.periods||[])]}:null};
 const entry={...clean,key,type,createdAt:old?.createdAt||new Date().toISOString()};
 return old?items.map(x=>x.key===key?entry:x):[...items,entry];
}
function visibleSeats(seats,{query='',freeOnly=false,favoriteOnly=false}={},favorites=[],areaId=''){
 const q=String(query).trim().toLowerCase();return seats.filter(s=>(!q||String(s.no).toLowerCase().includes(q))&&(!freeOnly||s.available)&&(!favoriteOnly||favorites.some(f=>f.key===favoriteKey('seat',{...s,areaId}))));
}
// 学校时间字段可能是“YYYY-MM-DD HH:MM(:SS)”、“HH:MM”或 10/13 位时间戳，统一换成北京时间。
function parseStamp(raw,day,today=nowChina()){
 if(raw==null||raw==='')return null;
 const s=String(raw);
 if(/^\d{10,13}$/.test(s)){const ms=Number(s)*(s.length===10?1000:1),d=new Date(ms);return{ms,day:dtf('sv-SE',{timeZone:'Asia/Shanghai'}).format(d),time:dtf('en-GB',{timeZone:'Asia/Shanghai',hour12:false,hour:'2-digit',minute:'2-digit'}).format(d)};}
 const date=s.match(/\d{4}-\d{2}-\d{2}/),t=s.match(/(\d{1,2}):(\d{2})/);
 if(!t||Number(t[1])>23||Number(t[2])>59)return null;
 const d=date?date[0]:day||today,time=t[1].padStart(2,'0')+':'+t[2],ms=Date.parse(d+'T'+time+':00+08:00');
 return Number.isFinite(ms)?{ms,day:d,time}:null;
}
// 当前预约的起止时间；字段名不统一，读不到就返回 null，不猜测。
function reservationTimes(r,today=nowChina()){
 const begin=parseStamp(r.beginTime??r.startTime??r.start_time,r.day||r.date,today);
 const end=parseStamp(r.endTime??r.end_time,begin?.day||r.day||r.date,today);
 return begin&&end&&end.ms>begin.ms?{begin,end}:null;
}
// 学校“当前预约”没有列出时，用本机已核验成功的预约：尚未开始的，或刚成功 10 分钟内的（学校列表可能有延迟）。
function bookedTask(tasks,accountId='default',now=Date.now()){
 const at=(t,time)=>Date.parse(t.day+'T'+(time||'00:00')+':00+08:00');
 return tasks.filter(t=>t.status==='succeeded'&&t.bookedSeat&&!t.bookingCancelled&&(t.accountId||'default')===accountId&&at(t,t.end||'23:59')>now&&(at(t,t.start)>now||now-Date.parse(t.updatedAt||0)<600000)).sort((a,b)=>at(a,a.start)-at(b,b.start))[0]||null;
}
function periodText(list){
 const v=[...new Set((list||[]).map(Number).filter(Number.isFinite))].sort((a,b)=>a-b),out=[];
 for(let i=0;i<v.length;i++){let j=i;while(j+1<v.length&&v[j+1]===v[j]+1)j++;out.push(i===j?String(v[i]):v[i]+'–'+v[j]);i=j;}
 return out.join('、')||'—';
}
// 主题色：由一个基色推出浅色/深色模式下的强调色、浅底色和浅底上的文字色。
function accentPalette(base,dark){
 if(!/^#?[0-9a-f]{6}$/i.test(String(base)))throw Error('主题色格式不正确');
 const n=parseInt(String(base).replace('#',''),16),c=[n>>16&255,n>>8&255,n&255],mix=(t,to)=>c.map(x=>Math.round(x+(to-x)*t)),hex=a=>'#'+a.map(x=>x.toString(16).padStart(2,'0')).join('');
 return dark?{primary:hex(mix(.15,255)),onPrimary:'#ffffff',soft:hex(mix(.72,0)),onSoft:hex(mix(.5,255)),seat:hex(mix(.7,0)),onSeat:hex(mix(.55,255))}
  :{primary:hex(c),onPrimary:'#ffffff',soft:hex(mix(.88,255)),onSoft:hex(mix(.25,0)),seat:hex(mix(.88,255)),onSeat:hex(mix(.25,0))};
}
// ---------- 0.8：提醒、统计与筛选 ----------
const clockText=ms=>dtf('en-GB',{timeZone:'Asia/Shanghai',hour12:false,hour:'2-digit',minute:'2-digit'}).format(new Date(ms));
const seatLabel=no=>{const s=String(no||'');return /^[A-Za-z]?\d+$/.test(s)?s+' 号':s;};
// 签到提醒：预约开始前 lead 分钟提醒一次。来源是学校“当前预约”里尚未开始的预约和本机核验成功的预约任务，按座位与开始时间去重。
// 编号按“座位 + 开始时间”生成，不管来自学校列表还是本机任务都一致；学校记录显示已取消的本机任务不再提醒。
function checkinReminders({current=[],tasks=[],records=[],accountIds=null,leadMinutes=15,extra=[],now=Date.now(),today=nowChina(),pass=false}={}){
 const lead=Math.max(0,Number(leadMinutes)||0)*60000,out=[],seen=new Set();
 const cancelled=t=>t.bookingCancelled||records.some(r=>String(r.space??r.seat_id??r.space_id)===String(t.bookedSeat.id)&&/取消|失效|撤销/.test(String(r.status_name||'')+String(r.statusMsg||''))&&recordParts(r.beginTime??r.start_time??r.startTime,r.day??r.date??'').day===t.day&&recordParts(r.beginTime??r.start_time??r.startTime,'').time===t.start);
 const add=(area,no,begin)=>{
  const at=begin-lead,id='r:'+String(no)+'@'+begin;
  if(!lead||!Number.isFinite(begin)||seen.has(id)||at<=now+15000)return;
  seen.add(id);
  out.push({id,at,title:clockText(begin)+' 的预约快开始了',text:(area||'图书馆')+' '+seatLabel(no)+' · '+Math.round(lead/60000)+' 分钟后开始，记得按时签到，未按时签到可能被记违约。'+(pass?'点此出示入馆码。':'')});
 };
 // 已经签到（使用中、已入座等）的预约不再提醒签到；同一个预约在本机任务里也跳过。
 for(const r of current){const t=reservationTimes(r,today);if(!t)continue;if(r.temporarilyAway||/使用中|已签到|已入座|已入馆/.test(String(r.statusMsg||r.status_name||''))){seen.add('r:'+String(r.no||r.name)+'@'+t.begin.ms);continue;}add(r.nameMerge||r.areaName,r.no||r.name,t.begin.ms);}
 // 在学校页面或别处约的、还没开始的预约（例如明天的）：学校的“当前预约”里没有，按预约记录提醒
 for(const r of upcomingBookings(records,current,now,today)){const t=reservationTimes(r,today);if(t)add(r.nameMerge||r.areaName,r.no??r.name,t.begin.ms);}
 for(const t of tasks){if(t.status!=='succeeded'||!t.bookedSeat||accountIds&&!accountIds.includes(t.accountId||'default')||cancelled(t))continue;add(t.areaName,t.bookedSeat.no,Date.parse(t.day+'T'+t.start+':00+08:00'));}
 for(const x of extra)if(x&&x.id&&Number(x.at)>now+15000)out.push({id:String(x.id),at:Number(x.at),title:String(x.title||'提醒'),text:String(x.text||'')});
 return out.sort((a,b)=>a.at-b.at).slice(0,12);
}
// 学习足迹：只按学校返回的最近记录估算，取消、违约、未签到的不计。
// 真正入馆的记录：去掉取消、违约、未签到等，尚未开始的不算；进行中的算到现在。
const clockFormat=dtf('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false});
// 没去成的状态：取消、违约、未签到等，统计、成就、记录列表都按这一份判断。
const NEGATIVE_STATUS=/取消|违约|未签到|失效|撤销|爽约/;
// 也接受本机累积的日志项（见 mergeVisitLog），这样学习足迹、日历、小结和成就用的是同一份数据。
function logVisit(v,now){
 const begin=Number(v[0]),left=Number(v[6])||begin+(Number(v[1])||0);
 if(!(begin>0)||begin>now)return null;
 const end=Math.min(left,now);
 return{begin,sign:Number(v[5])||0,day:String(v[2]),ms:v[6]?Math.max(0,end-begin):Number(v[1])||0,area:String(v[3]||''),seat:String(v[4]||''),left,endTime:left<=now?clockFormat.format(new Date(left)):''};
}
function usedVisits(records=[],now=Date.now(),today=nowChina()){
 const used=[],seen=new Set();
 for(const r of records){
  if(Array.isArray(r)){const x=logVisit(r,now);if(x)used.push(x);continue;}
  if(NEGATIVE_STATUS.test(String(r.status_name||r.statusMsg||'')))continue;
  const t=reservationTimes(r,today);if(!t||t.begin.ms>now)continue;
  // 学校接口翻页时偶尔重复给同一条记录：按 id（没有就按时间 + 区域 + 座位）去重，次数和时长不重复算
  const key=String(r.id??[t.begin.ms,t.end.ms,r.nameMerge||r.areaName||'',r.no??r.name??''].join('|'));if(seen.has(key))continue;seen.add(key);
  // 提前签退时学校在 finishTime 记实际离开时间，按它算时长；没有就按预约结束
  const fin=parseStamp(r.finishTime??r.finish_time,t.begin.day,today),left=fin&&fin.ms>t.begin.ms&&fin.ms<t.end.ms?fin.ms:t.end.ms;
  const end=Math.min(left,now);
  // 签到时间（学校给了才有）：早起鸟优先按它算，提前一晚约的座位不会因为预约从开馆开始就被当成早到
  const sg=parseStamp(r.signTime??r.sign_time??r.signInTime??r.checkInTime??r.checkinTime,t.begin.day,today),sign=sg&&sg.ms>=t.begin.ms-7200000&&sg.ms<=t.end.ms?sg.ms:0;
  used.push({begin:t.begin.ms,sign,day:t.begin.day,ms:Math.max(0,end-t.begin.ms),area:String(r.nameMerge||r.areaName||''),seat:String(r.no??r.name??''),left,endTime:left<=now?clockFormat.format(new Date(left)):''});
 }
 return used;
}
function libraryStats(records=[],now=Date.now(),today=nowChina()){
 const used=usedVisits(records,now,today);
 const month=today.slice(0,7),inMonth=used.filter(x=>x.day.slice(0,7)===month),days=new Set(used.map(x=>x.day));
 const count={};for(const x of used)if(x.area)count[x.area]=(count[x.area]||0)+1;
 const top=Object.entries(count).sort((a,b)=>b[1]-a[1])[0];
 const shift=(d,n)=>dtf('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(Date.parse(d+'T12:00:00+08:00')+n*86400000));
 let streak=0,cursor=days.has(today)?today:shift(today,-1);
 while(days.has(cursor)){streak++;cursor=shift(cursor,-1);}
 return{sample:records.length,visits:used.length,monthVisits:inMonth.length,monthHours:Math.round(inMonth.reduce((a,x)=>a+x.ms,0)/360000)/10,totalHours:Math.round(used.reduce((a,x)=>a+x.ms,0)/360000)/10,streak,topArea:top?top[0]:'',topCount:top?top[1]:0};
}
// 区域筛选：楼层、只看有空座、名称搜索、按空座排序。
function areaFloors(areas=[]){return[...new Set(areas.map(a=>String(a.floor||'')).filter(Boolean))];}
function filterAreas(areas=[],{floor='',freeOnly=false,query='',sort=''}={}){
 const q=String(query||'').trim().toLowerCase();
 const list=areas.filter(a=>(!floor||String(a.floor||'')===floor)&&(!freeOnly||Number(a.free)>0)&&(!q||String(a.name||'').toLowerCase().includes(q)||String(a.floor||'').toLowerCase().includes(q)));
 return sort==='free'?list.slice().sort((a,b)=>(Number(b.free)||0)-(Number(a.free)||0)):list;
}
function maskCard(card){const s=String(card||'');return s.length>=8?s.slice(0,4)+'****'+s.slice(-2):s;}
function daysUntil(day,today=nowChina()){const a=Date.parse(String(day)+'T00:00:00+08:00'),b=Date.parse(today+'T00:00:00+08:00');return Number.isFinite(a)?Math.round((a-b)/86400000):null;}
function greeting(hour){return hour>=5&&hour<11?'早上好':hour>=11&&hour<13?'中午好':hour>=13&&hour<18?'下午好':hour>=18&&hour<23?'晚上好':'夜深了';}
// 称呼：三字名去掉姓，四字名多为复姓、去掉前两字，其余原样。
function givenName(name){const s=String(name||'').trim();return /^[\u4e00-\u9fa5]{3}$/.test(s)?s.slice(1):/^[\u4e00-\u9fa5]{4}$/.test(s)?s.slice(2):s;}
// 可取消的预约：与官方预约记录页的条件一致（status 2/9，oksign 存在时须为 1）。
function cancellableRecord(r){return !!r&&['2','9'].includes(String(r.status))&&(r.oksign==null||Number(r.oksign)===1);}
const seatOf=r=>String(r?.no??r?.name??'');
// 当前预约卡片对应的学校记录：同一座位号、同一开始时间。
function matchRecord(records=[],r,today=nowChina()){
 const t=reservationTimes(r,today);if(!t)return null;
 return records.find(x=>seatOf(x)===seatOf(r)&&reservationTimes(x,today)?.begin.ms===t.begin.ms)||null;
}
// 还没出现在“当前预约”里、可以取消的预约（例如明天的），按开始时间排序。
function upcomingBookings(records=[],current=[],now=Date.now(),today=nowChina()){
 return records.filter(x=>cancellableRecord(x)&&(reservationTimes(x,today)?.end.ms||0)>now&&!current.some(r=>matchRecord([x],r,today))).sort((a,b)=>reservationTimes(a,today).begin.ms-reservationTimes(b,today).begin.ms);
}
// 教室某天逐节的占用：states 是 {节次: 'free'|'borrowed'|'busy'}，合并成连续区段。
function roomDay(periods=[],states={}){
 const v=[...new Set(periods.map(Number).filter(Number.isFinite))].sort((a,b)=>a-b),out=[];
 for(const p of v){const s=states[p]||'busy',last=out[out.length-1];if(last&&last.state===s&&last.to===p-1)last.to=p;else out.push({from:p,to:p,state:s});}
 // 文字只列空闲的节次，占用情况看上面的色块。
 const free=out.filter(x=>x.state==='free').map(x=>x.from===x.to?String(x.from):x.from+'–'+x.to);
 return{segments:out,text:free.length?'空闲：第 '+free.join('、')+' 节':'这一天没有空闲的节次',freeCount:v.filter(p=>(states[p]||'busy')==='free').length};
}
// 教学周 + 星期 → 日期：以“今天是第 currentWeek 周”为基准推算。
function weekDate(week,weekday,currentWeek,today=nowChina()){
 const t=new Date(today+'T12:00:00+08:00'),wd=t.getUTCDay()||7,diff=(Number(week)-Number(currentWeek))*7+(Number(weekday)-wd);
 return Number.isFinite(diff)&&currentWeek?dtf('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(t.getTime()+diff*86400000)):'';
}
// 空教室离线副本：只留界面要用的字段，房间数封顶，避免本机存储变大。
const ROOM_FIELDS=['id','name','building','campus','capacity','reserved'];
function roomSnapshot(rooms=[],limit=300){return rooms.slice(0,limit).map(x=>{const o={};for(const k of ROOM_FIELDS)if(x[k]!==undefined&&x[k]!=='')o[k]=x[k];if(x.states)o.states=x.states;return o;});}
// 日期 → 教学周（weekDate 的反向）：以“today 是第 currentWeek 周”为基准，周一起算。
function weekOf(day,currentWeek,today=nowChina()){
 const t=Date.parse(today+'T12:00:00+08:00'),wd=new Date(t).getUTCDay()||7,monday=t-(wd-1)*86400000,d=Date.parse(day+'T12:00:00+08:00');
 return Number(currentWeek)+Math.floor(Math.round((d-monday)/86400000)/7);
}
// 离线空教室：每天按节同步一次。rooms 是 [id,名称,教学楼,座位数]；days[日期].s 每间教室占 periods.length 个字符：0 有课或占用，1 空闲，2 空闲但有借用。
function packRoomDay(rooms=[],periods=[],states=new Map()){return rooms.map(r=>{const m=states.get(String(r[0]))||{};return periods.map(p=>m[p]||'0').join('');}).join('');}
// 某教学周某天在离线数据里的那一天：有就用；没有就用同一星期几里日期最近的一天按课表推算（approx）。
function offlineDay(data,week,weekday){
 if(!data?.days||!data.base)return null;
 const date=weekDate(week,weekday,data.base.week,data.base.day);
 if(data.days[date])return{date,source:date,approx:false,day:data.days[date]};
 const t=Date.parse(date+'T12:00:00+08:00'),same=Object.keys(data.days).filter(d=>(new Date(d+'T12:00:00+08:00').getUTCDay()||7)===Number(weekday)).sort((a,b)=>Math.abs(Date.parse(a+'T12:00:00+08:00')-t)-Math.abs(Date.parse(b+'T12:00:00+08:00')-t));
 return same.length?{date,source:same[0],approx:true,day:data.days[same[0]]}:null;
}
const buildingKey=x=>String(x||'').toLowerCase().replace(/[\s\-_·.#（）()]/g,'').replace(/教学楼|教学|楼$/g,'');
function sameBuilding(a,b){if(String(a)===String(b))return true;const x=buildingKey(a);return !!x&&x===buildingKey(b);}
// 离线查询：与联网时同样的条件（教学楼、名称、周次、星期、节次都无课），顺带算出“空到第几节”。
function offlineRooms(data,{building='',name='',week,weekday,periods=[]}={}){
 const hit=offlineDay(data,week,weekday);if(!hit)return null;
 const P=data.periods||[],n=P.length,s=hit.day.s||'',want=periods.map(Number).filter(p=>P.includes(p)),last=Math.max(...want);
 const label=building?(data.buildings||[]).find(b=>String(b.value)===String(building))?.label||'':'',key=x=>String(x||'').toLowerCase().replace(/[\s\-_·.#（）()]/g,''),k=key(name);
 const known=!label||data.rooms.some(r=>sameBuilding(r[2],label)),rooms=[],final={};
 data.rooms.forEach((r,i)=>{
  const st=p=>s[i*n+P.indexOf(p)]||'0';
  if(!want.length||want.some(p=>st(p)==='0'))return;
  if(label&&known&&!sameBuilding(r[2],label)||k&&!key(r[1]).includes(k))return;
  const reserved=want.some(p=>st(p)==='2');
  rooms.push({id:r[0],name:r[1],building:r[2],campus:data.campusName||data.campusLabel||'',capacity:r[3],reserved});
  if(!reserved){let reached=last;for(const p of P.filter(p=>p>last)){if(st(p)!=='1')break;reached=p;}final[String(r[0])]=reached;}
 });
 return{date:hit.date,source:hit.source,approx:hit.approx,at:hit.day.at,rooms,until:{final,last:P[n-1]??last,done:true},anyBuilding:!!label&&!known};
}
// 离线“看全天”：一次算出名称匹配（或指定 id）的教室在这一天每一节的状态，不用逐节查。
function offlineRoomDay(data,{name='',exactId='',week,weekday}={}){
 const hit=offlineDay(data,week,weekday);if(!hit)return null;
 const P=data.periods||[],n=P.length,s=hit.day.s||'',key=x=>String(x||'').toLowerCase().replace(/[\s\-_·.#（）()]/g,''),k=key(name),rooms=[];
 data.rooms.forEach((r,i)=>{
  if(exactId?String(r[0])!==String(exactId):!k||!key(r[1]).includes(k))return;
  const states={};P.forEach((p,j)=>{const c=s[i*n+j];if(c==='1')states[p]='free';else if(c==='2')states[p]='borrowed';});
  rooms.push({id:r[0],name:r[1],building:r[2],campus:data.campusName||data.campusLabel||'',capacity:r[3],states});
 });
 return{date:hit.date,source:hit.source,approx:hit.approx,at:hit.day.at,periods:P,rooms};
}
// 副本过了几天（按北京时间的日期算）；超过 staleDays 天提醒重新查询。
function cacheAge(at,now=Date.now(),staleDays=3){const days=Math.floor((Date.parse(chinaDay(now)+'T00:00:00+08:00')-Date.parse(chinaDay(at)+'T00:00:00+08:00'))/86400000);return{days:Number.isFinite(days)?days:0,stale:Number.isFinite(days)&&days>=staleDays};}
// 每日一句：同一天固定一句，第二天换下一句。
function dailyPick(list=[],day=nowChina()){if(!list.length)return null;const n=Math.floor(Date.parse(day+'T12:00:00+08:00')/86400000);return list[((n%list.length)+list.length)%list.length];}
// 入馆日历：某月每天的入馆小时数与深浅等级（0 没去，1–4 越深待得越久）。
function monthCalendar(records=[],month=nowChina().slice(0,7),now=Date.now(),today=nowChina()){
 const used=usedVisits(records,now,today).filter(x=>x.day.slice(0,7)===month),byDay={};
 for(const x of used)byDay[x.day]=(byDay[x.day]||0)+x.ms;
 const first=Date.parse(month+'-01T12:00:00+08:00'),dim=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
 const days=Array.from({length:dim},(_,i)=>{const day=month+'-'+String(i+1).padStart(2,'0'),h=(byDay[day]||0)/3600000;return{day,hours:Math.round(h*10)/10,level:h<=0?0:h<2?1:h<4?2:h<6?3:4,future:day>today};});
 return{month,offset:(new Date(first).getUTCDay()+6)%7,days,visits:used.length,activeDays:Object.keys(byDay).length,hours:Math.round(used.reduce((a,x)=>a+x.ms,0)/360000)/10};
}
// 月度小结：次数、小时、入馆天数、最常坐的座位、最晚离开、月内最长连续天数。
function monthSummary(records=[],month=nowChina().slice(0,7),now=Date.now(),today=nowChina()){
 const used=usedVisits(records,now,today).filter(x=>x.day.slice(0,7)===month),cal=monthCalendar(records,month,now,today);
 const seats={};for(const x of used)if(x.seat){const k=x.area+'\u0000'+x.seat;seats[k]=(seats[k]||0)+1;}
 const top=Object.entries(seats).sort((a,b)=>b[1]-a[1])[0];
 let best=0,run=0;for(const d of cal.days){run=d.level?run+1:0;best=Math.max(best,run);}
 const latest=used.map(x=>x.endTime).filter(Boolean).sort().pop()||'';
 return{month,visits:used.length,hours:cal.hours,activeDays:cal.activeDays,longestStreak:best,latest,topSeat:top?{area:top[0].split('\u0000')[0],no:top[0].split('\u0000')[1],count:top[1]}:null};
}
// 小勋章：连续入馆、累计小时、单月次数。只增不减，记录被学校接口挤出最近 100 条后也保留。
// 入馆记录在本机累积：学校每次只给最近十来条，按“开始时间 + 座位”去重合并，成就按累积的算。日志项：[开始ms, 时长ms, 日期, 区域, 座位, 签到ms（没有为 0）, 离开ms（实际或预约结束）]，旧记录只有前 5 项。
function mergeVisitLog(log=[],records=[],now=Date.now(),today=nowChina()){
 const map=new Map((Array.isArray(log)?log:[]).filter(v=>Array.isArray(v)&&v.length>=5).map(v=>[v[0]+'|'+v[4],v]));
 // 之前记下的进行中预约，后来被取消或判了违约，要从本机记录里去掉
 for(const r of records){if(Array.isArray(r)||!NEGATIVE_STATUS.test(String(r.status_name||r.statusMsg||'')))continue;const t=reservationTimes(r,today);if(t)map.delete(t.begin.ms+'|'+String(r.no??r.name??''));}
 for(const x of usedVisits(records.filter(r=>!Array.isArray(r)),now,today))map.set(x.begin+'|'+x.seat,[x.begin,x.ms,x.day,x.area,x.seat,x.sign,x.left]);
 return[...map.values()].sort((a,b)=>a[0]-b[0]).slice(-2000);
}
// 成就：每种都有几级，id 为 key+门槛（与旧勋章 streak3 / hours10 / month10 等一致，已得的照旧算）。
const ACHIEVEMENTS=[
 ['streak','连续入馆','🔥','最长连续入馆天数',[3,7,14,30],n=>'连续 '+n+' 天'],
 ['hours','时长积累','⏳','累计在馆时长（按预约时段，提前签退按实际离开算）',[10,50,100,200,500],n=>'累计 '+n+' 小时'],
 ['days','入馆打卡','📚','去过图书馆的天数',[10,30,60,100,200],n=>'入馆 '+n+' 天'],
 ['early','早起鸟','🌅','早上 8:30 及以前开始学习的天数',[3,10,30],n=>'早起 '+n+' 天'],
 ['weekend','周末不打烊','☀️','周六、周日去图书馆的天数',[3,10,30],n=>'周末 '+n+' 天'],
 ['explorer','探索者','🧭','坐过的不同阅览区',[3,6,10],n=>'去过 '+n+' 个区域'],
 ['seat','老地方','📍','同一个座位坐过的次数',[5,15,30],n=>'同座 '+n+' 次'],
 ['week','满勤周','🗓️','一周里去了 5 天的周数',[1,4,10],n=>'满勤 '+n+' 周'],
 ['month','月度达人','🏅','单月最多入馆天数',[10,20],n=>'单月入馆 '+n+' 天'],
 ['opens','老朋友','🤝','打开工大学伴的次数（达成前不显示）',[100,300],n=>'打开 '+n+' 次'],
];
function achievementStats(log=[]){
 const days=[...new Set(log.map(v=>v[2]))].sort(),shift=d=>dtf('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(Date.parse(d+'T12:00:00+08:00')+86400000));
 let streak=0,run=0,prev='';for(const d of days){run=prev&&shift(prev)===d?run+1:1;streak=Math.max(streak,run);prev=d;}
 // 北京时间当天第几分钟：直接算，不依赖各家 WebView 的时间格式化（有的会给出“24:05”或带空格的写法）
 const minuteOfDay=ms=>Math.floor((Number(ms)/60000+480)%1440),wd=d=>new Date(d+'T12:00:00+08:00').getUTCDay();
 const seats={},weeks={},months={};
 for(const v of log)if(v[4]){const k=v[3]+'|'+v[4];seats[k]=(seats[k]||0)+1;}
 for(const d of days){const t=Date.parse(d+'T12:00:00+08:00'),mon=t-((new Date(t).getUTCDay()+6)%7)*86400000;weeks[mon]=(weeks[mon]||0)+1;months[d.slice(0,7)]=(months[d.slice(0,7)]||0)+1;}
 return{streak,hours:Math.floor(log.reduce((a,v)=>a+(Number(v[1])||0),0)/3600000),days:days.length,early:new Set(log.filter(v=>Number(v[0])>0&&minuteOfDay(Number(v[5])||v[0])<=510).map(v=>v[2])).size,weekend:days.filter(d=>[0,6].includes(wd(d))).length,explorer:new Set(log.map(v=>v[3]).filter(Boolean)).size,seat:Math.max(0,...Object.values(seats)),week:Object.values(weeks).filter(n=>n>=5).length,month:Math.max(0,...Object.values(months))};
}
function achievements(stats={}){return ACHIEVEMENTS.map(([key,name,icon,desc,tiers,label])=>{const value=Number(stats[key])||0,reached=tiers.filter(n=>value>=n).length;return{key,name,icon,desc,tiers,value,reached,next:tiers[reached]??null,label,ids:tiers.map(n=>key+n)};});}
function earnedAchievements(stats={}){return achievements(stats).flatMap(a=>a.tiers.slice(0,a.reached).map(n=>({id:a.key+n,label:a.name+' · '+a.label(n)})));}
const MILESTONES=[['streak3','连续 3 天','streak',3],['streak7','连续一周','streak',7],['streak14','连续两周','streak',14],['streak30','连续一个月','streak',30],['hours10','累计 10 小时','totalHours',10],['hours50','累计 50 小时','totalHours',50],['hours100','累计 100 小时','totalHours',100],['hours200','累计 200 小时','totalHours',200],['month10','单月入馆 10 次','monthVisits',10],['month20','单月入馆 20 次','monthVisits',20]];
function earnedMilestones(stats={}){return MILESTONES.filter(([, , key,n])=>Number(stats[key])>=n).map(([id,label])=>({id,label}));}
// 老位置：这个座位在记录里真正坐过几次（区域名两边写法可能不同，互相包含就算同一区域）。
function seatVisits(records=[],no,area='',now=Date.now(),today=nowChina()){
 const a=String(area||'');
 return usedVisits(records,now,today).filter(x=>x.seat===String(no)&&(!a||!x.area||x.area===a||x.area.includes(a)||a.includes(x.area))).length;
}
const chinaDay=ms=>dtf('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(ms));
const exports={NEGATIVE_STATUS,mergeVisitLog,ACHIEVEMENTS,achievementStats,achievements,earnedAchievements,weekOf,packRoomDay,offlineDay,offlineRooms,offlineRoomDay,usedVisits,monthCalendar,monthSummary,MILESTONES,earnedMilestones,seatVisits,roomSnapshot,cacheAge,dailyPick,cancellableRecord,matchRecord,upcomingBookings,roomDay,weekDate,checkinReminders,libraryStats,areaFloors,filterAreas,maskCard,daysUntil,greeting,givenName,permanentRejection,validDay,validTime,Booker,validateTask,validateTaskConflicts,recordMatches,nowChina,active,errorText,favoriteKey,addFavorite,visibleSeats,parseStamp,reservationTimes,bookedTask,periodText,accentPalette};if(typeof module!=='undefined'&&module.exports)module.exports=exports;g.CampusCore=exports;
})(typeof globalThis!=='undefined'?globalThis:this);
