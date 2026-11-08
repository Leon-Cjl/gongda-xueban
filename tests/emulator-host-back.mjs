import fs from 'node:fs';import {adb,pkg,connect,sleep} from './emulator-driver.mjs';
const output=process.argv[2];if(!output)throw Error('Pass output JSON path');const checks=[],check=(ok,name)=>{checks.push({ok:!!ok,name});if(!ok)throw Error(name);};
adb('shell','am','start','-S','-n',pkg+'/cn.qlucampus.personal.HostAcceptanceActivity');const c=await connect('https://campus.local/');
const wait=async expression=>{for(let i=0;i<160;i++){if(await c.evaluate(expression))return;await sleep(100);}throw Error('Timed out '+expression);};
const host=(cmd,data={})=>c.evaluate(`qaHost(${JSON.stringify(cmd)},${JSON.stringify(data)})`);
try{
 await wait('!!window.CampusRuntimeReady&&document.querySelector("#accountDot")?.classList.contains("ok")');
 await c.evaluate(`(()=>{let n=0;const pending=new Map(),receive=Campus.receive;Campus.receive=m=>{const fn=pending.get(m.id);if(fn){pending.delete(m.id);fn(m);}else receive(m);};window.qaHost=(cmd,data={})=>new Promise(resolve=>{const id='back-'+(++n);pending.set(id,resolve);NativeHost.post(JSON.stringify({id,cmd,data}));});document.querySelector('[data-action="settings"]').click();return true;})()`);
 await wait('document.querySelector("#dialog").open');adb('shell','input','keyevent','4');await wait('!document.querySelector("#dialog").open');check(true,'the production native Back handler consumes one local overlay without exiting');
 const before=(await host('qaWindowState')).data.brightnessOverride;await host('qaPassRoute');let window=(await host('qaWindowState')).data;
 check(window.officialVisible&&window.brightened&&window.brightnessOverride===1,'the real protected-route shell raises only its own window brightness on a synthetic intercepted page');
 adb('shell','input','keyevent','4');await sleep(200);window=(await host('qaWindowState')).data;check(!window.officialVisible&&!window.brightened&&window.brightnessOverride===before,'Back exits the protected route and restores the original window override');
 await host('qaPassRoute');adb('shell','input','keyevent','3');await sleep(200);window=(await host('qaWindowState')).data;check(!window.officialVisible&&!window.brightened&&window.brightnessOverride===before,'backgrounding a protected route restores brightness and closes its visible content');
 adb('shell','am','start','--activity-reorder-to-front','-n',pkg+'/cn.qlucampus.personal.HostAcceptanceActivity');await sleep(250);check((await host('qaWindowState')).data.brightnessOverride===before,'returning to the app does not revive a stale brightness override');check((await host('qaCountWrites')).data.writes===0,'all native return and lifecycle checks issue no school writes');
 check(c.errors.length===0,'the production-host route flow has no JavaScript exceptions');
}catch(error){checks.push({ok:false,name:error.stack||error.message});process.exitCode=1;}
finally{fs.writeFileSync(output,JSON.stringify({synthetic:true,officialNetwork:'all requests intercepted by the QA WebViewClient; no pass code fetched',checks,runtimeErrors:c.errors},null,2));console.log(JSON.stringify({checks:checks.length,failed:checks.filter(x=>!x.ok)}));c.close();}
