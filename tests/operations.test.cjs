const {test}=require('node:test');const assert=require('node:assert/strict');
const {create}=require('../app/operations.js');const {recordMatches}=require('../app/core.js');
function fixture(){const state={operations:[]},saved=[];let n=0;return{state,saved,journal:create({state,save:async()=>saved.push(structuredClone(state.operations)),id:()=>String(++n),now:()=>42,recordMatches})};}
test('write intent is durable before dispatch and contains only the approved fields',async()=>{
 const f=fixture();await f.journal.run('reserve',{id:'task',seatId:1,day:'2026-11-02',password:'synthetic-excluded'},async id=>{assert.equal(id,'1');assert.equal(f.saved[0][0].phase,'sending');assert.ok(!('password'in f.saved[0][0].params));return{accepted:true};},'subject-a');
 assert.equal(f.state.operations[0].phase,'verifying');
});
test('a failed durable save prevents the school write',async()=>{
 let writes=0;const state={};const journal=create({state,save:async()=>{throw Error('disk')},id:()=>1,recordMatches});await assert.rejects(journal.run('reserve',{},async()=>{writes++;},'a'),/未向学校提交/);assert.equal(writes,0);
});
test('interrupted write recovery never dispatches again',async()=>{const f=fixture();f.state.operations=[{phase:'sending',method:'reserve',params:{},owner:'a'}];assert.equal(f.journal.recover(),true);assert.equal(f.state.operations[0].phase,'uncertain');assert.equal(f.journal.recover(),false);});
test('an unknown result blocks conflicting writes but permits reads and another owner',async()=>{
 const f=fixture();await assert.rejects(f.journal.run('reserve',{seatId:1},async()=>{throw Object.assign(Error('lost'),{code:'UNCERTAIN'})},'a'));
 let calls=0;await assert.rejects(f.journal.run('reserve',{seatId:2},async()=>{calls++},'a'),/待核验/);assert.equal(calls,0);
 await f.journal.run('records',{},async()=>{calls++;return[]},'a');await f.journal.run('reserve',{seatId:2},async()=>{calls++;return{accepted:true}},'b');assert.equal(calls,2);
});
test('absence or non-cancellability does not prove cancellation or checkout',async()=>{
 const f=fixture();f.state.operations=[{method:'cancelBooking',phase:'uncertain',params:{id:1}},{method:'checkout',phase:'uncertain',params:{id:2}}];
 assert.equal(f.journal.reconcile([{id:1,status:5},{id:2,status:2}],[]),false);assert.equal(f.journal.reconcile([],[]),false);
 assert.equal(f.journal.reconcile([{id:1,status:4,status_name:'已取消'},{id:2,status:5,status_name:'已结束'}],[]),true);assert.ok(f.state.operations.every(x=>x.phase==='verified'));
});
test('reserve journal confirms only matching successful records',()=>{
 const f=fixture();f.state.operations=[{method:'reserve',phase:'uncertain',params:{seatId:1,day:'2026-11-02',start:'08:00',end:'10:00'}}];
 const row={space:1,beginTime:'2026-11-02 08:00:00',endTime:'2026-11-02 10:00:00',status_name:'已撤销'};
 assert.equal(f.journal.reconcile([row],[]),false);assert.equal(f.journal.reconcile([{...row,status_name:'预约成功'}],[]),true);
});
test('failure to save a successful response remains uncertain',async()=>{
 let saves=0;const state={};const journal=create({state,save:async()=>{if(++saves>1)throw Error('disk')},id:()=>1,recordMatches});
 await assert.rejects(journal.run('checkout',{id:1},async()=>({verified:true}),'a'));assert.equal(state.operations[0].phase,'uncertain');
});
