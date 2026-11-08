import fs from 'node:fs';import {adb,pkg,connect,sleep} from './emulator-driver.mjs';
const output=process.argv[2];if(!output)throw Error('Pass output JSON path');const samples=[];let device;
for(let i=0;i<20;i++){
 const launch=adb('shell','am','start','-W','-S','-n',pkg+'/cn.qlucampus.personal.HostAcceptanceActivity').toString();const c=await connect('https://campus.local/');
 try{let ready=false;for(let j=0;j<160;j++){ready=await c.evaluate('!!window.CampusRuntimeReady&&document.querySelector("#accountDot")?.classList.contains("ok")');if(ready)break;await sleep(100);}if(!ready)throw Error('startup did not become locally usable and verify the synthetic identity');
 const marks=await c.evaluate('performance.getEntriesByType("mark").map(x=>({name:x.name,startTime:x.startTime}))');samples.push({round:i+1,ready,androidReportedTotalTimeMs:Number(launch.match(/TotalTime:\s*(\d+)/)?.[1]||0),marks,runtimeErrors:c.errors});console.log(JSON.stringify({round:i+1,ready,runtimeErrors:c.errors.length}));
 if(!device)device={android:adb('shell','getprop','ro.build.version.release').toString().trim(),model:adb('shell','getprop','ro.product.model').toString().trim()};
 }finally{c.close();}
 fs.writeFileSync(output,JSON.stringify({synthetic:true,build:'debug, isolated offline API fixture',scope:'20 process-cold functional startups; platform launch totals and renderer marks use separate clocks; no release-performance gate or physical pixel timing claim',device,samples},null,2));
}
if(samples.some(x=>x.runtimeErrors.length))process.exitCode=1;
