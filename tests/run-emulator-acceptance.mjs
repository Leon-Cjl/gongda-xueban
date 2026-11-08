// Executes existing isolated scenarios in the emulator's real system WebView.
import fs from 'node:fs';
import {adb,pkg,connect,sleep,screenshot} from './emulator-driver.mjs';
const output=process.argv[2];if(!output)throw Error('Pass an output JSON path');
const scenarios=process.argv.slice(3);if(!scenarios.length)scenarios.push('exams','research','offline','main');
const results={device:{serial:'emulator-5554',android:adb('shell','getprop','ro.build.version.release').toString().trim(),synthetic:true},scenarios:{}};
for(const scenario of scenarios){
 adb('shell','am','start','-S','-n',pkg+'/cn.qlucampus.personal.EmulatorActivity','--es','scenario',scenario,'--ez','acceptance','true');
 await sleep(500);const c=await connect('https://qa.campus.local/');
 try{
  let result;
  for(let i=0;i<650;i++){
   result=await c.evaluate(`document.querySelector('#qa-result')?.textContent||null`);
   if(result)break;await sleep(250);
  }
  results.scenarios[scenario]=result?JSON.parse(result):{ok:false,error:'scenario timed out'};
  const actualScenario=await c.evaluate("new URL(location.href).searchParams.get('case')");
  if(actualScenario!==scenario){results.scenarios[scenario].ok=false;results.scenarios[scenario].error='Wrong fixture: '+actualScenario;}
  results.scenarios[scenario].runtimeErrors=c.errors;
  console.log(JSON.stringify({scenario,ok:results.scenarios[scenario].ok,checks:results.scenarios[scenario].checks?.length,error:results.scenarios[scenario].error,runtimeErrors:c.errors.length}));
 }finally{c.close();}
 fs.writeFileSync(output,JSON.stringify(results,null,2));
}
adb('shell','am','start','-S','-n',pkg+'/cn.qlucampus.personal.EmulatorActivity','--es','page','exams');
await sleep(1000);const c=await connect('https://qa.campus.local/');
try{
 let demoReady=false;
 for(let i=0;i<100;i++){
  demoReady=await c.evaluate(`!!window.CampusRuntimeReady&&!!document.querySelector('.nav [data-page="exams"]')`);
  if(demoReady)break;
  await sleep(100);
 }
 if(!demoReady)throw Error('Exam demo navigation did not become ready');
 await c.evaluate(`window.__examData=[{kch:'DEMO1',kcmc:'材料科学基础',ksmc:'期末考试',kssj:'2099-12-01(09:00-11:00)',cdmc:'模拟教学楼 201'},{kch:'DEMO2',kcmc:'大学物理',ksmc:'补考',kssj:''}];document.querySelector('.nav [data-page="exams"]').click();true`);
 await sleep(800);screenshot(output.replace(/\.json$/,'')+'.png');
}finally{c.close();}
if(!Object.values(results.scenarios).every(r=>r.ok&&r.runtimeErrors.length===0))process.exitCode=1;
