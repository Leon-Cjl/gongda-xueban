/* Phone UI acceptance with the synthetic Android host (tests/mock-android.js). Never contacts the school.
   Loaded by tests/serve-mobile.py when the page URL has acceptance=1; the result is written to #qa-result. */
(async()=>{
 const checks=[],q=s=>document.querySelector(s),sleep=t=>new Promise(r=>setTimeout(r,t));
 const wait=async(fn,label)=>{for(let i=0;i<200;i++){try{if(fn())return;}catch(e){}await sleep(50);}const d=document.querySelector('#dialog');throw Error(label+' timed out'+(d?.open?' (dialog '+d.dataset.kind+': '+d.textContent.replace(/\s+/g,' ').slice(0,160)+')':''));};
 const check=(ok,name)=>{if(!ok)throw Error(name);checks.push(name);};
 const click=s=>{const el=q(s);if(!el)throw Error('Missing '+s);el.click();};
 const idle=()=>q('#progress').hidden;
 const touch=(type,y)=>{const t=new Touch({identifier:1,target:q('#content'),clientX:120,clientY:y});return new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[t],changedTouches:[t]});};
 const scenario=new URLSearchParams(location.search).get('case');
 const out=document.createElement('pre');out.id='qa-result';
 try{
  if(/^seats(80|300|1000)$/.test(scenario)){
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area="12"]'),'ready');click('[data-area="12"]');await wait(()=>q('#seatGrid')&&idle(),'seats');click('[data-toggle="freeOnly"]');
   const count=Number(scenario.slice(5)),nodes=[...q('#seatGrid').children];check(nodes.length===count,'the isolated fixture renders '+count+' seat cells');
   const seats=nodes.filter(x=>!x.disabled).slice(0,3);for(let i=0;i<30;i++){seats[i%3].click();}
   check(nodes.every((node,i)=>q('#seatGrid').children[i]===node),'30 rapid seat toggles keep all '+count+' original nodes');
   check(!q('#seatGrid .sel'),'an even number of toggles leaves no stale selected seat');
   for(let i=0;i<30;i++){click('.nav [data-page="me"]');click('.nav [data-page="library"]');}await sleep(120);
   check(document.querySelectorAll('#seatGrid').length===1&&q('#seatGrid').children.length===count,'30 tab round trips retain a single active seat grid');
   check(document.documentElement.scrollWidth<=innerWidth+1,'large seat fixtures do not overflow horizontally');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='inputcontinuity'){
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area="12"]'),'ready');click('[data-area="12"]');await wait(()=>q('#seatGrid')&&idle(),'seats');
   const input=q('#seatSearch');input.focus();input.value='A2';input.setSelectionRange(1,1);input.dispatchEvent(new InputEvent('input',{bubbles:true}));
   check(q('#seatSearch')===input&&document.activeElement===input&&input.selectionStart===1,'searching preserves the original input, caret and focus');
   input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'测'}));Campus.receive({event:'resume'});await sleep(140);
   check(q('#seatSearch')===input&&document.activeElement===input,'an incoming refresh cannot replace an active composition input');
   input.value='A20';input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'测'}));await sleep(120);
   check(q('#seatSearch')===input&&document.activeElement===input,'composition completion keeps the same native input node');
   check([...q('#seatGrid').children].every(x=>x.dataset.seat&&x.textContent.includes('A20')),'composition completion applies only the current search');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='fallbackui'){
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area="12"]'),'ready');click('[data-area="12"]');await wait(()=>q('#seatGrid')&&idle(),'seats');
   check(!!q('#content .lib-side')&&!q('#libraryDock .lib-side'),'shell rollback keeps the stable business controls available');
   check(document.documentElement.dataset.motion==='off','motion rollback disables animation without hiding controls');
   click('#seatGrid .seat:not(:disabled)');check(q('.sel-chip')&&q('#seatGrid .sel'),'rollback preserves selection and candidate behavior');
   check(!document.documentElement.classList.contains('glass-on'),'glass rollback keeps the opaque default');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='calendarpreview'){
   await wait(()=>window.CampusRuntimeReady&&idle(),'ready');window.__examData=[{kch:'QA',kcmc:'合成考试',ksmc:'期末',kssj:'2099-12-01(09:00-11:00)'}];
   click('.nav [data-page="exams"]');await wait(()=>q('[data-exam]')&&idle(),'exams');click('[data-action="calendarExams"]');await wait(()=>q('#dialog').dataset.kind==='calendarPlan','preview');
   check(q('#dialog').textContent.includes('合成日历')&&q('#dialog').textContent.includes('新增'),'preview displays the actual synthetic target and change counts');
   check(!window.__calendarWrites,'preview writes no calendar data');click('#dialog [data-action="closeDialog"]');await wait(()=>!q('#dialog').open,'cancel');
   check(!window.__calendarWrites,'cancelling the preview writes no calendar data');click('[data-action="calendarExams"]');await wait(()=>q('#dialog').open,'second preview');
   const confirm=q('[data-action="confirmCalendar"]');confirm.click();confirm.click();await sleep(160);check(window.__calendarWrites===1,'repeated confirmation commits the preview once');
   window.__examUnknown=true;click('[data-action="loadExams"]');await wait(()=>window.__examCalls>=2&&idle(),'partial exams');await sleep(80);
   click('[data-action="calendarExams"]');await wait(()=>q('#dialog').open,'partial preview');check(window.__calendarPlan.allowRemoval===false&&q('#dialog').textContent.includes('不会删除'),'an incomplete result explicitly disables calendar deletion');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='readingupdates'){
   await wait(()=>window.CampusRuntimeReady&&idle(),'ready');window.__examData=[{kch:'QA',kcmc:'合成考试',ksmc:'期末',kssj:'2099-12-01(09:00-11:00)',cdmc:'原考场'}];click('.nav [data-page="exams"]');await wait(()=>q('[data-exam]')&&!q('[data-action="loadExams"]').disabled,'first exams');
   const old=q('[data-exam]');window.__examData=[{...window.__examData[0],cdmc:'新考场',kssj:'2099-12-02(09:00-11:00)'}];let scrolling=true;
   const pulse=()=>{if(scrolling){window.dispatchEvent(new Event('scroll'));setTimeout(pulse,25);}};pulse();const calls=window.__examCalls;click('[data-action="loadExams"]');await wait(()=>window.__examCalls>calls&&q('.exam-status').textContent.includes('停止滚动'),'pending update');
   check(q('[data-exam]')===old&&old.textContent.includes('原考场'),'new read-only results do not replace the row while the user keeps scrolling');scrolling=false;
   await wait(()=>q('.exam-body').textContent.includes('新考场'),'idle update');check(!old.isConnected,'the current result applies after reading becomes idle');
   check(q('.exam-changes').textContent.includes('原考场')&&q('.exam-changes').textContent.includes('新考场'),'change details expose old and new time and location');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='renderduringtap'){
   await wait(()=>window.CampusRuntimeReady&&idle(),'ready');click('.nav [data-page="me"]');await wait(()=>q('#content [data-action="account"]'),'account entry');
   const button=q('#content [data-action="account"]');button.dispatchEvent(new PointerEvent('pointerdown',{pointerId:31,isPrimary:true,button:0,clientX:100,clientY:400,bubbles:true}));
   Campus.receive({event:'libraryLogin',state:'started'});await sleep(40);check(button.isConnected&&q('#content [data-action="account"]')===button,'a background reply preserves the pressed control through the pointer sequence');
   button.dispatchEvent(new PointerEvent('pointerup',{pointerId:31,isPrimary:true,button:0,clientX:100,clientY:400,bubbles:true}));Campus.receive({event:'libraryLogin',state:'done'});await sleep(40);
   check(button.isConnected,'the control stays attached between pointerup and its compatibility click');button.click();await wait(()=>!!q('#password'),'tap action');check(q('#dialog').open,'the original action opens normally before deferred content refresh');click('#dialog .sheet-close');await wait(()=>!q('#dialog').open,'closed');
   click('[data-action="settings"]');await wait(()=>q('#settingsForm'),'settings');const radio=q('#settingsForm input[name="theme"][value="dark"]');radio.dispatchEvent(new PointerEvent('pointerdown',{pointerId:32,isPrimary:true,button:0,bubbles:true}));Campus.receive({event:'resume'});await sleep(100);
   check(radio.isConnected,'foreground settings refresh cannot detach a pressed form control');radio.dispatchEvent(new PointerEvent('pointerup',{pointerId:32,isPrimary:true,button:0,bubbles:true}));radio.click();await sleep(100);check(document.documentElement.dataset.theme==='dark'&&q('#settingsForm input[name="theme"][value="dark"]').checked,'the pending setting is applied to the original action exactly once');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='seatcontinuity'){
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area="12"]'),'library ready');
   click('[data-area="12"]');await wait(()=>q('#seatGrid')&&idle(),'seats ready');
   const grid=q('#seatGrid'),content=q('#content'),search=q('#seatSearch');
   const seats=[...grid.querySelectorAll('.seat:not(:disabled)')].slice(0,3),refs=seats.map(x=>({id:x.dataset.seat,node:x}));
   seats[0].focus();seats[0].click();
   check(seats[0].isConnected&&document.activeElement===seats[0],'selecting a seat preserves its original node and keyboard focus');
   seats[1].click();seats[2].click();
   check(refs.every(x=>q('#seatGrid [data-seat="'+x.id+'"]')===x.node),'selecting alternatives preserves every existing seat node');
   check(refs.every((x,i)=>x.node.querySelector('.order')?.textContent===String(i+1)),'candidate badges retain the actual try order');
   check(seats[1].getAttribute('aria-label').includes('第 2 候选'),'screen reader label announces the candidate order');
   seats[0].click();
   check(seats[1].querySelector('.order').textContent==='1'&&seats[2].querySelector('.order').textContent==='2','removing the first candidate renumbers remaining candidates in place');
   check(!seats[0].querySelector('.order')&&seats[0].getAttribute('aria-pressed')==='false','deselection removes the badge and selected semantic state');
   check(q('#seatGrid')===grid&&q('#seatSearch')===search&&q('#content')===content,'seat updates preserve the grid, search and content containers');
   const chip=q('.sel-chip[data-seat="'+seats[1].dataset.seat+'"]');chip.focus();chip.click();
   check(document.activeElement===seats[1],'removing a focused candidate chip returns focus to its stable grid seat');
   seats[2].focus();seats[2].click();await sleep(240);
   check(seats[2].isConnected&&document.activeElement===seats[2]&&!q('#seatGrid .sel'),'clearing the last candidate preserves focus and clears all selection state');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='tabcontinuity'){
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area="12"]'),'library ready');
   click('[data-area="12"]');await wait(()=>q('#seatGrid')&&idle(),'seats ready');
   click('[data-toggle="freeOnly"]');await wait(()=>q('#seatGrid').children.length>=90,'full seat list');
   window.scrollTo(0,Math.min(500,document.documentElement.scrollHeight-innerHeight));await sleep(80);const libraryY=scrollY;
   check(libraryY>150,'library fixture has a meaningful reading position');
   click('.nav [data-page="me"]');await wait(()=>q('#pageTitle').textContent==='我的'&&idle(),'my page');
   window.scrollTo(0,240);await sleep(80);const myY=scrollY;
   click('.nav [data-page="library"]');await wait(()=>q('#seatGrid')&&idle(),'library return');
   check(Math.abs(scrollY-libraryY)<3,'returning to the library restores its reading position');
   check(q('#seatGrid').children.length>=90,'returning to the library keeps the selected area and filters');
   click('.nav [data-page="me"]');await wait(()=>q('#pageTitle').textContent==='我的'&&idle(),'my return');
   check(Math.abs(scrollY-myY)<3,'each tab restores its own independent reading position');
   for(const page of ['rooms','exams','me','library'])click('.nav [data-page="'+page+'"]');
   await wait(()=>q('#seatGrid')&&idle(),'rapid navigation');await sleep(400);
   check(q('.nav [aria-current="page"]').dataset.page==='library'&&q('#pageTitle').textContent==='图书馆','rapid navigation leaves the final page and navigation state aligned');
   check(Math.abs(scrollY-libraryY)<3,'rapid navigation does not let older work reset the restored position');
   const anchor=[...document.querySelectorAll('#seatGrid .seat')].find(el=>el.getBoundingClientRect().bottom>q('#appbar').getBoundingClientRect().bottom);
   const anchorId=anchor.dataset.seat,offset=anchor.getBoundingClientRect().top,padding=getComputedStyle(q('#content')).paddingTop;
   click('.nav [data-page="me"]');q('#content').style.paddingTop=(parseFloat(padding)+40)+'px';
   click('.nav [data-page="library"]');await wait(()=>q('#seatGrid'),'library after layout change');
   check(Math.abs(q('#seatGrid [data-seat="'+anchorId+'"]').getBoundingClientRect().top-offset)<3,'a stable seat anchor keeps reading position when content above it changes height');
   q('#content').style.paddingTop='';window.scrollTo(0,libraryY);
   click('.nav [data-page="library"]');
   check(!q('#seatGrid')&&!!q('[data-area]'),'activating the current library tab returns from seats to its root');
   click('.nav [data-page="library"]');await sleep(80);
   check(scrollY<3,'activating the root tab returns to its top');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='progressmotion'){
   await wait(()=>window.CampusRuntimeReady&&idle(),'ready');
   document.documentElement.dataset.motion='auto';
   const loader=document.createElement('div');loader.className='loader';loader.innerHTML='<i></i>';document.body.append(loader);
   q('#progress').hidden=false;await sleep(50);
   for(const el of [q('#progress i'),loader.firstChild]){
    const frames=el.getAnimations()[0]?.effect.getKeyframes()||[];
    check(frames.length>=2&&frames.every(f=>f.transform&&!('left' in f)),'indeterminate feedback animates transforms without per-frame left changes');
   }
   document.documentElement.dataset.motion='off';await sleep(30);
   check(!loader.firstChild.getAnimations().length&&!q('#progress i').getAnimations().length,'turning motion off stops both indeterminate animations');
   check(getComputedStyle(loader.firstChild).display!=='none','reduced feedback keeps the loading indicator visible');
   loader.remove();q('#progress').hidden=true;
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='adapteraudit'){
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-action="settings"]'),'ready');
   const t={day:'2026-11-01',start:'09:00',end:'10:00'},s={id:1},r={space:1,beginTime:'2026-11-01 09:00:00',endTime:'2026-11-01 10:00:00',status_name:'已撤销'};
   check(!CampusCore.recordMatches(r,t,s),'revoked records cannot confirm current booking success');
   check(!CampusCore.recordMatches(r,t,s,true),'revoked records cannot confirm historical booking success');
   check(CampusCore.recordMatches({...r,status_name:'预约成功'},t,s),'valid successful records still match');
   const expected=window.CampusEditionVersion||q('.footer').textContent.match(/工大学伴\s+(\d+(?:\.\d+)+)/)?.[1];
   click('[data-action="settings"]');await wait(()=>q('#settingsForm'),'settings');
   check(!!expected&&q('#settingsForm').textContent.includes(expected),'settings version matches the built edition or footer version');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='dialogfocus'){
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-action="settings"]'),'ready');
   q('[data-action="settings"]').focus();click('[data-action="settings"]');await wait(()=>q('#settingsForm'),'settings');
   const done=q('#settingsForm [data-action="closeDialog"]');done.focus();
   const scroll=q('.sheet-body').scrollTop;Campus.receive({event:'resume'});await sleep(250);
   check(document.activeElement===q('#settingsForm [data-action="closeDialog"]'),'foreground refresh preserves the focused Done button');
   check(Math.abs(q('.sheet-body').scrollTop-scroll)<3,'focus restoration does not move the settings scroll position');
   q('#dialog .sheet').focus();Campus.receive({event:'resume'});await sleep(250);
   check(document.activeElement===q('#dialog .sheet'),'replacing dialog content retains a focus target inside the modal');
   q('#settingsForm input[name="theme"][value="dark"]').focus();Campus.receive({event:'resume'});await sleep(250);
   check(document.activeElement===q('#settingsForm input[name="theme"][value="dark"]'),'radio focus still survives a settings refresh');
   q('#dialog .sheet-close').focus();Campus.receive({event:'resume'});await sleep(250);
   check(document.activeElement===q('#dialog .sheet-close'),'header close and footer Done retain their distinct focus targets');
   Campus.back();await wait(()=>!q('#dialog').open,'close');
   check(!q('#dialog').contains(document.activeElement),'closing the refreshed dialog leaves no focus inside hidden content');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='roomrace'){
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area]'),'library ready');
   Campus.receive({event:'navigate',page:'rooms'});
   await wait(()=>q('#roomForm')&&idle(),'room form ready');
   const originalPost=NativeHost.post;let held=null,hold=true;
   NativeHost.post=function(text){const m=JSON.parse(text);if(hold&&m.cmd==='teaching'&&m.data.method==='rooms'&&(m.data.params?.periods||[]).length>1){held=m;return;}return originalPost.call(this,text);};
   const editWeek=()=>{const field=q('#roomForm [name="week"]');field.value=Number(field.value)+1;field.dispatchEvent(new Event('change',{bubbles:true}));};
   q('#roomForm').requestSubmit();await wait(()=>held,'first query held');
   check(!q('.room-row'),'first query has no previous room results');
   editWeek();const first=held;held=null;
   Campus.receive({id:first.id,ok:true,data:{rooms:[{id:'late',name:'过期合成教室',building:'合成楼'}],total:1,page:1,pageSize:500,until:{done:true,final:{}}}});
   await wait(()=>idle(),'old query finished');
   check(!q('.room-row')&&!q('.query-summary'),'editing conditions before the first response prevents old rows and summary from appearing');
   hold=false;q('#roomForm').requestSubmit();await wait(()=>q('.query-summary')&&idle(),'current query succeeds');
   check(!!q('.room-row'),'a fresh query still succeeds after an old result was discarded');
   click('[data-action="editRoomQuery"]');await wait(()=>q('#roomForm'),'edit form');
   hold=true;q('#roomForm').requestSubmit();await wait(()=>held,'refresh held');editWeek();
   const failed=held;held=null;Campus.receive({id:failed.id,ok:false,error:{code:'NETWORK',message:'过期查询模拟断网'}});
   await wait(()=>!q('#roomForm [type="submit"]').disabled,'old failure finished');
   check(!q('#content').textContent.includes('过期查询模拟断网')&&!q('#toast').textContent.includes('过期查询模拟断网'),'a previous query failure does not display an error for the edited conditions');
   check(q('#content').textContent.includes('条件改了'),'existing results remain explicitly stale when new conditions have no local answer');
   hold=false;q('#roomForm').requestSubmit();await wait(()=>q('.query-summary')&&idle()&&!q('#content').textContent.includes('条件改了'),'current recovery');
   check(!!q('.room-row'),'query controls recover normally after a discarded error');
   NativeHost.post=originalPost;
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='readdeadline'){
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area]'),'library ready');
   const calls=[];let completeActive,completeNext;
   const reads=CampusReadQueue.create({scope:()=>({accountId:'synthetic',epoch:0}),send:method=>{calls.push(method);return new Promise(resolve=>{if(method==='status')completeActive=resolve;else completeNext=resolve;});}});
   const active=reads.request('status');await sleep(10);
   let error;const started=performance.now();await reads.request('exams',{}, {limit:80}).catch(e=>{error=e;});
   check(error?.code==='TIMEOUT'&&error.slow,'queued caller expires before the active transport completes');
   check(performance.now()-started<1500,'caller deadline includes time spent waiting');
   const next=reads.request('rooms');await sleep(20);
   check(calls.length===1,'an expired caller cannot release the active transport');
   completeActive({});await active;await sleep(20);
   check(calls.join(',')==='status,rooms','expired queued exam query is skipped');
   completeNext({rooms:[]});await next;
   check(calls.length===2,'remaining live query completes without an extra school request');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='batchundo'){
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area="12"]'),'library ready');
   click('[data-area="12"]');await wait(()=>q('[data-seat="204"]')&&idle(),'seat list');
   click('[data-seat="204"]');await wait(()=>q('[data-action="favoriteSelection"]'),'selection');
   click('[data-action="favoriteSelection"]');await wait(()=>q('#toast [data-action="undo"]'),'batch removal undo');
   check(!window.__saved.favorites.some(f=>f.id==='204'),'selected favorite is removed before undo');
   click('[data-action="favoriteSeat"]');await wait(()=>q('#favoriteSeatId'),'new favorite picker');
   q('#favoriteSeatId').value='205';click('[data-action="confirmFavoriteSeat"]');await wait(()=>!q('#dialog').open,'picker closed');
   click('[data-action="backToAreas"]');await wait(()=>q('[data-action="manageFavorites"]'),'favorites manager entry');
   click('[data-action="manageFavorites"]');await wait(()=>q('[data-remove-favorite="seat:12:203"]'),'unrelated favorite');
   click('[data-remove-favorite="seat:12:203"]');await wait(()=>!window.__saved.favorites.some(f=>f.id==='203'),'later removal persisted');
   click('#dialog .sheet-close');await wait(()=>!q('#dialog').open,'manager closed');
   check(q('#toast [data-action="undo"]')&&q('#toast').textContent.includes('已取消收藏'),'first undo remains available after later edits');
   click('#toast [data-action="undo"]');await wait(()=>window.__saved.favorites.some(f=>f.id==='204'),'first removal undone');
   check(window.__saved.favorites.some(f=>f.id==='205'),'undo preserves the favorite added afterwards');
   check(!window.__saved.favorites.some(f=>f.id==='203'),'undo preserves an unrelated later removal');
   check(window.__saved.favorites.filter(f=>f.id==='204').length===1,'undo restores each selected favorite only once');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='research'){
   const qAll=s=>[...document.querySelectorAll(s)];
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area]'),'library ready');
   check(window.CampusEdition==='public','interaction checks run in the release edition');
   window.__examData=[
    {kch:'A',kcmc:'材料科学',ksmc:'期末考试',kssj:'2026-01-10(09:00-11:00)'},
    {kch:'B',kcmc:'材料科学',ksmc:'补考',kssj:'2026-01-20(09:00-11:00)'},
    {kch:'C',kcmc:'大学物理',ksmc:'缓考',kssj:''}];
   click('.nav [data-page="exams"]');await wait(()=>q('.exam-history'),'archived exams');
   check(!q('.exam-history').open&&q('.exam-history summary').textContent.includes('2'),'completed exams start collapsed with a count');
   check(qAll('.exam-type').some(x=>x.textContent==='补考')&&qAll('.exam-type').some(x=>x.textContent==='缓考'),'different exam types are visible on their rows');
   q('.exam-history').open=true;await sleep(30);click('[data-action="loadExams"]');
   await wait(()=>!q('[data-action="loadExams"]').disabled,'refreshed archived exams');
   check(q('.exam-history').open,'refresh keeps the user’s expanded history open');
   const rows=qAll('.exam-history .exam-row');check(rows[0].textContent.includes('补考'),'completed exams show the most recent first');
   click('.nav [data-page="library"]');await wait(()=>q('[data-action="manageFavorites"]')&&idle(),'favorites entry');
   click('[data-action="manageFavorites"]');await wait(()=>q('[data-remove-favorite]'),'favorites');
   const removed=q('[data-remove-favorite]').dataset.removeFavorite;click('[data-remove-favorite]');
   await wait(()=>q('#toast [data-action="undo"]'),'undo toast');
   click('#dialog .sheet-close');await wait(()=>!q('#dialog').open,'favorites closed');
   const statusText=window.CampusEdition==='public'?'已收起':'已收藏';
   if(window.CampusEdition==='public'){
    click('.nav [data-page="me"]');await wait(()=>q('[data-action="hideDonate"]')&&idle(),'support card');
    click('[data-action="hideDonate"]');
   }else{
    click('[data-area="12"]');await wait(()=>q('.seat-card')&&idle(),'seat page');
    click('[data-action="favoriteSeat"]');await wait(()=>q('#favoriteSeatId'),'favorite seat picker');
    q('#favoriteSeatId').value='205';click('[data-action="confirmFavoriteSeat"]');await wait(()=>!q('#dialog').open,'favorite picker closed');
   }
   await sleep(100);
   check(q('#toast [data-action="undo"]')&&q('#toast').textContent.includes('已取消收藏'),'an unrelated status message cannot replace undo');
   click('#toast [data-action="undo"]');await wait(()=>window.__saved?.favorites?.some(x=>x.key===removed),'favorite restored');
   check(q('#toast').textContent.includes(statusText),'deferred status appears after undo');
   const t=q('#toast');t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7,isPrimary:true,clientX:100,clientY:500}));
   window.dispatchEvent(new PointerEvent('pointerup',{pointerId:7,isPrimary:true,clientX:180,clientY:500}));
   check(t.classList.contains('hide'),'toast can be dismissed with a horizontal swipe');
   click('[data-action="settings"]');await wait(()=>q('#dialog').open,'settings sheet');
   const d=q('#dialog'),handle=q('.sheet-handle');d.scrollTop=100;
   const dragTouch=(type,y)=>handle.dispatchEvent(new PointerEvent(type.replace('touchstart','pointerdown').replace('touchmove','pointermove').replace('touchcancel','pointercancel').replace('touchend','pointerup'),{pointerId:2,isPrimary:true,pointerType:'touch',button:0,clientX:150,clientY:y,bubbles:true,cancelable:true}));
   dragTouch('touchstart',100);dragTouch('touchmove',170);await sleep(30);
   check(d.classList.contains('dragging'),'the explicit handle accepts pointer input on a scrolled sheet');
   dragTouch('touchcancel',170);await sleep(450);check(d.open&&!d.classList.contains('dragging'),'system cancellation springs back without closing the sheet');
   dragTouch('touchstart',100);dragTouch('touchmove',40);await sleep(30);
   check(d.open&&d.classList.contains('dragging'),'upward handle input keeps the sheet open');dragTouch('touchcancel',40);await sleep(400);
   click('#dialog .sheet-close');await wait(()=>!d.open,'settings closed');
   check(document.documentElement.scrollWidth<=innerWidth,'new labels fit the mobile viewport');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='exams'){
   const qAll=s=>[...document.querySelectorAll(s)];
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area]'),'library ready');
   click('.nav [data-page="exams"]');
   await wait(()=>qAll('.exam-row').length===3&&!q('[data-action="loadExams"]').disabled,'exam result');
   check(q('#content').textContent.includes('时间待公布 · 2')&&q('#content').textContent.includes('即将考试 · 1'),'pending exams are separated from scheduled exams');
   check(new Set(qAll('[data-exam]').map(el=>el.dataset.exam)).size===3,'each exam row has a distinct detail identity');
   const pendingRows=()=>qAll('.exam-row').filter(el=>el.textContent.includes('待定'));
   pendingRows()[1].click();await wait(()=>q('#dialog').open,'second pending exam');
   check(q('#dialog').textContent.includes('待定批次二')&&!q('#dialog').textContent.includes('待定批次一'),'the second pending exam opens its own full information');
   click('#dialog .sheet-close');await wait(()=>!q('#dialog').open,'detail closed');
   const firstRow=q('.exam-row'),before=window.__examCalls,libraryBefore=window.__schoolCalls;
   window.scrollTo(0,0);q('#content').dispatchEvent(touch('touchstart',100));q('#content').dispatchEvent(touch('touchmove',280));q('#content').dispatchEvent(touch('touchend',280));
   await wait(()=>window.__examCalls>before&&!q('.ptr')?.classList.contains('spin'),'exam pull refresh');
   check(window.__schoolCalls===libraryBefore&&q('#toast').textContent.includes('考试安排已更新'),'exam pull refresh reads exams and reports success only afterwards');
   check(q('.exam-row')===firstRow,'unchanged exam refresh preserves list nodes rather than repainting the page');
   window.__examFail=true;const failedAt=window.__examCalls;
   q('#content').dispatchEvent(touch('touchstart',100));q('#content').dispatchEvent(touch('touchmove',280));q('#content').dispatchEvent(touch('touchend',280));
   await wait(()=>window.__examCalls>failedAt&&!q('.ptr')?.classList.contains('spin'),'failed pull refresh');
   check(qAll('.exam-row').length===3&&q('.exam-at').textContent.includes('仍显示这份缓存'),'failed refresh retains the list and marks the cached data');
   check(q('.exam-row')===firstRow,'a failed refresh keeps the original exam list mounted');
   document.documentElement.dataset.motion='auto';
   pendingRows()[0].click();await wait(()=>q('#dialog').open,'motion detail');
   q('#dialog').dispatchEvent(new MouseEvent('click',{bubbles:true}));
   check(q('#dialog').open&&q('#dialog').classList.contains('closing'),'backdrop dismissal starts an exit animation');
   await wait(()=>!q('#dialog').open,'backdrop exit finished');
   pendingRows()[0].click();await wait(()=>q('#dialog').open,'reopened detail');
   const cancelled=new Event('cancel',{cancelable:true});q('#dialog').dispatchEvent(cancelled);
   check(cancelled.defaultPrevented&&q('#dialog').classList.contains('closing'),'Escape uses the same animated close path');
   await wait(()=>!q('#dialog').open,'Escape exit finished');
   pendingRows()[0].click();q('#dialog').dispatchEvent(new MouseEvent('click',{bubbles:true}));pendingRows()[1].click();
   await sleep(450);
   check(q('#dialog').open&&q('#dialog').textContent.includes('待定批次二')&&!q('#dialog').classList.contains('closing'),'replacing a closing dialog cancels its old close callback');
   click('#dialog .sheet-close');await wait(()=>!q('#dialog').open,'replacement detail closed');
   check(document.documentElement.scrollWidth<=innerWidth,'exam layout fits the viewport');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='public'){
   await wait(()=>q('#dialog').open&&q('#dialog').dataset.kind==='consent','consent dialog');
   check(!window.__schoolCalls&&!window.CampusRuntimeReady,'nothing is sent to the school before the user agrees');
   check(q('#consentAccept').disabled&&!q('#dialog .sheet-close')&&q('.legal').textContent.includes('非官方')&&q('.legal').textContent.includes('作者收不到'),'first run shows the agreement with privacy notice and requires ticking the box');
   check(Campus.back()===false&&q('#dialog').open,'the agreement cannot be dismissed with back');
   click('[data-action="declineConsent"]');await sleep(50);check(window.__exited===true,'declining closes the app');
   q('#consentCheck').click();check(!q('#consentAccept').disabled,'ticking the box enables agreeing');click('#consentAccept');
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area]'),'library ready');
   check(window.__saved?.preferences?.consent===1,'consent version is stored');
   click('[data-area="12"]');await wait(()=>q('.seat-card')&&idle(),'seats');click('[data-seat="204"]');
   check(!q('[data-action="plan"]')&&!!q('[data-action="book"]'),'public edition has instant booking only');
   click('.nav [data-page="me"]');await wait(()=>q('.donate')&&idle(),'donate card');
   await wait(()=>q('.donate img').naturalWidth>0,'donate image');checks.push('support card shows the payment code');
   click('[data-action="saveDonate"]');await wait(()=>window.__donateSaved&&q('#toast').textContent.includes('已保存'),'save donate');checks.push('payment code can be saved to the album');
   click('[data-action="hideDonate"]');await wait(()=>!q('.donate'),'hide donate');check(window.__saved?.preferences?.donateHidden===true,'support card can be hidden and the choice is kept');
   click('[data-action="settings"]');await wait(()=>q('#donateOn'),'settings');check(!q('#donateOn').checked&&!!window.CampusEditionVersion&&q('#dialog').textContent.includes(window.CampusEditionVersion),'settings show the public version and the support switch');
   q('#donateOn').click();await wait(()=>q('.donate'),'donate back');checks.push('support card can be turned back on in settings');
   click('[data-action="settings"]');await wait(()=>q('#dialog [data-action="legal"]'),'settings legal');click('#dialog [data-action="legal"]');
   await wait(()=>q('#dialog').dataset.kind==='legal'&&q('.legal'),'legal view');check(q('#dialog').textContent.includes('你于'),'the agreement stays readable in settings with the consent date');
   click('#dialog [data-action="withdrawConsent"]');await wait(()=>q('[data-action="confirmWithdraw"]'),'withdraw confirm');check(!window.__reset,'withdrawing asks for confirmation first');
   click('[data-action="confirmWithdraw"]');await wait(()=>window.__reset,'reset');checks.push('withdrawing consent clears all local data');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='publicpc'){
   await wait(()=>q('#dialog').open&&q('#dialog').dataset.kind==='consent','consent dialog');
   check(!window.__schoolCalls&&q('.legal').textContent.includes('手机或电脑')&&q('.legal').textContent.includes('Windows'),'desktop edition shows the same agreement before any school request');
   click('[data-action="declineConsent"]');await sleep(50);check(window.__exited===true,'declining closes the desktop app');
   q('#consentCheck').click();click('#consentAccept');
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area]'),'library ready');
   click('[data-area="12"]');await wait(()=>q('.seat-card')&&idle(),'seats');click('[data-seat="204"]');
   check(!q('[data-action="plan"]')&&!q('[data-action="duoPlan"]')&&!!q('[data-action="book"]'),'desktop edition has instant booking only, single account');
   click('.nav [data-page="me"]');await wait(()=>q('.donate')&&idle(),'donate card');
   check(!q('[data-action="saveDonate"]')&&q('.donate').textContent.includes('扫一扫'),'desktop support card asks to scan with the phone');
   click('[data-action="settings"]');await wait(()=>q('#dialog [data-action="withdrawConsent"]'),'settings');
   check(!!window.CampusEditionVersion&&q('#dialog').textContent.includes(window.CampusEditionVersion),'settings show the public version');
   click('#dialog [data-action="withdrawConsent"]');await wait(()=>q('[data-action="confirmWithdraw"]'),'withdraw confirm');
   check(q('#dialog').textContent.includes('这台电脑'),'withdrawing names this computer');
   click('[data-action="confirmWithdraw"]');await wait(()=>window.__reset,'reset');checks.push('withdrawing consent clears all local data');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='reconcile'){
   await wait(()=>window.CampusRuntimeReady&&idle()&&window.__saved?.tasks?.find(t=>t.id==='t4')&&window.__saved.tasks.find(t=>t.id==='t4').status!=='uncertain','records checked');
   const st=id=>window.__saved.tasks.find(t=>t.id===id);
   check(st('t4').status==='succeeded'&&st('t4').bookedSeat?.no==='201'&&q('#toast').textContent.includes('核对到了'),'an unconfirmed booking found later in the school records turns into booked');
   check((window.__notified||[]).some(x=>x.includes('约到了')&&x.includes('201')),'on the desktop a booking confirmed later also raises a system notification');
   check(st('t5').status==='failed'&&st('t5').message.includes('没约上'),'an unconfirmed booking whose day passed without a record is marked as not booked');
   check(st('t3').status==='uncertain'&&!/官方/.test(st('t3').message),'unconfirmed booking for today keeps waiting, with the old wording replaced');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='medal'){
   await wait(()=>q('#dialog').open&&q('#dialog').dataset.kind==='medal','medal dialog');
   check(q('#dialog').textContent.includes('连续 3 天')&&!!document.querySelector('.confetti'),'a new badge pops with confetti');
   click('#dialog [data-action="closeDialog"]');
   click('.nav [data-page="me"]');await wait(()=>q('.cal-grid')&&idle(),'calendar');
   check(document.querySelectorAll('.cal-grid .cal-cell:not(.pad)').length>=28&&document.querySelectorAll('.cal-grid .cal-cell.l2').length>=1,'attendance calendar shades the days at the library');
   check(q('.badges').textContent.includes('连续 3 天'),'earned badges stay on 我的');
   click('.stats-card [data-summary], [data-summary]');await wait(()=>q('#dialog').dataset.kind==='summary','summary');
   check(q('.summary-card .stats')&&q('#dialog').textContent.includes('月小结')&&q('#dialog').textContent.includes('最常坐'),'monthly summary shows visits, hours and the usual seat');
   click('#dialog [data-action="closeDialog"]');
   const before=JSON.stringify(window.__saved?.preferences?.badges);Campus.receive({event:'resume'});await sleep(400);
   check(!q('#dialog').open,'the same badge is not celebrated twice');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='offline'){
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area]'),'library ready');
   click('.nav [data-page="rooms"]');await wait(()=>q('#roomForm')&&idle(),'rooms online');
   const stored=()=>{try{return JSON.parse(localStorage.getItem('qlu.roomOffline.v2')||'null');}catch(e){return null;}};
   for(let i=0;i<1200&&!stored()?.synced;i++)await sleep(100);
   const data=stored();
   check(data?.synced&&Object.keys(data.days).length===2&&data.adapterVersion===2&&data.rooms.length===14&&data.periods.length===12,'automatic download prioritizes today and tomorrow with verified coverage');
   check(window.__roomCalls>=24&&window.__roomCalls<84,'automatic synchronization avoids the old seven-day request burst');
   click('[data-action="settings"]');await wait(()=>q('[data-action="syncRooms"]'),'offline download entry');click('[data-action="syncRooms"]');
   for(let i=0;i<1200&&Object.keys(stored()?.days||{}).length!==7;i++)await sleep(100);
   check(Object.keys(stored()?.days||{}).length===7,'explicit seven-day download completes within its own bounded synchronization window');
   check(Object.values(stored().days).every(day=>day.complete),'the explicit seven-day download stores only completely scanned days');
   window.__offline=true;window.__netDown=true;
   const calls=window.__roomCalls;
   if(!q('#roomForm')){click('[data-action="editRoomQuery"]');await wait(()=>q('#roomForm'),'query form reopened');}
   q('#roomForm').requestSubmit();
   await wait(()=>q('.room-results')&&idle(),'local answer');
   check(window.__roomCalls===calls&&q('.room-results .list-note').textContent.includes('本机数据')&&!q('.offline-card'),'with today synced, a query is answered on the phone without asking the school (works with no network)');
   // 超出已同步 7 天的日期要问学校；断网时马上退回本机数据（按同一星期几推算）
   click('[data-action="editRoomQuery"]');await wait(()=>q('#roomForm'),'form');
   const head=q('.room-find');click('[data-week="1"]');await sleep(50);
   check(q('.room-results.stale')&&q('.stale-note')&&head.isConnected&&q('#roomForm [name="week"]').value===String(8),'changing a condition keeps the page in place and marks the old results instead of wiping them');
   q('#roomForm').requestSubmit();
   await wait(()=>q('.offline-card')&&q('.room-results')&&!q('.room-results.stale')&&idle(),'offline mode');
   check(q('#toast').textContent.includes('本机数据')&&q('.room-results .banner.warn').textContent.includes('推算'),'losing the network mid-query falls back to the saved data at once');
   window.__setTeaching(false);click('[data-action="editRoomQuery"]');await wait(()=>q('#roomForm'),'form offline');
   click('[data-action="thisWeek"]');await sleep(50);
   const form=q('#roomForm');form.querySelector('[name="jxl_id"]').value='a';form.querySelectorAll('[name="period"]').forEach(b=>{b.checked=['1','2'].includes(b.value);});
   form.dispatchEvent(new Event('change',{bubbles:true}));q('#roomForm').requestSubmit();
   await wait(()=>q('.room-results')&&idle(),'offline results');
   const rows=[...document.querySelectorAll('.room-results .room-row')];
   check(rows.length===5&&rows.every(r=>r.textContent.includes('1号教学楼'))&&q('.room-results .banner').textContent.includes('离线数据'),'any building and periods can be queried offline');
   check(rows[0].textContent.includes('空到第 2 节'),'offline results show how long each room stays free');
   rows[0].querySelector('[data-room-open]').click();
   await wait(()=>q('#dialog').open&&q('.room-day'),'offline room day');
   check(q('.room-day p').textContent==='空闲：第 1–2、4–5、7–8、10–11 节'&&q('#dialog').textContent.includes('离线数据')&&!q('[data-room-shift="1"]').disabled,'a classroom day opens offline and other days can be browsed');
   click('[data-room-shift="1"]');await wait(()=>q('.room-day')&&!q('#roomDayProgress'),'next day');checks.push('next day comes from the saved data');
   click('#dialog [data-action="closeDialog"], #dialog .sheet-close');
   click('[data-action="editRoomQuery"]');await wait(()=>q('#roomForm'),'form live');
   const before=document.querySelectorAll('.room-results .room-row').length,liveForm=q('#roomForm');liveForm.querySelector('[name="period"][value="3"]').click();await sleep(50);
   check(liveForm.isConnected&&!q('.room-results.stale')&&document.querySelectorAll('.room-results .room-row').length!==before&&q('.room-results .list-note').textContent.includes('第 1–3 节'),'offline, ticking a period updates the results at once without pressing query');
   liveForm.querySelector('[name="period"][value="3"]').click();await sleep(50);q('#roomForm').requestSubmit();await wait(()=>q('.query-summary'),'collapsed');
   click('[data-action="editRoomQuery"]');await wait(()=>q('#roomForm'),'form again');
   click('[data-week="1"]');click('[data-week="1"]');q('#roomForm').requestSubmit();
   await wait(()=>q('.room-results .banner.warn')&&idle(),'approx');
   check(q('.room-results .banner.warn').textContent.includes('推算'),'dates beyond the saved week are estimated from the same weekday and say so');
   click('[data-action="settings"]');await wait(()=>q('#offlineStatus'),'settings');
   check(q('#offlineStatus').textContent.includes('长清校区')&&q('#offlineStatus').textContent.includes('KB')&&q('#roomOfflineOn').checked,'settings show what is saved and the daily switch');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='thanks'||scenario==='thanksoff'){
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area]'),'library ready');
   click('.nav [data-page="me"]');
   if(scenario==='thanksoff'){await sleep(2500);check(!q('#dialog').open,'with the support card hidden, the thank-you never pops up');out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;}
   await wait(()=>q('#dialog').open&&q('#dialog').dataset.kind==='thanks','thanks dialog');
   const t=q('#dialog').textContent;
   check(t.includes('第 100 次')&&t.includes('天')&&t.includes('奶茶')&&q('#dialog .thanks-qr img')&&q('[data-action="thanksNever"]')&&q('[data-action="thanksLater"]'),'on the 100th open the thank-you recaps the visits first, then mentions the tip, with later and never buttons');
   click('[data-action="thanksZoom"]');check(q('.thanks-qr').classList.contains('big'),'tapping the payment code enlarges it');
   click('[data-action="thanksLater"]');await wait(()=>!q('#dialog').open,'closed');
   click('.nav [data-page="library"]');await sleep(400);click('.nav [data-page="me"]');await sleep(2000);
   check(!q('#dialog').open&&(window.__saved?.preferences?.thanks?.shown||[]).includes(100),'after later it does not pop up again until 300 opens');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='bigrooms'){
   // 几百间教室：结果先显示 60 间，筛选、收藏、改条件只更新结果那一块，不整页重画
   await wait(()=>window.CampusRuntimeReady&&idle()&&q('[data-area]'),'library ready');
   click('.nav [data-page="rooms"]');await wait(()=>q('.offline-card')&&q('.room-results'),'rooms offline');
   check(q('.query-summary')&&!q('#roomForm')&&document.querySelectorAll('.room-row').length>0,'opening the page with saved data lists free rooms at once, no query tap needed');
   click('[data-action="editRoomQuery"]');await wait(()=>q('#roomForm'),'form');
   const form=q('#roomForm');form.querySelectorAll('[name="period"]').forEach(b=>{b.checked=b.value==='1';});form.dispatchEvent(new Event('change',{bubbles:true}));
   q('#roomForm').requestSubmit();await wait(()=>q('.room-results')&&idle(),'results');
   const total=Number((q('.room-results h2').textContent.match(/(\d+)/)||[])[1]);
   check(total>300&&document.querySelectorAll('.room-row').length===60&&q('[data-action="moreRooms"]'),'a long result list shows the first 60 rooms with a button for more');
   click('[data-action="moreRooms"]');check(document.querySelectorAll('.room-row').length===180,'the button adds more rooms in place');
   const summary=q('.query-summary');click('[data-room-building="3号教学楼"]');
   check(summary.isConnected&&[...document.querySelectorAll('.room-row')].every(r=>r.textContent.includes('3号教学楼')),'building filter only redraws the result list');
   click('.room-row [data-star-type="room"]');
   check(summary.isConnected&&q('#roomFavs .chip.fav')&&q('.room-row [data-star-type="room"]').getAttribute('aria-pressed')==='true','starring a room updates the star and the favourites row without redrawing the page');
   click('[data-action="editRoomQuery"]');await wait(()=>q('#roomForm'),'form');const f2=q('#roomForm');
   f2.querySelector('[name="period"][value="3"]').click();
   check(f2.isConnected&&!q('.room-results.stale')&&q('.room-results .list-note').textContent.includes('第 1、3 节'),'ticking a period refreshes the offline results at once and keeps the form');
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  if(scenario==='auto'||scenario==='autofail'){
   await wait(()=>q('#content').textContent.includes('正在自动登录图书馆'),'auto login card');checks.push('expired library session starts a background login without opening the school page');
   check(!window.__official,'background login does not show the official page');
   if(scenario==='auto'){await wait(()=>idle()&&q('[data-area]'),'auto login areas');checks.push('background login success loads the library by itself');}
   else{await wait(()=>q('#content').textContent.includes('需要你完成一次验证'),'auto login failed');check(!!q('[data-action="loginLibrary"]'),'failed background login offers the login page');}
   out.textContent=JSON.stringify({ok:true,checks});document.body.appendChild(out);return;
  }
  await wait(()=>window.CampusRuntimeReady&&idle()&&(q('[data-area]')||q('.seat-card')),'library ready');
  if(scenario==='menu'){
   click('.nav [data-page="rooms"]');Campus.receive({event:'sessionChanged',system:'teaching',connected:true,probe:true});
   await wait(()=>idle()&&q('#content').textContent.includes('还差一步'),'teaching hint');
   check(q('#content').textContent.includes('/jwglxt/xtgl/index_initMenu.html'),'teaching hint names the page the school left open');
   click('[data-action="officialTeaching"]');await sleep(20);check(window.__official?.autoReturn===true,'opening the student page from the hint asks to return automatically');
  }else{
   {const tabs=[...document.querySelectorAll('.nav [data-page]')].filter(b=>!b.hidden).sort((x,y)=>Number(x.style.order)-Number(y.style.order)).map(b=>b.dataset.page);check(tabs.join()==='library,rooms,pass,exams,me','phone shows five tabs with the pass in the middle');}
   check(getComputedStyle(q('.nav')).position==='fixed','navigation is a bottom bar on the phone');
   check(!q('.nav [data-page="tasks"]:not([hidden])')&&!!q('.nav [data-page="me"]:not([hidden])'),'phone tabs: tasks live inside 我的');
   check(!!q('.page-head .quote .src')&&q('.page-head .quote').offsetHeight>0&&q('.page-head .quote').textContent.length<60,'library header shows one short daily line with its source');
   check(!(q('#dialog').open&&q('#dialog').dataset.kind==='medal')&&!document.querySelector('.confetti'),'badges already earned before are recorded quietly the first time');
   check(!!q('.current .cheer'),'the current booking shows a short line from real records');
   check(!q('#content').textContent.includes('其他日期')&&!q('#day')&&document.querySelectorAll('[data-day]').length===2,'date choice is only today and tomorrow');
   const areaCount=()=>document.querySelectorAll('[data-area]').length;
   click('[data-area-floor="三层"]');check(areaCount()===2,'floor filter keeps the areas on that floor');
   click('[data-toggle="area:freeOnly"]');check(areaCount()===1&&!!q('[data-area="12"]'),'free-seat filter hides full areas');
   click('[data-toggle="area:freeOnly"]');click('[data-area-floor=""]');check(areaCount()===4,'clearing filters shows every area again');
   click('[data-area="12"]');await wait(()=>q('.seat-card')&&idle(),'seats');
   click('[data-action="randomSeat"]');check(document.querySelectorAll('.sel-chip').length===1&&q('#toast').textContent.includes('号'),'random pick selects one free seat');click('.sel-chip');
   click('[data-seat="204"]');check(!!q('.sel-chip'),'selected seat appears in the bottom panel');
   click('[data-action="seatMap"]');await sleep(20);
   check(window.__official?.target==='area'&&window.__official.areaId==='12'&&window.__official.seatId==='204'&&/^\d{4}-\d{2}-\d{2}$/.test(window.__official.day),'seat map opens the official area with day and selected seat');
   check(Campus.back()===true&&!q('.seat-card')&&!!q('[data-area="12"]'),'back returns from seats to the area list');
   click('[data-area="12"]');await wait(()=>q('.seat-card')&&idle(),'seats again');
   check(getComputedStyle(q('.sel-panel')).display==='none'&&q('.seat-head [data-action="seatMap"]').getAttribute('aria-label')==='座位图','the booking bar stays out of the way until a seat is picked');
   {const box=q('#seatSearch');box.value='zzz';box.dispatchEvent(new Event('input',{bubbles:true}));}
   await wait(()=>q('[data-action="clearSeatFilter"]'),'empty seat filter');click('[data-action="clearSeatFilter"]');
   await wait(()=>q('[data-seat="212"]')&&q('#seatSearch').value==='','filter cleared');checks.push('an empty seat filter offers to clear itself');
   click('[data-seat="212"]');check(getComputedStyle(q('.sel-panel')).display!=='none','picking a seat brings up the booking bar');click('[data-action="book"]');
   await wait(()=>q('[data-action="confirmBook"]'),'confirm');click('[data-action="confirmBook"]');
   await wait(()=>q('#dialog').textContent.includes('预约成功'),'booking result');
   check(!!q('#dialog [data-action="openPass"]'),'booking result offers the pass');
   await sleep(1800);check(q('#dialog').open&&q('#dialog').textContent.includes('预约成功'),'a verified booking result remains visible until the user chooses the next action');
   click('#dialog [data-action="closeDialog"]');
   await wait(()=>!q('#dialog').open&&idle()&&[...document.querySelectorAll('.current, .upcoming')].some(e=>e.textContent.includes('A212')),'result closed by user');
   checks.push('completing the result reveals the newly verified reservation');
   check(!!window.__live&&window.__live.title.includes('号')&&window.__live.chip.length<=7,'seat notification payload has area, seat and a short chip');
   window.scrollTo(0,0);q('#content').dispatchEvent(touch('touchstart',100));for(let y=110;y<=280;y+=15){q('#content').dispatchEvent(touch('touchmove',y));await sleep(10);}
   check(q('.ptr').classList.contains('ready'),'pull indicator arms after a long pull');
   q('#content').dispatchEvent(touch('touchend',280));await wait(()=>q('#toast').textContent.includes('已刷新'),'pull refresh');checks.push('pull to refresh reloads the page data');
   q('.nav').dispatchEvent(touch('touchstart',800));q('.nav').dispatchEvent(touch('touchmove',900));check(!q('.ptr').classList.contains('dragging'),'pulling on the bottom bar does not refresh');q('.nav').dispatchEvent(touch('touchend',900));
   click('[data-action="settings"]');await wait(()=>q('input[name="accent"][value="green"]'),'settings');
   q('input[name="accent"][value="green"]').click();await sleep(20);
   const dark=document.documentElement.dataset.theme==='dark'||document.documentElement.dataset.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;
   check(document.documentElement.style.getPropertyValue('--primary').toLowerCase()===CampusCore.accentPalette('#18A957',dark).primary,'accent colour applies to the whole page in the current light/dark mode');
   q('input[name="accent"][value="blue"]').click();await sleep(20);check(document.documentElement.style.getPropertyValue('--primary')==='','default blue restores the tuned palette');
   check(q('#dialog').textContent.includes('通知与超级岛')&&!!q('#hapticsOn'),'settings show the notification diagnostics and the haptics switch');
   check(q('#hideBorrow')?.checked===true,'borrow/return entries are hidden by default');
   q('#quotesOn').click();await wait(()=>!q('.page-head .quote'),'quote off');checks.push('daily line can be turned off');q('#quotesOn').click();await wait(()=>q('.page-head .quote'),'quote on');
   q('#hideBorrow').click();await wait(()=>window.__saved?.preferences?.hideBorrow===false,'hideBorrow saved');checks.push('borrow/return switch is saved for the native pass page');q('#hideBorrow').click();click('#dialog .sheet-close');
   click('.nav [data-page="me"]');await wait(()=>q('.profile')&&q('#content').textContent.includes('测试同学')&&q('.stats')&&idle(),'me page');
   check(!/\d{2}:\d{2}:\d{2}/.test(q('#content').innerText),'times on 我的 are shown to the minute, not raw timestamps');
   click('.profile [data-action="account"]');await wait(()=>q('#dialog').open&&q('#remember'),'account dialog');check(q('#remember').checked,'saving the password is on by default');click('#dialog .sheet-close');
   check(q('.profile .badge.ok')?.textContent==='正常'&&q('#accountChipText').textContent==='同学','account status and greeting come from the school profile');
   check(q('.vio .big-num b')?.textContent==='2'&&document.querySelectorAll('.vio .record').length===2,'violation count and recent records are shown');
   check(Number(q('.stats .stat b')?.textContent)>=1,'study stats are computed from school records');
   q('#remindForm input[value="30"]').click();await wait(()=>window.__reminders?.some(r=>r.text.includes('30 分钟后开始')),'reminder lead');
   check(window.__reminders.every(r=>r.at>Date.now())&&q('.remind-next').textContent.includes('下一次'),'check-in reminder is scheduled natively before the reservation starts');
   click('[data-action="editCountdown"]');await wait(()=>q('#countdownForm'),'countdown form');
   q('#cdName').value='考研初试';q('#cdDay').value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(Date.now()+67*86400000));q('#countdownForm').requestSubmit();
   await wait(()=>q('.cd-days b')?.textContent==='67','countdown card');checks.push('custom countdown shows the days left');
   click('.nav [data-page="library"]');await wait(()=>q('[data-leave]')&&q('.upcoming'),'leave button');
   check(!!q('.current [data-cancel-booking="9001"]')&&q('.upcoming').textContent.includes('A205'),'current card and upcoming list offer cancelling school bookings');
   click('[data-cancel-booking="9002"]');await wait(()=>q('[data-confirm-cancel="9002"]'),'cancel confirm');
   check(window.__cancels===undefined,'cancel asks for confirmation before contacting the school');
   click('[data-confirm-cancel="9002"]');await wait(()=>q('#toast').textContent.includes('已取消预约')&&idle(),'cancel result');
   check(window.__cancels===1&&!q('[data-cancel-booking="9002"]')&&!q('.upcoming')?.textContent.includes('A205'),'cancelled booking disappears after the school records are re-read');
   check(['tick','confirm','heavy'].every(k=>window.__haptics?.includes(k)),'haptic feedback fires on taps, success and the dice');
   await wait(()=>q('[data-action="quickTomorrow"]'),'quick tomorrow chip');check(q('[data-action="quickTomorrow"]').textContent.includes('A203 / A204'),'one-tap tomorrow appears once tomorrow has no booking');
   click('[data-action="quickTomorrow"]');await wait(()=>q('[data-action="confirmBook"]')&&idle(),'quick tomorrow confirm');
   check(q('#dialog').textContent.includes('明天')&&q('#dialog').textContent.includes('A204')&&!q('#dialog').textContent.includes('A203'),'one-tap tomorrow picks the free favourite seats for tomorrow and asks to confirm');
   click('#dialog .sheet-close');click('[data-day]');await wait(()=>idle()&&q('[data-leave]'),'back to today');
   click('[data-leave]');await wait(()=>q('#leaveRemind'),'leave dialog');
   q('#leaveRemind').value='20';click('[data-action="confirmLeave"]');await wait(()=>q('#toast').textContent.includes('20 分钟后提醒你'),'leave reminder');
   check(window.__reminders.some(r=>r.id.startsWith('leave:')&&r.at-Date.now()>19*60000),'temporary leave schedules a return reminder');
   Campus.receive({event:'navigate',page:'rooms'});await wait(()=>q('#pageTitle').textContent==='空教室','navigate rooms');
   Campus.receive({event:'sessionChanged',system:'teaching',connected:true,probe:true});await wait(()=>q('#roomForm')&&idle(),'room form');
   q('#roomForm').requestSubmit();await wait(()=>q('.query-summary')&&idle(),'room results');checks.push('connected teaching page loads options and queries rooms');
   check(/今天 \d+\/\d+ · 第 \d+ 周/.test(q('.query-summary strong').textContent),'the room query names the actual date');
   await wait(()=>[...document.querySelectorAll('.room-row')].some(x=>x.textContent.includes('1号教学楼 101')&&x.textContent.includes('空到第 2 节'))&&[...document.querySelectorAll('.room-row')].some(x=>x.textContent.includes('3号教学楼 104')&&x.textContent.includes('空到第 4 节')),'free until');
   checks.push('free rooms show until which period they stay free');
   check(!localStorage.getItem('qlu.roomCache.v1')&&!localStorage.getItem('qlu.roomDayCache.v1'),'room queries no longer keep a separate last-query copy');
   click('[data-toggle="roomLong"]');check(!document.querySelector('.room-row').textContent.includes('空到第 2 节'),'longest-free sort puts the longest free rooms first');click('[data-toggle="roomLong"]');
   q('#roomFindInput').value='104';q('#roomFind').requestSubmit();
   await wait(()=>q('#dialog').open&&q('#dialog').dataset.kind==='roomDay'&&q('.room-day'),'room day');
   check(document.querySelectorAll('.room-day .slot').length===12&&q('.room-day .badge').textContent==='空闲 8 节','room search scans every period of the day');
   check(q('.room-day p').textContent==='空闲：第 1、3–4、6–7、9–10、12 节','room day lists the free periods as ranges');
   const dayLabel=q('.day-nav strong').textContent;click('[data-room-shift="1"]');await wait(()=>q('.room-day')&&q('.day-nav strong').textContent!==dayLabel,'next day');checks.push('room day can step to the next day');
   click('#dialog .sheet-close');click('[data-action="editRoomQuery"]');await sleep(10);click('[data-room-open]');
   await wait(()=>q('#dialog').dataset.kind==='roomDay'&&!q('#dialog .loader')&&q('#dialog h2'),'room row day');
   check(!!q('#dialog h2').textContent&&!q('#dialog .banner'),'tapping a free room opens its whole-day view');click('#dialog .sheet-close');
   check(Campus.back()===true&&q('#pageTitle').textContent==='图书馆','back from another tab returns to the library');
   click('.nav [data-page="pass"]');check(q('.pass-booking')?.textContent.includes('号'),'pass page shows the reserved seat');
   let steps=0;while(Campus.back()&&steps<6)steps++;check(steps>=2&&q('#pageTitle').textContent==='图书馆'&&!!q('[data-area]'),'back walks pass → library → areas, then lets the app exit');
   click('.nav [data-page="library"]');await wait(()=>q('[data-checkout]')&&idle(),'checkout button');click('[data-checkout]');await wait(()=>q('[data-confirm-checkout]'),'checkout confirm');
   check(!window.__checkouts&&q('[data-confirm-checkout]').classList.contains('danger'),'ending use asks for confirmation first, with a red button like other irreversible actions');click('[data-confirm-checkout]');await wait(()=>q('#toast').textContent.includes('已结束使用')&&idle(),'checkout result');
   check(window.__checkouts===1&&!q('.current'),'ending use releases the seat and the current card disappears');
   check(document.documentElement.scrollWidth<=innerWidth,'no horizontal overflow at phone width');
   click('.nav [data-page="library"]');await wait(()=>q('[data-area]')||q('.seat-card'),'library again');q('[data-action="backToAreas"]')?.click();await wait(()=>q('[data-area="13"]'),'areas');
   check(q('[data-area="14"]')&&!q('[data-area="15"]')&&!q('#content').textContent.includes('借还书业务'),'the borrow/return desk is hidden from the area list by default');
   click('[data-area="13"]');await wait(()=>q('.seat-card')&&idle(),'full area');
   const hint=q('.full-hint');check(hint&&hint.querySelector('[data-area="14"]')&&hint.textContent.includes('58 空')&&!hint.textContent.includes('借还书'),'a full area offers the areas with the most free seats, never the borrow/return desk');
   click('.full-hint [data-area="14"]');await wait(()=>q('.seat-title h2')?.textContent.includes('外文期刊')&&idle(),'jump');checks.push('tapping a suggestion opens that area');
  }
  out.textContent=JSON.stringify({ok:true,checks});
 }catch(e){out.textContent=JSON.stringify({ok:false,checks,error:e.message});}
 document.body.appendChild(out);
})();
