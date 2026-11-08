const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app/ui.js'),'utf8').replace(/\r\n/g,'\n');
const start=source.indexOf('function settleMotion()'),end=source.indexOf("\nmatchMedia(",start);
assert.ok(start>=0&&end>start,'motion settling function is present');
function run({enabled=false,closing='',animations=[],withApi=true}={}){
 const calls=[],classes=new Set(closing?[closing]:[]);
 const dialog={open:true,closeTimer:17,classList:{contains:k=>classes.has(k),remove:k=>classes.delete(k)},closeCleanup:()=>calls.push('cleanup'),cancelDrag:()=>calls.push('cancelDrag'),close(){this.open=false;calls.push('close');}};
 const document=withApi?{getAnimations:()=>animations}:{};
 const nav={};
 const context=vm.createContext({motionOn:()=>enabled,$:selector=>selector==='.nav'?nav:dialog,navDragEnd:(target,commit)=>{assert.equal(target,nav);assert.equal(commit,false);calls.push('cancelNav');},endPress:cancel=>{assert.equal(cancel,true);calls.push('cancelPress');},document,clearTimeout:id=>calls.push('timer:'+id)});
 vm.runInContext(source.slice(start,end)+'\nsettleMotion();',context);
 return {calls,dialog,classes};
}
test('standard motion leaves active animations and dialogs alone',()=>{
 let finished=false;const v=run({enabled:true,closing:'closing',animations:[{finish:()=>{finished=true;}}]});
 assert.deepEqual(v.calls,[]);assert.equal(v.dialog.open,true);assert.equal(finished,false);
});
test('reducing motion completes either close path and clears its fallback exactly once',()=>{
 for(const closing of ['closing','closing-drag']){
  const v=run({closing});
  assert.equal(v.dialog.open,false);assert.equal(v.calls.filter(x=>x==='close').length,1);
  assert.ok(v.calls.includes('cleanup')&&v.calls.includes('timer:17')&&v.calls.includes('cancelDrag'));
  assert.equal(v.calls.filter(x=>x==='cancelNav').length,1);assert.equal(v.calls.filter(x=>x==='cancelPress').length,1);
 }
});
test('settling animations keeps an ordinary open dialog available',()=>{
 const effects=[];const v=run({animations:[{finish:()=>effects.push('finished')} ]});
 assert.deepEqual(effects,['finished']);assert.equal(v.dialog.open,true);assert.ok(!v.calls.includes('close'));
});
test('an infinite animation cannot prevent other animations from settling',()=>{
 const effects=[];run({animations:[{finish:()=>{throw Error('infinite');},cancel:()=>effects.push('cancelled')},{finish:()=>effects.push('finished')}]});
 assert.deepEqual(effects,['cancelled','finished']);assert.doesNotThrow(()=>run({withApi:false}));
});
