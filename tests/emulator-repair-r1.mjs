// R1 integration on the emulator's system WebView. Synthetic QA activity only.
import fs from 'node:fs';
import path from 'node:path';
import {adb,pkg,connect,sleep,point,screenshot} from './emulator-driver.mjs';
const output=process.argv[2];if(!output)throw Error('Pass an output JSON path');
adb('shell','am','start','-S','-n',pkg+'/cn.qlucampus.personal.EmulatorActivity');
const c=await connect('https://qa.campus.local/'),checks=[];
const check=(ok,name,details)=>{checks.push({ok:!!ok,name,details});if(!ok)throw Error(name);};
const wait=async expression=>{for(let i=0;i<160;i++){if(await c.evaluate(expression))return;await sleep(100);}throw Error('Timed out: '+expression);};
const click=selector=>c.evaluate(`document.querySelector(${JSON.stringify(selector)}).click();true`);
const capture=name=>screenshot(path.join(path.dirname(output),'r1-'+name+'.png'));
try{
 // Reset before the synthetic bridge reads state; an old document can save
 // once more between an in-page clear and reload.
 await c.send('Page.enable');
 const reset=await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.clear();sessionStorage.clear();'});
 await c.send('Page.reload');await sleep(150);
 await wait(`!!window.CampusRuntimeReady&&!!window.__qaPreviewReady&&!!document.querySelector('[data-area="12"]')&&document.querySelector('#progress').hidden`);
 await c.send('Page.removeScriptToEvaluateOnNewDocument',{identifier:reset.identifier});
 await click('[data-area="12"]');await wait('!!document.querySelector("#seatGrid")&&document.querySelector("#progress").hidden');
 await click('[data-toggle="favoriteOnly"]');
 let v=await c.evaluate(`(()=>{const b=document.querySelector('[data-toggle="favoriteOnly"]');return {on:b.classList.contains('on'),aria:b.getAttribute('aria-pressed'),icon:!!b.querySelector('svg'),seats:[...document.querySelectorAll('#seatGrid .seat')].map(x=>x.dataset.seat)}})()`);
 check(v.on&&v.aria==='true'&&v.icon&&JSON.stringify(v.seats)==='["204"]','A01: free favourites, colour, icon and accessible state agree',v);
 await click('[data-toggle="freeOnly"]');
 v=await c.evaluate(`({seats:[...document.querySelectorAll('#seatGrid .seat')].map(x=>({id:x.dataset.seat,disabled:x.disabled})),fav:document.querySelector('[data-toggle="favoriteOnly"]').classList.contains('on'),free:document.querySelector('[data-toggle="freeOnly"]').classList.contains('on')})`);
 check(v.fav&&!v.free&&v.seats.length===2&&v.seats.some(x=>x.id==='203'&&x.disabled),'A01/A03: independent switches include the occupied favourite when free-only is off',v);
 await click('[data-toggle="favoriteOnly"]');check(await c.evaluate('document.querySelectorAll("#seatGrid .seat").length===96'),'A01: disabling both filters restores all 96 synthetic seats');capture('filters');
 await c.evaluate(`(()=>{const post=NativeHost.post.bind(NativeHost),receive=Campus.receive,active=new Set();window.__r1Reads=[];window.__r1MaxReads=0;NativeHost.post=text=>{const m=JSON.parse(text);if(m.cmd==='library'&&['areas','seats'].includes(m.data.method)){__r1Reads.push({id:m.id,method:m.data.method,day:m.data.params?.day});active.add(m.id);__r1MaxReads=Math.max(__r1MaxReads,active.size);setTimeout(()=>post(text),180);}else post(text);};Campus.receive=m=>{active.delete(m.id);receive(m);};return true;})()`);
 await c.evaluate(`(()=>{const days=[...document.querySelectorAll('[data-day]')];window.__r1FinalDay=days[1].dataset.day;for(const i of [1,0,1,0,1])document.querySelector('[data-day="'+days[i].dataset.day+'"]').click();return true;})()`);
 check(await c.evaluate(`document.querySelector('[data-day="'+__r1FinalDay+'"]').getAttribute('aria-pressed')==='true'`),'A02: date selection follows the last tap immediately during the pending read');
 await wait('!!document.querySelector("#seatGrid")&&document.querySelector("#progress").hidden');
 v=await c.evaluate(`({max:__r1MaxReads,reads:__r1Reads,last:__r1Reads.at(-1)?.day,day:__r1FinalDay,selected:document.querySelector('[data-day][aria-pressed="true"]').dataset.day,text:document.querySelector('.seat-title p').textContent})`);
 check(v.max===1&&v.last===v.day&&v.selected===v.day&&v.text.includes('明天'),'A02: library reads stay serial and only the latest date result becomes selectable',v);capture('latest-day');
 await click('.nav [data-page="rooms"]');await wait('!!document.querySelector("#roomForm")');
 await c.evaluate('document.querySelector("#roomForm").requestSubmit();true');await wait('!!document.querySelector("#roomResults [data-toggle=roomLong]")&&document.querySelector("#progress").hidden');
 await click('[data-toggle="roomSort"]');await click('[data-toggle="roomLong"]');
 check(await c.evaluate(`['roomSort','roomLong'].every(k=>document.querySelector('[data-toggle="'+k+'"]').getAttribute('aria-pressed')==='true')&&/先按空闲时长.*容量/.test(document.querySelector('#roomResults').textContent)`),'A05: both sorting priorities remain selected and their ordering is explained');
 await click('[data-action="editRoomQuery"]');await wait('!!document.querySelector("#roomForm")');
 await c.evaluate(`(()=>{const e=document.querySelector('#roomForm [name=week]');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 check(await c.evaluate(`!document.querySelector('#roomResults .stale-note')`),'A06: unchanged input and change events keep the existing result valid');
 await c.evaluate(`(()=>{const e=document.querySelector('#roomForm [name=week]');window.__r1Week=e.value;e.value=Number(e.value)+1;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 check(await c.evaluate(`!!document.querySelector('#roomResults .stale-note')`),'A06: an actual query change marks the result as old');
 await c.evaluate(`(()=>{const e=document.querySelector('#roomForm [name=week]');e.value=__r1Week;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 check(await c.evaluate(`!document.querySelector('#roomResults .stale-note')`),'A06: restoring the original query makes its existing result usable again');
 await wait('!!document.querySelector("[data-room-open]")');await click('[data-room-open]');await wait('!!document.querySelector("#dialog .timeline")&&!document.querySelector("#dialog .loader")');
 v=await c.evaluate(`(()=>{const e=document.querySelector('.timeline'),cs=getComputedStyle(e);return {columns:cs.gridTemplateColumns.split(' ').length,gap:cs.gap,overflow:document.documentElement.scrollWidth>innerWidth+1,cells:[...e.children].map(x=>({text:x.textContent.trim(),h:x.getBoundingClientRect().height}))};})()`);
 // Layout coordinates include fractional device-pixel rounding in WebView.
 check(v.columns===6&&v.gap==='8px'&&!v.overflow&&v.cells.length>=11&&v.cells.every(x=>x.h>=31.99),'A09: whole-day periods use six columns, separated cells and no horizontal overflow',v);capture('periods');
 await click('#dialog .sheet-close');await wait('!document.querySelector("#dialog").open');
 await c.evaluate(`window.__r1Before={count:document.querySelectorAll('#roomResults .room-row').length,time:document.querySelector('#roomResults .list-note').textContent};Campus.receive({event:'resourcesReleased'});true`);await sleep(450);
 v=await c.evaluate(`({count:document.querySelectorAll('#roomResults .room-row').length,oldCount:__r1Before.count,stale:!!document.querySelector('#roomResults .stale-note'),details:document.querySelectorAll('#roomResults button[data-room-open]').length,text:document.querySelector('#roomResults').textContent,sorts:['roomSort','roomLong'].map(k=>document.querySelector('[data-toggle="'+k+'"]').getAttribute('aria-pressed'))})`);
 check(v.count===v.oldCount&&v.count>0&&!v.stale&&v.details===0&&v.text.includes('待重连')&&v.sorts.every(x=>x==='true'),'A07: resource release preserves read-only results and filters while blocking unavailable detail reads',v);capture('read-only');
 await click('.nav [data-page="library"]');await sleep(500);
 const start=await point(c,'.nav [data-page="library"]'),end=await point(c,'.nav [data-page="me"]');
 adb('shell','input','touchscreen','motionevent','DOWN',String(start.x),String(start.y));await sleep(550);
 check(await c.evaluate(`document.querySelector('.nav').classList.contains('dragging')`),'A11: a native long press enters direct navigation manipulation');
 adb('shell','input','touchscreen','motionevent','MOVE',String(end.x),String(end.y));await sleep(160);
 v=await c.evaluate(`(()=>{const n=document.querySelector('.nav').getBoundingClientRect(),p=document.querySelector('.nav-pill').getBoundingClientRect();return {left:p.left,right:p.right,navLeft:n.left,navRight:n.right,lens:document.querySelector('.nav button.lens')?.dataset.page};})()`);
 check(v.left>=v.navLeft-1&&v.right<=v.navRight+1&&v.lens==='me','A11: the grown capsule stays inside the transformed bar at the far endpoint',v);
 adb('shell','input','touchscreen','motionevent','UP',String(end.x),String(end.y));await sleep(550);
 check(await c.evaluate(`document.querySelector('.nav [aria-current=page]').dataset.page==='me'&&!document.querySelector('.nav').classList.contains('dragging')&&!document.querySelector('.nav .lens')`),'A10/A11: release commits the final endpoint and removes drag state');capture('nav-release');
 const last=await point(c,'.nav [data-page="me"]'),first=await point(c,'.nav [data-page="library"]'),rooms=await point(c,'.nav [data-page="rooms"]');
 adb('shell','input','touchscreen','motionevent','DOWN',String(last.x),String(last.y));await sleep(550);
 adb('shell','input','touchscreen','motionevent','MOVE',String(first.x),String(first.y));await sleep(160);
 v=await c.evaluate(`(()=>{const n=document.querySelector('.nav').getBoundingClientRect(),p=document.querySelector('.nav-pill').getBoundingClientRect();return {left:p.left,right:p.right,navLeft:n.left,navRight:n.right,lens:document.querySelector('.nav button.lens')?.dataset.page};})()`);
 check(v.left>=v.navLeft-1&&v.right<=v.navRight+1&&v.lens==='library','A11: reversing to the left endpoint also keeps the grown capsule contained',v);
 // UP intentionally has a different coordinate from the final MOVE.
 adb('shell','input','touchscreen','motionevent','UP',String(rooms.x),String(rooms.y));await sleep(550);
 check(await c.evaluate(`document.querySelector('.nav [aria-current=page]').dataset.page==='rooms'&&!document.querySelector('.nav').classList.contains('dragging')`),'A11: the native release coordinate overrides the preceding move coordinate');
 adb('shell','input','touchscreen','motionevent','DOWN',String(rooms.x),String(rooms.y));await sleep(550);
 adb('shell','input','touchscreen','motionevent','MOVE',String(last.x),String(last.y));await sleep(120);
 adb('shell','input','touchscreen','motionevent','CANCEL',String(last.x),String(last.y));await sleep(450);
 check(await c.evaluate(`document.querySelector('.nav [aria-current=page]').dataset.page==='rooms'&&!document.querySelector('.nav').classList.contains('dragging')&&!document.querySelector('.nav .lens')`),'A11: a native cancellation clears manipulation without committing the hovered tab');capture('nav-cancel');
 await click('[data-action="settings"]');await wait('!!document.querySelector("#settingsForm")');
 check(await c.evaluate(`document.querySelector('#dialog').open&&getComputedStyle(document.documentElement).backgroundColor===getComputedStyle(document.body).backgroundColor`),'A15 partial: HTML canvas and body share the theme background under an open sheet');capture('settings');
 check(c.errors.length===0,'R1 integration has no JavaScript exceptions',c.errors);
}catch(error){checks.push({ok:false,name:'runner',details:String(error.stack||error)});process.exitCode=1;}
finally{try{adb('shell','input','touchscreen','motionevent','CANCEL','0','0');}catch{}const result={synthetic:true,device:'emulator-5554',version:'test',checks,runtimeErrors:c.errors,physicalDevice:false};fs.writeFileSync(output,JSON.stringify(result,null,2));c.close();console.log(JSON.stringify({checks:checks.length,failed:checks.filter(x=>!x.ok)}));}
