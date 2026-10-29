/* School adapters. This script runs only inside the school's authenticated WebView. */
(() => {
 'use strict';
 const LIB='libyuyue.qlu.edu.cn';
 const isLibrary=location.protocol==='https:'&&location.hostname===LIB;
 const isTeaching=location.protocol==='https:'&&location.hostname==='jw.qlu.edu.cn';
 if(!isLibrary&&!isTeaching)return;
 const send=value=>{const text=JSON.stringify(value);if(window.QluReply)window.QluReply.post(text);else if(window.chrome?.webview)window.chrome.webview.postMessage(value);};
 const error=(code,message,extra={})=>Object.assign(new Error(message),{code,...extra});
 const token=()=>sessionStorage.getItem('token')||'';
 async function post(path,body={},encrypted=false,mutation=false,timeout=20000){
  const writing=encrypted||mutation;
  if(!token())throw error('AUTH','请先登录图书馆');
  let payload=body;
  if(encrypted){
   const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date()).replaceAll('-','');
   const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(day+[...day].reverse().join('')), 'AES-CBC',false,['encrypt']);
   const bytes=await crypto.subtle.encrypt({name:'AES-CBC',iv:new TextEncoder().encode('ZZWBKJ_ZHIHUAWEI')},key,new TextEncoder().encode(JSON.stringify(body)));
   payload={aesjson:btoa(String.fromCharCode(...new Uint8Array(bytes)))};
  }
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
  let response;
  try{response=await fetch(path,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest',authorization:'bearer'+token()},body:JSON.stringify(payload),signal:ctl.signal});}
  catch(e){throw error(writing?'UNCERTAIN':'NETWORK',writing?'操作结果尚不明确，请核对学校当前预约；未自动重试':'网络连接失败，请稍后重试',{uncertain:writing});}
  finally{clearTimeout(timer);}
  if(response.status===401||response.status===403)throw error('AUTH','图书馆登录已过期，请重新登录');
  if(response.status===429)throw error('RATE_LIMIT','学校系统请求频繁，请稍后重试');
  if(!response.ok)throw error(writing?'UNCERTAIN':'NETWORK','学校服务暂时不可用',{uncertain:writing});
  let r;try{r=await response.json();}catch(e){throw error(writing?'UNCERTAIN':'PARSE','学校返回的内容读不懂，可能系统改版了',{uncertain:writing});}
  if(Number(r.code)===10001)throw error('AUTH','图书馆登录已过期，请重新登录');
  if(Number(r.code)!==0)throw error('SCHOOL',String(r.message||r.msg||'学校系统未接受操作'));
  if(token())send({session:token()});
  return r.data;
 }
 const list=x=>Array.isArray(x)?x:[];
 const hhmm=x=>{if(!x)return'';const m=String(x).match(/(?:^|[ T])(\d{2}:\d{2})/);return m?m[1]:'';};
 const seatName=x=>String(x.no??x.name??x.id);
 // 官方页面显示“取消预约”的条件：普通座位记录 status 为 2 或 9，且（字段存在时）oksign 为 1。
 const cancellable=x=>['2','9'].includes(String(x?.status))&&(x.oksign==null||Number(x.oksign)===1);
 const records=async()=>{const d=await post('/v4/member/seat',{type:1,page:1,limit:100});return Array.isArray(d)?d:list(d?.data||d?.list);};
 async function configuration(){
  let d=await post('/v4/index/peizhi',{},false,false,8000);
  if(typeof d==='string'){
   const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date()).replaceAll('-','');
   const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(day+[...day].reverse().join('')),'AES-CBC',false,['decrypt']);
   const bytes=Uint8Array.from(atob(d),c=>c.charCodeAt(0));
   try{d=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-CBC',iv:new TextEncoder().encode('ZZWBKJ_ZHIHUAWEI')},key,bytes)));}catch(e){throw error('PARSE','读不到学校的临时签退规则');}
  }
  return d||{};
 }
 async function current(){
  const d=await post('/v4/index/subscribe',{},false,false,8000),rows=list(d).filter(x=>Number(x.type)===1);
  if(!rows.length)return[];
  const config=await configuration();
  // canCheckout：与官方当前预约页“签退/结束使用”按钮的条件一致（学校开放签退，且已入座或暂离）。
  return rows.map(x=>({...x,canTemporaryLeave:Number(x.flag_out)===1&&Number(config.notice?.rightback)===1,temporarilyAway:Number(x.flag_leave)===1,canCheckout:Number(config.notice?.leave)===1&&(Number(x.flag_leave)===1||Number(x.flag_out)===1)}));
 }
 let leaving=false;
 async function library(method,p){
  if(method==='status'){if(!token())return{connected:false};await post('/v4/space/index');return{connected:true};}
  if(method==='catalog'){const d=await post('/v4/space/pcTopFor',{day:p.day});return{libraries:list(d?.list).map(x=>({id:x.id,name:x.name,free:x.free_num,total:x.total_num})),dates:list(d?.date)};}
  if(method==='areas'){
   const f=await post('/v4/space/index');
   const premises=p.libraryId?[p.libraryId]:list(f?.premises).map(x=>x.id);
   const d=await post('/v4/space/pick',{premisesIds:premises,categoryIds:[],storeyIds:[],boutiqueIds:[],date:p.day});
   return{areas:list(d?.area).map(x=>({id:x.id,name:x.name,floor:x.storeyName,free:x.free_num,total:x.total_num})),dates:list(f?.date)};
  }
  if(method==='seats'){
   const info=await post('/v4/Space/map',{id:p.areaId});
   if(String(info.type)!=='1')throw error('UNSUPPORTED','这个区域的预约规则特殊，助手暂不支持');
   const row=list(info.date?.list).find(x=>x.day===p.day)||{};
   const kind=Number(info.date?.reserveType||3);
   const start=p.start||hhmm(row.def_start_time)||hhmm(row.start_time);
   const end=p.end||hhmm(row.def_end_time)||hhmm(row.end_time);
   const d=await post('/v4/Space/seat',{id:p.areaId,day:p.day,label_id:[],start_time:start,end_time:end,begdate:'',enddate:''});
   return{areaId:p.areaId,name:info.name,kind,start,end,rule:row,seats:list(d?.list).map(x=>({id:x.id,no:seatName(x),status:Number(x.status),available:Number(x.status)===1})),segments:list(row.times||row.time||row.list).map(x=>({id:x.id??x.segment,label:x.show_time||[x.start,x.end].filter(Boolean).join('–')}))};
  }
  if(method==='records')return records();
  if(method==='current')return current();
  // 只读：账号状态与违约记录。手机号、邮箱不取出。
  if(method==='profile'){
   const d=await post('/v4/member/my',{},false,false,10000)||{},code=String(d.status??'');
   return{name:String(d.name||''),card:String(d.card||d.id||''),dept:String(d.deptName||''),status:code,statusText:({'1':'正常','0':'注销','2':'挂失','3':'临时禁止'})[code]||(code?'未知状态':''),validUntil:String(d.date||'')};
  }
  if(method==='violations'){
   const d=await post('/v4/member/seatRenege',{type:1,page:1,limit:20},false,false,10000),rows=Array.isArray(d)?d:list(d?.data);
   return{total:Number(d?.total??rows.length)||0,items:rows.slice(0,20).map(x=>({area:String(x.nameMerge||x.areaName||''),seat:String(x.name??x.no??''),time:String(x.renegeTime||x.beginTime||''),status:String(x.status_name||x.statusMsg||'')}))};
  }
  // 学校的区域预约须知是 HTML，这里只转成纯文本再交给界面，不把学校的标记插进助手页面。
  if(method==='rules'){
   if(!/^\d{1,9}$/.test(String(p.areaId||'')))throw error('INVALID','缺少区域编号');
   const d=await post('/v4/space/rule',{id:p.areaId},false,false,10000),doc=new DOMParser().parseFromString(String(d?.content||''),'text/html');
   doc.querySelectorAll('br').forEach(x=>x.replaceWith('\n'));doc.querySelectorAll('p,div,li,h1,h2,h3,h4,tr').forEach(x=>x.append('\n'));
   return{text:(doc.body?.textContent||'').replace(/[ \t ]+/g,' ').replace(/\n\s*\n+/g,'\n').trim().slice(0,4000)};
  }
  if(method==='temporaryLeave'){
   if(leaving)throw error('BUSY','临时签退正在处理，请先核对结果');
   if(!p.id)throw error('INVALID','缺少当前预约编号');
   leaving=true;try{
    const before=await current(),item=before.find(x=>String(x.id)===String(p.id));
    if(!item)throw error('STALE','该预约已不在当前预约中，请刷新');
    if(item.temporarilyAway)return{verified:true,alreadyAway:true,current:before};
    if(!item.canTemporaryLeave)throw error('SCHOOL','学校当前未开放该预约的临时签退');
    await post('/v4/space/leave',{id:item.id},false,true,8000);
    let after;try{after=await current();}catch(e){throw error('UNCERTAIN','暂离已提交，但刷新状态失败',{uncertain:true});}
    return{verified:after.some(x=>String(x.id)===String(item.id)&&x.temporarilyAway),current:after};
   }finally{leaving=false;}
  }
  // 取消普通座位预约：与官方“预约记录”相同，只对学校标为可取消（status 2/9）的记录调用 /v4/space/cancel，提交后重新读记录核验。
  if(method==='cancelBooking'){
   if(!/^\d{1,12}$/.test(String(p.id||'')))throw error('INVALID','缺少预约记录编号');
   if(leaving)throw error('BUSY','另一项操作正在处理，请先核对结果');
   leaving=true;try{
    const item=(await records()).find(x=>String(x.id)===String(p.id));
    if(!item)throw error('STALE','学校记录里找不到这个预约，请刷新');
    if(!cancellable(item))throw error('SCHOOL','学校当前不允许取消这个预约（'+String(item.status_name||item.status||'状态未知')+'）');
    await post('/v4/space/cancel',{id:item.id},false,true,8000);
    let after;try{after=await records();}catch(e){throw error('UNCERTAIN','取消已提交，但刷新记录失败',{uncertain:true});}
    const now=after.find(x=>String(x.id)===String(item.id));
    return{verified:!now||!cancellable(now),records:after};
   }finally{leaving=false;}
  }
  // 结束使用（提前离馆）：释放座位。提交前后都读当前预约，从当前预约里消失才算核验成功。
  if(method==='checkout'){
   if(leaving)throw error('BUSY','另一项操作正在处理，请先核对结果');
   if(!p.id)throw error('INVALID','缺少当前预约编号');
   leaving=true;try{
    const before=await current(),item=before.find(x=>String(x.id)===String(p.id));
    if(!item)throw error('STALE','该预约已不在当前预约中，请刷新');
    if(!item.canCheckout)throw error('SCHOOL','学校当前不允许结束这个预约');
    await post('/v4/space/checkout',{id:item.id},false,true,8000);
    let after;try{after=await current();}catch(e){throw error('UNCERTAIN','结束使用已提交，但刷新状态失败',{uncertain:true});}
    return{verified:!after.some(x=>String(x.id)===String(item.id)),current:after};
   }finally{leaving=false;}
  }
  if(method==='reserve'){
   if(!p.seatId||!/^\d{4}-\d{2}-\d{2}$/.test(p.day))throw error('INVALID','缺少座位或预约日期');
   const body={seat_id:p.seatId,segment:p.segment||'',day:p.day,start_time:p.kind===3?p.start:'',end_time:p.kind===2||p.kind===3?p.end:''};
   if(p.kind===1&&!body.segment)throw error('INVALID','这个区域要先选学校的固定时段');
   const d=await post('/v4/space/confirm',body,true);
   return{accepted:true,receipt:d};
  }
  throw error('INVALID','未知图书馆操作');
 }
 function teachingContext(){
  const visit=(w,depth)=>{try{if(w.location.hostname!=='jw.qlu.edu.cn')return null;const d=w.document;if(w.location.pathname.includes('/cdjy/cdjy_cxKxcdlb.html')&&(d.querySelector('#dm_cx')||d.querySelector('#tabGrid')&&d.querySelector('#xnm')))return{w,d,url:new URL(w.location.href)};if(depth<5)for(const frame of d.querySelectorAll('iframe,frame')){const found=visit(frame.contentWindow,depth+1);if(found)return found;}}catch(e){}return null;};
  return visit(window,0);
 }
 function selectOptions(d,id){const el=d.getElementById(id)||d.querySelector('[name="'+id+'"]');return el?.options?Array.from(el.options).map(o=>({value:o.value,label:o.textContent.trim(),selected:o.selected})):[];}
 const value=(d,id)=>d.getElementById(id)?.value||'';
 async function teachingPost(ctx,path,body,verb='POST'){
  // Use the school's own jQuery request hooks, which attach its menu/session parameters.
  const jq=ctx.w.jQuery;
  if(jq?.ajax)return new Promise((resolve,reject)=>jq.ajax({url:path,type:verb,data:Object.fromEntries(body),dataType:'json',timeout:20000,success:resolve,error:(xhr,status)=>reject(error(status==='timeout'?'TIMEOUT':xhr.status===401||xhr.status===403?'AUTH':status==='parsererror'?'PARSE':'NETWORK','教务查询失败（'+(xhr.status||status)+'）'))}));
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),20000);
  // 真机上教务页自己的 jQuery 常常没加载，走这里；断网时 fetch 抛的是不带 code 的 TypeError，要标成 NETWORK / TIMEOUT，界面才会退回本机数据。
  try{let r;try{r=await ctx.w.fetch(verb==='GET'?path+'?'+body.toString():path,{method:verb,credentials:'include',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:verb==='GET'?undefined:body,signal:ctl.signal});}catch(e){throw error(e?.name==='AbortError'?'TIMEOUT':'NETWORK',e?.name==='AbortError'?'教务响应超时':'连不上教务（网络断开或不在校园网）');}if(r.status===401||r.status===403)throw error('AUTH','请重新登录学生教务');if(r.ok===false)throw error('NETWORK','教务服务返回 '+r.status);try{return await r.json();}catch(e){throw error('PARSE','教务返回的不是查询结果，可能登录过期了');}}finally{clearTimeout(timer);}
 }
 // start（YYYY-MM-DD）是第 first 周（学校的 ZXZC，常为 0）所在的那一天；算今天（北京时间）是第几周，周一起算；不在 1–30 周内就当没有。
 function weekFrom(start,first=1){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(start||'')))return null;const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date()),monday=x=>{const t=Date.parse(x+'T12:00:00Z');return t-((new Date(t).getUTCDay()+6)%7)*86400000;},w=Math.round((monday(day)-monday(start))/604800000)+(Number.isFinite(Number(first))?Number(first):1);return w>=1&&w<=30?w:null;}
 function termWeek(text){const t=String(text),dq=Number((t.match(/DQZC=(\d+)/)||[])[1]),zx=(t.match(/ZXZC=(\d+)/)||[])[1];return dq>0?dq:weekFrom((t.match(/ZXRQ=(\d{4}-\d{2}-\d{2})/)||[])[1],zx==null?1:Number(zx));}
 async function teaching(method,p){
  const ctx=teachingContext()||(method==='exams'&&location.hostname==='jw.qlu.edu.cn'?{w:window,d:document,url:new URL(location.href)}:null);
  if(method==='status')return{connected:!!teachingContext(),page:location.pathname};
  if(!ctx)throw error('PAGE','未找到已加载的空闲教室页面，请在学生菜单打开后返回；支持页面内嵌的查询页');
  const d=ctx.d;
  if(method==='options'){
   const fields={};for(const id of ['xnm','xqm','xqh_id','cdlb_id'])fields[id]=selectOptions(d,id);
   const terms=selectOptions(d,'dm_cx'),year=value(d,'xnm'),term=value(d,'xqm');
   if(!fields.xnm.length){const years=[...new Set(terms.map(x=>x.value.split('-')[0]).filter(x=>/^\d{4}$/.test(x)))];if(!years.length&&year)years.push(year);fields.xnm=years.map(x=>({value:x,label:x+'–'+(Number(x)+1),selected:x===year}));}
   if(!fields.xqm.length){const codes=[...new Set(terms.map(x=>x.value.split('-')[1]).filter(Boolean))];if(!codes.length&&term)codes.push(term);fields.xqm=codes.map(x=>({value:x,label:({'3':'第 1 学期','12':'第 2 学期','16':'第 3 学期'})[x]||x,selected:x===term}));}
   fields.jxl_id=selectOptions(d,'lh');if(!fields.jxl_id.length)fields.jxl_id=selectOptions(d,'jxl_id');
   // 当前周：学校在页面脚本里给的 DQZC 实际常是 0（真机上还因为页面自己的 jQuery 没加载，dqzc 变量根本没赋值）；
   // 这时用同一段脚本里的 ZXRQ（第 ZXZC 周的周一）按周一起算。
   fields.currentWeek=Number(ctx.w.dqzc)||termWeek(Array.from(d.scripts||[]).map(s=>s.textContent||'').join(' '))||null;
   // 查询页的当前周来自页面脚本里的 dqzc；没有时按学校页面自己的做法再问一次（cdjy_cxQtlb 返回 dqzcxq.DQZC）。
   if(!fields.currentWeek&&year&&term){try{const qt=await teachingPost(ctx,'/jwglxt/cdjy/cdjy_cxQtlb.html',new URLSearchParams({xnm:year,xqm:term,xqh_id:value(d,'xqh_id'),flag:String(ctx.w.isCdjysqflg??'')}));fields.currentWeek=Number(qt?.dqzcxq?.DQZC)||weekFrom(qt?.dqzcxq?.ZXRQ,qt?.dqzcxq?.ZXZC==null?1:Number(qt.dqzcxq.ZXZC))||null;}catch(e){}}
   fields.weeks=Array.from(d.querySelectorAll('#selectTR_ZC th.selectTH[value]')).map(x=>Number(x.getAttribute('value'))).filter(Number.isFinite);
   fields.periods=Array.from(d.querySelectorAll('#selectTR_JC th.selectTH[value]')).map(x=>({value:Number(x.getAttribute('value')),label:x.textContent.trim()})).filter(x=>x.value>0&&x.value<=30);
   if(p.year&&p.term&&p.campus!=null){
    const linked=await teachingPost(ctx,'/jwglxt/cdjy/cdjy_cxXqjc.html',new URLSearchParams({xnm:p.year,xqm:p.term,xqh_id:p.campus}),'GET');
    if(Array.isArray(linked?.lhList))fields.jxl_id=[{value:'',label:'全部教学楼',selected:true},...linked.lhList.map(x=>({value:x.JXLDM,label:x.JXLMC,selected:false}))];
    if(Array.isArray(linked?.jcList))fields.periods=linked.jcList.map(x=>({value:Number(x.JCMC),label:x.RSDJCMC||String(x.JCMC),time:String(x.SJD||''),part:String(x.RSDMC||'')})).filter(x=>x.value>0&&x.value<=30);
   }
   if(!fields.xnm.length||!fields.xqm.length)throw error('PAGE','教务页面还没加载完，稍后再试');
   return fields;
  }
  if(method==='rooms'){
   if(!Number.isInteger(p.week)||p.week<1||p.week>53||!Number.isInteger(p.weekday)||p.weekday<1||p.weekday>7||!Array.isArray(p.periods)||!p.periods.length||p.periods.some(x=>!Number.isInteger(x)||x<1||x>30))throw error('INVALID','请选择有效的周次、星期和节次');
   const body=new URLSearchParams();
   for(const id of ['cdlb_id','cdejlb_id','qszws','jszws','cdmc','cdjylx','sfbhkc','sfkpk'])body.set(id,value(d,id));
   // 按教室名称查找：用学校查询页自带的“场地名称”条件；名称只保留常见字符。
   const name=String(p.name||'').replace(/[^\p{L}\p{N} ._\-()（）#]/gu,'').trim().slice(0,30);
   if(name)body.set('cdmc',name);
   // 带名称查找时放大页长；“空到第几节”需要整页比对，也允许放大（最多 500）。
   const size=name?300:Math.min(500,Math.max(100,Number(p.pageSize)||100));
   Object.entries({xnm:p.year||value(d,'xnm'),xqm:p.term||value(d,'xqm'),xqh_id:p.campus||'',lh:p.building||'',zcd:String(2**(p.week-1)),xqj:String(p.weekday),jcd:String([...new Set(p.periods)].reduce((a,b)=>a+2**(b-1),0)),jyfs:'0','queryModel.showCount':String(size),'queryModel.currentPage':String(Math.max(1,Number(p.page)||1)),'queryModel.sortName':'cdbh','queryModel.sortOrder':'asc'}).forEach(([k,v])=>body.set(k,v));
   const menu=ctx.url.searchParams.get('gnmkdm')||value(d,'gnmkdmKey');
   if(!menu||!/^N\d+$/.test(menu))throw error('PAGE','没找到教务里的空闲教室查询，可能页面改版了');
   const result=await teachingPost(ctx,'/jwglxt/cdjy/cdjy_cxKxcdlb.html?doType=query&gnmkdm='+encodeURIComponent(menu),body);
   const rows=Array.isArray(result?.items)?result.items:Array.isArray(result?.rows)?result.rows:null;
   if(!rows)throw error('PARSE','学校没有返回教室列表');
   return{total:Number(result.totalResult??result.total??result.records??rows.length),page:Math.max(1,Number(p.page)||1),pageSize:size,rooms:rows.map(x=>({id:x.cd_id||x.cdxqxx_id||x.cdbh,name:x.cdmc||x.cdbh||'教室',building:x.jxlmc||x.jxl||'',campus:x.xqmc||'',capacity:x.sjzws||x.zws||x.zwzs||x.zws1||'',reserved:['1','是','已被预约'].includes(String(x.sfybyy))}))};
  }
  // 考试信息：学校“学生考试信息查询”（只读）。在已登录的教务页里直接发请求；只回考试相关字段，学号姓名班级这类个人信息不带出去
  if(method==='exams'){
   const xnm=String(p.year||value(d,'xnm')),xqm=String(p.term||value(d,'xqm'));
   if(!/^\d{4}$/.test(xnm)||!/^\d{1,2}$/.test(xqm))throw error('INVALID','请选择有效的学年学期');
   const body=new URLSearchParams({xnm,xqm,ksmcdmb_id:'',kch:'',kc:'',ksrq:'',kkbm_id:'',_search:'false',nd:String(Date.now()),'queryModel.showCount':'200','queryModel.currentPage':'1','queryModel.sortName':'','queryModel.sortOrder':'asc',time:'0'});
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),20000);
   let r;try{r=await ctx.w.fetch('/jwglxt/kwgl/kscx_cxXsksxxIndex.html?doType=query&gnmkdm=N358105',{method:'POST',credentials:'include',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body,signal:ctl.signal});}catch(e){throw error(e?.name==='AbortError'?'TIMEOUT':'NETWORK',e?.name==='AbortError'?'教务响应超时':'连不上教务（网络断开或不在校园网）');}finally{clearTimeout(timer);}
   if(r.status===401||r.status===403)throw error('AUTH','请重新登录学生教务');
   let j;try{j=await r.json();}catch(e){throw error('PARSE','教务返回的不是考试信息，可能登录过期了');}
   const rows=Array.isArray(j?.items)?j.items:null;
   if(!rows)throw error('PARSE','学校没有返回考试列表');
   const skip=new Set(['xh_id','xh','xm','xb','bj','njmc','zymc','jgmc','pycc','row_id','totalresult','xnm','xqm']);
   return{year:xnm,term:xqm,exams:rows.map(x=>Object.fromEntries(Object.entries(x).filter(([k,v])=>!skip.has(k)&&v!=null&&v!==''&&typeof v!=='object').map(([k,v])=>[k,String(v).slice(0,200)])))};
  }
  throw error('INVALID','未知教务操作');
 }
 window.QluAgent={async run(m){try{const result=await(isLibrary?library(m.method,m.params||{}):teaching(m.method,m.params||{}));send({id:m.id,ok:true,data:result});}catch(e){send({id:m.id,ok:false,error:{code:e.code||'ERROR',message:e.message||'操作失败',uncertain:!!e.uncertain}});}}};
 // Resolve the actual link exposed to this student's role, rather than guessing a teacher menu URL.
 if(isTeaching&&new URLSearchParams(location.search).get('jsdm')==='xs'){
  let sent=false;const locate=()=>{if(sent)return;for(const a of document.querySelectorAll('a,button,[data-url]')){
   if(!/空闲教室|空教室/.test(a.textContent||a.getAttribute('title')||''))continue;
   const raw=['href','data-url','data-href','onclick'].map(k=>a.getAttribute(k)||'').join(' ');
   const path=raw.match(/(?:\/jwglxt)?\/cdjy\/cdjy_cxKxcdlb\.html[^\s'"<>)]*/);
   if(!path)continue;let url=new URL(path[0].startsWith('/jwglxt')?path[0]:'/jwglxt'+path[0],location.origin);
   const menu=raw.match(/N\d{4,}/);if(!url.searchParams.has('gnmkdm')&&menu)url.searchParams.set('gnmkdm',menu[0]);
   if(!url.searchParams.has('gnmkdm'))continue;sent=true;send({event:'teachingRoute',url:url.href});break;
  }};
  const start=()=>{locate();const watch=new MutationObserver(locate);watch.observe(document.documentElement,{subtree:true,childList:true});setTimeout(()=>watch.disconnect(),15000);};
  if(document.documentElement)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
 }
})();
