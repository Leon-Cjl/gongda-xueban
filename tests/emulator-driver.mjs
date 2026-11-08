import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
export const serial=globalThis.process?.env?.GONGDA_EMULATOR || 'emulator-5554';
if(!serial.startsWith('emulator-'))throw Error('This runner is restricted to an Android emulator');
export const pkg='cn.qlucampus.gongda.debug';
export const adb=(...args)=>execFileSync('C:/Users/cui/AppData/Local/Android/Sdk/platform-tools/adb.exe',['-s',serial,...args],{timeout:30000});
export const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function connect(prefix='https://campus.local',port=9347){
 let pid;
 for(let i=0;i<40;i++){try{pid=adb('shell','pidof',pkg).toString().trim().split(/\s+/)[0];}catch{}if(pid)break;await sleep(100);}
 if(!pid)throw Error('Debug app is not running');
 adb('forward',`tcp:${port}`,`localabstract:webview_devtools_remote_${pid}`);
 let target;
 for(let i=0;i<40;i++){try{const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();target=tabs.find(t=>t.url.startsWith(prefix));}catch{}if(target)break;await sleep(150);}
 if(!target)throw Error('Target WebView not found: '+prefix);
 const ws=new WebSocket(target.webSocketDebuggerUrl),waiting=new Map(),events=new Map(),errors=[];let seq=0;
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=event=>{const r=JSON.parse(event.data);if(r.id&&waiting.has(r.id)){const p=waiting.get(r.id);waiting.delete(r.id);clearTimeout(p.timer);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}else if(events.has(r.method)){const p=events.get(r.method);events.delete(r.method);clearTimeout(p.timer);p.resolve(r.params);}else if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails.exception?.description||r.params.exceptionDetails.text);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{waiting.delete(id);reject(Error(method+' timed out'));},20000);waiting.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};
 await send('Runtime.enable');
 const event=name=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{events.delete(name);reject(Error(name+' timed out'));},20000);events.set(name,{resolve,reject,timer});});
 return {send,evaluate,event,errors,target,close:()=>ws.close()};
}
export function screenshot(path){fs.writeFileSync(path,adb('exec-out','screencap','-p'));}
export async function point(cdp,selector){
 const p=await cdp.evaluate(`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing element');e.scrollIntoView({block:'nearest',behavior:'instant'});let previous=null;for(let i=0;i<30;i++){await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect();if(previous&&Math.abs(r.top-previous.top)<.2&&Math.abs(r.left-previous.left)<.2)return{x:(r.left+r.width/2)*devicePixelRatio,y:(r.top+r.height/2)*devicePixelRatio};previous={top:r.top,left:r.left};}throw Error('Native target geometry did not settle');})()`);
 // DevTools reports the actual native WebView bounds, including the status-bar offset.
 const tabs=await(await fetch('http://127.0.0.1:9347/json/list')).json();
 const rect=JSON.parse(tabs.find(t=>t.id===cdp.target.id).description);
 return {x:Math.round(p.x+rect.screenX),y:Math.round(p.y+rect.screenY)};
}
export async function tap(cdp,selector){const p=await point(cdp,selector);adb('shell','input','swipe',String(p.x),String(p.y),String(p.x),String(p.y),'60');await sleep(250);}
