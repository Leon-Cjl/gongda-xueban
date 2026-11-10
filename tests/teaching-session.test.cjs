const {test}=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../app/teaching-session.js');
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
test('foreground/background callers share login and option readiness',async()=>{
 const gate=defer(),options=defer(),phases=[];let calls=0,prepared=0;
 const session=create({scope:()=> 'a',connect:async()=>{calls++;return gate.promise;},prepare:async()=>{prepared++;await options.promise;},changed:s=>{assert.ok(Object.isFrozen(s));phases.push(s.phase);}});
 const a=session.ensure(),b=session.ensure();assert.equal(a,b);await new Promise(setImmediate);assert.equal(calls,1);
 gate.resolve({connected:true});await new Promise(setImmediate);assert.equal(session.snapshot().phase,'connecting');assert.equal(prepared,1);
 options.resolve();assert.equal(await a,true);assert.deepEqual(phases,['connecting','ready']);
});
test('temporary network failure backs off and a later retry can recover',async()=>{
 let time=100,calls=0;const session=create({scope:()=> 'a',clock:()=>time,connect:async()=>{calls++;if(calls<3)throw Object.assign(Error('network'),{code:'NETWORK'});return{connected:true};}});
 assert.equal(await session.ensure(),false);assert.equal(session.snapshot().retryAt,30100);assert.equal(await session.ensure(),false);assert.equal(calls,1);
 time=30100;await session.ensure();assert.equal(session.snapshot().retryAt,90100);time=90100;assert.equal(await session.ensure(),true);assert.equal(session.snapshot().retryAt,0);
});
test('CAPTCHA stops automatic password attempts until explicit user retry',async()=>{
 let calls=0;const session=create({scope:()=> 'a',connect:async()=>{calls++;return{needsUser:true};}});
 await session.ensure();for(let i=0;i<3;i++)assert.equal(await session.ensure(),false);assert.equal(calls,1);assert.equal(session.snapshot().phase,'needs_user');
 await session.ensure({retry:true});assert.equal(calls,2);
});
test('old identity result and cleanup cannot change a new connection',async()=>{
 let owner='a';const gates=[defer(),defer()],phases=[];let calls=0,prepared=0;
 const session=create({scope:()=>owner,connect:()=>gates[calls++].promise,prepare:async()=>{prepared++;},changed:s=>phases.push([s.owner,s.phase])});
 const a=session.ensure();await new Promise(setImmediate);owner='b';const b=session.ensure();await new Promise(setImmediate);
 gates[0].resolve({connected:true});assert.equal(await a,false);assert.equal(session.snapshot().phase,'connecting');assert.equal(prepared,0);
 gates[1].resolve({connected:true});assert.equal(await b,true);assert.deepEqual(phases,[['a','connecting'],['b','connecting'],['b','ready']]);
});
test('an expiry arriving during a probe escalates once and shares final readiness',async()=>{
 const gate=defer(),calls=[];let prepared=0;
 const session=create({scope:()=> 'a',connect:async o=>{calls.push(o.fresh);return calls.length===1?gate.promise:{connected:true};},prepare:async()=>{prepared++;}});
 const a=session.ensure();await new Promise(setImmediate);const b=session.ensure({fresh:true});assert.equal(a,b);gate.resolve({connected:true});assert.equal(await b,true);assert.deepEqual(calls,[false,true]);assert.equal(prepared,1);
});
test('reset before dispatch prevents an old intent from using a new account',async()=>{
 let calls=0;const session=create({scope:()=> 'a',connect:async()=>{calls++;return{connected:true};}});
 const run=session.ensure();session.reset();assert.equal(await run,false);assert.equal(calls,0);assert.equal(session.snapshot().phase,'idle');
});
test('malformed and stale responses do not masquerade as connected',async()=>{
 const session=create({scope:()=> 'a',connect:async()=>null});assert.equal(await session.ensure(),false);assert.equal(session.snapshot().phase,'retryable');
 const stale=create({scope:()=> 'a',connect:async()=>{throw Object.assign(Error('stale'),{code:'STALE'});}});assert.equal(await stale.ensure(),false);assert.equal(stale.snapshot().phase,'idle');
});
