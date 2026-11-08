import fs from 'node:fs';
import {adb,pkg,connect,sleep} from './emulator-driver.mjs';
const output=process.argv[2];if(!output)throw Error('Pass an output JSON path');
adb('shell','am','start','-S','-n',pkg+'/cn.qlucampus.personal.HostAcceptanceActivity');
const c=await connect('https://campus.local/'),checks=[];
const check=(ok,name)=>{checks.push({ok:!!ok,name});if(!ok)throw Error(name)};
const wait=async expression=>{for(let i=0;i<200;i++){try{if(await c.evaluate(expression))return;}catch{}await sleep(100);}throw Error('Condition timed out: '+expression)};
async function install(){
 await wait('!!window.CampusRuntimeReady&&!!window.Campus&&document.querySelector("#accountDot")?.classList.contains("ok")');
 await c.evaluate(`(()=>{let n=0;const receive=Campus.receive;window.__testPending=new Map();Campus.receive=m=>{const p=__testPending.get(m.id);if(p){__testPending.delete(m.id);p(m);}else receive(m);};window.__testHost=(cmd,data={})=>new Promise(resolve=>{const id='native-qa-'+(++n);__testPending.set(id,resolve);NativeHost.post(JSON.stringify({id,cmd,data}));});return true})()`);
}
const host=async(cmd,data={})=>c.evaluate(`__testHost(${JSON.stringify(cmd)},${JSON.stringify(data)})`);
const ready=()=>host('ready');
const credentials=subject=>host('credentials',{username:subject,password:'synthetic-only',remember:true});
try{
 await install();await wait(`document.querySelector('#accountDot').classList.contains('ok')`);let a=(await ready()).data;
 check(a.subjectId==='synthetic-a'&&a.identityVerified,'real native handlers verify the synthetic school identity');
 let r=await host('saveState',{_sessionEpoch:a.sessionEpoch,tasks:[{id:'history-a',status:'failed',seats:[]}],favorites:[],preferences:{}});check(r.ok,'identity-owned state is durably acknowledged');
 r=await credentials('synthetic-b');check(r.ok&&r.data.reload,'credentials finish the session transaction before requesting a local reload');
 await sleep(350);await install();await wait(`document.querySelector('#accountDot').classList.contains('ok')`);let b=(await ready()).data;
 check(b.subjectId==='synthetic-b'&&b.sessionEpoch>a.sessionEpoch&&!b.state.tasks?.some(x=>x.id==='history-a'),'the new identity cannot see the previous identity tasks');
 r=await host('saveState',{_sessionEpoch:a.sessionEpoch,tasks:[{id:'late-a'}],preferences:{}});check(!r.ok&&r.error.code==='STALE','a late save from the old session is rejected');
 r=await host('library',{sessionEpoch:a.sessionEpoch,method:'records',params:{}});check(!r.ok&&r.error.code==='STALE','old-session school reads are rejected by native');
 await host('saveState',{_sessionEpoch:b.sessionEpoch,tasks:[{id:'history-b',status:'failed',seats:[]}],favorites:[],preferences:{}});
 await credentials('synthetic-a');await sleep(350);await install();await wait(`document.querySelector('#accountDot').classList.contains('ok')`);a=(await ready()).data;
 check(a.state.tasks.some(x=>x.id==='history-a')&&!a.state.tasks.some(x=>x.id==='history-b'),'switching back restores only the correct archived identity state');
 adb('shell','input','keyevent','3');await sleep(200);
 r=await host('library',{sessionEpoch:a.sessionEpoch,method:'reserve',params:{}});check(!r.ok&&r.error.code==='PAUSED','native rejects a new school write while the Activity is in the background');
 check((await host('qaCountWrites')).data.writes===0,'the background rejection occurs before the synthetic school adapter dispatch');
 adb('shell','am','start','--activity-reorder-to-front','-n',pkg+'/cn.qlucampus.personal.HostAcceptanceActivity');await sleep(250);
 r=await host('qaTrimMemory');check(r.data.passReleased&&r.data.teachingReleased&&r.data.mainAlive&&r.data.apiAlive,'memory pressure releases inactive school pages while preserving the local UI and operation adapter');
 await host('qaProfileMismatch');await sleep(500);a=(await ready()).data;
 check(!a.identityVerified,'a school profile that disagrees with the intended identity is not accepted');
 r=await host('library',{sessionEpoch:a.sessionEpoch,method:'records',params:{}});check(!r.ok&&r.error.code==='AUTH','private school data stays blocked after identity verification fails');
}catch(error){checks.push({ok:false,name:error.message});process.exitCode=1;}
finally{fs.writeFileSync(output,JSON.stringify({synthetic:true,checks,runtimeErrors:c.errors},null,2));console.log(JSON.stringify({checks:checks.length,failed:checks.filter(x=>!x.ok),runtimeErrors:c.errors.length}));if(c.errors.length)process.exitCode=1;c.close();}
