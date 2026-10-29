// 真机动效巡检（不随安装包分发）：每个交互用 adb 真点，页面里逐帧记录 掉帧 / 页面跳动 / 滑块越界 / 脚本报错。
// 用法：装 build-naiwa.ps1 打的调试包并打开，adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>，再 node tests/device-motion-inspect.mjs
// 只做只读操作（不点预约），改过的设置（签到提醒、主题）结束时恢复
import {execFileSync} from 'child_process';
const ADB = 'C:/Users/cui/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const list = await (await fetch('http://localhost:9333/json')).json();
const ws = new WebSocket(list.find(p => p.url.startsWith('https://campus.local')).webSocketDebuggerUrl);
let id = 0; const wait = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } };
await new Promise(r => ws.onopen = r);
const ev = expr => new Promise(r => { const i = ++id; wait.set(i, d => r(d.result?.result?.value ?? d.result?.exceptionDetails?.exception?.description)); ws.send(JSON.stringify({id: i, method: 'Runtime.evaluate', params: {expression: expr, awaitPromise: true, returnByValue: true}})); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tap = (x, y) => execFileSync(ADB, ['shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y))]);
const swipe = (x1, y1, x2, y2, ms) => execFileSync(ADB, ['shell', 'input', 'swipe', ...[x1, y1, x2, y2, ms].map(v => String(Math.round(v)))]);
// css px -> device px (WebView 从 y=137 开始，dpr 3.5)
const dev = async sel => { const r = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:(r.left+r.width/2)*devicePixelRatio,y:(r.top+r.height/2)*devicePixelRatio+(screen.height*devicePixelRatio-innerHeight*devicePixelRatio)}})()`); return r; };
const MON = `(()=>{window.__errs=window.__errs||[];if(!window.__errHook){window.__errHook=1;addEventListener('error',e=>__errs.push(e.message));}
 window.__mon={frames:[],out:[],jump:[],sy0:scrollY};let last=performance.now(),t0=last;const track=window.__track;let y0=track&&document.querySelector(track)?.getBoundingClientRect().top;
 const f=now=>{const m=__mon;m.frames.push(now-last);last=now;
  for(const g of document.querySelectorAll('.slide-ghost,.nav-pill')){const r=g.getBoundingClientRect(),p=g.parentElement.getBoundingClientRect();if(r.width&&(r.left<p.left-1||r.right>p.right+1||r.top<p.top-1||r.bottom>p.bottom+1))m.out.push(g.className+' '+Math.round(r.left-p.left)+'..'+Math.round(r.right-p.right)+' / '+Math.round(r.top-p.top)+'..'+Math.round(r.bottom-p.bottom));}
  if(track){const e=document.querySelector(track);if(e){const y=e.getBoundingClientRect().top;if(y0!=null&&Math.abs(y-y0)>40)m.jump.push(Math.round(y0)+'->'+Math.round(y));y0=y;}}
  if(now-t0<1200)requestAnimationFrame(f)};requestAnimationFrame(f);return 1})()`;
const report = async name => { await sleep(1300); const r = await ev(`(()=>{const m=__mon,fr=m.frames.slice(2);return {long:fr.filter(x=>x>25).map(Math.round),out:[...new Set(m.out)].slice(0,4),jump:[...new Set(m.jump)].slice(0,4),scroll:Math.round(scrollY-m.sy0),errs:__errs.splice(0)}})()`); const bad = r.long.length || r.out.length || r.jump.length || r.errs.length; console.log((bad ? '✗ ' : '✓ ') + name.padEnd(28), JSON.stringify(r)); };
async function step(name, track, act) { await ev(`window.__track=${JSON.stringify(track)}`); await ev(MON); await act(); await report(name); }
const go = p => ev(`(async()=>{document.querySelector('#dialog').open&&document.querySelector('#dialog [data-action=closeDialog]')?.click();document.querySelector('.nav [data-page=${p}]').click();await new Promise(f=>setTimeout(f,700));scrollTo(0,0);return 1})()`);

// 1 底栏：每两页之间切一次
await go('library');
for (const [a, b] of [['library', 'rooms'], ['rooms', 'me'], ['me', 'pass'], ['pass', 'library'], ['library', 'me'], ['me', 'library']]) {
 await go(a); const p = await dev(`.nav [data-page=${b}]`); await step(`底栏 ${a}→${b}`, '.nav', () => tap(p.x, p.y));
}
// 2 底栏拖动
await go('library'); { const a = await dev('.nav [data-page=library]'), b = await dev('.nav [data-page=me]'); await step('底栏拖动 图书馆→我的', '.nav', () => swipe(a.x, a.y, b.x, b.y, 700)); }
// 3 空教室筛选标签（先滚到中间再点，查整页跳动）
await go('rooms');
let chips; for (let k = 0; k < 15 && !(chips?.length > 2); k++) { await sleep(300); chips = await ev(`[...document.querySelectorAll('#roomResults .room-filter .chip')].map((c,i)=>i)`); }
if (chips?.length > 2) for (const i of [2, 0, 1]) { await ev(`document.querySelector('#roomResults').scrollIntoView({block:'start'});scrollBy(0,-60)`); await sleep(300); const p = await dev(`#roomResults .room-filter .chip:nth-child(${i + 1})`); await step(`空教室标签 #${i}`, '#roomResults .list-head', () => tap(p.x, p.y)); }
// 3b 图书馆（只读：切日期、进区域、选座再取消、返回；不点预约）
await go('library'); await sleep(1200);
if (await ev(`!!document.querySelector('#content [data-day]')`)) {
 const day0 = await ev(`document.querySelector('#content [data-day].on')?.dataset.day`);
 for (const k of [1, 0]) { const p = await dev(`#content [data-day]:nth-child(${k + 1})`); await step(`日期标签 #${k}`, '#content [data-day]', () => tap(p.x, p.y)); await sleep(1500); }
 const area = await dev('#content .area-row:not(.full)');
 if (area) { await step('进区域', '.nav', () => tap(area.x, area.y)); await sleep(1800);
  for (const n of [1, 2]) { const p = await dev(`.seat:not([disabled]):not(.sel)`); if (p) await step(`选座 ${n}`, '.seat-card .seat-head', () => tap(p.x, p.y)); }
  for (const n of [1, 2]) { const p = await dev(`.sel-chip`); if (p) await step(`取消选座 ${n}`, '.seat-card .seat-head', () => tap(p.x, p.y)); }
  const b = await dev('[data-action=backToAreas]'); if (b) await step('返回区域列表', '.nav', () => tap(b.x, b.y)); await sleep(800); }
 console.log('  图书馆日期恢复为', day0, '当前', await ev(`document.querySelector('#content [data-day].on')?.dataset.day`));
}
// 4 我的页：签到提醒（滚到中间）—— 结束时恢复原值
await go('me');
const lead0 = await ev(`[...document.querySelectorAll('#remindForm input')].find(i=>i.checked)?.value`);
for (const v of ['0', '15', '30']) { await ev(`document.querySelector('#remindForm').scrollIntoView({block:'center'})`); await sleep(300); const p = await dev(`#remindForm input[value="${v}"] + span`); await step(`签到提醒 →${v}`, '#remindForm .seg', () => tap(p.x, p.y)); }
// 5 设置弹窗：打开、主题分段（结束恢复）、下拉关闭
await go('me');
{ const p = await dev('[data-action=settings]'); await step('打开设置弹窗', '.nav', () => tap(p.x, p.y)); }
const theme0 = await ev(`[...document.querySelectorAll('#dialog input[name=theme]')].find(i=>i.checked)?.value`);
for (const v of ['dark', 'light', theme0]) { const p = await dev(`#dialog input[name=theme][value="${v}"] + span`); await step(`主题分段 →${v}`, '#dialog .seg', () => tap(p.x, p.y)); }
{ const p = await dev('#dialog .sheet-close'); await step('点×关闭弹窗', '.nav', () => tap(p.x, p.y)); await sleep(300); await ev(`document.querySelector('#dialog').open`).then(o => console.log('  关闭后弹窗 open =', o)); }
{ const p = await dev('[data-action=settings]'); tap(p.x, p.y); await sleep(700); }
{ const p = await dev('#dialog .sheet-handle'); await step('下拉关闭弹窗', '.nav', () => swipe(p.x, p.y + 30, p.x, p.y + 1300, 220)); }
console.log('设置还原：主题', theme0, '签到提醒', lead0, '| 现在：', await ev(`JSON.stringify({open:document.querySelector('#dialog').open})`));
ws.close(); process.exit(0);
