import fs from 'node:fs';import path from 'node:path';
import {adb,pkg,connect,sleep} from './emulator-driver.mjs';
const output=process.argv[2];if(!output)throw Error('Pass output directory');fs.mkdirSync(output,{recursive:true});
adb('shell','am','start','-S','-n',pkg+'/cn.qlucampus.personal.EmulatorActivity');const c=await connect('https://qa.campus.local/');
try{
 await c.evaluate('localStorage.clear();true');await c.send('Page.reload');await sleep(150);
 for(let i=0;i<120;i++){if(await c.evaluate('!!window.CampusRuntimeReady&&!!document.querySelector("[data-area]")&&document.querySelector("#progress").hidden'))break;await sleep(100);}
 await c.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing',transferMode:'ReturnAsStream'});
 const report=await c.evaluate(`(async()=>{const pause=t=>new Promise(r=>setTimeout(r,t)),d=CampusDiagnostics.create(),supported=!!d.summary().longTasks;d.start();await pause(100);performance.mark('qa_controlled_block_start');const until=performance.now()+120;while(performance.now()<until){}performance.mark('qa_controlled_block_end');await pause(300);const calibration=d.summary();d.stop();
 const q=s=>document.querySelector(s);q('[data-area="12"]').click();for(let i=0;i<120&&(!q('#seatGrid')||!q('#progress').hidden);i++)await pause(30);const grid=q('#seatGrid');if(!grid)throw Error('No synthetic grid');const seat=grid.querySelector('.seat:not(:disabled)'),durations=[],originalNodes=[...grid.children];let replaced=0,verifiedToggles=0;const observer=new MutationObserver(records=>{for(const record of records)replaced+=record.removedNodes.length;});observer.observe(grid,{childList:true});
 for(let i=0;i<30;i++){const start=performance.now();if(!seat.isConnected)throw Error('Seat detached during timed interaction');seat.click();durations.push(performance.now()-start);if(seat.getAttribute('aria-pressed')===String(i%2===0))verifiedToggles++;await pause(100);}observer.disconnect();const retainedBeforeNavigation=originalNodes.every((node,i)=>q('#seatGrid')?.children[i]===node);
 for(let i=0;i<10;i++){q('.nav [data-page="me"]').click();await pause(150);q('.nav [data-page="library"]').click();await pause(150);}return{synthetic:true,build:'debug emulator; diagnostic only',calibration:{supported,summary:calibration},seatToggles:30,verifiedToggles,gridRemovedNodes:replaced,originalSeatRetained:retainedBeforeNavigation,handlerTimesMs:durations,marks:performance.getEntriesByType('mark').map(x=>({name:x.name,startTime:x.startTime})),physicalPresentation:'not observed',fps:'not measured'};})()`);
 // CDP returns the completed stream in an event; retain that event without collecting arbitrary runtime data.
 // Wait for tracing completion on this session via a dedicated driver listener.
 const complete=c.event('Tracing.tracingComplete');await c.send('Tracing.end');const {stream}=await complete;
 let trace='';while(true){const r=await c.send('IO.read',{handle:stream});trace+=r.data||'';if(r.eof)break;}await c.send('IO.close',{handle:stream});fs.writeFileSync(path.join(output,'renderer-trace.json'),trace);
 const data=JSON.parse(trace),counts={};for(const e of data.traceEvents||[])if(['Layout','Paint','UpdateLayoutTree','RunTask'].includes(e.name))counts[e.name]=(counts[e.name]||0)+1;report.traceEventCounts=counts;report.runtimeErrors=c.errors;
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({seatToggles:report.seatToggles,gridRemovedNodes:report.gridRemovedNodes,calibration:report.calibration,traceEventCounts:counts,runtimeErrors:c.errors.length}));
 if(report.gridRemovedNodes||!report.originalSeatRetained||report.verifiedToggles!==30||c.errors.length||report.calibration.supported&&report.calibration.summary.longTasks.count===0)process.exitCode=1;
}finally{c.close();}
