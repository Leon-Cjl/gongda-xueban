const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/ui.js'),'utf8');
const listener=source.split(/\r?\n/).find(line=>line.includes("window.addEventListener('pointerup',e=>{if(e.pointerId===navDrag.id)"));
assert.ok(listener,'the real navigation release handler must be present');
function fixture(){
 const nav={},navDrag={id:7,on:true,x:30},releases=[];let up;
 vm.runInNewContext(listener,{window:{addEventListener:(type,fn)=>{assert.equal(type,'pointerup');up=fn;}},nav,navDrag,
  navDragEnd:(element,commit)=>{assert.equal(element,nav);releases.push({x:navDrag.x,commit});}});
 return {navDrag,releases,up};
}
test('navigation release uses the final pointer position even without a preceding move',()=>{
 const f=fixture();f.up({pointerId:7,clientX:210});assert.deepEqual(f.releases,[{x:210,commit:true}]);
});
test('an unrelated pointer cannot move or release the captured navigation gesture',()=>{
 const f=fixture();f.up({pointerId:8,clientX:210});assert.equal(f.navDrag.x,30);assert.deepEqual(f.releases,[]);
});
