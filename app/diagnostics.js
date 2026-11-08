(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CampusDiagnostics=api;})(globalThis,function(){
 'use strict';
 function create({Observer=globalThis.PerformanceObserver,clock=()=>performance.now()}={}){
  let supported=!!Observer?.supportedEntryTypes?.includes('longtask');const samples=[];let observer=null,startAt=null,endAt=null,generation=0,total=0,longest=0;
  function start(){if(!supported||observer)return;startAt=clock();endAt=null;samples.length=0;total=0;longest=0;const own=++generation;try{observer=new Observer(list=>{if(own!==generation)return;for(const item of list.getEntries())if(Number.isFinite(item.duration)){total++;longest=Math.max(longest,item.duration);samples.push({at:Math.max(0,clock()-startAt),duration:item.duration});if(samples.length>64)samples.shift();}});observer.observe({entryTypes:['longtask']});}catch(error){observer?.disconnect();observer=null;supported=false;}}
  function stop(){generation++;if(observer)endAt=clock();observer?.disconnect();observer=null;}
  function summary(){return{longTasks:supported?{observing:!!observer,count:total,retained:samples.length,longestMs:longest,windowMs:startAt!=null?Math.max(0,(endAt??clock())-startAt):0}:null,capabilities:{waapi:typeof Element!=='undefined'&&typeof Element.prototype.animate==='function',pointer:typeof PointerEvent!=='undefined',viewport:typeof visualViewport!=='undefined',clone:typeof structuredClone==='function'}};}
  return{start,stop,summary};
 }
 return{create};
});
