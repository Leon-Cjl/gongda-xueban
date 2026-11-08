/* Local animation ownership. DOM replacement cancels only removed nodes; retargets
   start at the sampled presentation rectangle, including any current stretch. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CampusMotion=api;})(globalThis,function(){
 'use strict';
 const presets={route:220,feedback:180,press:220,sheet:300,liquid:360};
 const keys=['x','y','w','h'];
 // Values are CSS px, velocities px/s, time seconds.
 function sample(from,target,velocity,time,{mass=1,stiffness=500,damping=40}={}){
  const a=from-target,l=damping/(2*mass),w2=stiffness/mass,d=w2-l*l;
  let x,v;
  if(Math.abs(d)<1e-7){const b=velocity+l*a,e=Math.exp(-l*time);x=e*(a+b*time);v=e*(b-l*(a+b*time));}
  else if(d>0){const w=Math.sqrt(d),b=(velocity+l*a)/w,e=Math.exp(-l*time),c=Math.cos(w*time),s=Math.sin(w*time);x=e*(a*c+b*s);v=e*((-l*a+b*w)*c+(-l*b-a*w)*s);}
  else{const q=Math.sqrt(-d),r1=-l+q,r2=-l-q,c1=(velocity-r2*a)/(r1-r2),c2=a-c1;x=c1*Math.exp(r1*time)+c2*Math.exp(r2*time);v=r1*c1*Math.exp(r1*time)+r2*c2*Math.exp(r2*time);}
  return{x:target+x,v};
 }
 function create({enabled=()=>true,clock=()=>performance.now()}={}){
  const owners=new WeakMap(),rects=new WeakMap(),active=new Set();
  const idle=()=>({finished:Promise.resolve(),cancel(){},finish(){}});
  function forget(item){
   active.delete(item);
   const remaining=(owners.get(item.el)||[]).filter(x=>x!==item);
   if(remaining.length)owners.set(item.el,remaining);else owners.delete(item.el);
  }
  function stop(item){forget(item);try{item.animation.cancel();}catch(error){}}
  function cancel(el){
   for(const item of owners.get(el)||[])stop(item);
   owners.delete(el);rects.delete(el);
  }
  function play(el,preset,frames,options={}){
   if(!el||!frames?.length)return idle();
   const properties=new Set(frames.flatMap(frame=>Object.keys(frame)).filter(x=>!['offset','easing','composite','computedOffset'].includes(x)));
   const previous=(owners.get(el)||[]).filter(item=>[...properties].some(x=>item.properties.has(x)));
   const first={...frames[0]};
   // getComputedStyle is live: copy every needed value before cancelling anything.
   if(previous.length&&typeof getComputedStyle==='function'){
    const style=getComputedStyle(el);
    for(const key of properties)if(previous.some(item=>item.properties.has(key)))first[key]=style[key];
   }
   for(const item of previous)stop(item);
   if(!enabled()||!el.animate){
    if(options.fill==='forwards'||options.fill==='both')for(const key of properties)if(key in frames[frames.length-1])el.style[key]=frames[frames.length-1][key];
    return idle();
   }
   const animation=el.animate([first,...frames.slice(1)],{...options,duration:options.duration??presets[preset]??presets.feedback});
   const item={animation,properties,el};active.add(item);
   owners.set(el,[...(owners.get(el)||[]),item]);
   animation.finished.then(()=>forget(item),()=>forget(item));
   return animation;
  }
  function atRect(state,time){
   const points=state.values,t=Math.max(0,Math.min(state.duration,time));
   let i=1;while(i<points.length-1&&points[i].t<t)i++;
   const a=points[i-1],b=points[i],span=Math.max(1e-6,b.t-a.t),f=Math.max(0,Math.min(1,(t-a.t)/span)),r={},v={};
   for(const key of keys){r[key]=a.r[key]+(b.r[key]-a.r[key])*f;v[key]=(b.r[key]-a.r[key])/span;}
   return{r,v};
  }
  function bounded(rect,min,max){
   let w=Math.max(1,rect.w),x=rect.x;
   if(Number.isFinite(min)&&Number.isFinite(max))w=Math.min(w,Math.max(1,max-min));
   if(Number.isFinite(min))x=Math.max(min,x);
   if(Number.isFinite(max))x=Math.min(max-w,x);
   return{x,y:rect.y,w,h:Math.max(1,rect.h)};
  }
  function animateRect(el,from,to,min,max,velocitySeed,{duration:fixedDuration,physics,stretch=0}={}){
   if(!el)return idle();
   const previous=rects.get(el),time=previous?Math.max(0,(Number.isFinite(previous.animation?.currentTime)?previous.animation.currentTime:clock()-previous.start)/1000):0;
   const painted=previous&&time<previous.duration?atRect(previous,time):null,initial={},velocity={};
   for(const key of keys){initial[key]=painted?painted.r[key]:from[key];velocity[key]=painted?painted.v[key]:velocitySeed[key]||0;}
   const values=[];let settled=0,duration=fixedDuration||.6;
   const steps=Math.ceil(duration*120);
   for(let i=0;i<=steps;i++){
    const t=Math.min(duration,i/120),r={},v={};
    for(const key of keys){const p=sample(initial[key],to[key],velocity[key],t,physics);r[key]=p.x;v[key]=p.v;}
    values.push({t,r,v});
    if(!fixedDuration){
     if(keys.every(k=>Math.abs(r[k]-to[k])<.25&&Math.abs(v[k])<2))settled++;else settled=0;
     if(settled>=3){duration=t;break;}
    }
   }
   const travel=Math.abs(to.x-initial.x),peak=Math.max(1,...values.map(p=>Math.abs(p.v.x+p.v.w/2)));
   for(const p of values){
    // Stretch at speed, within the track. Animate transforms, not layout width.
    if(stretch&&travel>2){const gain=stretch*Math.abs(p.v.x+p.v.w/2)/peak*Math.min(1,p.t/.025,(duration-p.t)/.025),extra=p.r.w*Math.max(0,gain);p.r={...p.r,x:p.r.x-extra/2,w:p.r.w+extra};}
    p.r=bounded(p.r,min,max);
   }
   values[values.length-1]={t:duration,r:bounded(to,min,max)};
   cancel(el);
   el.style.width=to.w+'px';el.style.height=to.h+'px';el.style.transformOrigin='0 0';
   el.style.transform='translate('+to.x+'px,'+to.y+'px)';
   const frames=values.map(({t,r})=>({offset:duration?Math.min(1,t/duration):1,transform:'translate('+r.x+'px,'+r.y+'px) scale('+r.w/Math.max(1,to.w)+','+r.h/Math.max(1,to.h)+')'}));
   const state={values,start:clock(),duration,animation:null};rects.set(el,state);
   const animation=play(el,'sheet',frames,{duration:duration*1000,easing:'linear'});state.animation=animation;
   const done=()=>{if(rects.get(el)===state)rects.delete(el);};animation.finished.then(done,done);
   return animation;
  }
  function springRect(el,from,to,min=-Infinity,max=Infinity,velocitySeed={}){return animateRect(el,from,to,min,max,velocitySeed,{});}
  function liquidRect(el,from,to,min=-Infinity,max=Infinity){return animateRect(el,from,to,min,max,{}, {duration:presets.liquid/1000,physics:{mass:1,stiffness:1024,damping:49.92},stretch:.16});}
  function cancelTree(root,{includeRoot=true}={}){
   if(!root)return;
   const elements=new Set();
   for(const item of active)if(item.el===root?includeRoot:root.contains(item.el))elements.add(item.el);
   for(const el of elements)cancel(el);
  }
  function finishAll(){for(const item of [...active])try{item.animation.finish();}catch(error){stop(item);}}
  return{play,springRect,liquidRect,cancel,cancelTree,finishAll,scrollBehavior:()=>enabled()?'smooth':'auto'};
 }
 return{create,sample,presets};
});
