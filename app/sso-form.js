/* Invoked by the host only on the university SSO login origin. Never logs credentials. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CampusSsoForm=api;})(globalThis,function(){
 'use strict';
 function allowed(env){return env.location.protocol==='https:'&&env.location.hostname==='sso.qlu.edu.cn'&&/^\/login\/?$/.test(env.location.pathname)&&(!env.location.port||env.location.port==='443');}
 function choose(document,style){
  const editable=e=>!!e&&e.type!=='hidden'&&!e.disabled&&!e.readOnly&&e.getClientRects().length>0&&!['hidden','collapse'].includes(style(e).visibility)&&style(e).display!=='none';
  const candidates=[];
  for(const button of [...document.querySelectorAll('#submitBtn,button[type="submit"],input[type="submit"]')].filter(editable)){
   const area=button.form||document;
   const passwords=[...area.querySelectorAll('input[type="password"]')].filter(editable);
   const users=[...area.querySelectorAll('input[name="username"],input#username,input#nameInput,input[autocomplete="username"],input[type="text"]')].filter(editable).filter(e=>!/captcha|yzm|verify|code/i.test(e.name+' '+e.id));
   const preferred=users.filter(e=>e.name==='username'||['username','nameInput'].includes(e.id)||e.autocomplete==='username');
   const names=preferred.length?preferred:users;
   if(passwords.length!==1||names.length!==1)continue;
   const username=names[0],password=passwords[0];
   if(candidates.some(x=>x.username===username&&x.password===password))continue;
   const captcha=[...area.querySelectorAll('input[name="captcha_code"],input[name="captcha"],input#yzm,input[autocomplete="one-time-code"],input[name*="verify" i],input[id*="captcha" i]')].some(editable);
   candidates.push({username,password,button,captcha});
  }
  return candidates.length===1?candidates[0]:candidates.length>1?{ambiguous:true}:null;
 }
 function cancel(environment=globalThis){environment.__campusSsoRun?.stop('cancelled');}
 function fill(username,password,environment=globalThis){
  if(!allowed(environment))return {filled:false,reason:'origin'};
  if(environment.__qluSsoSubmitted)return {filled:false,reason:'submitted'};
  const previous=environment.__campusSsoRun;
  if(previous)return {filled:previous.reason==='submitted',reason:previous.reason||'waiting'};
  if(typeof username!=='string'||typeof password!=='string'||!username.trim()||!password)return {filled:false,reason:'credentials'};
  const href=environment.location.href,doc=environment.document,run={credentials:{username,password},reason:'',stopped:false,timer:null,observer:null,listeners:[]};
  environment.__campusSsoRun=run;
  run.stop=reason=>{
   if(run.stopped)return;run.stopped=true;run.reason=reason;run.credentials=null;
   environment.clearTimeout(run.timer);run.observer?.disconnect();
   for(const [target,name,listener]of run.listeners)target.removeEventListener(name,listener,true);run.listeners=[];
  };
  const listen=(target,name,listener)=>{target.addEventListener(name,listener,true);run.listeners.push([target,name,listener]);};
  const valid=()=>!run.stopped&&allowed(environment)&&environment.location.href===href&&!environment.__qluSsoSubmitted;
  const user=e=>{if(e.isTrusted)run.stop('userInput');};
  for(const name of ['pointerdown','keydown','input','change'])listen(doc,name,user);
  for(const name of ['pagehide','popstate','hashchange'])listen(environment,name,()=>run.stop('navigation'));
  const sameFields=fields=>{const now=choose(doc,e=>environment.getComputedStyle(e));if(!now||now.ambiguous||now.captcha||now.username!==fields.username||now.password!==fields.password||now.button!==fields.button){run.stop(now?.captcha?'captcha':'changed');return false;}return true;};
  const attempt=()=>{
   if(!valid()){if(!run.stopped)run.stop('navigation');return;}
   const fields=choose(doc,e=>environment.getComputedStyle(e));
   if(!fields)return;
   if(fields.ambiguous){run.stop('ambiguous');return;}
   if(fields.captcha){run.stop('captcha');return;}
   if(fields.username.value&&fields.username.value!==run.credentials.username||fields.password.value){run.stop('userInput');return;}
   const set=Object.getOwnPropertyDescriptor(environment.HTMLInputElement.prototype,'value')?.set;
   if(!set){run.stop('unsupported');return;}
   for(const [element,value]of [[fields.username,run.credentials.username],[fields.password,run.credentials.password]]){
    if(!valid()||!element.isConnected){run.stop('navigation');return;}
    set.call(element,value);
    element.dispatchEvent(new environment.Event('input',{bubbles:true}));
    if(!valid()||!sameFields(fields))return;
    element.dispatchEvent(new environment.Event('change',{bubbles:true}));
    if(!valid()||!sameFields(fields))return;
   }
   const latest=choose(doc,e=>environment.getComputedStyle(e));
   if(!valid()||!latest||latest.ambiguous||latest.captcha||latest.username!==fields.username||latest.password!==fields.password||latest.button!==fields.button||fields.username.value!==run.credentials.username||fields.password.value!==run.credentials.password){run.stop(latest?.captcha?'captcha':'changed');return;}
   environment.__qluSsoSubmitted=true;run.stop('submitted');fields.button.click();
  };
  run.timer=environment.setTimeout(()=>run.stop('timeout'),8000);
  run.observer=new environment.MutationObserver(()=>{try{attempt();}catch(_){run.stop('pageError');}});run.observer.observe(doc.documentElement,{subtree:true,childList:true,attributes:true});
  try{attempt();}catch(_){run.stop('pageError');}
  return {filled:run.reason==='submitted',reason:run.reason||'waiting'};
 }
 return {choose,fill,cancel};
});
