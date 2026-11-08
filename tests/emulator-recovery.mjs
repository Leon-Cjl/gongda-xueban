import fs from 'node:fs';
import {adb,pkg,connect,sleep} from './emulator-driver.mjs';
const output=process.argv[2];if(!output)throw Error('Pass an output JSON path');
const checks=[],check=(ok,name)=>{checks.push({ok:!!ok,name});if(!ok)throw Error(name);};let c;
async function install(){c=await connect('https://campus.local/');for(let i=0;i<160;i++){try{if(await c.evaluate('!!window.CampusRuntimeReady&&document.querySelector("#accountDot")?.classList.contains("ok")'))break;}catch{}await sleep(100);}await c.evaluate(`(()=>{let n=0;const receive=Campus.receive,pending=new Map();Campus.receive=m=>{const p=pending.get(m.id);if(p){pending.delete(m.id);p(m);}else receive(m);};window.qaHost=(cmd,data={})=>new Promise(resolve=>{const id='recovery-'+(++n);pending.set(id,resolve);NativeHost.post(JSON.stringify({id,cmd,data}));});return true;})()`);}
const host=(cmd,data={})=>c.evaluate(`qaHost(${JSON.stringify(cmd)},${JSON.stringify(data)})`);
try{
 adb('shell','am','start','-S','-n',pkg+'/cn.qlucampus.personal.HostAcceptanceActivity');await install();
 const ready=(await host('ready')).data,operation={id:'interrupted-synthetic',owner:'synthetic-a',method:'reserve',phase:'sending',at:Date.now(),params:{day:'2099-12-01',start:'09:00',end:'11:00',seatId:1}};
 const saved=await host('saveState',{_sessionEpoch:ready.sessionEpoch,tasks:[],favorites:[],preferences:{},operations:[operation]});check(saved.ok,'a synthetic in-flight operation is durably recorded before renderer loss');
 const terminate=await host('qaTerminateRenderer');check(terminate.data.supported,'the system WebView supports actual renderer termination');
 c.close();c=null;await sleep(1800);await install();
 const result=(await host('ready')).data;
 check(result.identityVerified&&result.subjectId==='synthetic-a','the Activity reconstructs and re-verifies the synthetic identity after renderer termination');
 check(result.state.operations?.some(x=>x.id===operation.id&&x.phase==='uncertain'),'the interrupted operation recovers as awaiting verification');
 check((await host('qaCountWrites')).data.writes===0,'recovery never dispatches or replays a school write');
 check(!await c.evaluate('document.querySelector("#dialog").open'),'renderer recovery does not resurrect an old overlay');
}catch(error){checks.push({ok:false,name:error.stack||error.message});process.exitCode=1;}
finally{fs.writeFileSync(output,JSON.stringify({synthetic:true,checks,runtimeErrors:c?.errors||[]},null,2));console.log(JSON.stringify({checks:checks.length,failed:checks.filter(x=>!x.ok),runtimeErrors:c?.errors?.length||0}));c?.close();}
