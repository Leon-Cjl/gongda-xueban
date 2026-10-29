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
   click('[data-action="settings"]');await wait(()=>q('#donateOn'),'settings');check(!q('#donateOn').checked&&q('#dialog').textContent.includes('1.0.0')&&!q('#dialog').textContent.includes('个人使用版'),'settings show the public version and the support switch');
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
   check(q('#dialog').textContent.includes('1.0.0')&&!q('#dialog').textContent.includes('个人使用版'),'settings show the public version');
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
   check(data?.synced&&Object.keys(data.days).length===7&&data.rooms.length===14&&data.periods.length===12&&JSON.stringify(data).length<20000,'the whole campus is saved for seven days, one request per period');
   check(window.__roomCalls>=84,'every period of every day was queried');
   window.__offline=true;window.__netDown=true;
   const calls=window.__roomCalls;
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
   check(!document.querySelector('.donate'),'the personal edition has no support card');
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
   await wait(()=>!q('#dialog').open&&idle()&&[...document.querySelectorAll('.current, .upcoming')].some(e=>e.textContent.includes('A212')),'result closes by itself');
   checks.push('a successful booking closes its dialog and the page refreshes to show the new seat');
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
