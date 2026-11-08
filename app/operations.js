/* Durable write intents. Recovery only verifies; it never replays a school mutation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CampusOperations=api;})(globalThis,function(){
 'use strict';
 const writes=new Set(['reserve','temporaryLeave','cancelBooking','checkout']);
 const pending=new Set(['sending','verifying','uncertain']);
 const fields=['id','seatId','day','start','end','areaId','segment','kind','no'];
 function create({state,save,now=()=>Date.now(),id=()=>crypto.randomUUID(),recordMatches}){
  const entries=()=>state.operations||(state.operations=[]);
  const open=()=>entries().filter(x=>pending.has(x.phase));
  const prune=()=>{const all=entries(),closed=all.filter(x=>!pending.has(x.phase)).slice(-100);state.operations=all.filter(x=>pending.has(x.phase)||closed.includes(x));};
  async function run(method,params,dispatch,owner){
   if(!writes.has(method))return dispatch();
   if(open().some(x=>x.owner===owner&&(x.method==='reserve'||method==='reserve'||String(x.params.id)===String(params.id))))throw Object.assign(Error('已有同一账号的操作待核验，请先查看学校记录'),{code:'BUSY'});
   const entry={id:id(),owner,method,taskId:method==='reserve'?params.id||'':'',params:Object.fromEntries(fields.filter(k=>params[k]!=null).map(k=>[k,params[k]])),phase:'sending',at:now()};
   entries().push(entry);prune();
   try{await save();}catch(error){entry.phase='not_sent';throw Object.assign(Error('本机操作记录保存失败，未向学校提交'),{code:'CLIENT'});}
   let responded=false;
   try{
    const result=await dispatch(entry.id);responded=true;entry.phase=result?.verified===true?'verified':method==='reserve'?'verifying':'uncertain';entry.updatedAt=now();await save();return result;
   }catch(error){entry.phase=!responded&&error.notSent===true?'not_sent':responded||error.uncertain||['UNCERTAIN','TIMEOUT','NETWORK','CLIENT','STALE'].includes(error.code)?'uncertain':'rejected';entry.updatedAt=now();await save().catch(()=>{});throw error;}
  }
  function recover(tasks=[]){let changed=false;for(const entry of entries())if(entry.phase==='sending'){entry.phase='uncertain';changed=true;}
   for(const task of tasks)if(task.status==='uncertain'&&task.subjectId&&!entries().some(x=>x.taskId===task.id)){entries().push({id:id(),owner:task.subjectId,method:'reserve',taskId:task.id,phase:'uncertain',at:now(),params:{day:task.day,start:task.start,end:task.end,seatIds:(task.seats||[]).map(x=>x.id)}});changed=true;}return changed;
  }
  function reconcile(records=[],current=[],tasks=[]){
   let changed=false;
   for(const entry of open()){
    const task=entry.taskId&&tasks.find(x=>x.id===entry.taskId),p=entry.params,record=records.find(x=>String(x.id)===String(p.id));
    const label=String(record?.status_name||'')+' '+String(record?.statusMsg||'');
    const verified=entry.method==='reserve'?(task?.status==='succeeded'||records.some(r=>(p.seatIds||[p.seatId]).some(id=>recordMatches(r,p,{id}))))
     :entry.method==='temporaryLeave'?current.some(x=>String(x.id)===String(p.id)&&x.temporarilyAway===true)
     :entry.method==='cancelBooking'?!!record&&/已取消|已撤销|取消成功|撤销成功/.test(label)
     :entry.method==='checkout'?!!record&&/已结束|已完成|已签退/.test(label):false;
    if(verified){entry.phase='verified';entry.updatedAt=now();changed=true;}
    else if(entry.method==='reserve'&&Number.isFinite(Date.parse(p.day+'T'+p.end+':00+08:00'))&&Date.parse(p.day+'T'+p.end+':00+08:00')<now()){entry.phase='expired_unverified';entry.updatedAt=now();changed=true;}
   }
   if(changed)prune();return changed;
  }
  return{run,recover,reconcile,open};
 }
 return{create};
});
