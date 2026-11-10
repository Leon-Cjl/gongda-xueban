/* Teaching session repository. Transport and option preparation are injected;
   UI observes immutable state and sends intents through ensure(). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CampusTeachingSession=api;})(globalThis,function(){
 'use strict';
 function create({scope,connect,prepare=async()=>{},changed=()=>{},clock=()=>Date.now()}={}){
  let entry=null;
  const idle=owner=>Object.freeze({owner,phase:'idle',retryAt:0,error:'',code:'',needsUser:false,offline:false,page:''});
  function current(){const owner=scope();if(!entry||entry.owner!==owner)entry={owner,state:idle(owner),task:null,failures:0};return entry;}
  function valid(e,task){return entry===e&&e.owner===scope()&&e.task===task;}
  function emit(e,patch){e.state=Object.freeze({...e.state,...patch});changed(e.state);}
  function retryable(e,detail){e.failures++;emit(e,{...detail,phase:'retryable',needsUser:false,retryAt:clock()+Math.min(300000,30000*2**Math.min(4,e.failures-1))});}
  function ensure({fresh=false,retry=false}={}){
   const e=current();
   if(e.task){if(fresh)e.task.fresh=true;return e.task.promise;}
   if(!retry&&(e.state.phase==='needs_user'||e.state.retryAt>clock()))return Promise.resolve(false);
   const task={fresh:!!fresh,promise:null};e.task=task;
   task.promise=Promise.resolve().then(async()=>{
    let usedFresh=false;
    try{
     do{
      if(!valid(e,task))return false;
      usedFresh=task.fresh;
      const result=await connect({fresh:usedFresh});
      if(!valid(e,task))return false;
      // An expiry reported during an old-page probe requires one fresh login.
      if(task.fresh&&!usedFresh)continue;
      if(!result?.connected){
       const detail={error:'',code:'',offline:!!result?.offline,page:String(result?.page||'')};
       if(result?.needsUser)emit(e,{...detail,phase:'needs_user',needsUser:true,retryAt:0});
       else retryable(e,detail);
       return false;
      }
      await prepare({fresh:usedFresh});
      if(!valid(e,task))return false;
     }while(task.fresh&&!usedFresh);
     e.failures=0;emit(e,{phase:'ready',needsUser:false,retryAt:0,error:'',code:'',offline:false,page:''});return true;
    }catch(error){
     if(!valid(e,task)||error?.code==='STALE')return false;
     retryable(e,{error:String(error?.message||error),code:String(error?.code||''),offline:false,page:''});return false;
    }finally{if(valid(e,task)){e.task=null;if(e.state.phase==='connecting')emit(e,{phase:'idle'});}}
   });
   emit(e,{phase:'connecting',retryAt:0,error:'',code:'',needsUser:false,offline:false,page:''});
   return task.promise;
  }
  function userResolved(){const e=current();if(!e.task){e.failures=0;emit(e,idle(e.owner));}}
  return{ensure,snapshot:()=>current().state,reset:()=>{entry=null;},userResolved};
 }
 return{create};
});
