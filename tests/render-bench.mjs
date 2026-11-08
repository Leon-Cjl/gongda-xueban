// Synthetic data only; outputs aggregate timings, never account/session contents.
import fs from 'node:fs';
const [port, url, output] = process.argv.slice(2);
const onDevice = url.startsWith('https://qa.campus.local/');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let tabs;
for (let i = 0; i < 60; i++) {
 try { tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (tabs.length) break; } catch {}
 await sleep(100);
}
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let seq = 0; const waiting = new Map();
ws.onmessage = event => { const r = JSON.parse(event.data), p = waiting.get(r.id); if (p) { waiting.delete(r.id); clearTimeout(p.timer); r.error ? p.reject(Error(JSON.stringify(r.error))) : p.resolve(r.result); } };
const send = (method, params = {}) => new Promise((resolve, reject) => {
 const id = ++seq, timer = setTimeout(() => { waiting.delete(id); reject(Error(method + ' timed out')); }, 30000);
 waiting.set(id, {resolve, reject, timer}); ws.send(JSON.stringify({id, method, params}));
});
const evaluate = async expression => { const r = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}); if (r.exceptionDetails) throw Error(r.exceptionDetails.text + ': ' + r.exceptionDetails.exception?.description); return r.result?.value; };
try {
 if (!onDevice) {
  await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  await send('Emulation.setCPUThrottlingRate', {rate: 4});
 }
 await send('Page.navigate', {url});
 for (let i = 0; i < 100; i++) { if (await evaluate('!!window.CampusRuntimeReady && !!document.querySelector("[data-area]")')) break; await sleep(100); }
 const report = await evaluate(`(async () => {
  const q = s => document.querySelector(s), wait = async f => { for (let i=0;i<400;i++) { if (f()) return; await new Promise(r=>setTimeout(r,10)); } throw Error('UI did not settle'); };
  if (!window.NativeHost || !window.CampusRuntimeReady) throw Error('Synthetic host not ready');
  window.__examData = Array.from({length:30},(_,i)=>({kch:'QA'+i,kcmc:'合成测试科目 '+i,ksmc:'期末',kssj:'2099-12-01(09:00-11:00)',cdmc:'测试楼 '+(i+101)}));
  q('.nav [data-page="exams"]').click();
  await wait(()=>qAll('.exam-row').length===30 && !q('[data-action="loadExams"]').disabled);
  function qAll(s){return [...document.querySelectorAll(s)];}
  await new Promise(r=>setTimeout(r,400));
  const durations=[], kept=[], frames=[];let last=performance.now(), recording=true, replacements=0;
  const frame=t=>{if(recording){frames.push(t-last);last=t;requestAnimationFrame(frame);}};requestAnimationFrame(frame);
  const observer=new MutationObserver(records=>{for(const r of records)if(r.target===q('#content')&&r.removedNodes.length)replacements++;});observer.observe(q('#content'),{childList:true});
  for(let i=0;i<20;i++){
   const row=q('.exam-row'), calls=window.__examCalls||0,t=performance.now();q('[data-action="loadExams"]').click();durations.push(performance.now()-t);
   await wait(()=>window.__examCalls>calls&&!q('[data-action="loadExams"]').disabled);
   kept.push(row===q('.exam-row'));await new Promise(r=>setTimeout(r,20));
  }
  recording=false;observer.disconnect();
  const percentile=(a,p)=>a.slice().sort((a,b)=>a-b)[Math.min(a.length-1,Math.ceil(a.length*p)-1)];
  return {rounds:20,rows:30,cpuSlowdown:${onDevice ? 1 : 4},medianClickMs:percentile(durations,.5),p95ClickMs:percentile(durations,.95),contentReplacements:replacements,preservedFirstRow:kept.filter(Boolean).length,rafP95Ms:percentile(frames,.95),rafOver33Ms:frames.filter(x=>x>33.4).length,rafSamples:frames.length};
 })()`);
 fs.writeFileSync(output, JSON.stringify(report, null, 2));
 if (!onDevice) { const shot = await send('Page.captureScreenshot', {format: 'png'}); fs.writeFileSync(output.replace(/\.json$/, '') + '.png', Buffer.from(shot.data, 'base64')); }
 console.log(JSON.stringify(report));
} finally { ws.close(); setTimeout(() => process.exit(0), 30); }
