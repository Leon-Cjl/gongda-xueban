// Naiwa-specific smoke checks, restricted to the synthetic emulator activity.
import fs from 'node:fs';
import {adb,pkg,connect,sleep,screenshot} from './emulator-driver.mjs';
const output=process.argv[2];if(!output)throw Error('Pass an output JSON path');
const expectedVersion=JSON.parse(fs.readFileSync(new URL('../variants/naiwa/version.json',import.meta.url),'utf8')).versionName;
adb('shell','am','start','-S','-n',pkg+'/cn.qlucampus.personal.EmulatorActivity');
const c=await connect('https://qa.campus.local/'),checks=[];
const check=(ok,name)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
const wait=async expr=>{for(let i=0;i<100;i++){if(await c.evaluate(expr))return;await sleep(80);}throw Error('Timed out: '+expr);};
try{
 await c.evaluate('localStorage.clear();true');await c.send('Page.reload');
 await wait('!!window.CampusRuntimeReady&&!!window.__qaPreviewReady');
 check(await c.evaluate(`window.CampusEdition==='public'&&window.CampusEditionVersion===${JSON.stringify(expectedVersion)}&&!!window.NaiwaPetUI&&!!window.NaiwaTheme`),'Naiwa modules and the new public-edition version are active');
 await c.evaluate(`document.querySelector('.nav [data-page="me"]').click();true`);await wait(`!!document.querySelector('[data-pet-action="open"]')`);
 check(await c.evaluate(`document.querySelector('.nav [data-page="tasks"]').hidden`),'the public edition keeps timed task navigation hidden');
 await c.evaluate(`document.querySelector('[data-pet-action="open"]').click();true`);await wait(`!!document.querySelector('#petAdoptForm')`);
 check(await c.evaluate(`document.querySelector('#dialog').dataset.kind==='pet'&&!document.querySelector('#dialog .sheet-body')`),'pet adoption retains its existing dialog layout');
 await c.evaluate(`document.querySelector('#petAdoptForm').requestSubmit();true`);await wait(`!document.querySelector('#petAdoptForm')&&!!document.querySelector('[data-pet-action="config"]')`);
 check(true,'synthetic pet adoption saves and opens the room');
 await wait(`[...document.querySelectorAll('#dialog [data-pet-image]')].length>0&&[...document.querySelectorAll('#dialog [data-pet-image]')].every(e=>e.complete&&e.naturalWidth>0&&!e.dataset.petRetried)`);
 check(true,'pet artwork decodes in the system WebView');
 screenshot(output.replace(/\.json$/,'')+'-room.png');
 await c.evaluate(`document.querySelector('[data-pet-action="config"]').click();true`);await wait(`!!document.querySelector('#petConfigForm')`);
 check(await c.evaluate(`document.querySelector('#dialog').dataset.kind==='pet-config'`),'the learning agreement remains editable');
 await c.evaluate(`document.querySelector('#dialog .sheet-close').click();document.querySelector('[data-action="settings"]').click();true`);await wait(`!!document.querySelector('input[name="mascotTheme"]')`);
 await c.evaluate(`document.querySelector('input[name="mascotTheme"][value="classic"]').click();true`);await sleep(80);
 check(await c.evaluate(`document.documentElement.dataset.mascotTheme==='classic'&&!document.querySelector('[data-naiwa-accents]').disabled`),'classic appearance restores the normal accent controls');
 await c.evaluate(`document.querySelector('input[name="mascotTheme"][value="naiwa"]').click();true`);await sleep(80);
 check(await c.evaluate(`document.documentElement.dataset.mascotTheme==='naiwa'&&document.querySelector('[data-naiwa-accents]').disabled`),'Naiwa appearance restores its own palette');
 check(c.errors.length===0,'no JavaScript exceptions in the pet and theme flow');
}catch(error){checks.push({name:'runner completed',ok:false,error:String(error.stack||error)});}
finally{
 const result={synthetic:true,device:'emulator-5554',ok:checks.every(x=>x.ok),checks,runtimeErrors:c.errors};fs.writeFileSync(output,JSON.stringify(result,null,2));c.close();
 console.log(JSON.stringify({ok:result.ok,checks:checks.length,failed:checks.filter(x=>!x.ok)}));if(!result.ok)process.exitCode=1;
}
