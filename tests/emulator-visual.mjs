import fs from 'node:fs';import path from 'node:path';
import {adb,pkg,connect,sleep,screenshot} from './emulator-driver.mjs';
const directory=process.argv[2];if(!directory)throw Error('Pass output directory');fs.mkdirSync(directory,{recursive:true});
adb('shell','am','start','-S','-n',pkg+'/cn.qlucampus.personal.EmulatorActivity');const c=await connect('https://qa.campus.local/'),checks=[],shots=[];
const check=(ok,name,details)=>{checks.push({ok:!!ok,name,details});if(!ok)throw Error(name);};
const wait=async expression=>{for(let i=0;i<150;i++){if(await c.evaluate(expression))return;await sleep(100);}throw Error('Timed out '+expression);};
const click=selector=>c.evaluate(`document.querySelector(${JSON.stringify(selector)}).click();true`);
async function capture(name){await sleep(160);screenshot(path.join(directory,name+'.png'));shots.push(name+'.png');}
try{
 await c.evaluate('localStorage.clear();true');await c.send('Page.reload');await sleep(150);
 await wait('!!window.CampusRuntimeReady&&document.querySelector("[data-area]")&&document.querySelector("#progress").hidden');
 await c.evaluate(`window.__examData=[{kch:'QA1',kcmc:'材料科学基础',ksmc:'期末考试',kssj:'2099-12-01(09:00-11:00)',cdmc:'合成考场 201'},{kch:'QA2',kcmc:'大学物理',ksmc:'补考',kssj:''}];true`);
 for(const mode of ['light','dark','large','largest']){
  await click('[data-action="settings"]');await wait('!!document.querySelector("#settingsForm")');
  await click(`#settingsForm input[name="theme"][value="${mode==='dark'?'dark':'light'}"]`);
  await c.evaluate(`QaView.textZoom(${mode==='largest'?200:mode==='large'?130:100});true`);await sleep(120);await click('#dialog .sheet-close');await wait('!document.querySelector("#dialog").open');
  for(const page of ['library','rooms','pass','exams','me']){
   await click(`.nav [data-page="${page}"]`);await wait(`document.querySelector('.nav [aria-current="page"]').dataset.page==='${page}'`);await sleep(300);
   const layout=await c.evaluate(`(()=>{const nav=document.querySelector('.nav'),r=nav.getBoundingClientRect(),buttons=[...nav.querySelectorAll('button:not([hidden])')];return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,navVisible:r.top>=0&&r.bottom<=innerHeight+1,labels:buttons.map(b=>({text:b.textContent.trim(),width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})),title:document.querySelector('#content h1')?.textContent}})()`);
   check(!layout.overflow&&layout.navVisible&&layout.labels.length===5,`${mode}/${page}: viewport and five labelled navigation targets remain usable`,layout);await capture(mode+'-'+page);
  }
  await click('.nav [data-page="library"]');await wait(`!!document.querySelector('[data-area="12"]')`);await click('[data-area="12"]');await wait('!!document.querySelector("#seatGrid")&&document.querySelector("#progress").hidden');
  await click('#seatGrid .seat:not(:disabled)');await capture(mode+'-seats');await click('[data-action="book"]');await wait('!!document.querySelector("[data-action=confirmBook]")');
  check(await c.evaluate(`document.querySelector('#dialog').hasAttribute('aria-labelledby')&&document.querySelector('#dialog').textContent.includes('确认')`),`${mode}: reservation confirmation has a labelled modal`);await capture(mode+'-confirmation');await click('#dialog .sheet-close');await wait('!document.querySelector("#dialog").open');
  await click('[data-action="settings"]');await wait('!!document.querySelector("#settingsForm")');await capture(mode+'-settings');await click('#dialog .sheet-close');await wait('!document.querySelector("#dialog").open');
  await click('[data-action="backToAreas"]');
 }
 await c.evaluate('QaView.textZoom(100);true');check(c.errors.length===0,'visual matrix has no JavaScript exceptions',c.errors);
}catch(error){checks.push({ok:false,name:error.stack||error.message});process.exitCode=1;}
finally{fs.writeFileSync(path.join(directory,'matrix.json'),JSON.stringify({synthetic:true,textScale:'Android WebSettings.textZoom 100/130/200; no system settings changed',checks,shots,runtimeErrors:c.errors},null,2));console.log(JSON.stringify({checks:checks.length,shots:shots.length,failed:checks.filter(x=>!x.ok)}));c.close();}
