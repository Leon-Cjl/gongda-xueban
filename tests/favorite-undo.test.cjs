const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const C=require('../app/core.js');
const source=fs.readFileSync(path.join(__dirname,'../app/ui.js'),'utf8');
const feature=source.slice(source.indexOf('async function favoriteSelection()'),source.indexOf('async function favoriteClick('));
function setup(){
 const seat=id=>({id,no:String(id),areaId:'12',areaName:'合成测试区域'});
 let initial=[];for(const id of [1,2,3])initial=C.addFavorite(initial,'seat',seat(id));
 const state={favorites:initial,selection:[seat(1),seat(2)]};let undo,saves=0;
 const context=vm.createContext({state,C,Set,seatItem:x=>x,isFavorite:(type,x)=>state.favorites.some(f=>f.key===C.favoriteKey(type,x)),save:async()=>{saves++;},render(){},toast:(text,callback)=>{undo=callback;}});
 vm.runInContext(feature,context);
 return {state,seat,remove:context.favoriteSelection,undo:()=>undo(),saves:()=>saves};
}
test('undoing a batch favorite removal preserves later additions, removals and edits',async()=>{
 const s=setup();await s.remove();
 assert.deepEqual(s.state.favorites.map(f=>f.id),['3']);
 s.state.favorites=s.state.favorites.filter(f=>f.id!=='3');
 s.state.favorites=C.addFavorite(s.state.favorites,'seat',s.seat(4));
 s.state.favorites=C.addFavorite(s.state.favorites,'seat',{...s.seat(2),areaName:'后来重新收藏的区域名'});
 await s.undo();
 assert.deepEqual(s.state.favorites.map(f=>f.id).sort(),['1','2','4']);
 assert.equal(s.state.favorites.find(f=>f.id==='2').areaName,'后来重新收藏的区域名');
 assert.equal(s.saves(),2);
});
test('batch undo restores only removed favorites and never duplicates a re-added seat',async()=>{
 const s=setup(),before=s.state.favorites.find(f=>f.id==='1');await s.remove();
 s.state.favorites=C.addFavorite(s.state.favorites,'seat',s.seat(1));await s.undo();
 assert.equal(s.state.favorites.filter(f=>f.id==='1').length,1);
 assert.equal(s.state.favorites.length,3);
 assert.equal(s.state.favorites.find(f=>f.id==='2').areaName,before.areaName);
});
