const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app/ui.js'),'utf8');
function setup({hour=21,day='2026-11-09',selected=day,loading=false,dialog=false,ready=true}={}){
 const calls=[],state={day:selected,loading,libraryConnected:true,selection:[1],areas:[1],info:{old:true},seats:[1],openingArea:'old',updated:'old',error:'old'};
 const context={state,window:{CampusRuntimeReady:ready},C:{nowChina:()=>day},chinaHour:()=>hour,$:()=>({open:dialog}),loadLibrary:()=>calls.push('load'),render:()=>calls.push('render'),addDays:(value,n)=>new Date(Date.parse(value+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)};
 vm.runInNewContext(source.slice(source.indexOf('function earliestBookingDay()'),source.indexOf('\nfunction api('))+'\nthis.rollDay=rollDay;this.earliestBookingDay=earliestBookingDay;',context);
 return{state,calls,...context};
}
test('21:59 retains today while 22:00 advances the bookable day',()=>{assert.equal(setup({hour:21}).earliestBookingDay(),'2026-11-09');assert.equal(setup({hour:22}).earliestBookingDay(),'2026-11-10');});
test('crossing the cutoff clears stale seats and reloads tomorrow exactly once',()=>{const x=setup({hour:22});assert.equal(x.rollDay(),true);assert.equal(x.state.day,'2026-11-10');assert.equal(x.state.info,null);assert.deepEqual([...x.state.selection],[]);assert.deepEqual(x.calls,['load']);assert.equal(x.rollDay(),false);assert.equal(x.calls.length,1);});
test('midnight retains the same calendar date that was tomorrow before midnight',()=>{const x=setup({hour:0,day:'2026-11-10',selected:'2026-11-10'});assert.equal(x.rollDay(),false);assert.deepEqual(x.calls,[]);});
test('future explicit date is retained and month/year boundaries advance correctly',()=>{assert.equal(setup({hour:22,day:'2026-12-31'}).earliestBookingDay(),'2027-01-01');const x=setup({hour:22,selected:'2026-11-12'});assert.equal(x.rollDay(),false);assert.equal(x.state.day,'2026-11-12');});
test('cutoff waits for an active dialog or loading flow and never acts before local state is ready',()=>{for(const options of [{dialog:true},{loading:true},{ready:false}]){const x=setup({hour:22,...options});assert.equal(x.rollDay(),false);assert.deepEqual(x.calls,[]);}});

test('confirming a dialog across 22:00 reloads tomorrow and never submits the stale date',async()=>{
 const events=[],dialog={open:true,dataset:{kind:'book'}},context={creatingTasks:false,pendingBooking:{day:'2026-11-09'},$:()=>dialog,earliestBookingDay:()=> '2026-11-10',closeDialog:()=>events.push('close'),normalizeBookingDay:()=>events.push('normalize'),toast:()=>events.push('notice'),loadLibrary:async()=>events.push('reload'),C:{validateTask:()=>assert.fail('stale date must not submit')},addTasks:()=>assert.fail('must not book a new date without confirmation')};
 vm.runInNewContext(source.slice(source.indexOf('async function confirmBook()'),source.indexOf('// 没约上时“再试一次”'))+'\nthis.confirm=confirmBook;',context);
 await context.confirm();assert.equal(context.pendingBooking,null);assert.deepEqual(events,['close','normalize','notice','reload']);
});
