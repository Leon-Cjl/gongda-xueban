const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app/ui.js'), 'utf8');
const roomBlockStart = source.indexOf('async function roomPage(');
const roomBlockEnd = source.indexOf('async function autoConnectTeaching(', roomBlockStart);
assert.ok(roomBlockStart >= 0 && roomBlockEnd > roomBlockStart, 'room query functions must have stable boundaries');
const block = source.slice(roomBlockStart, roomBlockEnd);
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
const query = weekday => ({year:'2026',term:'3',campus:'1',week:7,weekday,periods:[1,2]});
function setup(hasResult = true) {
 const gate = deferred(), errors = [], rows = {rooms:[{id:'old'}]}, fresh = {rooms:[{id:'fresh'}]};
 const state = {rooms:hasResult ? rows : null, roomQuery:query(1), preferences:{roomQuery:query(1)}, teachingOptions:{currentWeek:7}, roomLoading:false, roomsStale:false};
 let local = null, requests = 0;
 const ctx = vm.createContext({state, structuredClone, untilToken:0, ROOM_PAGE:40, queryRooms:() => {requests++;return gate.promise;}, instantRooms:() => local, nowStamp:()=>'14:00', haptic:()=>{}, fail:e=>errors.push(e.message), render:()=>{}, renderRoomResults:()=>{}, roomDateLabel:()=>'', $:()=>null});
 vm.runInContext(source.match(/^const inputOwner = .*$/m)[0],ctx);
 vm.runInContext(block,ctx); ctx.roomBusyUi=()=>{};
 return {state,gate,errors,fresh,ctx,get requests(){return requests;}, change(weekday,hit=null){local=hit;state.preferences.roomQuery=query(weekday);ctx.roomFormChanged();}, setLocal(value){local=value;}};
}
test('late success cannot mark a newer local result stale', async () => {
 const s=setup(), run=s.ctx.runRoomQuery(query(1),{online:true});
 s.change(2,s.fresh);s.gate.resolve({rooms:[{id:'late'}]});
 assert.equal(await run,false);assert.equal(s.state.rooms,s.fresh);assert.equal(s.state.roomsStale,false);assert.equal(s.state.roomQuery.weekday,2);
});
test('late failure cannot invalidate the current local result or show an old error', async () => {
 const s=setup(), run=s.ctx.runRoomQuery(query(1),{online:true});
 s.change(2,s.fresh);s.gate.reject(Object.assign(Error('old-session-expired'),{code:'EXPIRED'}));await run;
 assert.deepEqual(s.errors,[]);assert.equal(s.state.rooms,s.fresh);assert.equal(s.state.roomsStale,false);assert.equal(s.state.roomLoading,false);
});
test('editing conditions during the first query invalidates its reply even without existing rows', async () => {
 const s=setup(false),run=s.ctx.runRoomQuery(query(1),{online:true});
 s.change(2);s.gate.resolve({rooms:[{id:'late'}]});assert.equal(await run,false);assert.equal(s.state.rooms,null);
});
test('pagination replies cannot overwrite results for newly selected conditions', async () => {
 const s=setup(),run=s.ctx.roomPage(2);s.change(2,s.fresh);s.gate.resolve({rooms:[{id:'late-page'}],page:2});await run;
 assert.equal(s.state.rooms,s.fresh);assert.equal(s.state.roomQuery.weekday,2);assert.equal(s.state.roomsStale,false);
});
test('pagination failure after conditions change is silent', async () => {
 const s=setup(),run=s.ctx.roomPage(2);s.change(2,s.fresh);s.gate.reject(Error('old-page-failed'));await run;assert.deepEqual(s.errors,[]);
});
test('a duplicate blocked query does not invalidate the query already running', async () => {
 const s=setup(),run=s.ctx.runRoomQuery(query(1),{online:true});
 assert.equal(await s.ctx.runRoomQuery(query(1),{online:true}),false);s.gate.resolve(s.fresh);
 assert.equal(await run,true);assert.equal(s.state.rooms,s.fresh);assert.equal(s.requests,1);
});
test('current query failures remain visible and release the busy state', async () => {
 const s=setup(),run=s.ctx.runRoomQuery(query(1),{online:true});s.gate.reject(Error('current-network-error'));await run;
 assert.deepEqual(s.errors,['current-network-error']);assert.equal(s.state.roomLoading,false);
});
test('changing conditions without a local answer keeps existing rows marked stale', async () => {
 const s=setup(),old=s.state.rooms,run=s.ctx.runRoomQuery(query(1),{online:true});s.change(2);s.gate.resolve(s.fresh);await run;
 assert.equal(s.state.rooms,old);assert.equal(s.state.roomsStale,true);
});
test('valid pagination records its actual page and keeps the form conditions', async () => {
 const s=setup(),run=s.ctx.roomPage(2);s.gate.resolve({...s.fresh,page:2});await run;
 assert.equal(s.state.rooms.page,2);assert.equal(s.state.roomQuery.page,2);assert.equal(s.state.roomQuery.weekday,1);assert.equal(s.state.roomLimit,40);
});

test('a same-query reply from an old identity cannot replace the current account results',async()=>{
 const s=setup(),old=s.state.rooms,run=s.ctx.runRoomQuery(query(1),{online:true});s.state.sessionEpoch=2;s.gate.resolve(s.fresh);assert.equal(await run,false);assert.equal(s.state.rooms,old);
});
