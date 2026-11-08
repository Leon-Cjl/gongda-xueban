/* Exams feature: data ownership, query lifecycle, presentation and calendar export. */
(function(root, factory) {
 const api = factory();
 if (typeof module === 'object' && module.exports) module.exports = api; else root.CampusExams = api;
})(globalThis, function() {
 'use strict';
 async function readPages(read,current=()=>true) {
  const exams=[],pages=new Set();let total=null;
  for(let page=1;page<=10;page++) {
   if(!current())throw Object.assign(Error('账号已变化'),{code:'STALE'});
   const r=await read(page);
   if(!current())throw Object.assign(Error('账号已变化'),{code:'STALE'});
   if(!Array.isArray(r?.exams))throw Object.assign(Error('教务返回的考试信息格式有变化，请到教务核对'),{code:'PARSE'});
   const known=r.totalKnown===true&&Number.isSafeInteger(r.total)&&r.total>=0;
   if(known&&total!=null&&total!==r.total)throw Object.assign(Error('考试列表在查询期间变化，请重试'),{code:'PARSE'});
   if(known)total=r.total;
   const signature=JSON.stringify(r.exams);
   if(r.exams.length&&pages.has(signature))return{exams,complete:false,coverage:'学校返回了重复分页，请重试'};
   pages.add(signature);exams.push(...r.exams);
   if(known&&exams.length===total)return{exams,complete:true,coverage:''};
   if(known&&exams.length>total)throw Object.assign(Error('考试分页数量异常，请到教务核对'),{code:'PARSE'});
   if(!known||!r.exams.length)return{exams,complete:false,coverage:known?'学校未返回全部分页，请重试':'学校未提供完整数量，当前结果可能不完整'};
  }
  return{exams,complete:false,coverage:'已达单次读取上限，当前结果可能不完整'};
 }
 function calendarKeys(c,list) {
  const keys=new Set();return list.map(e=>{const key=c.year+'-'+c.term+'|'+JSON.stringify([e.x.kch||e.x.kcmc||'',e.x.ksmc||'',e.x.sjbh||'',e.x.ksfs||'']);if(keys.has(key))throw Error('存在无法稳定区分的重复考试，请到教务核对；未修改日历');keys.add(key);return key;});
 }
 function examChanges(previous,next) {
  const identify=x=>JSON.stringify([x.kch||x.kcmc||'',x.ksmc||'',x.sjbh||'',x.ksfs||'']),group=rows=>{const m=new Map();for(const x of rows){const k=identify(x);m.set(k,m.has(k)?null:x);}return m;};
  const old=group(previous||[]),fresh=group(next||[]),changes=[];
  for(const [key,row] of fresh){const before=old.get(key);if(!before||!row)continue;
   const oldPlace=[before.cdxqmc,before.cdmc,before.zwh].filter(Boolean).join(' · ')||'考场待公布',newPlace=[row.cdxqmc,row.cdmc,row.zwh].filter(Boolean).join(' · ')||'考场待公布';
   if((before.kssj||'')!==(row.kssj||'')||oldPlace!==newPlace)changes.push({name:row.kcmc||row.ksmc||'考试',before:(before.kssj||'时间待公布')+' · '+oldPlace,after:(row.kssj||'时间待公布')+' · '+newPlace});
  }
  return changes.slice(0,20);
 }
 function create(dependencies) {
 const {state, C, I, dtf, md, esc, pageHead, cacheTime, summary, showDialog, host, haptic, toast, save, onlineRooms, onlineTeaching, backgroundTeaching, teachingSettled, dropTeaching, refreshView} = dependencies;
const EXAM_FIELDS = [['ksmc', '考试名称'], ['kssj', '考试时间'], ['cdxqmc', '考场校区'], ['cdmc', '考场'], ['zwh', '座位号'], ['cdbh', '考场编号'], ['cdjc', '考场简称'], ['ksfs', '考试方式'], ['khfs', '考核方式'], ['kch', '课程号'], ['xf', '学分'], ['kkxy', '开课学院'], ['jsxx', '任课教师'], ['jxbmc', '教学班'], ['jxbzc', '教学班组成'], ['sksj', '上课时间'], ['jxdd', '上课地点'], ['xnmc', '学年'], ['xqmmc', '学期'], ['xqmc', '校区'], ['cxbj', '是否重修'], ['zxbj', '是否自修'], ['sjbh', '考试批次']];
const EXAM_HIDE = new Set(['kcmc', 'cdjc']);
let examBusy = false;
let expandedTerm = null;
// 当前学期：以学校教务查询页默认选中的学年学期为准（学校换学期就跟着换；不受空教室里自己改的学期、本机离线数据影响）；
// 这次还没连上教务时沿用上次查到的那个学期，从没查过才按日期推（8 月起是第一学期）。
function examTerm() {
 const s = state.schoolTerm, c = examCached();
 if (s) return {...s};
 if (c) return {year: c.year, term: c.term};
 const [y, m] = C.nowChina().split('-').map(Number);
 return {year: String(m >= 8 ? y : y - 1), term: m >= 8 || m < 2 ? '3' : '12'};
}
// 本机只存一个学期的结果，并记下是哪个学号查的：换了学号不显示上一位同学的考试
function examCached() { const c = Object.values(state.preferences.examCache || {})[0]; return c && c.owner === state.username ? c : null; }
const examKey = t => t.year + '-' + t.term;
function examTermLabel(t) { return t.year + '–' + (Number(t.year) + 1) + ' 第' + (t.term === '3' ? '一' : '二') + '学期'; }
function examInfo(x, index = 0) {
 const m = String(x.kssj || '').match(/(\d{4}-\d{2}-\d{2})\s*\(?\s*(\d{1,2}:\d{2})\s*[-–~至]\s*(\d{1,2}:\d{2})/), day = m?.[1] || '', pad = t => t.padStart(5, '0');
 const start = m ? pad(m[2]) : '', end = m ? pad(m[3]) : '', now = C.nowChina(), clock = dtf('en-GB', {timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false}).format(new Date());
 const past = day ? day < now || day === now && end && end <= clock : false;
 const place = [x.cdxqmc, x.cdmc].filter(Boolean).join(' · ') + (x.zwh ? ' · 座位 ' + x.zwh : '');
 // 详情标识只用于当前这份列表；原始行号区分同科目、同批次、时间都未公布的多条记录。
 return {x, key: JSON.stringify([x.kch || x.kcmc || '', x.ksmc || '', x.kssj || '', index]), name: x.kcmc || x.ksmc || '考试', type: (String(x.ksmc || '').match(/补考|缓考|重修|期中|期末/) || [])[0] || x.ksfs || x.khfs || '', day, start, end, past, place: place || '考场待公布', when: day ? md(day) + ' ' + dtf('zh-CN', {timeZone: 'Asia/Shanghai', weekday: 'short'}).format(new Date(day + 'T12:00:00+08:00')) + (start ? ' ' + start + '–' + end : '') : (x.kssj || '时间待公布')};
}
let listMemo = {source: null, minute: '', value: []};
function examList(c) {
 const source = c?.exams, minute = C.nowChina() + '|' + Math.floor(Date.now() / 60000);
 if (source !== listMemo.source || minute !== listMemo.minute) listMemo = {source, minute, value: (source || []).map(examInfo).sort((a, b) => ((a.day || '9999') + a.start).localeCompare((b.day || '9999') + b.start))};
 return listMemo.value;
}
function examCountdown(e) { if (e.past) return '已结束'; const n = e.day ? C.daysUntil(e.day) : null; return n == null ? '' : n === 0 ? '今天' : n === 1 ? '明天' : n + ' 天后'; }
function examRow(e) {
 const soon = !e.past && e.day && C.daysUntil(e.day) <= 3;
 return '<button class="exam-row' + (e.past ? ' past' : e.next ? ' next' : '') + '" data-exam="' + esc(e.key) + '"><span class="exam-date"><b>' + esc(e.day ? md(e.day) : '待定') + '</b><small>' + esc(examCountdown(e)) + '</small></span>'
  + '<span class="exam-main"><strong>' + esc(e.name) + (e.type ? '<small class="badge exam-type' + (/补考|缓考|重修/.test(e.type) ? ' warn' : '') + '">' + esc(e.type) + '</small>' : '') + '</strong><span class="exam-line">' + I.calendar + esc(e.when.replace(/^\S+\s/, '') || e.when) + (soon ? '<i class="badge warn">' + esc(examCountdown(e)) + '</i>' : '') + '</span><span class="exam-line">' + I.map + esc(e.place) + '</span></span>' + I.chevron + '</button>';
}
function examNote() { return '<p class="exam-note muted small">' + I.warn + '<span>考试时间、地点以学校教务系统公布为准，临近考试请再核对一次。<button class="link" data-action="officialExams">打开教务考试信息</button></span></p>'; }
function examParts({includeBody = true} = {}) {
 const c = examCached(), t = c ? {year: c.year, term: c.term} : examTerm(), list = examList(c), coming = list.filter(e => !e.past && e.day), waiting = list.filter(e => !e.day), done = list.filter(e => e.past);
 if(coming.length)for(const e of coming)e.next=e===coming[0];
 const head = I.calendar + esc(examTermLabel(t));
 let body;
 if (state.examError === 'needsLogin') body = '<div class="banner warn"><span>要先登录学生教务才能查考试安排</span><button class="btn text" data-action="showTeachingLogin">登录教务</button></div>';
 else if (state.examError) body = '<div class="banner warn"><span>' + esc(state.examError) + '</span><button class="btn text" data-action="loadExams">重试</button></div>';
 else body = '';
 if (c && c.complete !== true) body += '<div class="banner warn"><span>' + esc(c.coverage || '这份缓存尚未核实完整性，请刷新；导入日历不会删除旧条目') + '</span></div>';
 if (c?.changes?.length) body += '<details class="exam-changes"><summary>本次更新：' + c.changes.length + ' 场考试的时间或考场变化</summary>' + c.changes.map(x=>'<div><strong>'+esc(x.name)+'</strong><p class="small">原安排：'+esc(x.before)+'</p><p class="small">新安排：'+esc(x.after)+'</p></div>').join('') + '</details>';
 const status = body; body = '';
 if (includeBody) {
 if (!c) body += examBusy ? '<div class="skel-row"><i class="skel w60"></i><i class="skel w40"></i></div><div class="skel-row"><i class="skel w60"></i><i class="skel w40"></i></div>' : '<p class="muted small">从学生教务读取考试科目、时间和考场。</p><button class="btn tonal" data-action="loadExams">' + I.calendar + '查询考试安排</button>';
 else if (!list.length && c.complete !== true) body += '<p class="muted small">尚未取得完整考试安排，请重新查询或到教务核对。</p>';
 else if (!list.length) body += '<div class="empty small"><p>还没有公布考试安排</p><span class="muted small">学校一般在考试前几周公布，可以过些天再刷新</span></div>';
 else body += (coming.length ? '<h3 class="exam-group">即将考试 · ' + coming.length + '</h3><div class="exam-list">' + coming.map(examRow).join('') + '</div>' : !waiting.length ? '<p class="muted small">已公布的考试都已结束。</p>' : '')
  + (waiting.length ? '<h3 class="exam-group">时间待公布 · ' + waiting.length + '</h3><p class="muted small">学校公布时间后，刷新查看最新安排。</p><div class="exam-list">' + waiting.map(examRow).join('') + '</div>' : '')
  + (done.length ? '<details class="exam-history" data-exam-term="' + esc(examKey(t)) + '"' + (expandedTerm === examKey(t) ? ' open' : '') + '><summary class="exam-group">已结束 · ' + done.length + '</summary><div class="exam-list">' + done.slice().reverse().map(examRow).join('') + '</div></details>' : '');
 }
 const cal = state.platform === 'android' && c && (c.complete === true || coming.some(e => e.day && e.start)) ? '<button class="btn tonal" data-action="calendarExams">' + I.calendar + '导入日历（' + coming.filter(e => e.day && e.start).length + ' 场）</button>' : '';
 return {term: head, status, body, actions: cal, meta: (c ? '<p class="muted small exam-at" role="status">' + esc(cacheTime(c.at)) + ' 从教务查询' + (examBusy ? ' · 正在更新…' : state.examStale?.owner === state.username ? ' · 上次更新未成功，仍显示这份缓存：' + esc(state.examStale.reason) : '') + '</p>' : '') + examNote()};
}
function examsView() {
 const parts = examParts();
 return pageHead('考试安排', '', '<button class="icon-btn" data-action="loadExams" aria-label="刷新考试安排"' + (examBusy ? ' aria-busy="true" disabled' : '') + '>' + I.refresh + '</button>')
  + '<section class="card exams-card"><p class="exam-term">' + parts.term + '</p><div class="exam-status">' + parts.status + '</div><div class="exam-body">' + parts.body + '</div><div class="exam-actions">' + parts.actions + '</div><div class="exam-meta">' + parts.meta + '</div></section>';
}
function rememberHistory(term, open) { expandedTerm = open ? term : null; }
function examDialog(key) {
 const e = examList(examCached()).find(x => x.key === key);
 if (!e) return;
 const rows = EXAM_FIELDS.filter(([k]) => e.x[k] && !EXAM_HIDE.has(k) && !['jxbmc','jxbzc'].includes(k)).map(([k, l]) => [l, k === 'jsxx' ? String(e.x[k]).replace(/\b\d+\//g, '') : k === 'jxdd' ? [...new Set(String(e.x[k]).split(';'))].join('；') : e.x[k]]);
 showDialog('<h2>' + esc(e.name) + '</h2>' + summary([['时间', esc(e.when) + (examCountdown(e) ? ' <span class="badge' + (e.past ? '' : ' ok') + '">' + esc(examCountdown(e)) + '</span>' : '')], ['地点', esc(e.place)]])
  + '<div class="card list-card exam-detail">' + rows.map(([l, v]) => '<div class="record"><div><span class="muted">' + esc(l) + '</span><strong>' + esc(v) + '</strong></div></div>').join('') + '</div>' + examNote()
  + '<div class="dialog-actions"><button class="btn text" data-action="officialExams">去教务核对</button><button class="btn filled" data-action="closeDialog">好</button></div>', 'exam');
}
// 把还没考的考试写进手机日历（考前一天、一小时提醒）；同一场再导入时更新原来那条
let calendarBusy = false;
let pendingCalendarPlan = null;
async function calendarExams() {
 if (calendarBusy) return;
 const c = examCached(), all = examList(c);
 if (!c) return;
 try { const keys = calendarKeys(c, all);all.forEach((e,i)=>{e.cal=keys[i];}); } catch(error) {toast(error.message);return;}
 const list = all.filter(e => !e.past && e.day && e.start);
 if (!list.length && c.complete !== true) { toast('没有可以导入的考试，且尚未取得完整安排；未修改日历'); return; }
 const at = (day, time) => Date.parse(day + 'T' + time + ':00+08:00');
 const events = list.map(e => ({key: e.cal, title: e.name + ' 考试', start: at(e.day, e.start), end: at(e.day, e.end || e.start), location: e.place, description: [e.x.ksmc, e.x.ksfs && '考试方式：' + e.x.ksfs, e.x.zwh && '座位号：' + e.x.zwh, e.x.kch && '课程号：' + e.x.kch, '考试时间、地点以学校教务系统公布为准。'].filter(Boolean).join('\n')}));
 try {
  calendarBusy = true;
  const owner = JSON.stringify([state.activeAccountId, state.username, state.sessionEpoch]);
  const r = await host('calendarPreview', {events, keep: all.map(e => e.cal), term: c.year + '-' + c.term, allowRemoval: c.complete === true});
  if (owner !== JSON.stringify([state.activeAccountId, state.username, state.sessionEpoch]) || state.page !== 'exams') return;
  pendingCalendarPlan = {id: r.planId, owner};
  showDialog('<h2>确认日历同步</h2>' + summary([['目标日历', esc(r.calendar || '系统日历')], ['新增', esc(r.added) + ' 场'], ['更新', esc(r.updated) + ' 场'], ['删除', esc(r.removed) + ' 场']]) + '<p class="muted small">只处理本应用为当前账号、本学期创建的考试。取消不会修改日历；旧版未标记归属的条目请自行核对。' + (c.complete === true ? '' : '当前数据不完整，本次不会删除任何旧条目。') + '</p><div class="dialog-actions"><button class="btn text" data-action="closeDialog">取消</button><button class="btn filled" data-action="confirmCalendar">确认同步</button></div>', 'calendarPlan');
 } catch (e) { if (e.code !== 'BUSY') { haptic('reject'); toast(C.errorText(e)); } }
 finally { calendarBusy = false; }
}
async function confirmCalendar() {
 if (calendarBusy || !pendingCalendarPlan) return;
 const plan = pendingCalendarPlan;pendingCalendarPlan = null;
 if (plan.owner !== JSON.stringify([state.activeAccountId, state.username, state.sessionEpoch])) { toast('账号已变化，请重新预览日历');return; }
 calendarBusy = true;
 try { const result = await host('calendarCommit', {planId: plan.id});haptic('confirm');toast('日历已同步：新增 ' + result.added + ' 场，更新 ' + result.updated + ' 场，删除 ' + result.removed + ' 场'); }
 catch (error) { haptic('reject');toast(C.errorText(error)); }
 finally {calendarBusy = false;}
}
async function loadExams({quiet = false} = {}) {
 if (examBusy) return false;
 const accountId = state.activeAccountId, username = state.username, epoch = state.sessionEpoch, hadCache = !!examCached();
 let contentChanged = !hadCache;
 const sameAccount = () => accountId === state.activeAccountId && username === state.username && epoch === state.sessionEpoch;
 examBusy = true; state.examError = ''; refreshView({contentChanged: !hadCache});
 try {
  for (let retry = 0; ; retry++) {
   await teachingSettled();
   if (!sameAccount()) return false;
   if (!onlineRooms() && !(await backgroundTeaching({manual: true, fresh: retry > 0}))) throw Object.assign(Error(state.teachingAuto.needsUser ? '' : '连不上学生教务（可能不在校园网或教务在维护），稍后再试'), {code: state.teachingAuto.needsUser ? 'AUTH' : 'NETWORK'});
   if (!sameAccount()) return false;
   const t = examTerm();
   try {
    const r = await readPages(page => onlineTeaching('exams', {year: t.year, term: t.term, page}, 25000), sameAccount);
    if (!sameAccount()) return false;
    if (!Array.isArray(r?.exams)) throw Object.assign(Error('教务返回的考试信息格式有变化，请到教务核对'), {code: 'PARSE'});
    const previous = examCached();
    if (!r.complete && !r.exams.length && previous?.exams?.length) throw Object.assign(Error(r.coverage), {code:'INCOMPLETE'});
    const unchanged = previous && examKey(previous) === examKey(t) && JSON.stringify(previous.exams) === JSON.stringify(r.exams);
    contentChanged = contentChanged || !unchanged;
    state.preferences.examCache = {[examKey(t)]: {at: Date.now(), year: t.year, term: t.term, owner: username, complete: r.complete, coverage: r.coverage, changes: unchanged ? previous.changes || [] : previous && examKey(previous) === examKey(t) ? examChanges(previous.exams,r.exams) : [], exams: unchanged ? previous.exams : r.exams}};
    state.examStale = null;
    break;
   } catch (e) {
    if (!sameAccount()) return false;
    // 明确过期或后台查询页消失时，重连一次再查；真正的格式错误保留缓存并提示，不重复提交密码。
    if (retry || !['PAGE', 'AUTH', 'EXPIRED'].includes(e.code)) throw e;
    dropTeaching();
   }
  }
  await save();
  if (!sameAccount()) return false;
  if (!quiet) haptic('confirm');
  return true;
 } catch (e) {
  if (!sameAccount()) return false;
  if (e.code === 'NETWORK' && onlineRooms()) dropTeaching();
  state.examStale = {owner: username, reason: C.errorText(e)};
  state.examError = e.code === 'AUTH' ? 'needsLogin' : quiet ? '' : C.errorText(e);
  return false;
 }
 finally {
  examBusy = false;
  if (state.page === 'exams') { refreshView({contentChanged}); if (!sameAccount()) setTimeout(maybeRefreshExams, 0); }
 }
}
// 进考试页、回到前台时：没查过就查；教务在线且学校换了学期、或上次查询超过 6 小时就悄悄重查；上次失败的提示不一直挂着
function maybeRefreshExams() {
 if (examBusy) return;
 const c = examCached(), s = state.schoolTerm;
 if (!c) loadExams();
 else if (s && examKey(s) !== examKey(c) || Date.now() - c.at > 6 * 3600000) loadExams({quiet: true});
 else if (state.examError && state.examError !== 'needsLogin') { state.examError = ''; refreshView({contentChanged: false}); }
}
 return {rememberHistory, examTerm, examCached, examKey, examTermLabel, examInfo, examList, examCountdown, examRow, examNote, examsView, examDialog, calendarExams, confirmCalendar, loadExams, maybeRefreshExams, parts: examParts, get busy() { return examBusy; }};
 }
 return {create, readPages, calendarKeys, examChanges};
});
