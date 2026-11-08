// Real system WebView + native emulator input; all data stays in the isolated QA activity.
import fs from 'node:fs';
import {adb,pkg,connect,sleep,screenshot,point} from './emulator-driver.mjs';
const output=process.argv[2];if(!output)throw Error('Pass an output JSON path');
const checks=[],check=(name,ok,details)=>{checks.push({name,ok:!!ok,...(details?{details}:{})});};
adb('shell','am','start','-W','-S','-n',pkg+'/cn.qlucampus.personal.EmulatorActivity');
const c=await connect('https://qa.campus.local/');
const evaluate=c.evaluate;
const media=value=>c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value}]});
const open=async()=>{await evaluate(`document.querySelector('[data-action="settings"]').click();true`);await sleep(160);};
const option=async(name,value)=>{await evaluate(`document.querySelector('#settingsForm input[name="${name}"][value="${value}"]').click();true`);await sleep(70);};
try{
 await evaluate('localStorage.clear();true');await c.send('Page.reload');await sleep(150);
 for(let i=0;i<70;i++){if(await evaluate('!!window.CampusRuntimeReady&&!!window.__qaPreviewReady'))break;await sleep(100);}
 await open();
 for(const motion of ['auto','off'])for(const system of ['no-preference','reduce']){
  await media(system);await option('motion',motion);
  const v=await evaluate(`(()=>{const p=document.createElement('div');p.className='first-show';document.body.append(p);const a=getComputedStyle(p),b=getComputedStyle(document.querySelector('#dialog'),'::backdrop');const r={card:a.animationName,backdrop:b.animationName};p.remove();return r})()`);
  const disabled=motion==='off'||system==='reduce';
  check(`motion ${motion}/${system}: card and backdrop follow preference`,disabled?v.card==='none'&&v.backdrop==='none':v.card==='rise'&&v.backdrop==='fade-in',v);
 }
 await option('motion','auto');await media('reduce');
 const layout=await evaluate(`(()=>{const d=document.querySelector('#dialog'),s=d.querySelector('.sheet-body')||d,b=d.querySelector('.sheet-close');s.scrollTop=450;const r=b.getBoundingClientRect(),h=d.getBoundingClientRect();return {hasBody:s!==d,scroll:s.scrollTop,outerScroll:d.scrollTop,closeVisible:r.top>=h.top&&r.bottom<=h.bottom,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
 check('settings has an independent scroll area',layout.hasBody&&layout.scroll>100,layout);
 check('close control stays visible after scrolling',layout.closeVisible,layout);
 check('settings does not scroll its outer frame or overflow horizontally',layout.outerScroll===0&&!layout.overflow,layout);
 screenshot(output.replace(/\.json$/,'')+'-scrolled.png');
 for(const [width,height] of [[360,480],[960,640]]){
  await c.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await sleep(70);
  const v=await evaluate(`(()=>{const d=document.querySelector('#dialog'),b=d.querySelector('.sheet-close'),r=d.getBoundingClientRect(),q=b.getBoundingClientRect();return {open:d.open,width:innerWidth,height:innerHeight,dialogWidth:r.width,top:r.top,bottom:r.bottom,closeTop:q.top,closeBottom:q.bottom,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
  check(`settings remains usable at ${width}x${height}`,v.open&&v.dialogWidth>0&&v.bottom>v.top&&v.top>=0&&v.bottom<=v.height+1&&v.closeTop>=v.top&&v.closeBottom<=v.bottom&&!v.overflow,v);
 }
 await c.send('Emulation.clearDeviceMetricsOverride');await sleep(100);
 if(layout.hasBody){
  const p=await point(c,'#dialog .sheet-body');adb('shell','input','swipe',String(p.x),String(p.y),String(p.x),String(p.y+160),'350');await sleep(180);
  const v=await evaluate(`(()=>{const d=document.querySelector('#dialog');return {open:d.open,scroll:d.querySelector('.sheet-body').scrollTop,dragging:d.classList.contains('dragging')}})()`);
  check('native content swipe scrolls without dismissing the sheet',v.open&&v.scroll>0&&v.scroll<layout.scroll&&!v.dragging,v);
  await evaluate(`document.querySelector('#dialog .sheet-body').scrollTop=420;document.querySelector('#settingsForm input[name="motion"][value="auto"]').focus();true`);
  const before=await evaluate(`document.querySelector('#dialog .sheet-body').scrollTop`);
  await evaluate(`window.Campus.receive({event:'resume'});true`);await sleep(200);
  const preserved=await evaluate(`(()=>{const d=document.querySelector('#dialog');return {scroll:d.querySelector('.sheet-body').scrollTop,focused:document.activeElement?.name==='motion'&&document.activeElement?.value==='auto'}})()`);
  check('foreground settings refresh preserves scroll and keyboard focus',Math.abs(preserved.scroll-before)<3&&preserved.focused,preserved);
  const p2=await point(c,'#dialog .sheet-handle'),geometry=await evaluate(`({height:document.querySelector('#dialog').getBoundingClientRect().height,density:devicePixelRatio,viewport:innerHeight})`);const distance=Math.round(Math.max(900,geometry.height*geometry.density*.5));adb('shell','input','swipe',String(p2.x),String(p2.y),String(p2.x),String(p2.y+distance),'240');
  let dismissed=false;for(let i=0;i<15;i++){dismissed=await evaluate(`!document.querySelector('#dialog').open`);if(dismissed)break;await sleep(100);}
  check('native header drag can close a scrolled settings sheet',dismissed,{...geometry,distance});
  await open();
  check('reopening settings starts its content at the top',await evaluate(`document.querySelector('#dialog .sheet-body').scrollTop===0`));
 }
 await media('no-preference');await option('motion','auto');
 await evaluate(`document.querySelector('#dialog .sheet-close').click();true`);await sleep(20);await open();await sleep(450);
 check('old exit completion cannot close a reopened settings sheet',await evaluate(`document.querySelector('#dialog').open&&document.querySelector('#dialog').dataset.kind==='settings'`));
 await evaluate(`document.querySelector('#dialog .sheet-close').click();true`);await media('reduce');await sleep(60);
 check('switching to reduced motion settles an in-progress close immediately',await evaluate(`!document.querySelector('#dialog').open`));
 if(await evaluate(`document.querySelector('#dialog').open`)){await sleep(450);await evaluate(`document.querySelector('#dialog .sheet-close')?.click();true`);await sleep(50);}
 await open();await media('no-preference');await option('motion','auto');
 await evaluate(`(()=>{const p=document.createElement('div');p.id='qa-motion-probe';document.body.append(p);window.__qaMotion=p.animate([{opacity:0},{opacity:1}],{duration:10000});return true})()`);
 await option('motion','off');
 check('application reduced motion settles an already running Web Animation',await evaluate(`window.__qaMotion.playState==='finished'||window.__qaMotion.playState==='idle'`));
 await evaluate(`document.querySelector('#qa-motion-probe').remove();true`);
 await option('theme','dark');
 check('settings header uses the same surface as its dark sheet',await evaluate(`(()=>{const h=document.querySelector('#dialog .sheet-header');return !!h&&getComputedStyle(h).backgroundColor===getComputedStyle(document.querySelector('#dialog')).backgroundColor})()`));
 screenshot(output.replace(/\.json$/,'')+'-dark.png');
 await option('theme','system');await evaluate(`document.querySelector('#dialog .sheet-close').click();true`);await sleep(80);
 await evaluate(`window.__examData=[{kch:'UI1',kcmc:'界面合成考试',ksmc:'期末考试',kssj:'2099-12-01(09:00-11:00)',cdmc:'模拟考场'}];document.querySelector('.nav [data-page="exams"]').click();true`);await sleep(150);
 await evaluate(`document.querySelector('[data-action="loadExams"]')?.click();true`);
 let examReady=false;for(let i=0;i<80;i++){if(await evaluate(`!!document.querySelector('[data-exam]')`)){examReady=true;break;}await sleep(100);}
 if(!examReady)throw Error('Synthetic exam row did not load');
 await evaluate(`document.querySelector('[data-exam]').click();true`);await sleep(100);
 check('ordinary exam detail keeps the existing sheet layout',await evaluate(`(()=>{const d=document.querySelector('#dialog');return d.open&&d.dataset.kind!=='settings'&&!d.querySelector('.sheet-header')&&!d.querySelector('.sheet-body')})()`));
 check('no JavaScript exceptions during the UI flow',c.errors.length===0,c.errors);
}catch(error){check('runner completed',false,String(error.stack||error));}
finally{
 try{await c.send('Emulation.setEmulatedMedia',{features:[]});await evaluate(`document.querySelector('#qa-motion-probe')?.remove();document.querySelector('#dialog .sheet-close')?.click();true`);}catch{}
 const result={device:'emulator-5554',synthetic:true,ok:checks.every(x=>x.ok),checks,runtimeErrors:c.errors};fs.writeFileSync(output,JSON.stringify(result,null,2));c.close();
 console.log(JSON.stringify({ok:result.ok,checks:checks.length,failed:checks.filter(x=>!x.ok)}));if(!result.ok)process.exitCode=1;
}
