const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app/ui.js'),'utf8');
const deferred=()=>{let resolve,reject;return{promise:new Promise((a,b)=>{resolve=a;reject=b}),resolve,reject};};
function context(api){const state={activeAccountId:'default',username:'synthetic-a',sessionEpoch:1,libraryConnected:true,page:'library',current:['new-current'],currentError:'new-error',profile:{name:'new-profile'},violations:{total:0},statusAt:0};return vm.createContext({state,api,inputOwner:()=>JSON.stringify([state.activeAccountId,state.username,state.sessionEpoch]),restricted:()=>false,render:()=>{},Promise,Date});}
for(const field of ['username','sessionEpoch']){
 test('current/records aggregate cannot apply an earlier fulfilled half after '+field+' changes',async()=>{
  const gate=deferred(),c=context(method=>method==='current'?Promise.resolve(['old-synthetic']):gate.promise);
  const start=source.indexOf('async function refreshCurrent()');vm.runInContext(source.slice(start,source.indexOf('/* ---------- 预约流程',start)),c);
  const run=c.refreshCurrent();await new Promise(setImmediate);c.state[field]=field==='username'?'synthetic-b':2;gate.reject(Object.assign(Error('old rejected half'),{code:'STALE'}));await run;
  assert.deepEqual(c.state.current,['new-current']);assert.equal(c.state.currentError,'new-error');
 });
 test('profile/violations aggregate cannot relabel an earlier fulfilled half after '+field+' changes',async()=>{
  const gate=deferred(),c=context(method=>method==='profile'?Promise.resolve({name:'old-synthetic'}):gate.promise);
  const start=source.indexOf('async function loadAccountStatus(');vm.runInContext(source.slice(start,source.indexOf('/* ---------- 签到提醒',start)),c);
  const run=c.loadAccountStatus({force:true});await new Promise(setImmediate);c.state[field]=field==='username'?'synthetic-b':2;gate.reject(Object.assign(Error('old rejected half'),{code:'STALE'}));await run;
  assert.deepEqual(c.state.profile,{name:'new-profile'});assert.deepEqual(c.state.violations,{total:0});
 });
}
