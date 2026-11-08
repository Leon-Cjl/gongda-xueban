const {test}=require('node:test'),assert=require('node:assert/strict');const {create}=require('../app/diagnostics.js');
test('diagnostics are opt-in, bounded, generation-safe and stop without extending the observation window',()=>{
 let time=100,callback,disconnected=0;class Observer{static supportedEntryTypes=['longtask'];constructor(fn){callback=fn;}observe(){}disconnect(){disconnected++;}}
 const d=create({Observer,clock:()=>time});assert.equal(callback,undefined);d.start();time=140;
 callback({getEntries:()=>Array.from({length:100},(_,i)=>({duration:60+i,url:'synthetic-private',name:'synthetic-private'}))});
 let r=d.summary();assert.equal(r.longTasks.count,100);assert.equal(r.longTasks.retained,64);assert.ok(!JSON.stringify(r).includes('private'));d.stop();time=500;
 callback({getEntries:()=>[{duration:900}]});r=d.summary();assert.equal(r.longTasks.count,100);assert.equal(r.longTasks.windowMs,40);assert.equal(disconnected,1);
});
test('unsupported diagnostics report unavailable rather than zero long tasks',()=>{assert.equal(create({Observer:null}).summary().longTasks,null);});
