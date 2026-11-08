import fs from 'node:fs';import {adb,pkg,connect,sleep} from './emulator-driver.mjs';
const [output,apk]=process.argv.slice(2);if(!output||!apk)throw Error('Pass output path and isolated QA APK');let c;const checks=[],check=(ok,name)=>{checks.push({ok:!!ok,name});if(!ok)throw Error(name);};
async function attach(){c=await connect('https://campus.local/');for(let i=0;i<150;i++){if(await c.evaluate('!!window.CampusRuntimeReady&&document.querySelector("#accountDot")?.classList.contains("ok")'))break;await sleep(100);}await c.evaluate(`(()=>{let n=0;const pending=new Map(),receive=Campus.receive;Campus.receive=m=>{const fn=pending.get(m.id);if(fn){pending.delete(m.id);fn(m);}else receive(m);};window.qaHost=(cmd,data={})=>new Promise(resolve=>{const id='upgrade-'+(++n);pending.set(id,resolve);NativeHost.post(JSON.stringify({id,cmd,data}));});return true;})()`);}
const host=(cmd,data={})=>c.evaluate(`qaHost(${JSON.stringify(cmd)},${JSON.stringify(data)})`);
try{
 adb('shell','am','start','-S','-n',pkg+'/cn.qlucampus.personal.HostAcceptanceActivity');await attach();check((await host('qaSeedLegacy')).ok,'legacy-format synthetic tasks and favourites are durably seeded in the isolated QA directory');c.close();c=null;
 adb('shell','am','force-stop',pkg);adb('install','-r','-t',apk);check(true,'an APK package replacement completes without clearing application data');
 adb('shell','am','start','-n',pkg+'/cn.qlucampus.personal.HostAcceptanceActivity','--ez','keepSyntheticState','true');await attach();const before=(await host('ready')).data;
 check(before.legacyAvailable&&!before.state.tasks?.length,'unowned legacy data survives replacement but stays quarantined from the verified identity');
 const adopt=await host('adoptLegacyState');check(adopt.ok,'explicit recovery is accepted only after the current synthetic identity is verified');await sleep(500);c.close();await attach();const after=(await host('ready')).data;
 check(after.state.tasks?.find(x=>x.id==='legacy-pending')?.status==='needs_auth'&&after.state.tasks?.find(x=>x.id==='legacy-sending')?.status==='uncertain','old pending work pauses and interrupted submissions require verification after adoption');
 check(after.state.favorites?.some(x=>x.key==='seat:qa:1')&&!Object.keys(after.state.preferences?.examCache||{}).length,'explicit recovery preserves favourites without assigning another identity exam cache');
 check((await host('qaCountWrites')).data.writes===0,'package replacement and legacy recovery never replay a school write');
}catch(error){checks.push({ok:false,name:error.stack||error.message});process.exitCode=1;}
finally{fs.writeFileSync(output,JSON.stringify({synthetic:true,scope:'isolated QA APK replacement plus legacy-format migration; existing personal installation untouched',checks,runtimeErrors:c?.errors||[]},null,2));console.log(JSON.stringify({checks:checks.length,failed:checks.filter(x=>!x.ok)}));c?.close();}
