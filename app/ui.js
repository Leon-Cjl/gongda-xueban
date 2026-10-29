/* 工大学伴 · 共享界面逻辑（安卓 WebView 与 Windows WebView2 共用）。
   学校请求一律经本机客户端转发；这里负责界面状态、预约调度与本机保存。 */
(() => {
'use strict';
const VERSION = '0.9.28';
// 公开版：单账号、只有“立即预约”；有可收起的“支持作者”卡片和《用户协议与隐私说明》。
const PUBLIC = window.CampusEdition === 'public';
const SHOWN_VERSION = PUBLIC ? (window.CampusEditionVersion || '') : VERSION;
const LEGAL = window.CampusLegal || {version: 0, sections: []};
const C = CampusCore;
// 奶蛙版（普通版的分支）：带了 naiwa-theme.js、pet-*.js 时启用主题和奶蛙小屋；普通版没有这些文件，下面的挂接都不起作用。
const NW = !!window.NaiwaTheme;
window.NaiwaTheme?.install();
let mascotThemeSaving = false, petUI = null;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const same = (a, b) => String(a) === String(b);
const svg = (body, cls = '') => '<svg class="icon' + cls + '" viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
const STAR = '<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z"/>';
const I = {
 library: svg('<path d="M12 6.6C10 5.1 7 4.6 3.5 5.1v13.2c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5.1C17 4.6 14 5.1 12 6.6Z"/><path d="M12 6.6v13.2"/>'),
 room: svg('<path d="M5.5 20.5V4.8c0-.7.6-1.3 1.3-1.3h10.4c.7 0 1.3.6 1.3 1.3v15.7"/><path d="M3 20.5h18"/><path d="M14.6 12.2v.6"/>'),
 alarm: svg('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.3V13l2.6 1.9"/><path d="M4.6 5.2 7 3.2M19.4 5.2 17 3.2"/>'),
 qr: svg('<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.3"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.3"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.3"/><path d="M14 14h2.6v2.6H14zM17.9 17.9h2.6v2.6h-2.6zM14 20.5h1.2M20.5 14v1.2"/>'),
 refresh: svg('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>'),
 back: svg('<path d="M15 5.5 8.5 12l6.5 6.5"/>'),
 chevron: svg('<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>'),
 close: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
 star: svg(STAR),
 starOn: svg(STAR, ' fill'),
 calendar: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
 search: svg('<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>'),
 check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
 warn: svg('<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4.2M12 17v.3"/>'),
 ok: svg('<circle cx="12" cy="12" r="8.5"/><path d="m8 12.3 2.8 2.7L16.2 9.5"/>'),
 minus: svg('<path d="M6 12h12"/>'),
 plus: svg('<path d="M12 6v12M6 12h12"/>'),
 map: svg('<path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2Z"/><path d="M9 4.5v13M15 6.5v13"/>'),
 user: svg('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.8 20c.9-3.8 3.7-5.8 7.2-5.8s6.3 2 7.2 5.8"/>'),
 dice: svg('<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01M12 12h.01" stroke-width="2.6"/>'),
 bell: svg('<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
 flag: svg('<path d="M5.5 21V4M5.5 4.5h11l-2 3.5 2 3.5h-11"/>'),
 medal: svg('<circle cx="12" cy="15" r="5.5"/><path d="M7 3h3.2l2 6.6M17 3h-3.2l-2 6.6"/><path d="m12 12.6.8 1.6 1.7.2-1.3 1.2.3 1.7-1.5-.8-1.5.8.3-1.7-1.3-1.2 1.7-.2Z"/>')
};
const ACCENTS = [['blue', '#3482FF', '澎湃蓝'], ['teal', '#00A1B5', '青碧'], ['green', '#18A957', '翠绿'], ['purple', '#7B5CF5', '星紫'], ['orange', '#FF7A1A', '活力橙'], ['pink', '#EE4C86', '樱粉'], ['red', '#E5484D', '朱红'], ['graphite', '#5B6573', '石墨']];
const PAGES = {library: '图书馆', rooms: '空教室', tasks: '预约任务', pass: '入馆码', exams: '考试', me: '我的'};
// 双端分工：手机侧重查询、入馆和提醒（不常驻后台），任务并入“我的”；电脑上任务单独成页。
// 手机底栏：入馆码放在正中间
const NAV = {android: ['library', 'rooms', 'pass', 'exams', 'me'], windows: ['library', 'tasks', 'rooms', 'me']};
const STATUS = {pending: '待执行', checking: '登录预检', submitting: '提交中', verifying: '核验中', succeeded: '已成功', failed: '未成功', uncertain: '确认中', needs_auth: '需要登录', missed: '已错过', cancelled: '已取消'};
const TONE = {pending: 'info', checking: 'info', submitting: 'info', verifying: 'info', succeeded: 'ok', failed: 'err', uncertain: 'warn', needs_auth: 'warn', missed: 'warn'};
const WEEKDAYS = '一二三四五六日';
// 每日一句：只选出处明确的古籍原句，同一天固定一句。
const QUOTES = [
 ['不积跬步，无以至千里。', '荀子《劝学》'],
 ['骐骥一跃，不能十步；驽马十驾，功在不舍。', '荀子《劝学》'],
 ['锲而不舍，金石可镂。', '荀子《劝学》'],
 ['博观而约取，厚积而薄发。', '苏轼'],
 ['古之立大事者，不惟有超世之才，亦必有坚忍不拔之志。', '苏轼《晁错论》'],
 ['路漫漫其修远兮，吾将上下而求索。', '屈原《离骚》'],
 ['业精于勤，荒于嬉；行成于思，毁于随。', '韩愈《进学解》'],
 ['千里之行，始于足下。', '《老子》'],
 ['纸上得来终觉浅，绝知此事要躬行。', '陆游'],
 ['学而不思则罔，思而不学则殆。', '《论语》'],
 ['知之者不如好之者，好之者不如乐之者。', '《论语》'],
 ['天行健，君子以自强不息。', '《周易》'],
 ['君子藏器于身，待时而动。', '《周易》'],
 ['长风破浪会有时，直挂云帆济沧海。', '李白'],
 ['为者常成，行者常至。', '《晏子春秋》'],
 ['凡事预则立，不预则废。', '《礼记·中庸》'],
 ['人一能之，己百之；人十能之，己千之。', '《礼记·中庸》'],
 ['读书不觉已春深，一寸光阴一寸金。', '王贞白'],
 ['盛年不重来，一日难再晨。', '陶渊明'],
 ['志不强者智不达。', '《墨子》']
];
const TEXT_INPUT = 'input[type=search],input[type=text],input[type=number],input[type=password],input:not([type])';

const state = {
 activeAccountId: 'default', accounts: [], supportsAccounts: false, page: 'library', platform: window.CampusPlatform || (window.NativeHost ? 'android' : 'unknown'),
 tasks: [], libraryConnected: false, teachingConnected: false, hasCredentials: false, username: '', systemDark: undefined,
 catalog: [], areas: [], seats: [], selection: [], records: [], recordsLoaded: false, current: [], currentError: '',
 day: C.nowChina(), libraryId: '', areaId: '', start: '', end: '', kind: 3, segment: '', info: null,
 loading: false, error: '', updated: '', teachingOptions: null, rooms: null, roomQuery: null, roomFavoritesOnly: false, roomFormOpen: true, termOpen: false, teachingHint: '',
 bookingId: '', favorites: [], notify: null, currentAt: 0, knownCurrent: [],
 profile: null, violations: null, statusAt: 0, statusLoading: false, statusError: '', rules: {}, reminders: [], remindersAt: 0, areaQuery: '', roomBuilding: '', roomSort: '',
 teachingAuto: {busy: false, tried: false, needsUser: false, error: ''},
 roomDay: null, roomFind: '', roomFindDate: '', calMonth: '', roomLoading: false, roomsStale: false, roomLimit: 0, libraryAuto: {busy: false, needsUser: false},
 preferences: {...(NW ? {mascotTheme: 'naiwa'} : {}), theme: 'system', motion: 'auto', glass: 'auto', accent: 'blue', seatNotify: true, roomQuery: null, seatFilter: {query: '', freeOnly: true, favoriteOnly: false}, areaFilter: {floor: '', freeOnly: false, sort: ''}, checkinLead: 15, countdown: null, manualReminders: [], firedReminders: [], desktopNotify: true}
};
// 读取标记按用途分开：读入馆记录、提交签退等不再挡住换日期和选座。state.loading 只是“有任何一种在读”，给进度条和通用判断用。
state.reading = {library: false, current: false, records: false, op: false, account: false};
Object.defineProperty(state, 'loading', {get: () => Object.values(state.reading).some(Boolean), set: v => { state.reading.account = !!v; }});
const pending = new Map();
let seq = 0, toastTimer, undoAction = null, accountBusy = false, creatingTasks = false, booker, lastPage = '', pendingLeave = null, leaving = false, cancelling = false, checkingOut = false, untilToken = 0, roomDefaultsApplied = false, lastLive = '', teachingConnecting = false, lastReminders = '';
const lastStatus = new Map();
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 本机客户端桥 ---------- */
function host(cmd, data = {}) {
 return new Promise((resolve, reject) => {
  const id = String(++seq), m = {id, cmd, data};
  pending.set(id, {resolve, reject});
  setTimeout(() => {
   if (!pending.has(id)) return;
   pending.delete(id);
   reject(Object.assign(Error('客户端响应超时，稍后会刷新状态'), {code: 'TIMEOUT', uncertain: cmd === 'library' && ['reserve', 'temporaryLeave', 'cancelBooking', 'checkout'].includes(data.method)}));
  }, 65000);
  if (window.chrome?.webview) window.chrome.webview.postMessage(m);
  else if (window.NativeHost) window.NativeHost.post(JSON.stringify(m));
  else { pending.delete(id); reject(Error('请在工大学伴客户端中使用此功能')); }
 });
}
window.Campus = {
 receive(m) {
  if (typeof m === 'string') m = JSON.parse(m);
  if (m.id && pending.has(String(m.id))) {
   const p = pending.get(String(m.id));
   pending.delete(String(m.id));
   m.ok ? p.resolve(m.data) : p.reject(Object.assign(Error(m.error?.message || '操作失败'), m.error || {}));
  } else if (m.event === 'sessionChanged') sessionChanged(m);
  else if (m.event === 'libraryLogin') { Object.assign(state.libraryAuto, {busy: m.state === 'started', needsUser: m.state === 'failed' && !!m.needsUser, failed: m.state === 'failed'}); render(); }
  else if (m.event === 'tick') tick();
  else if (m.event === 'closeRequest') host('closeReply', {allow: !state.tasks.some(t => C.active.includes(t.status))}).catch(() => {});
  else if (m.event === 'systemTheme') { state.systemDark = !!m.dark; applyAppearance(); }
  else if (m.event === 'navigate') { closeDialog(); go(m.page); }
  else if (m.event === 'resume') onResume();
 },
 tick,
 back
};
window.chrome?.webview?.addEventListener('message', e => Campus.receive(e.data));
// 安卓上原生和网页各有一个每秒的计时，合并成一次。
let lastTick = 0;
function tick() { if (Date.now() - lastTick < 700) return; lastTick = Date.now(); if (!creatingTasks) booker?.tick(); fireDueReminders(); maybeDailyRoomSync(); rollDay(); rollRoomDay(); retryFailedReads(); }
// 断网时读失败的“当前预约”“账号信息”：网络恢复后不用手点重试，在看的页面每分钟自己再读一次。
let lastRetry = 0;
function retryFailedReads() {
 if (!window.CampusRuntimeReady || state.loading || Date.now() - lastRetry < 60000 || $('#dialog').open) return;
 if (state.currentError && state.libraryConnected && ['library', 'me'].includes(state.page)) { lastRetry = Date.now(); busy(refreshCurrent, {quiet: true, kind: 'current'}); }
 else if (state.statusError && state.libraryConnected && state.page === 'me' && !state.statusLoading) { lastRetry = Date.now(); loadAccountStatus({force: true}); }
}
// 过了零点：空教室的当前周跟着算，查询条件原来是“本周、今天”的换成新的今天；已查的结果保留，日期按新的一天显示（会写成“昨天”）。
let roomToday = C.nowChina();
function rollRoomDay() {
 const today = C.nowChina();
 if (today === roomToday || !window.CampusRuntimeReady) return;
 const prev = roomToday, o = state.teachingOptions, q = state.preferences.roomQuery, oldWeek = o?.currentWeek, prevWd = new Date(prev + 'T12:00:00+08:00').getUTCDay() || 7;
 roomToday = today;
 if (oldWeek) o.currentWeek = C.weekOf(today, oldWeek, prev);
 if (q && oldWeek && Number(q.week) === Number(oldWeek) && Number(q.weekday) === prevWd) state.preferences.roomQuery = {...q, week: o.currentWeek, weekday: chinaWeekday()};
 if (state.page === 'rooms' && !$('#dialog').open && !state.roomLoading) render();
}
// 客户端跨过零点一直开着时，日期还停在昨天：自动换到今天并重读座位。
function rollDay() {
 const today = C.nowChina();
 if (!window.CampusRuntimeReady || state.loading || state.day >= today || $('#dialog').open) return;
 state.day = today; state.selection = [];
 if (state.libraryConnected) loadLibrary(); else render();
}
const api = (method, params = {}, accountId = state.activeAccountId) => !state.supportsAccounts && accountId !== 'default' ? Promise.reject(Error('此客户端暂不支持该账号的任务，请使用 Windows 双账号版')) : host('library', {method, params, accountId});
// 教务请求排队逐个发：后台同步和界面查询不会同时操作学校页面。没连上教务但有离线数据时，查询走本机数据。
let teachingChain = Promise.resolve();
// limit：从真正发出时算起最多等多久（排队时间不算）；到时先报超时，队列接着往下走。
function onlineTeaching(method, params = {}, limit = 0) {
 const accountId = state.activeAccountId, send = () => host('teaching', {method, params, accountId});
 const run = teachingChain.then(() => limit ? Promise.race([send(), sleep(limit).then(() => { throw Object.assign(Error('教务响应太慢'), {code: 'TIMEOUT', slow: true}); })]) : send());
 teachingChain = run.catch(() => {});
 return run.catch(e => { e.system = 'teaching'; throw e; });
}
async function teaching(method, params = {}) {
 if (state.teachingOptions?.offline) return offlineTeaching(method, params);
 // 本机数据能回答这次查询时：学校 8 秒没回应、断网、教务掉线（离开校园网、网络差），就先用本机数据，不让人干等着报错。
 const local = method === 'rooms' && offlineCovers(params);
 try { return await onlineTeaching(method, params, local ? 8000 : 0); }
 catch (e) {
  if (!local || !['NETWORK', 'TIMEOUT', 'AUTH', 'PAGE', 'PARSE'].includes(e.code)) throw e;
  if (e.slow) { if (onlineRooms()) toast('教务响应慢，这次先用本机数据'); }
  else if (onlineRooms()) goOfflineRooms(e);
  return offlineTeaching(method, params);
 }
}
function offlineCovers(p) { const d = offlineData(); return !!d && same(p.year, d.year) && same(p.term, d.term) && same(p.campus, d.campus) && !!C.offlineDay(d, p.week, p.weekday); }
// 切到本机数据：正在看的结果留着；登录过期一类的错误顺便在后台重新连接教务。
function goOfflineRooms(e) {
 state.teachingOptions = null; state.teachingConnected = false; useOfflineRooms();
 toast('连不上教务，先用本机数据');
 // 登录失效一类：后台重新走一遍登录（只看页面还在会误判已连上）；断网一类：过几分钟、或回到空教室页时再试。
 state.teachingAuto.tried = false;
 if (['AUTH', 'PAGE', 'PARSE'].includes(e.code) && Date.now() - lastExpiredReconnect > 120000) { lastExpiredReconnect = Date.now(); setTimeout(() => backgroundTeaching({fresh: true}), 1000); }
 else roomSync.next = Math.min(roomSync.next, Date.now() + 5 * 60000);
}
const hasPass = () => state.platform === 'android';

function sessionChanged(m) {
 if (m.accountId && m.accountId !== state.activeAccountId) return;
 if (m.system === 'teaching') {
  state.teachingConnected = !!m.connected;
  let switched = false;
  if (m.connected) state.teachingAuto.needsUser = false;
  else { state.teachingHint = '学生教务未连接。'; if (onlineRooms() && offlineData()) { state.teachingOptions = null; useOfflineRooms(); switched = true; } }
  // 只是连接状态变了：空教室页只换顶部状态，接着连教务时还会再画一次，不整页重画两遍；“我的”页的连接状态要跟着变。
  if (switched || state.page === 'me') render(); else if (state.page === 'rooms') roomsChrome();
  if (m.connected && !onlineRooms()) connectTeaching();
  return;
 }
 const was = state.libraryConnected;
 state.libraryConnected = !!m.connected;
 if (m.connected) Object.assign(state.libraryAuto, {busy: false, needsUser: false, failed: false});
 render();
 if (m.connected) { if (!was) toast('图书馆已连接'); loadLibrary({quiet: true}); }
}

let saveQueue = Promise.resolve();
function save() {
 // nextReminder：Windows 关闭窗口时据此提示“还有签到提醒没发出”。
 const nextReminder = (state.reminders || []).find(r => r.at > Date.now())?.at || 0;
 const payload = JSON.parse(JSON.stringify({tasks: state.tasks, favorites: state.favorites, preferences: {...state.preferences, libraryId: state.libraryId, areaId: state.areaId}, nextReminder}));
 const saved = saveQueue.catch(() => {}).then(() => host('saveState', payload));
 saveQueue = saved;
 return saved;
}

/* ---------- 账号（Windows 支持两个独立账号） ---------- */
function account(id = state.activeAccountId) { return state.accounts.find(a => a.id === id) || {id, label: state.username || '我的账号', username: state.username}; }
function acceptAccounts(d) {
 if (!d) return;
 state.accounts = d.accounts || [];
 state.activeAccountId = d.activeAccountId || 'default';
 state.username = account().username || '';
 state.hasCredentials = !!account().hasCredentials;
}
async function selectAccount(id, add = false) {
 if (accountBusy || state.loading || leaving) { toast('当前操作完成后再切换账号'); return false; }
 accountBusy = true; state.loading = true; render();
 try {
  acceptAccounts(await host('accounts', add ? {action: 'add', label: '同伴账号'} : {action: 'switch', accountId: id}));
  Object.assign(state, {libraryConnected: false, teachingConnected: false, catalog: [], areas: [], info: null, seats: [], selection: [], records: [], recordsLoaded: false, current: [], currentError: '', error: '', teachingOptions: null, teachingHint: '', rooms: null, roomDay: null, areaId: '', profile: null, violations: null, statusAt: 0, statusError: '', statusLoading: false, currentAt: 0, knownCurrent: [], teachingAuto: {busy: false, tried: false, needsUser: false, error: ''}});
  pendingLeave = null; state.loading = false; render();
  if (add) accountDialog(); else await loadLibrary();
  return true;
 } catch (e) { state.loading = false; render(); toast(e.message); return false; }
 finally { accountBusy = false; }
}
async function addTasks(added) {
 if (creatingTasks) throw Error('正在保存计划，请稍候');
 C.validateTaskConflicts(state.tasks, added);
 creatingTasks = true;
 added.forEach(t => t.status = 'draft');
 state.tasks.push(...added);
 try { await save(); added.forEach(t => t.status = 'pending'); await save(); }
 catch (e) { for (const t of added) { t.status = 'cancelled'; t.message = '本机保存失败，任务未启用'; } await save().catch(() => {}); throw e; }
 finally { creatingTasks = false; }
}

/* ---------- 通用 ---------- */
function toast(text, undo) {
 const el = $('#toast');
 undoAction = undo || null;
 el.innerHTML = '<span>' + esc(text) + '</span>' + (undo ? '<button data-action="undo">撤销</button>' : '');
 el.classList.remove('hide');
 if (el.showPopover) try { if (el.matches(':popover-open')) el.hidePopover(); el.showPopover(); } catch (e) {}
 clearTimeout(toastTimer);
 toastTimer = setTimeout(hideToast, undo ? 6500 : 4000);
}
function hideToast() {
 const el = $('#toast');
 // 先淡出再隐藏；淡出途中又来了新提示就不隐藏
 if (motionOn() && !el.classList.contains('hide') && el.animate) { const text = el.innerHTML; el.animate([{opacity: 1}, {opacity: 0, transform: 'translate(-50%, 8px)'}], {duration: 160, easing: EASE.in}).finished.then(() => { if (el.innerHTML === text) hideToastNow(); }).catch(() => {}); return; }
 hideToastNow();
}
function hideToastNow() {
 const el = $('#toast');
 el.classList.add('hide');
 if (el.hidePopover) try { el.hidePopover(); } catch (e) {}
 undoAction = null;
}
function fail(e) {
 state.error = e.message || String(e);
 if (e.code === 'AUTH') {
  if (e.system === 'teaching') state.teachingConnected = false;
  else { state.libraryConnected = false; state.seats = []; state.selection = []; state.info = null; state.current = []; }
 }
 if (teachingExpired(e)) return;
 render();
}
// 教务会话过期后，后台页面会被学校带回登录页：查询报“找不到查询页/非查询数据/登录过期”。这时清掉旧选项并在后台重新连接。
let lastExpiredReconnect = 0;
function teachingExpired(e) {
 if (e.system !== 'teaching' || !['AUTH', 'PAGE', 'PARSE'].includes(e.code) || !state.teachingOptions || Date.now() - lastExpiredReconnect < 120000) return false;
 lastExpiredReconnect = Date.now();
 Object.assign(state, {teachingOptions: null, teachingConnected: false, teachingHint: '', error: offlineData() ? '' : '教务登录已过期，正在重新连接…'});
 useOfflineRooms();
 state.teachingAuto.tried = false;
 render();
 setTimeout(() => { if (state.page === 'rooms') autoConnectTeaching(true, true).then(() => { if (state.teachingOptions && state.error.startsWith('教务登录已过期')) { state.error = ''; render(); } }); }, 0);
 return true;
}
function report(e) { haptic('reject'); if (teachingExpired(e)) return; if (e.code === 'AUTH') fail(e); toast(e.message || String(e)); }
async function busy(fn, {quiet = false, kind = 'library'} = {}) {
 // 同一种读取不并发；切换账号时什么都不读
 if (state.reading[kind] || state.reading.account) { if (!quiet) toast('正在读取学校数据，请稍候'); return; }
 state.reading[kind] = true; state.error = ''; render();
 try { return await fn(); } catch (e) { if (e.code !== 'STALE') fail(e); } finally { state.reading[kind] = false; render(); }
}
const opBusy = fn => busy(fn, {kind: 'op'});
// 每次读图书馆（换日期、进区域、返回区域列表）编一个号；读回来时号已经变了，说明人已经离开这次查询，结果丢掉，不把页面又拽回去。
let libraryEpoch = 0;
function checkLibraryRead(epoch) { if (epoch !== libraryEpoch) throw Object.assign(Error('已离开这次查询'), {code: 'STALE'}); }
const DTF = new Map(), dtf = (l, o) => { const k = l + JSON.stringify(o); let f = DTF.get(k); if (!f) { f = new Intl.DateTimeFormat(l, o); DTF.set(k, f); } return f; };
const dayFormat = dtf('sv-SE', {timeZone: 'Asia/Shanghai'});
function addDays(day, n) { return dayFormat.format(new Date(Date.parse(day + 'T12:00:00+08:00') + n * 86400000)); }
function md(day) { const m = String(day || '').match(/^\d{4}-(\d{2})-(\d{2})$/); return m ? Number(m[1]) + '/' + Number(m[2]) : String(day || ''); }
function dayName(day) { const t = C.nowChina(); return day === t ? '今天' : day === addDays(t, 1) ? '明天' : day === addDays(t, -1) ? '昨天' : md(day); }
function chinaWeekday() { return new Date(C.nowChina() + 'T12:00:00+08:00').getUTCDay() || 7; }
function chinaHour() { return Number(dtf('en-GB', {timeZone: 'Asia/Shanghai', hour: '2-digit', hour12: false}).format(new Date())) % 24; }
function nowStamp() { return new Date().toLocaleTimeString('en-GB', {timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit'}); }
// 时间到分钟；exact 时秒数不为 0 才带秒。
function fireText(iso, exact = false) {
 const d = new Date(iso);
 if (!Number.isFinite(d.getTime())) return '—';
 const t = d.toLocaleTimeString('en-GB', {timeZone: 'Asia/Shanghai', hour12: false});
 return dayName(dayFormat.format(d)) + ' ' + (exact && !t.endsWith(':00') ? t : t.slice(0, 5));
}
const periodText = C.periodText;
function options(items, val, key = 'id', label = 'name') { return (items || []).map(x => '<option value="' + esc(x[key]) + '"' + (same(x[key], val) ? ' selected' : '') + '>' + esc(x[label]) + '</option>').join(''); }
function summary(rows) { return '<dl class="summary">' + rows.map(([k, v]) => '<dt>' + k + '</dt><dd>' + v + '</dd>').join('') + '</dl>'; }
function pageHead(title, sub, actions = '', greet = '') { return '<header class="page-head' + (actions ? '' : ' bare') + '"><div>' + (greet ? '<span class="greet">' + greet + '</span>' : '') + '<h1>' + title + '</h1>' + (sub ? '<p class="muted">' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="actions">' + actions + '</div>' : '') + '</header>'; }
function toggleChip(key, label, on) { return '<button class="chip' + (on ? ' on' : '') + '" data-toggle="' + key + '" aria-pressed="' + !!on + '">' + (on ? I.check : '') + label + '</button>'; }
function timeText() {
 if (state.kind === 1) { const s = (state.info?.segments || []).find(x => same(x.id, state.segment)); return s ? s.label : '学校固定时段'; }
 return state.start && state.end ? state.start + '–' + state.end : '学校默认时段';
}
function shortName(name, n = 9) { const s = String(name || ''); return s.length > n + 1 ? s.slice(0, n) + '…' : s; }

/* ---------- 渲染 ---------- */
function navPages() { return NAV[state.platform] || ['library', 'rooms', 'tasks', 'me']; }
// 某端没有的页面换成对应页面：手机的“任务”在“我的”里，电脑没有入馆码。
function pageFor(page) { return navPages().includes(page) ? page : page === 'tasks' ? 'me' : 'library'; }
function motionOn() { return document.documentElement.dataset.motion !== 'off' && !matchMedia('(prefers-reduced-motion: reduce)').matches; }
// kind：forward / back（左右滑）或 fade（淡入淡出）。不支持或关了动画时直接执行。
// 内容区入场：淡入，电脑上再带一点左右滑动。安卓 WebView 里给内容区做横向平移时，固定在底部的导航栏会消失几帧（真机录屏确认），所以手机上只淡入。
function enter(el, dx = 0, ms = 220) {
 if (!el?.animate) return;
 const slide = dx && state.platform !== 'android';
 el.animate(slide ? [{opacity: 0, transform: 'translateX(' + dx + 'px)'}, {opacity: 1, transform: 'none'}] : [{opacity: 0}, {opacity: 1}], {duration: slide ? ms + 40 : ms, easing: EASE.out});
}
let vtSeq = 0;
function transition(kind, fn) {
 if (!motionOn() || document.hidden) { fn(); return; }
 // 手机上 View Transition 要先截整屏快照（高分屏 1440×3200 一帧卡 50～200ms），改成只给内容区播 Web Animations；切页的入场动画由 render 播。
 if (state.platform === 'android' || !document.startViewTransition) {
  fn();
  const dx = kind === 'forward' ? 28 : kind === 'back' ? -28 : 0;
  if (kind !== 'tab') enter($('#content'), dx);
  return;
 }
 const root = document.documentElement, my = ++vtSeq;
 root.dataset.vt = kind;
 vtActive = true;
 // 只收尾自己这一次：连点时上一次过渡被跳过，它的收尾不能把新一次的动画类型删掉。
 const done = () => { if (my === vtSeq) { vtActive = false; delete root.dataset.vt; } };
 let t, ran = false;
 const run = () => { if (!ran) { ran = true; fn(); } };
 try { t = document.startViewTransition(run); } catch (e) { done(); run(); return; }
 // 页面暂时不出帧（切到后台、窗口没焦点）时过渡会一直等着：0.3 秒还没开始就直接更新、取消动画，1 秒后无论如何收尾。
 setTimeout(() => { if (!ran) { t.skipTransition?.(); run(); } }, 300);
 setTimeout(done, 1000);
 // 被跳过（页面在后台、紧接着又有一次过渡）时 ready 会拒绝；更新本身照样执行。
 t.ready.catch(() => {});
 t.finished.catch(() => {}).finally(done);
}
// 原地换内容的轻动画：先登记要动的区块，下一次画完后播。dx 为 0 时淡入，正数从右边滑进、负数从左边。
let pendingSwap = null;
function swapNext(sel, dx = 0) { pendingSwap = {sel, dx}; }
function playSwap() {
 const p = pendingSwap; pendingSwap = null;
 if (!p || !motionOn()) return;
 for (const el of $$(p.sel)) enter(el, p.dx, 180);
}
let vtActive = false, seatsAppear = false, panelAppear = false, formAppear = false;
function render() {
 document.documentElement.dataset.platform = state.platform;
 state.page = pageFor(state.page);
 const pages = navPages();
 $$('.nav [data-page]').forEach(b => { const i = pages.indexOf(b.dataset.page); b.hidden = i < 0; b.style.order = String(i); b.setAttribute('aria-current', b.dataset.page === state.page ? 'page' : 'false'); });
 // 滑块在换内容之前就起步：这时底栏的排版还没被新页面弄脏，读位置不费事，和新页面同一帧开始动
 if (lastPage && lastPage !== state.page) movePill($('.nav'));
 $('#pageTitle').textContent = PAGES[state.page];
 const keep = lastPage === state.page, scroll = window.scrollY, active = document.activeElement, focusId = active?.id, caret = active?.type === 'search' ? active.selectionStart : null, stripKey = x => (x.closest('[id]')?.id || '') + '|' + x.className, strips = keep ? new Map($$('#content .chip-row.scroll').map(x => [stripKey(x), x.scrollLeft])) : new Map();
 const views = {library: libraryView, rooms: roomsView, tasks: tasksView, pass: passView, exams: examsView, me: meView};
 const content = $('#content');
 content.innerHTML = errorBanner() + views[state.page]();
 if (NW && NaiwaTheme.normalize(state.preferences.mascotTheme) === 'naiwa') {
  const compact = state.page === 'library' && !!state.info || state.page === 'rooms' && !!state.rooms;
  const decoration = state.page === 'library' && !compact ? petUI?.home() || '' : state.page === 'rooms' ? NaiwaTheme.intro(state.page, compact) : '';
  content.querySelector('.page-head')?.insertAdjacentHTML('afterend', decoration);
 }
 if (state.recordsLoaded && state.records !== lastRecords) { lastRecords = state.records; setTimeout(checkMilestones, 0); }
 content.setAttribute('aria-busy', String(state.loading || state.roomLoading));
 $('#progress').hidden = !(state.loading || state.roomLoading);
 updateAccountChip();
 updateTaskBadge();
 if (!keep) {
  // 切页按底栏顺序左右滑入，看得出是往哪边走。
  const from = pages.indexOf(lastPage), to = pages.indexOf(state.page);
  // 用 Web Animations 播入场动画：不需要先强制整页排版（原来的 offsetWidth 一次要十几毫秒）。
  if (!vtActive && motionOn()) enter(content, from < 0 || from === to ? 0 : from < to ? 28 : -28);
  window.scrollTo(0, 0);
 }
 else {
  window.scrollTo(0, scroll);
  $$('#content .chip-row.scroll').forEach(x => { const left = strips.get(stripKey(x)); if (left) x.scrollLeft = left; });
  const el = focusId && document.getElementById(focusId);
  if (el) { el.focus({preventScroll: true}); if (caret != null) try { el.setSelectionRange(caret, caret); } catch (e) {} }
 }
 lastPage = state.page;
 updateDock();
 playSwap();
 playTapMorph();
}
// 整页重画会把刚点的按钮换成新的，按钮上的颜色过渡播不出来：点之前记下它的颜色，重画后找到同一个按钮，从旧颜色过渡到新颜色并轻轻回弹
let tapMorph = null;
function morphKey(el) { const input = el.tagName === 'LABEL' && el.querySelector('input'); if (input) return 'LABEL|' + input.name + '=' + input.value; return el.tagName + '.' + (el.classList[0] || '') + '|' + [...el.attributes].filter(a => a.name.startsWith('data-') || a.name === 'id' || a.name === 'name' || a.name === 'value').map(a => a.name + '=' + a.value).sort().join('&'); }
document.addEventListener('click', e => {
 const el = e.target.closest?.('#content button, #content .chip, #content label, #dialog .seg > label');
 // 点 label 时浏览器还会给里面的单选框补一次点击，那时它已经选中了：不能拿它覆盖第一次记下的旧位置
 if (el && el.tagName === 'LABEL' && e.target !== el && e.target.matches('input')) return;
 if (!el || !motionOn()) { tapMorph = null; return; }
 // 一组里只能选一个的（分段选择、今天/明天、楼层、教学楼）：记下旧选中项的位置和样子，高亮从那里滑过来
 const cs = getComputedStyle(el), group = slideGroup(el), was = group.filter(slideOn), one = was.length === 1 && was[0] !== el ? was[0] : null;
 const of = one && getComputedStyle(slideFace(one));
 // 旧位置记成相对于这一组容器的坐标：整页重画后上面的卡片高度会变、页面会挪，用屏幕坐标的话高亮会从别处飞来
 tapMorph = {el, key: morphKey(el), at: Date.now(), top: el.getBoundingClientRect().top, prev: one ? relBox(slideFace(one), el.parentElement) : null, look: of ? {background: of.backgroundColor, borderRadius: of.borderRadius, boxShadow: of.boxShadow} : null, from: {backgroundColor: cs.backgroundColor, color: cs.color}};
 // 下一帧再看一次：没被重画的（设置里的分段选择是原生单选框）直接滑；被局部重画换掉的（空教室结果、选座面板、弹窗）在新按钮上接着播
 const m = tapMorph; requestAnimationFrame(() => { if (tapMorph !== m) return; if (m.el.isConnected) { tapMorph = null; slideFrom(m); } else playTapMorph(); });
}, true);
// 一组里只能选一个的按钮（今天/明天、楼层、设置里的分段选择等）：选中的高亮从旧选项滑到新选项，带一点回弹；能多选的不滑
function slideGroup(el) {
 const seg = el.closest('.seg');
 if (seg) return [...seg.querySelectorAll(':scope > label')];
 if (!el.parentElement || !el.classList.contains('chip')) return [];
 return [...el.parentElement.children].filter(x => x.tagName === el.tagName && x.classList.contains('chip'));
}
function slideOn(x) { return x.classList.contains('on') || x.getAttribute('aria-pressed') === 'true' || !!x.querySelector?.(':scope > input:checked'); }
function slideFace(x) { return x.matches('label') ? x.querySelector('span') || x : x; }
function slideFrom(m, elapsed = 0) {
 if (!m?.prev || elapsed >= LIQUID_MS - 40) return;
 const el = m.el.isConnected ? m.el : [...$$('#content ' + m.el.tagName.toLowerCase() + ', #dialog ' + m.el.tagName.toLowerCase())].find(x => morphKey(x) === m.key);
 if (!el || !slideOn(el)) return;
 const group = slideGroup(el);
 if (group.filter(slideOn).length !== 1) return;
 const face = slideFace(el), host = el.parentElement, cs = getComputedStyle(face), seg = !!el.closest('.seg');
 const to = relBox(face, host), from = m.prev;
 if (!to.w || Math.abs(to.x - from.x) + Math.abs(to.y - from.y) < 2) return;
 const ghost = document.createElement('i');
 ghost.className = 'slide-ghost';
 // 颜色取点击那一刻旧选中项的：新选中项身上的背景色过渡才刚开始，这时读到的还是透明
 Object.assign(ghost.style, m.look || {background: cs.backgroundColor, borderRadius: cs.borderRadius, boxShadow: cs.boxShadow});
 if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
 host.prepend(ghost);
 face.style.setProperty('background-color', 'transparent'); face.style.setProperty('box-shadow', 'none');
 // 和底栏滑块同一种动画；拉长时左右都不出这一组的容器
 const a = ghost.animate(liquidFrames(from, to, 0, seg ? host.clientWidth : host.scrollWidth), {duration: LIQUID_MS, easing: 'linear', fill: 'forwards'});
 if (elapsed) a.currentTime = elapsed;
 liveSlide = {m, ghost, start: performance.now() - elapsed};
 // 各自有底色的标签：高亮要从中间标签底下穿过，路过的标签底色临时淡掉、让它过去再恢复；原来选中的那个底色从透明慢慢回来
 if (!seg) {
  // 文字选中色跟着高亮一起到，不先亮
  if (m.from?.color && m.from.color !== cs.color) face.animate([{color: m.from.color}, {color: cs.color}], {duration: LIQUID_MS * .6, easing: 'ease-out'});
  const lo = Math.min(from.x, to.x), hi = Math.max(from.x + from.w, to.x + to.w);
  for (const c of group) {
   if (c === el) continue;
   const r = relBox(c, host), bg = getComputedStyle(c).backgroundColor;
   if (r.x + r.w <= lo || r.x >= hi) continue;
   const source = Math.abs(r.x - from.x) < 2;
   c.animate(source ? [{backgroundColor: 'transparent'}, {backgroundColor: 'transparent', offset: .3}, {backgroundColor: bg}] : [{backgroundColor: bg}, {backgroundColor: 'transparent', offset: .15}, {backgroundColor: 'transparent', offset: .55}, {backgroundColor: bg}], {duration: LIQUID_MS, easing: 'ease-out'});
  }
 }
 face.style.setProperty('transition', 'none');
 // 收尾时按钮自己的底色直接出现，不再从透明过渡一遍（否则影子一撤会闪一下）
 const done = () => { if (!ghost.isConnected) return; ghost.remove(); face.style.removeProperty('background-color'); face.style.removeProperty('box-shadow'); face.offsetWidth; face.style.removeProperty('transition'); };
 a.finished.then(done, done); setTimeout(done, LIQUID_MS + 200);
}
// 滑到一半页面又被重画（例如签到提醒：先在原控件上开滑，保存完设置再整页重画），影子会跟着旧控件一起被换掉：
// 每次重画后检查一遍，在新控件上从同一进度接着滑，不会半路消失或从别处飞来
let liveSlide = null;
// 元素在容器内容里的位置（含容器自身的横向滚动），影子就画在这个坐标系里
function relBox(x, host) { const r = x.getBoundingClientRect(), h = host.getBoundingClientRect(); return {x: r.left - h.left + host.scrollLeft - host.clientLeft, y: r.top - h.top + host.scrollTop - host.clientTop, w: r.width, h: r.height}; }
function resumeSlide() {
 const s = liveSlide;
 if (!s || s.ghost.isConnected) return;
 liveSlide = null;
 slideFrom(s.m, performance.now() - s.start);
}
function playTapMorph() {
 resumeSlide();
 const m = tapMorph;
 if (!m || Date.now() - m.at > 1500 || !motionOn()) return;
 if (m.el.isConnected) return; // 没被重画替换：按下回弹已经在原按钮上播了
 const tag = m.el.tagName.toLowerCase(), el = [...$$('#content ' + tag + ', #dialog ' + tag)].find(x => morphKey(x) === m.key);
 tapMorph = null;
 if (!el?.animate) return;
 keepInPlace(el, m.top);
 if (m.prev && slideOn(el) && slideGroup(el).filter(slideOn).length === 1) { slideFrom(m); pressRelease(el, m.at); return; }
 const fade = (x, from) => { const s = getComputedStyle(x), to = {backgroundColor: s.backgroundColor, color: s.color}; if (Object.keys(to).some(k => to[k] !== from[k])) x.animate([from, to], {duration: 240, easing: 'ease-out'}); };
 fade(el, m.from);
 pressRelease(el, m.at);
}
// 重画后刚点的按钮在屏幕上挪了位置（例如筛选后列表变短，页面不够长，浏览器只能把滚动位置往回夹）：
// 不让整页一下跳过去，从原来的位置平滑滑到新位置
function keepInPlace(el, top) {
 if (top == null || el.closest('dialog, .lib-side, .nav')) return;
 const dy = top - el.getBoundingClientRect().top;
 if (Math.abs(dy) > 2) $('#content').animate([{transform: 'translateY(' + dy + 'px)'}, {transform: 'none'}], {duration: Math.min(420, 240 + Math.abs(dy) / 3), easing: EASE.out});
}
// 按下反馈：安卓 WebView 的 :active 要等系统确认不是滑动才加上，快点一下几乎看不到。
// 改成手指一碰就缩小，松手时按弹簧弹回；点完整页重画换掉了按钮，就在新按钮上接着播完剩下的回弹
const PRESSABLE = '.btn, .chip, .seat, .icon-btn, .area-row, .room-main, .achv, .sel-chip, .account-chip, .seg > label, .swatch, .switch-row, .nav button';
let pressed = null, releasedAt = 0;
function pressRelease(el, at = releasedAt) {
 if (!el?.animate || !motionOn() || el.closest('.nav') && el.closest('.nav').classList.contains('dragging')) return;
 const face = el.matches('.seg > label, .swatch') ? el.querySelector('span') || el : el;
 const a = face.animate([{transform: 'scale(.94)'}, {transform: 'none'}], {duration: 360, easing: SPRING.press});
 a.currentTime = Math.min(340, Math.max(0, Date.now() - (at || Date.now())));
}
document.addEventListener('pointerdown', e => {
 if (e.button > 0 || !motionOn()) return;
 const el = e.target.closest?.(PRESSABLE);
 if (!el || el.disabled || el.matches(':disabled')) return;
 pressed = el; el.classList.add('pressing');
}, {passive: true});
function endPress(cancel) {
 const el = pressed; pressed = null;
 if (!el) return;
 el.classList.remove('pressing');
 releasedAt = Date.now();
 if (!cancel) pressRelease(el);
}
document.addEventListener('pointerup', () => endPress(false), {passive: true});
document.addEventListener('pointercancel', () => endPress(true), {passive: true});
// 第一次出现的卡片、提示：升起淡入一次；之后页面再重画不重复播
const shownOnce = new Set();
function firstShow(key) { if (shownOnce.has(key)) return ''; shownOnce.add(key); return ' first-show'; }
function errorBanner() { return state.error ? '<div class="banner error' + firstShow('error:' + state.error) + '" role="alert"><span>' + esc(state.error) + '</span><button class="icon-btn" data-action="dismissError" aria-label="关闭提示">' + I.close + '</button></div>' : ''; }
// 只对学校明确的异常状态（注销、挂失、临时禁止）提示，读不懂的状态码不报警。
function restricted() { return !!(state.libraryConnected && ['0', '2', '3'].includes(state.profile?.status)); }
function updateAccountChip() {
 const ok = state.libraryConnected, bad = restricted();
 $('#accountDot').classList.toggle('ok', ok && !bad);
 $('#accountDot').classList.toggle('err', bad);
 $('#accountChipText').textContent = state.supportsAccounts ? account().label : !ok ? '未登录' : bad ? state.profile.statusText || '状态异常' : state.profile?.name ? C.givenName(state.profile.name) : '已登录';
 $('#account').setAttribute('aria-label', '账号与登录，图书馆' + (ok ? '已连接' : '未登录') + (bad ? '，学校账号状态：' + (state.profile.statusText || '异常') : ''));
}
function updateTaskBadge() {
 const n = state.tasks.filter(t => C.active.includes(t.status)).length, text = n > 9 ? '9+' : String(n);
 // 手机的任务在“我的”里，角标跟着放到“我的”。
 const target = navPages().includes('tasks') ? 'tasks' : 'me';
 $$('.nav-badge').forEach(el => { const on = el.dataset.for === target && n > 0; el.hidden = !on; el.textContent = on ? text : ''; });
}
let dockNav = -1, dockAll = -1, pillAt = '';
// 弹簧：w 越大越快，z 越小回弹越明显。cubic-bezier 的“回弹”是前 1/4 时间冲完、剩下慢慢挪，看着像一下跳过去；
// 这里按真实弹簧算出位移曲线，写成 CSS linear() 缓动（安卓 WebView 113 起支持，旧的退回普通缓出）
function springAt(t, w, z) { const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + z * w / wd * Math.sin(wd * t)); }
const LINEAR_OK = (() => { try { return CSS.supports('transition-timing-function', 'linear(0, 1)'); } catch (e) { return false; } })();
function spring(w, z, ms) { if (!LINEAR_OK) return 'cubic-bezier(.2,.9,.3,1)'; const n = 40, pts = []; for (let i = 0; i <= n; i++) pts.push(+springAt(i / n * ms / 1000, w, z).toFixed(4)); pts[n] = 1; return 'linear(' + pts.join(',') + ')'; }
// 全部动画只用这几条曲线：进场缓出、退场缓入、弹簧（样式表里的 --spring 也由这里算好写进去）
const EASE = {out: 'cubic-bezier(.2,.8,.2,1)', in: 'cubic-bezier(.4,0,1,1)'};
const SPRING = {press: spring(34, .62, 360), sheet: spring(26, .78, 360)};
if (LINEAR_OK) document.documentElement.style.setProperty('--spring', SPRING.sheet);
// 悬浮底栏里选中项下面那块浅色滑块：前沿快、后沿慢，滑动时被拉长再收回，像一滴水滑过去（第一次只放到位，不播动画）
function movePill(navEl) {
 const cur = navEl?.querySelector('button[aria-current=page]');
 if (!cur || getComputedStyle(navEl).position !== 'fixed') return;
 let pill = navEl.querySelector('.nav-pill');
 if (!pill) { pill = document.createElement('i'); pill.className = 'nav-pill'; pill.setAttribute('aria-hidden', 'true'); navEl.prepend(pill); } pill.classList.toggle('on-pass', cur.dataset.page === 'pass');
 const x = cur.offsetLeft, w = cur.offsetWidth, at = x + ',' + w;
 if (at === pillAt) return;
 const prev = pillAt.split(',').map(Number); pillAt = at;
 pill.getAnimations().forEach(a => a.cancel());
 pill.style.width = w + 'px'; pill.style.transform = 'translateX(' + x + 'px)';
 if (prev.length !== 2 || !pill.classList.contains('ready') || !motionOn() || navEl.classList.contains('dragging')) { pill.classList.add('ready'); return; }
 // 回弹不能冲出底栏：左右沿限制在第一个、最后一个按钮的外沿以内，冲到边上时滑块被压扁一点再弹回
 const [px, pw] = prev, btns = [...navEl.querySelectorAll('button[data-page]')].filter(b => b.offsetWidth > 0), h = pill.offsetHeight;
 const frames = liquidFrames({x: px, y: 0, w: pw, h}, {x, y: 0, w, h}, Math.min(...btns.map(b => b.offsetLeft)), Math.max(...btns.map(b => b.offsetLeft + b.offsetWidth)));
 pill.animate(frames, {duration: LIQUID_MS, easing: 'linear'});
}
// 底栏滑块和各处选中高亮共用的位移：整块滑过去，只在跑得最快时顺着方向略微拉长（最多 20%），到位时带一点点回弹；左右沿不超出 [minL, maxR]
// （之前前后沿分开走，中途被拉成横跨两格的一大坨，收尾又慢慢挪 300ms，真机录屏看着发糊）
const LIQUID_MS = 360;
function liquidFrames(from, to, minL = -Infinity, maxR = Infinity) {
 const frames = [], n = 24, px = v => v.toFixed(1) + 'px', s = t => springAt(t, 32, .78), dt = .004;
 let vmax = 0; const v = []; for (let i = 0; i <= n; i++) { const t = i / n * LIQUID_MS / 1000, d = (s(t + dt) - s(t)) / dt; v.push(d); vmax = Math.max(vmax, d); }
 for (let i = 0; i <= n; i++) {
  const t = i / n * LIQUID_MS / 1000, k = s(t), w = from.w + (to.w - from.w) * k, c = from.x + from.w / 2 + (to.x + to.w / 2 - from.x - from.w / 2) * k;
  const sw = w * (1 + .2 * Math.max(0, v[i]) / (vmax || 1)), l = Math.max(minL, c - sw / 2), r = Math.min(maxR, c + sw / 2);
  frames.push({transform: 'translate(' + px(l) + ',' + px(from.y + (to.y - from.y) * k) + ')', width: px(Math.max(8, r - l)), height: px(from.h + (to.h - from.h) * k)});
 }
 frames[n] = {transform: 'translate(' + to.x + 'px,' + to.y + 'px)', width: to.w + 'px', height: to.h + 'px'};
 return frames;
}
function updateDock() {
 requestAnimationFrame(() => {
  // 底栏、已选面板现在是悬浮的：按它们顶边到屏幕底的距离算，内容底部留白和提示条位置都跟着它
  const height = el => { if (!el) return 0; const s = getComputedStyle(el); return s.position === 'fixed' && s.display !== 'none' ? Math.max(0, Math.round(innerHeight - el.getBoundingClientRect().top)) : 0; };
  const navEl = $('.nav'), nav = height(navEl), side = Math.max(0, height($('.lib-side')) - nav);
  movePill(navEl);
  // 高度没变就不写：每次重画后都写一遍会让整页样式再算一次
  if (nav !== dockNav) { dockNav = nav; document.documentElement.style.setProperty('--nav-h', nav + 'px'); }
  if (nav + side !== dockAll) { dockAll = nav + side; document.documentElement.style.setProperty('--dock-h', dockAll + 'px'); }
 });
}

/* ---------- 图书馆 ---------- */
function quoteLine() { if (state.preferences.quotes === false) return ''; const [text, src] = C.dailyPick(QUOTES); return '<span class="quote">' + esc(text) + '<span class="src">' + esc(src) + '</span></span>'; }
function greetLine() { const n = state.profile?.name; return n ? esc(C.greeting(chinaHour()) + '，' + C.givenName(n)) : ''; }
function libraryView() {
 let h = pageHead('图书馆', quoteLine(), '', greetLine()) + accountPicker();
 if (!state.libraryConnected) return h + libraryLoginCard();
 h += restrictionBanner() + currentCards() + favoriteSeatsRow() + queryBar(!state.info);
 if (state.openingArea && !state.info) return h + seatSkeleton();
 if (!state.info) return h + areaList();
 return h + '<div class="lib"><div class="lib-main">' + seatCard() + '</div><aside class="lib-side" aria-label="已选座位">' + selectionPanel() + '</aside></div>';
}
function accountPicker() {
 if (!state.supportsAccounts) return '';
 return '<div class="account-switcher"><label class="muted small" for="activeAccount">当前账号</label><select id="activeAccount" aria-label="切换账号">' + options(state.accounts, state.activeAccountId, 'id', 'label') + '</select><span class="muted small">' + esc(account().username || '尚未登录') + '</span><button class="btn text push" data-action="manageAccounts">管理账号</button></div>';
}
function libraryLoginCard() {
 const a = state.libraryAuto;
 if (a.busy) return '<section class="card hero"><div class="hero-icon">' + I.library + '</div><h2>正在自动登录图书馆…</h2><p class="muted">使用已保存的账号，稍等几秒。</p><div class="loader" aria-hidden="true"><i></i></div></section>';
 if (a.failed && state.hasCredentials) return '<section class="card hero"><div class="hero-icon">' + I.library + '</div><h2>' + (a.needsUser ? '需要你完成一次验证' : '自动登录没有完成') + '</h2><p class="muted">' + (a.needsUser ? '学校要求验证码或短信，完成后自动返回。' : '网络或学校系统暂时不可用。') + '</p><button class="btn filled wide" data-action="loginLibrary">' + (a.needsUser ? '打开登录页' : '登录图书馆') + '</button><button class="btn text" data-action="account">修改已存账号</button></section>';
 return '<section class="card hero"><div class="hero-icon">' + I.library + '</div><h2>登录图书馆</h2><p class="muted">使用学校统一认证' + (state.hasCredentials ? '，自动填写已存密码' : '') + '。</p><button class="btn filled wide" data-action="loginLibrary">登录图书馆</button>' + (state.hasCredentials ? '' : '<button class="btn text" data-action="account">设置自动登录</button>') + '</section>';
}
function restrictionBanner() { return restricted() ? '<div class="banner error"><span>学校显示账号状态为“' + esc(state.profile.statusText || '异常') + '”，这段时间可能无法预约座位。</span><button class="btn text" data-page="me">查看</button></div>' : ''; }
// 暂离提交后一时没确认的座位先锁住，防止重复提交；学校显示已暂离、预约已不在、或过了 90 秒仍没暂离（多半没签退成功或已回座）就解锁。
const leaveLockAt = new Map();
function leaveLocked(r) { return (state.preferences.uncertainLeaveIds || []).includes(state.activeAccountId + ':' + String(r.id)); }
function currentCards() {
 if (state.currentError) return '<div class="banner warn"><span>当前预约读取失败：' + esc(state.currentError) + '</span><button class="btn text" data-action="refreshCurrent">重试</button></div>';
 return state.current.map(r => {
  const locked = leaveLocked(r), away = !!r.temporarilyAway, no = String(r.no || r.name || '');
  const status = locked ? '暂离确认中' : r.statusMsg || r.status_name || ('学校状态 ' + (r.status ?? '—'));
  const canLeave = r.canTemporaryLeave && !away && !locked, rec = C.matchRecord(state.records, r), canCancel = C.cancellableRecord(rec) && !away && !locked;
  const fresh = takeJustBooked(no);
  return '<section class="card current' + (fresh ? ' just-booked' : firstShow('cur:' + r.id)) + (opWorking(r.id, rec?.id) ? ' working' : '') + '"' + (opWorking(r.id, rec?.id) ? ' aria-busy="true"' : '') + '><div class="current-top"><span class="overline">当前预约</span><span class="badge ' + (away || locked ? 'warn' : 'ok') + '">' + esc(status) + '</span><button class="icon-btn" data-action="refreshCurrent" aria-label="刷新当前预约">' + I.refresh + '</button></div>'
   + '<h2>' + esc(r.nameMerge || r.areaName || '图书馆') + ' <span class="seat-no">' + esc(no) + (/^[A-Za-z]?\d+$/.test(no) ? ' 号' : '') + '</span></h2>'
   + (reservationSpan(r).text ? '<p class="muted small">' + esc(reservationSpan(r).text) + '</p>' : '')
   + (away ? '<p class="muted small">已暂离，请按学校规定时限回座签到</p>' : '')
   + ((seatVisitsText(no, r.nameMerge || r.areaName) || cheerLine()) ? '<p class="cheer">' + esc([seatVisitsText(no, r.nameMerge || r.areaName), cheerLine()].filter(Boolean).join(' · ')) + '</p>' : '')
   + '<div class="actions">' + (hasPass() ? '<button class="btn filled" data-action="openPass">' + I.qr + '入馆码</button>' : '') + (canLeave ? '<button class="btn tonal" data-leave="' + esc(r.id) + '">临时签退</button>' : '') + (/^\d+$/.test(String(r.area_id ?? r.areaId ?? '')) ? '<button class="btn text" data-seat-location="' + esc(r.id) + '">座位位置</button>' : '') + (r.canCheckout && !locked ? '<button class="btn text" data-checkout="' + esc(r.id) + '">结束使用</button>' : '') + (canCancel ? '<button class="btn text danger" data-cancel-booking="' + esc(rec.id) + '">取消预约</button>' : '') + '<button class="btn text" data-action="officialCurrent">学校页面</button></div>' + seatNotifyTip() + '</section>';
 }).join('') + upcomingCards();
}
// 学校记录里还没开始、可以取消的预约（例如明天的），当前预约里没有的才列出。
function upcomingCards() {
 const list = C.upcomingBookings(state.records, state.current).slice(0, 4);
 if (!list.length) return '';
 return '<section class="card list-card upcoming"><div class="list-head"><h2>待使用的预约</h2><span class="muted small">学校记录</span></div>' + list.map(r => '<div class="record' + (takeJustBooked(r.no ?? r.name ?? '') ? ' just-booked' : firstShow('up:' + r.id)) + (opWorking(r.id) ? ' working' : '') + '"><div><strong>' + esc((r.nameMerge || r.areaName || '图书馆') + ' ' + String(r.no ?? r.name ?? '')) + '</strong><span class="muted">' + esc(bookingTime(r)) + '</span></div><button class="btn tonal sm" data-cancel-booking="' + esc(r.id) + '">取消预约</button></div>').join('') + '</section>';
}
function bookingTime(r) { const t = C.reservationTimes(r); return t ? dayName(t.begin.day) + ' ' + t.begin.time + '–' + t.end.time : String(r.beginTime || ''); }
function seatNotifyTip() {
 const n = state.notify;
 if (state.platform !== 'android' || !n || n.allowed || state.preferences.seatNotify === false) return '';
 return '<div class="current-tip"><span>在通知栏和超级岛显示座位，点按出示入馆码</span><button class="btn filled sm" data-action="enableSeatNotify">开启</button><button class="icon-btn" data-action="dismissSeatNotify" aria-label="不再提示">' + I.close + '</button></div>';
}
// 学校当前预约的字段名不完全统一；读不到起止时间时不显示，不猜测。
// 出示入馆码、看当前预约时的一句话：只用真实记录和倒计时，每天固定一句。
function cheerLine() {
 if (!hasVisits()) return '';
 const s = stats(), c = state.preferences.countdown, left = c ? C.daysUntil(c.day) : null, lines = [];
 if (s.monthVisits) lines.push('本月第 ' + s.monthVisits + ' 次入馆');
 if (s.streak >= 2) lines.push('已连续入馆 ' + s.streak + ' 天');
 if (s.totalHours >= 1) lines.push('累计 ' + s.totalHours + ' 小时');
 if (left > 0) lines.push('离' + c.name + '还有 ' + left + ' 天');
 return lines.length ? C.dailyPick(lines) : '';
}
function seatVisitsText(no, area) { const n = C.seatVisits(visitLog(), no, area); return n >= 2 ? '在这里坐过 ' + n + ' 次' : ''; }
function reservationSpan(r) {
 const t = C.reservationTimes(r);
 if (!t) return {text: '', end: 0, day: ''};
 return {text: (t.begin.day === C.nowChina() ? '' : dayName(t.begin.day) + ' ') + t.begin.time + '–' + t.end.time, end: t.end.ms, day: t.begin.day};
}
function bookedTask() { return C.bookedTask(state.tasks, state.activeAccountId); }
function liveSeatPayload() {
 const r = state.current.find(x => !x.temporarilyAway) || state.current[0];
 if (!r) {
  const t = bookedTask();
  if (!t) return null;
  const no = String(t.bookedSeat.no), numbered = /^[A-Za-z]?\d+$/.test(no), end = Date.parse(t.day + 'T' + t.end + ':00+08:00');
  return {title: (t.areaName || '图书馆') + ' · ' + no + (numbered ? ' 号' : ''), text: '已预约 · ' + dayName(t.day) + ' ' + t.start + '–' + t.end, chip: numbered && no.length <= 5 ? no + '号' : no.length <= 7 ? no : '', endAt: Number.isFinite(end) ? end : 0, sub: '图书馆座位', area: t.areaName || '图书馆', seat: no};
 }
 const no = String(r.no || r.name || ''), numbered = /^[A-Za-z]?\d+$/.test(no), span = reservationSpan(r);
 const status = leaveLocked(r) ? '暂离确认中' : r.temporarilyAway ? '暂离中，请按时回座' : r.statusMsg || r.status_name || '已预约';
 const chip = numbered && no.length <= 5 ? no + '号' : no.length <= 7 ? no : '';
 return {title: (r.nameMerge || r.areaName || '图书馆') + ' · ' + no + (numbered ? ' 号' : ''), text: status + (span.text ? ' · ' + span.text : ''), chip, endAt: span.end || 0, sub: '图书馆座位', area: r.nameMerge || r.areaName || '图书馆', seat: no};
}
// 安卓：把当前预约同步到常驻通知（系统支持时显示在超级岛），内容不变时不重复发送。
function syncLiveSeat() {
 if (state.platform !== 'android') return;
 const payload = state.preferences.seatNotify !== false && state.notify?.allowed ? liveSeatPayload() : null, key = payload ? JSON.stringify(payload) : '';
 if (key === lastLive) return;
 lastLive = key;
 host('liveSeat', payload || {clear: true}).then(n => { if (n) state.notify = n; }).catch(() => { lastLive = ''; });
}
async function refreshNotify() { if (state.platform === 'android') state.notify = await host('notifyState').catch(() => state.notify); }
function onResume() {
 if (Date.now() - (state.preferences.opens?.at || 0) > 30 * 60000) countOpen();
 refreshNotify().then(() => { syncLiveSeat(); const d = $('#dialog'); if (d.open && d.dataset.kind === 'settings') settingsDialog(); else render(); });
 if (state.libraryConnected && !state.reading.current && Date.now() - state.currentAt > 60000) busy(refreshCurrent, {quiet: true, kind: 'current'});
 // 在座位页离开一会儿再回来：座位多半已经变了，超过 2 分钟就悄悄重读，已选的、还空着的留着
 if (state.page === 'library' && state.libraryConnected && state.areaId && state.info && !state.reading.library && Date.now() - (state.seatsAt || 0) > 120000) refreshAfterBooking({keep: true});
 if (state.page === 'rooms' && !onlineRooms()) autoConnectTeaching();
}
function haptic(kind) { if (state.platform === 'android' && state.preferences.haptics !== false) host('haptic', {kind}).catch(() => {}); }
function favoriteSeatsRow() {
 const list = state.favorites.filter(f => f.type === 'seat');
 if (!list.length) return '';
 return '<div class="fav-row"><span class="overline">常用座位</span><div class="chip-row scroll">' + quickTomorrowChip(list) + list.map(f => '<button class="chip fav" data-use-favorite="' + esc(f.key) + '">' + I.starOn + esc(f.no) + ' <span class="muted">' + esc(shortName(f.areaName)) + '</span></button>').join('') + '<button class="chip" data-action="manageFavorites">管理</button></div></div>';
}
// 一键约明天：用常用座位里第一个座位所在的区域，明天按学校默认时段，依次尝试这个区域里收藏的座位（最多 3 个）。
function quickTomorrowChip(list) {
 const tomorrow = addDays(C.nowChina(), 1);
 if (!state.libraryConnected || state.records.some(r => C.cancellableRecord(r) && C.reservationTimes(r)?.begin.day === tomorrow)) return '';
 return '<button class="chip quick" data-action="quickTomorrow">' + I.flag + '一键约明天 <span class="muted">' + esc(list.filter(f => same(f.areaId, list[0].areaId)).slice(0, 3).map(f => f.no).join(' / ')) + '</span></button>';
}
async function quickTomorrow() {
 const favs = state.favorites.filter(f => f.type === 'seat');
 if (!favs.length) return;
 if (state.reading.library) { toast('正在读取学校数据，请稍候'); return; }
 const area = String(favs[0].areaId), want = favs.filter(f => same(f.areaId, area)), tomorrow = addDays(C.nowChina(), 1);
 haptic('tick');
 state.day = tomorrow; state.selection = [];
 if (favs[0].libraryId) state.libraryId = String(favs[0].libraryId);
 await loadLibrary();
 if (!state.areas.some(a => same(a.id, area))) { toast('明天这个区域没有开放预约'); return; }
 await loadSeats(area, true);
 if (!state.info || state.day !== tomorrow || !same(state.areaId, area)) return;
 state.selection = want.map(f => state.seats.find(s => same(s.id, f.id) && s.available)).filter(Boolean).slice(0, 3);
 render();
 if (!state.selection.length) { haptic('reject'); toast('明天常用座位都已被约'); return; }
 if (state.kind === 1 && !state.segment) { toast('这个区域需要先选学校的固定时段'); return; }
 bookDialog();
}
function queryBar(withLibraries) {
 const today = C.nowChina(), tomorrow = addDays(today, 1);
 const day = (d, label) => '<button class="chip' + (state.day === d ? ' on' : '') + '" data-day="' + d + '" aria-pressed="' + (state.day === d) + '">' + label + ' <span class="muted">' + md(d) + '</span></button>';
 let h = '<div class="query-bar"><div class="chip-row" role="group" aria-label="使用日期">' + day(today, '今天') + day(tomorrow, '明天') + '</div>';
 if (withLibraries && state.catalog.length > 1) h += state.catalog.length <= 3
  ? '<div class="chip-row" role="group" aria-label="图书馆">' + state.catalog.map(l => '<button class="chip' + (same(l.id, state.libraryId) ? ' on' : '') + '" data-library="' + esc(l.id) + '" aria-pressed="' + same(l.id, state.libraryId) + '">' + esc(l.name) + '</button>').join('') + '</div>'
  : '<label class="field"><span class="label">图书馆</span><select id="libraryId">' + options(state.catalog, state.libraryId) + '</select></label>';
 return h + '</div>';
}
// “隐藏借还书”打开时（默认），图书馆区域里的“借还书业务”也不显示、不推荐。
function shownAreas() { return state.preferences.hideBorrow === false ? state.areas : state.areas.filter(a => !/借还书|借书|还书/.test(String(a.name || ''))); }
function areaList() {
 const areas = shownAreas();
 if (!areas.length && state.reading.library) return '<section class="card list-card" aria-busy="true"><div class="list-head"><h2>选择区域</h2></div>' + Array.from({length: 5}, () => '<div class="skel-row"><i class="skel w60"></i><i class="skel w30"></i></div>').join('') + '</section>';
 if (!areas.length) return '<section class="card"><div class="empty"><h3>没有可展示的区域</h3><p>学校没有返回阅览区域。</p><div class="actions center"><button class="btn tonal" data-action="refresh">刷新</button><button class="btn text" data-action="officialLibrary">学校页面</button></div></div></section>';
 const f = state.preferences.areaFilter, floors = C.areaFloors(areas), list = C.filterAreas(areas, {...f, query: state.areaQuery});
 const floorChip = (v, label) => '<button class="chip' + (f.floor === v ? ' on' : '') + '" data-area-floor="' + esc(v) + '" aria-pressed="' + (f.floor === v) + '">' + esc(label) + '</button>';
 const tools = '<div class="area-tools">' + (areas.length > 8 ? '<label class="search">' + I.search + '<input id="areaSearch" type="search" enterkeyhint="search" placeholder="搜索区域名称" value="' + esc(state.areaQuery) + '" aria-label="搜索区域"></label>' : '')
  + '<div class="chip-row scroll" role="group" aria-label="区域筛选">' + (floors.length > 1 ? floorChip('', '全部楼层') + floors.map(x => floorChip(x, x)).join('') + '<span class="chip-sep" aria-hidden="true"></span>' : '') + toggleChip('area:freeOnly', '有空座', f.freeOnly) + toggleChip('area:sort', '空座多优先', f.sort === 'free') + '</div></div>';
 const filtered = list.length !== areas.length;
 const fresh = lastAreasShown !== state.areas; lastAreasShown = state.areas;
 return tools + '<section class="card list-card area-list' + (fresh ? ' fresh' : '') + '"><div class="list-head"><h2>选择区域' + (filtered ? ' <span class="muted small">' + list.length + ' / ' + areas.length + '</span>' : '') + '</h2><button class="icon-btn" data-action="refresh" aria-label="刷新区域">' + I.refresh + '</button></div>'
  + (list.length ? list.map(areaRow).join('') : '<div class="empty"><p>没有符合筛选条件的区域</p><button class="btn tonal sm" data-action="clearAreaFilter">清除筛选</button></div>')
  + '<p class="muted small list-note">数据来自学校 · 更新于 ' + esc(state.updated) + '</p></section>';
}
function areaRow(a) {
 const free = Number(a.free), total = Number(a.total), known = a.free != null && Number.isFinite(free), full = known && free <= 0;
 const meta = [a.floor, Number.isFinite(total) && total > 0 ? '共 ' + total + ' 座' : ''].filter(Boolean).join(' · ');
 return '<button class="area-row' + (full ? ' full' : '') + '" data-area="' + esc(a.id) + '"><span class="area-main"><strong>' + esc(a.name) + '</strong>' + (meta ? '<span class="muted">' + esc(meta) + '</span>' : '') + (known && total > 0 ? '<progress max="' + total + '" value="' + Math.max(0, free) + '" aria-hidden="true"></progress>' : '') + '</span><span class="area-free"><b>' + (known ? free : '—') + '</b><small>' + (full ? '已满' : '空座') + '</small></span>' + I.chevron + '</button>';
}
function seatSkeleton() {
 const a = state.areas.find(x => same(x.id, state.openingArea));
 return '<section class="card seat-card" aria-busy="true"><div class="seat-head"><button class="icon-btn" data-action="backToAreas" aria-label="返回区域列表">' + I.back + '</button><div class="seat-title"><h2>' + esc(a?.name || '读取座位') + '</h2><p class="muted">正在读取座位…</p></div></div>'
  + '<i class="skel skel-bar"></i><div class="skel-tools"><i class="skel"></i><i class="skel"></i><i class="skel"></i></div><i class="skel skel-meta"></i>'
  + '<div class="seat-grid">' + Array.from({length: 25}, () => '<i class="skel seat-skel"></i>').join('') + '</div></section>';
}
function seatCard() {
 const f = state.preferences.seatFilter, free = state.seats.filter(s => s.available).length;
 const list = C.visibleSeats(state.seats, f, state.favorites, state.areaId);
 let h = '<section class="card seat-card' + (seatsAppear ? ' appear' : '') + '"><div class="seat-head"><button class="icon-btn" data-action="backToAreas" aria-label="返回区域列表">' + I.back + '</button><div class="seat-title"><h2>' + esc(state.info.name) + '</h2><p class="muted">' + esc(dayName(state.day)) + ' ' + esc(md(state.day)) + ' · ' + esc(timeText()) + '</p></div><button class="btn tonal sm" data-action="seatMap" title="在学校页面查看座位分布" aria-label="座位图">' + I.map + '<span class="wide-only">座位图</span></button><button class="icon-btn" data-action="randomSeat" aria-label="随机挑一个空座" title="从当前筛选的空座里随机挑一个">' + I.dice + '</button><button class="icon-btn" data-action="refresh" aria-label="刷新座位">' + I.refresh + '</button></div>';
 if (state.kind === 1) h += '<label class="field"><span class="label">学校固定时段</span><select id="segment"><option value="">请选择</option>' + options(state.info.segments || [], state.segment, 'id', 'label') + '</select></label>';
 h += '<div class="seat-tools"><label class="search">' + I.search + '<input id="seatSearch" type="search" enterkeyhint="search" placeholder="座位号" value="' + esc(f.query) + '" aria-label="搜索座位号"></label>' + toggleChip('freeOnly', '只看空座', f.freeOnly) + toggleChip('favoriteOnly', '只看收藏', f.favoriteOnly) + '</div>';
 // 这个区域没有空座：直接给出同一天空座最多的几个区域，点一下就过去，不用退回列表找。
 const others = free ? [] : shownAreas().filter(a => !same(a.id, state.areaId) && Number(a.free) > 0).sort((x, y) => Number(y.free) - Number(x.free)).slice(0, 3);
 if (others.length) h += '<div class="banner info full-hint"><span>这里没有空座，去空座多的区域：</span><div class="chip-row">' + others.map(a => '<button class="chip" data-area="' + esc(a.id) + '">' + esc(a.name) + ' · ' + esc(a.free) + ' 空</button>').join('') + '</div></div>';
 h += '<div class="seat-meta"><span class="badge ' + (free ? 'ok' : 'warn') + '">' + free + ' 个空座 / 共 ' + state.seats.length + '</span><span class="legend"><span><i></i>可约</span><span><i class="busy"></i>占用</span><span><i class="sel"></i>已选</span></span></div>';
 h += list.length ? '<div id="seatGrid" class="seat-grid">' + list.map(seatButton).join('') + '</div>' : '<div class="empty"><p>' + (state.seats.length ? '没有符合筛选条件的座位' : '学校没有返回座位') + '</p>' + (state.seats.length ? '<button class="btn tonal sm" data-action="clearSeatFilter">清除筛选</button>' : '') + '</div>';
 return h + '<p class="seat-foot muted">学校数据 · 更新于 ' + esc(state.updated) + ' · <button class="link" data-action="favoriteSeat">收藏占用中的座位</button></p></section>';
}
function seatButton(s) {
 const i = state.selection.findIndex(x => same(x.id, s.id)), fav = isFavorite('seat', seatItem(s));
 return '<button class="seat' + (i >= 0 ? ' sel' : '') + (fav ? ' fav' : '') + '" data-seat="' + esc(s.id) + '"' + (s.available ? '' : ' disabled') + ' aria-pressed="' + (i >= 0) + '" aria-label="' + esc(s.no) + ' 号座位，' + (s.available ? '可预约' : '不可预约') + (fav ? '，已收藏' : '') + '">' + esc(s.no) + (i >= 0 ? '<i class="order">' + (i + 1) + '</i>' : '') + '</button>';
}
function selectionPanel() {
 const sel = state.selection, n = sel.length, allFav = n > 0 && sel.every(s => isFavorite('seat', seatItem(s)));
 const chips = n ? sel.map((s, i) => '<button class="sel-chip" data-seat="' + esc(s.id) + '" aria-label="取消选择 ' + esc(s.no) + ' 号"' + (seatVisitsText(s.no, state.info?.name) ? ' title="' + esc(seatVisitsText(s.no, state.info?.name)) + '"' : '') + '><i>' + (i + 1) + '</i>' + esc(s.no) + (seatVisitsText(s.no, state.info?.name) ? '<small>' + esc(seatVisitsText(s.no, state.info?.name).replace('在这里坐过 ', '坐过 ')) + '</small>' : '') + I.close + '</button>').join('') : '<span class="muted">点选座位，最多 3 个，按顺序依次尝试</span>';
 return '<div class="sel-panel' + (n ? '' : ' empty') + (panelAppear ? ' appear' : '') + '"><h2 class="sel-title">已选座位</h2><div class="sel-row"><div class="sel-chips">' + chips + '</div>'
  + (n ? '<button class="icon-btn' + (allFav ? ' star-on' : '') + '" data-action="favoriteSelection" aria-pressed="' + allFav + '" aria-label="' + (allFav ? '取消收藏所选座位' : '收藏所选座位') + '">' + (allFav ? I.starOn : I.star) + '</button>' : '') + '</div>'
  + '<div class="sel-actions">'
  + '<button class="btn filled grow" data-action="book"' + (n ? '' : ' disabled') + '>立即预约</button></div></div>';
}
async function loadLibrary({quiet = false} = {}) {
 await busy(async () => {
  const epoch = ++libraryEpoch;
  const s = await api('status'); checkLibraryRead(epoch);
  state.libraryConnected = !!s.connected;
  if (!s.connected) { state.info = null; state.seats = []; state.selection = []; state.current = []; return; }
  // 刚恢复登录时学校偶尔先回一个空列表：空的话隔 1.5 秒再读一次，不让人一打开就看到“没有区域”。
  const again = async (read, empty) => { let v = await read(); checkLibraryRead(epoch); if (empty(v)) { await sleep(1500); checkLibraryRead(epoch); v = await read(); checkLibraryRead(epoch); } return v; };
  const d = await again(() => api('catalog', {day: state.day}), v => !(v?.libraries || []).length);
  state.catalog = d.libraries || [];
  if (!state.catalog.some(x => same(x.id, state.libraryId))) state.libraryId = state.catalog[0]?.id || '';
  state.areas = state.libraryId ? ((await again(() => api('areas', {libraryId: state.libraryId, day: state.day}), v => !(v?.areas || []).length)).areas || []) : [];
  checkLibraryRead(epoch); const keep = state.selection;
  state.info = null; state.seats = []; state.selection = [];
  // 区域一到就先显示（不等当前预约）；要回到上次的区域时等座位到了再画，免得先闪一下区域列表。座位和当前预约同时读，不排队。
  const reopen = state.areaId && state.areas.some(a => same(a.id, state.areaId));
  if (!reopen) state.areaId = '';
  if (!reopen) { state.updated = nowStamp(); render(); }
  await Promise.all([reopen ? fetchSeats(state.areaId, keep, epoch) : null, refreshCurrent()]);
  checkLibraryRead(epoch); state.updated = nowStamp();
  await save();
 }, {quiet});
 if (state.libraryConnected) loadAccountStatus();
}
async function fetchSeats(id, keep = [], epoch = libraryEpoch) {
 const d = await api('seats', {areaId: id, day: state.day, start: '', end: ''});
 checkLibraryRead(epoch); state.seatsAt = Date.now(); state.areaId = id; state.info = d; state.seats = d.seats || []; state.kind = d.kind; state.start = d.start; state.end = d.end;
 state.selection = keep.map(s => state.seats.find(x => same(x.id, s.id) && x.available)).filter(Boolean);
 const segments = d.segments || [];
 state.segment = segments.length === 1 ? String(segments[0].id) : segments.some(x => same(x.id, state.segment)) ? state.segment : '';
}
async function loadSeats(id, reset = false) {
 // 进新区域：马上换成座位页的骨架，座位到了再填上；当前预约在座位画出来之后再读。
 if (!state.reading.library && (!same(state.areaId, id) || !state.info)) { state.openingArea = id; state.info = null; haptic('tap'); transition('forward', render); }
 return busy(async () => {
  const opening = !same(state.areaId, id) || !state.info, keep = reset || opening ? [] : state.selection;
  const epoch = ++libraryEpoch;
  try { await fetchSeats(id, keep, epoch); } finally { state.openingArea = ''; }
  seatsAppear = opening; render(); seatsAppear = false;
  await refreshCurrent();
  state.updated = nowStamp();
  await save();
  if (opening) requestAnimationFrame(() => $('.seat-card')?.scrollIntoView({block: 'start'}));
 });
}
// 学校数据还在读时不让换日期、区域或选座：否则日期标签变了，座位却还是上一次读到的那天。
function libraryInputLocked() { if (!state.reading.library && !state.reading.account) return false; toast('数据读取完成后再切换日期或区域'); render(); return true; }
function backToAreas() { haptic('tick'); ++libraryEpoch; state.openingArea = ''; state.info = null; state.seats = []; state.selection = []; state.areaId = ''; transition('back', () => { render(); window.scrollTo(0, 0); }); save().catch(() => {}); }
async function changeDay(day) {
 if (libraryInputLocked()) return;
 if (!C.validDay(day) || day === state.day) { render(); return; }
 state.day = day; state.selection = [];
 await loadLibrary();
}
async function changeLibrary(id) {
 if (libraryInputLocked()) return;
 if (same(id, state.libraryId)) return;
 state.libraryId = id; state.areaId = ''; state.info = null; state.selection = [];
 await loadLibrary();
}
// 选座、取消选座只改动到的座位按钮和已选面板，不整页重画；页面结构对不上时退回整页重画
function patchSeats(ids, wasSelected = new Set()) {
 const side = $('.lib-side'), grid = $('#seatGrid');
 if (state.page !== 'library' || !side || !grid || $('#dialog').open) return false;
 for (const id of ids) {
  const el = grid.querySelector('.seat[data-seat="' + CSS.escape(String(id)) + '"]'), s = state.seats.find(x => same(x.id, id));
  if (el && s) el.outerHTML = seatButton(s);
 }
 side.innerHTML = selectionPanel();
 if (motionOn()) for (const id of ids) if (state.selection.some(x => same(x.id, id)) && !wasSelected.has(String(id))) side.querySelector('.sel-chip[data-seat="' + CSS.escape(String(id)) + '"]')?.animate([{transform: 'scale(.6)', opacity: 0}, {transform: 'none', opacity: 1}], {duration: 360, easing: SPRING.sheet});
 playTapMorph();
 updateDock();
 return true;
}
function toggleSeat(id) {
 if (libraryInputLocked()) return;
 const seat = state.seats.find(x => same(x.id, id));
 if (!seat?.available) return;
 const before = new Set(state.selection.map(x => String(x.id))), touched = new Set([...before, String(seat.id)]);
 const wasEmpty = !state.selection.length;
 const i = state.selection.findIndex(x => same(x.id, seat.id));
 if (i >= 0) state.selection.splice(i, 1);
 else if (state.selection.length < 3) state.selection.push(seat);
 else { toast('最多选择 3 个座位'); haptic('reject'); return; }
 haptic('tick');
 panelAppear = wasEmpty && state.selection.length > 0;
 for (const x of state.selection) touched.add(String(x.id));
 const panel = !state.selection.length && motionOn() && $('.sel-panel:not(.empty)');
 if (panel?.animate) { panel.querySelectorAll('.sel-chip').forEach(c => c.remove()); panel.animate([{transform: 'none', opacity: 1}, {transform: 'translateY(100%)', opacity: .4}], {duration: 170, easing: EASE.in, fill: 'forwards'}); const seatEl = $('.seat[data-seat="' + CSS.escape(String(seat.id)) + '"]'); seatEl?.classList.remove('sel'); seatEl?.querySelector('.order')?.remove(); seatEl?.setAttribute('aria-pressed', 'false'); setTimeout(() => { if (!state.selection.length && !patchSeats(touched, before)) render(); }, 170); return; }
 if (!patchSeats(touched, before)) render();
 panelAppear = false;
}
function baseTask() { return {accountId: state.activeAccountId, accountName: account().label, areaId: state.areaId, areaName: state.info?.name || '', day: state.day, start: state.start, end: state.end, kind: state.kind, segment: state.segment, seats: state.selection.map(x => ({id: x.id, no: x.no}))}; }
async function refreshCurrent() {
 try {
  // 当前预约和预约记录同时读。
  const [cur, rec] = await Promise.allSettled([api('current'), api('records')]);
  if (cur.status === 'rejected') throw cur.reason;
  state.current = cur.value;
  petUI?.observe(false);
  state.currentError = '';
  if (rec.status === 'fulfilled') setRecords(rec.value); else if (rec.reason?.code === 'AUTH') throw rec.reason;
  state.currentAt = Date.now();
  state.knownCurrent = state.current;
  syncLiveSeat();
  syncReminders();
  const locked = state.preferences.uncertainLeaveIds || [];
  state.preferences.uncertainLeaveIds = locked.filter(id => { if (!id.startsWith(state.activeAccountId + ':')) return true; const r = state.current.find(x => state.activeAccountId + ':' + String(x.id) === id); return !!r && !r.temporarilyAway && Date.now() - (leaveLockAt.get(id) || 0) < 90000; });
  if (locked.length !== state.preferences.uncertainLeaveIds.length) await save();
 } catch (e) { state.currentError = e.message; if (e.code === 'AUTH') throw e; }
}

/* ---------- 预约流程 ---------- */
// 弹窗打开时记下要约的内容：确认前座位列表在后台刷新、选择被清掉，提交的仍是弹窗里看到的那一份。
let pendingBooking = null, justBooked = null;
// 刚约到的座位在当前预约或待使用列表里第一次露面时高亮一次；结果弹窗还盖着时先不算，免得动画播在弹窗后面
function takeJustBooked(no) {
 const d = $('#dialog'), covered = d.open && !d.classList.contains('closing');
 const hit = !covered && justBooked && Date.now() < justBooked.until && justBooked.no && String(no) === justBooked.no;
 if (hit) justBooked = null;
 return hit;
}
function bookDialog() {
 if (libraryInputLocked() || !state.info || !state.selection.length) return;
 const t = baseTask();
 if (state.kind === 1 && !state.segment) { toast('请先选择学校固定时段'); return; }
 pendingBooking = structuredClone(t);
 // 那天已经有预约：先说清楚，学校通常同一时段只允许一个预约
 const today = C.nowChina(), sameDay = [...state.current, ...C.upcomingBookings(state.records, state.current)].filter(r => (C.reservationTimes(r, today)?.begin.day || '') === t.day);
 const clash = sameDay.length ? '<div class="banner warn small"><span>' + esc(dayName(t.day)) + '已有预约：' + sameDay.map(r => esc((r.nameMerge || r.areaName || '图书馆') + ' ' + (r.no || r.name || '') + ' 号')).join('、') + '。学校可能不允许重复预约，以学校结果为准。</span></div>' : '';
 showDialog('<h2>确认立即预约</h2>' + clash + summary([['区域', esc(t.areaName)], ['日期', esc(dayName(t.day) + ' ' + md(t.day))], ['时段', esc(timeText())], ['座位', t.seats.map(s => esc(s.no)).join(' → ')]]) + '<p class="muted small">按顺序尝试，约到一个即停止。' + (PUBLIC ? '仅限本人使用，请遵守《预约须知》，不得代约、转让或倒卖座位。' : '') + '</p><div class="dialog-actions"><button class="btn text" data-action="closeDialog">取消</button><button class="btn filled" data-action="confirmBook">确认预约</button></div>', 'book');
}
async function confirmBook() {
 if (creatingTasks || !pendingBooking || !$('#dialog').open || $('#dialog').dataset.kind !== 'book') return;
 lastBooking = structuredClone(pendingBooking);
 const t = C.validateTask({...pendingBooking, fireAt: new Date(Date.now() + 200).toISOString()});
 // 连点“确认预约”只算一次；按下就显示“正在提交”
 const button = $('#dialog [data-action=confirmBook]'); if (button) { button.disabled = true; button.textContent = '正在提交…'; }
 try { await addTasks([t]); } catch (e) { if (button?.isConnected) { button.disabled = false; button.textContent = '确认预约'; } throw e; }
 pendingBooking = null;
 state.bookingId = t.id;
 bookingDialog();
 updateTaskBadge();
 // 立即预约不用等下一次定时检查（原来要多等约 1 秒）
 setTimeout(() => { lastTick = 0; tick(); }, 220);
}
// 没约上时“再试一次”：同一区域、同一时段，只用现在还空着的那几个座位
let lastBooking = null;
async function retryBook() {
 const b = lastBooking;
 if (!b || !same(state.areaId, b.areaId) || state.day !== b.day) { closeDialog(); toast('请重新选座后预约'); return; }
 for (let i = 0; i < 20 && state.reading.library; i++) await sleep(250);
 const seats = b.seats.filter(s => state.seats.some(x => same(x.id, s.id) && x.available));
 if (!seats.length) { closeDialog(); haptic('reject'); toast('这几个座位已经没有空的了，换一个吧'); return; }
 pendingBooking = {...structuredClone(b), seats};
 $('#dialog').dataset.kind = 'book';
 await confirmBook();
}
function bookingDialog() {
 const t = state.tasks.find(x => x.id === state.bookingId);
 if (!t) return;
 const live = C.active.includes(t.status), ok = t.status === 'succeeded';
 let h;
 if (live) {
  const now = Math.max(1, {pending: 1, checking: 1, submitting: 2, verifying: 3}[t.status]);
  h = '<h2>正在预约…</h2><ol class="progress-steps">' + ['检查登录和已有预约', '提交预约', '确认结果'].map((s, i) => { const cls = i + 1 < now ? 'done' : i + 1 === now ? 'now' : ''; return '<li class="' + cls + '"><i>' + (cls === 'done' ? I.check : '') + '</i>' + s + '</li>'; }).join('') + '</ol><p class="muted small">' + esc(t.message) + '</p><div class="dialog-actions"><button class="btn text" data-action="closeDialog">在后台继续</button></div>';
 } else {
  h = '<h2>' + (ok ? '预约成功' : '没有完成预约') + '</h2>' + (ok ? seatNotifyTip() : '') + '<div class="result ' + (ok ? 'ok' : 'warn') + '">' + (ok ? I.ok : I.warn) + '<div><strong>' + (ok ? esc(t.areaName) + ' · ' + esc(t.bookedSeat?.no || '') + ' 号' : esc(STATUS[t.status] || t.status)) + '</strong><span>' + esc(t.message) + '</span></div></div><div class="dialog-actions">'
   + (ok ? (hasPass() ? '<button class="btn text" data-action="openPass">入馆码</button>' : '') + '<button class="btn filled" data-action="closeDialog">完成</button>' : (t.status === 'failed' && lastBooking ? '<button class="btn text" data-action="closeDialog">换个座位</button><button class="btn filled" data-action="retryBook">再试一次</button>' : (navPages().includes('tasks') ? '<button class="btn text" data-action="goTasks">查看任务</button>' : '') + '<button class="btn filled" data-action="closeDialog">知道了</button>')) + '</div>';
 }
 showDialog(h, 'booking');
}
function onTasksChanged() {
 notifyTaskOutcomes();
 updateTaskBadge();
 const t = state.bookingId && state.tasks.find(x => x.id === state.bookingId), d = $('#dialog');
 if (t) {
  const showing = d.open && d.dataset.kind === 'booking';
  if (showing) bookingDialog();
  if (!C.active.includes(t.status)) {
   state.bookingId = '';
   if (!showing) toast(t.status === 'succeeded' ? '预约成功：' + (t.bookedSeat?.no || '') + ' 号' : '预约没有完成：' + (STATUS[t.status] || t.status));
   haptic(t.status === 'succeeded' ? 'confirm' : 'reject');
   if (t.status === 'succeeded') {
    justBooked = {no: String(t.bookedSeat?.no || ''), until: Date.now() + 20000};
    state.selection = []; syncLiveSeat(); syncReminders(); refreshAfterBooking(); maybeThanks(2800);
    // 成了就收起结果弹窗，回到页面顶部看新预约。
    if (showing) setTimeout(() => { const dd = $('#dialog'); if (dd.open && dd.dataset.kind === 'booking' && !state.bookingId) { closeDialog(); render(); window.scrollTo({top: 0, behavior: 'smooth'}); } }, 1500);
   } else if (t.status === 'uncertain') laterRefresh(3000, 12000);
   // 没约上多半是座位被别人约走：重新读座位，被约走的从已选里去掉，还空着的留着
   else if (t.status === 'failed') refreshAfterBooking({keep: true});
  }
 }
 if (state.page === 'tasks' || state.page === 'me') render();
}
// Windows：任务从执行中变成结束时发系统通知（窗口在前台时由客户端跳过）。
function notifyTaskOutcomes() {
 for (const t of state.tasks) {
  const prev = lastStatus.get(t.id);
  lastStatus.set(t.id, t.status);
  if (!prev || prev === t.status || !C.active.includes(prev) || C.active.includes(t.status) || t.status === 'cancelled') continue;
  const who = state.supportsAccounts && t.accountName ? t.accountName + ' · ' : '';
  if (t.status === 'succeeded') { desktopNotify('约到了：' + (t.bookedSeat?.no || '') + ' 号', who + (t.areaName || '图书馆') + ' · ' + dayName(t.day) + ' ' + t.start + '–' + t.end, 'tasks'); syncReminders(); }
  else desktopNotify('预约' + (STATUS[t.status] || t.status), who + (t.areaName ? t.areaName + ' · ' : '') + (t.message || ''), 'tasks');
 }
}
function desktopNotify(title, text, page = '', force = false) {
 if (state.platform !== 'windows' || state.preferences.desktopNotify === false) return;
 host('notify', {title, text, page, force}).catch(() => {});
}
// 预约、取消、签退之后自动刷新：等界面手头的读取做完再刷，不会因为“正在读取”被跳过。
async function refreshAfterBooking({keep = false} = {}) {
 for (let i = 0; i < 60 && state.reading.library; i++) await sleep(250);
 await busy(async () => { if (state.areaId && state.info) await fetchSeats(state.areaId, keep ? state.selection : []); await refreshCurrent(); state.updated = nowStamp(); }, {quiet: true});
}
function laterRefresh(...delays) { for (const ms of delays.length ? delays : [3000]) setTimeout(() => { if (state.libraryConnected) refreshAfterBooking(); }, ms); }
// 提交后一时没在记录里看到的任务：之后每次读到学校记录都再核对一次，对上了就算约到。
function reconcileTasks() {
 let changed = false, found = false;
 const today = C.nowChina();
 for (const t of state.tasks) {
  if (t.status !== 'uncertain' || (t.accountId || 'default') !== state.activeAccountId || !Array.isArray(t.seats)) continue;
  const seat = t.seats.find(s => state.records.some(r => C.recordMatches(r, t, s, true)));
  if (seat) { t.bookedSeat = seat; t.status = 'succeeded'; t.message = t.day < today ? '核对到了：当时约上了' : '约到了，记得按时签到'; changed = found = true; }
  // 使用日期已过、学校记录也覆盖到那天，却始终没有这次预约：判定为没约上，不再一直“确认中”。
  else if (t.day < today && state.records.some(r => (C.reservationTimes(r)?.begin.day || '9999') <= t.day)) { t.status = 'failed'; t.message = '预约记录里没有这次预约，没约上'; changed = true; }
 }
 if (!changed) return;
 save().catch(() => {}); updateTaskBadge(); syncLiveSeat(); syncReminders();
 if (found) { toast('核对到了：已约到座位'); for (const t of state.tasks) if (t.status === 'succeeded' && ['约到了，记得按时签到', '核对到了：当时约上了'].includes(t.message) && lastStatus.get(t.id) === 'uncertain') { lastStatus.set(t.id, 'succeeded'); desktopNotify('约到了：' + (t.bookedSeat?.no || '') + ' 号', (t.areaName || '图书馆') + ' · ' + dayName(t.day) + ' ' + t.start + '–' + t.end, 'tasks'); } }
}

/* ---------- 任务 ---------- */
function tasksView() { return pageHead('预约任务', '') + tasksBody(); }
function tasksBody(embedded = false) {
 const byFire = (a, b) => Date.parse(a.fireAt) - Date.parse(b.fireAt);
 const active = state.tasks.filter(t => C.active.includes(t.status)).sort(byFire);
 const done = state.tasks.filter(t => !C.active.includes(t.status)).sort((a, b) => byFire(b, a));
 let h = '';
 if (!state.tasks.length) h += embedded ? '' : '<section class="card"><div class="empty"><h3>还没有预约任务</h3><p>' + '选好座位后点“立即预约”。' + '</p><button class="btn tonal" data-page="library">去选座</button></div></section>';
 else {
  // 嵌在“我的”里时，进行中的任务已经放在页面上方。
  if (!embedded) h += '<div class="section-head"><h2>待执行 · ' + active.length + '</h2></div>' + (active.length ? '<div class="tasks-grid">' + active.map(taskCard).join('') + '</div>' : '<p class="muted small list-note">没有待执行的任务</p>');
  if (done.length) h += '<div class="section-head"><h2>已结束 · ' + done.length + '</h2><button class="btn text" data-action="clearDone">清除</button></div><div class="tasks-grid">' + done.slice(0, 30).map(taskCard).join('') + '</div>';
 }
 return h + recordsSection();
}
function taskCard(t) {
 const live = C.active.includes(t.status), seats = (t.seats || []).map(s => esc(s.no)).join(' → ');
 const who = state.supportsAccounts ? esc(t.accountName || account(t.accountId || 'default').label) : '';
 return '<article class="card task"><div class="task-top"><span class="badge ' + (TONE[t.status] || '') + '">' + esc(STATUS[t.status] || t.status) + '</span><span class="muted small">' + who + '</span></div>'
  + '<h3>' + esc(t.areaName || '图书馆') + '</h3><p class="seats">' + seats + (t.bookedSeat && t.status === 'succeeded' ? ' <span class="badge ok">已约 ' + esc(t.bookedSeat.no) + '</span>' : '') + '</p>'
  + '<dl class="task-meta"><dt>使用</dt><dd>' + esc(dayName(t.day) + ' ' + md(t.day) + ' ' + t.start + '–' + t.end) + '</dd><dt>提交</dt><dd>' + esc(fireText(t.fireAt)) + '</dd>' + '</dl>'
  + '<p class="muted msg">' + esc(t.message || '') + '</p>'
  + '<div class="actions">' + (live ? '<button class="btn tonal sm" data-cancel="' + esc(t.id) + '">取消任务</button>' : '') + '<button class="btn text sm" data-task-records="' + esc(t.id) + '">预约记录</button></div></article>';
}
function recordsSection() {
 if (!state.libraryConnected) return '';
 // 取消、违约这类没去成的记录变淡，真正去过的更显眼。
 const rows = state.records.slice(0, 10).map(r => '<div class="record' + (C.NEGATIVE_STATUS.test(r.status_name || r.statusMsg || '') ? ' dim' : '') + '"><div><strong>' + esc((r.nameMerge || r.areaName || '图书馆') + ' ' + (r.no || '')) + '</strong><span class="muted">' + esc(bookingTime(r) || r.day || '') + '</span></div><span class="badge">' + esc(r.status_name || '—') + '</span></div>').join('');
 return '<div class="section-head"><h2>学校预约记录</h2><button class="btn text" data-action="records">' + (state.recordsLoaded ? '刷新' : '读取') + '</button></div><section class="card list-card">'
  + (rows || '<p class="muted small list-note">' + (state.recordsLoaded ? '学校没有返回预约记录。' : '点“读取”获取学校最近的预约记录。') + '</p>')
  + '<div class="list-note"><button class="btn text sm" data-action="officialRecords">查看全部记录</button></div></section>';
}
function setRecords(list) { state.records = Array.isArray(list) ? list : []; state.recordsLoaded = true; reconcileTasks(); mergeVisits(); if (petUI && Array.isArray(list)) { state.petRecordsAt = Date.now(); petUI.observe(true); } }
function visitLog(id = state.activeAccountId) { return (state.preferences.visitLog || {})[id] || []; }
function mergeVisits() {
 const id = state.activeAccountId, old = visitLog(id), merged = C.mergeVisitLog(old, state.records);
 if (JSON.stringify(merged) === JSON.stringify(old)) return;
 state.preferences.visitLog = {...(state.preferences.visitLog || {}), [id]: merged};
 save().catch(() => {});
}
async function loadRecords(quiet = false) { await busy(async () => { setRecords(await api('records')); }, {quiet, kind: 'records'}); }
async function cancelTask(id) {
 const t = state.tasks.find(x => x.id === id);
 if (!t || !C.active.includes(t.status)) { render(); return; }
 t.cancelRequested = true;
 if (['submitting', 'verifying'].includes(t.status)) toast('提交已开始，会先核对结果再停止');
 else { t.status = 'cancelled'; t.message = '已取消，本机不再执行'; }
 await save();
 render();
}
async function clearDone() {
 const removed = state.tasks.filter(t => !C.active.includes(t.status));
 if (!removed.length) return;
 // 调度器持有同一个数组，必须原地修改。
 state.tasks.splice(0, state.tasks.length, ...state.tasks.filter(t => C.active.includes(t.status)));
 await save();
 render();
 toast('已清除 ' + removed.length + ' 条已结束任务', async () => { for (const t of removed) if (!state.tasks.some(x => x.id === t.id)) state.tasks.push(t); await save(); render(); });
}

/* ---------- 空教室 ---------- */
// 离线空教室：每天第一次打开时在后台按节同步本校区今天起 7 天的空闲情况（覆盖上一份，约一两百 KB）。
// 没连上教务时，查询表单、结果、“看全天”照常可用，数据来自本机；超出这 7 天的日期按同一星期几的排课推算并标明。
const OFFLINE_KEY = 'qlu.roomOffline.v2', OFFLINE_DAYS = 7;
let lastRecords = null, statsMemo = {r: null, t: 0, v: null}, offlineMemo, roomSync = {busy: false, next: Date.now() + 8000, day: 0, of: 0};
// 学习足迹、一句话、日历、小结都按本机累积的入馆记录算，和成就用同一份（学校每次只给最近一些记录）。
function stats() { const log = visitLog(); if (statsMemo.r !== log || Date.now() - statsMemo.t > 60000) statsMemo = {r: log, t: Date.now(), v: C.libraryStats(log)}; return statsMemo.v; }
function hasVisits() { return state.recordsLoaded || visitLog().length > 0; }
function offlineData() {
 if (offlineMemo === undefined) { try { const v = JSON.parse(localStorage.getItem(OFFLINE_KEY) || 'null'); offlineMemo = v?.v === 1 && Array.isArray(v.rooms) && v.days && Object.keys(v.days).length ? v : null; } catch (e) { offlineMemo = null; } }
 return offlineMemo;
}
function saveOffline(v) { offlineMemo = v; try { localStorage.setItem(OFFLINE_KEY, JSON.stringify(v)); } catch (e) {} }
const onlineRooms = () => !!state.teachingOptions && !state.teachingOptions.offline;
function cacheTime(at) { const d = new Date(at); return dayName(dayFormat.format(d)) + ' ' + d.toLocaleTimeString('en-GB', {timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit'}); }
function offlineRange(d) { const days = Object.keys(d.days).sort(); return md(days[0]) + '–' + md(days[days.length - 1]); }
function offlineOptions(d) { return {offline: true, currentWeek: weekFixed(C.weekOf(C.nowChina(), d.base.week, d.base.day)), xnm: [{value: d.year, label: d.yearLabel, selected: true}], xqm: [{value: d.term, label: d.termLabel, selected: true}], xqh_id: [{value: d.campus, label: d.campusLabel, selected: true}], jxl_id: d.buildings || [], periods: d.periods.map(p => ({value: p, label: String(p), ...(d.periodInfo || []).find(x => x.value === p)}))}; }
function useOfflineRooms() { const d = offlineData(); if (state.teachingOptions || !d) return; state.teachingOptions = offlineOptions(d); if (!state.rooms) state.roomFormOpen = true; applyTeachingDefaults(); }
function offlineError(message) { return Object.assign(Error(message), {code: 'OFFLINE', system: 'teaching'}); }
async function offlineTeaching(method, p = {}) {
 const d = offlineData();
 if (method === 'status') return {connected: false};
 if (!d) throw offlineError('还没有离线数据，连上校园网后会自动下载');
 if (method === 'options') return offlineOptions(d);
 if (!same(p.year, d.year) || !same(p.term, d.term) || !same(p.campus, d.campus)) throw offlineError('离线数据只有' + d.campusLabel + '本学期的，其他校区或学期要连上校园网查');
 const r = C.offlineRooms(d, p);
 if (!r) throw offlineError('离线数据里没有这一天，连上校园网再查');
 return offlineResult(r);
}
// 这一天今天同步过：本机数据和联网查到的一样，直接用来回答查询、算“空到第几节”，不用等学校。
function localRooms(q) {
 const d = offlineData();
 if (!d || !same(q.year, d.year) || !same(q.term, d.term) || !same(q.campus, d.campus)) return null;
 const r = C.offlineRooms(d, q);
 return r && !r.approx && !r.anyBuilding && C.cacheAge(r.at).days === 0 ? r : null;
}
function syncedUntil(q) { return localRooms(q)?.until || null; }
function offlineResult(r, local = false) { return {total: r.rooms.length, page: 1, pageSize: Math.max(r.rooms.length, 1), rooms: r.rooms, until: r.until, offline: {date: r.date, source: r.source, approx: r.approx, at: r.at, anyBuilding: !!r.anyBuilding, local}}; }
// 不用联网就能给出的结果：离线模式下按本机数据算；联网时只用今天同步过的那一天。
function instantRooms(q) {
 if (!state.teachingOptions?.offline) { const r = localRooms(q); return r ? offlineResult(r, true) : null; }
 const d = offlineData();
 if (!d || !same(q.year, d.year) || !same(q.term, d.term) || !same(q.campus, d.campus)) return null;
 const r = C.offlineRooms(d, q);
 return r ? offlineResult(r) : null;
}
function offlineStatus() {
 const d = offlineData();
 if (roomSync.busy) return '正在更新 · 第 ' + roomSync.day + ' / ' + roomSync.of + ' 天';
 if (!d) return '还没有离线数据，连上校园网后会自动下载。';
 let kb = 0;
 try { kb = Math.max(1, Math.round((localStorage.getItem(OFFLINE_KEY) || '').length / 1024)); } catch (e) {}
 return d.campusLabel + ' · ' + offlineRange(d) + ' · ' + cacheTime(d.at) + ' 更新 · 约 ' + kb + ' KB';
}
function syncProgress() { const el = $('.sync-note'), s = $('#offlineStatus'); if (el) { if (roomSync.busy) el.textContent = '正在更新离线数据 · 第 ' + roomSync.day + ' / ' + roomSync.of + ' 天'; else el.remove(); } if (s) s.textContent = offlineStatus(); }
function syncNote() { return roomSync.busy ? '<p class="muted small sync-note">正在更新离线数据 · 第 ' + roomSync.day + ' / ' + roomSync.of + ' 天</p>' : ''; }
function offlineCard() {
 const d = offlineData(), a = state.teachingAuto, age = C.cacheAge(d.at);
 return '<div id="offlineBox"><section class="card offline-card"><div><strong>离线模式</strong><span class="muted small">' + esc(d.campusLabel + ' · ' + offlineRange(d) + ' · ' + cacheTime(d.at) + ' 更新') + '</span></div>'
  + (a.busy ? '<span class="muted small">正在连接…</span>' : '<button class="btn tonal sm" data-action="' + (a.needsUser ? 'showTeachingLogin' : 'autoTeaching') + '">' + (a.needsUser ? '登录教务' : '连接教务') + '</button>') + '</section>'
  + (age.stale ? '<div class="banner warn"><span>离线数据已经 ' + age.days + ' 天没更新，排课或借用可能有变化。</span></div>' : '') + '</div>';
}
// 后台连接教务时只更新顶部的连接状态，不重画整页（不打断正在看的结果和正在填的条件）。
function roomsChrome() {
 if (state.page !== 'rooms') return;
 const box = $('#offlineBox');
 if (box && state.teachingOptions?.offline) box.outerHTML = offlineCard(); else render();
}
// 按节同步：每天每节一次请求（超过 500 间再翻页），请求之间留间隔；界面正在读学校数据时让路。每同步完一天就存一次。
async function syncOfflineRooms(force = false) {
 const today = C.nowChina(), old = offlineData(), o = state.teachingOptions, cw = o?.currentWeek, q = {...state.preferences.roomQuery};
 // 今天已同步过、且就是当前查询的学年学期校区，才不用再下；换了校区当天就按新校区下。
 if (roomSync.busy || !onlineRooms() || state.preferences.roomOffline === false || !force && syncedFor(old, q, today) || !q.year || q.campus == null || !o.currentWeek) return false;
 const periods = roomPeriods(), label = (list, v) => (list || []).find(x => same(x.value, v))?.label || '';
 const keep = old && same(old.year, q.year) && same(old.term, q.term) && same(old.campus, q.campus) && old.periods.join() === periods.join();
 const data = keep ? {...old, days: {...old.days}, rooms: old.rooms.slice()} : {v: 1, year: q.year, term: q.term, campus: q.campus, rooms: [], days: {}};
 Object.assign(data, {periodInfo: (o.periods || []).filter(p => periods.includes(Number(p.value)) && p.time).map(p => ({value: Number(p.value), time: p.time, part: p.part || ''})), yearLabel: label(o.xnm, q.year), termLabel: label(o.xqm, q.term), campusLabel: label(o.xqh_id, q.campus), buildings: (o.jxl_id || []).map(({value, label}) => ({value, label})), periods, base: {day: today, week: cw}});
 for (const k of Object.keys(data.days)) if (k < today) delete data.days[k];
 const index = new Map(data.rooms.map((r, i) => [String(r[0]), i]));
 Object.assign(roomSync, {busy: true, day: 0, of: OFFLINE_DAYS});
 syncProgress();
 let ok = true;
 try {
  for (let i = 0; i < OFFLINE_DAYS; i++) {
   const date = addDays(today, i), week = C.weekOf(date, cw, today), weekday = new Date(date + 'T12:00:00+08:00').getUTCDay() || 7, states = new Map();
   // 上次中途断了：今天已经下好的天直接跳过，接着往后下。
   if (keep && !force && old.days[date] && C.cacheAge(old.days[date].at).days === 0) { roomSync.day = i + 1; syncProgress(); continue; }
   for (const p of periods) {
    for (let page = 1; page <= 6; page++) {
     while (state.loading || state.roomLoading || state.roomDay?.loading) await sleep(500);
     if (!onlineRooms()) throw Error('教务已断开');
     await sleep(400);
     let r;
     for (let k = 0; ; k++) { try { r = await onlineTeaching('rooms', {year: q.year, term: q.term, campus: q.campus, building: '', week, weekday, periods: [p], page, pageSize: 500}); break; } catch (e) { if (k || e.code === 'AUTH') throw e; await sleep(2000); } }
     for (const x of r.rooms || []) {
      const id = String(x.id);
      if (x.campus) data.campusName = x.campus;
      if (!index.has(id)) { index.set(id, data.rooms.length); data.rooms.push([x.id, x.name, x.building || '', x.capacity || '']); }
      if (!states.has(id)) states.set(id, {});
      states.get(id)[p] = x.reserved ? '2' : '1';
     }
     if (page * (Number(r.pageSize) || 500) >= (Number(r.total) || 0)) break;
    }
   }
   data.days[date] = {week, weekday, at: Date.now(), s: C.packRoomDay(data.rooms, periods, states)};
   data.at = Date.now();
   // 下载途中改了周次：这份是按旧周次下的，停下且不保存。
   if (Number(state.teachingOptions?.currentWeek) !== Number(cw)) throw Error('周次已改');
   if (keep || !old) saveOffline(data);
   roomSync.day = i + 1;
   syncProgress();
  }
  data.synced = today;
  saveOffline(data);
 } catch (e) {
  ok = false;
  // 下到一半连不上了：几分钟后再接着下；手头有本机数据就先切过去，免得接下来的查询再等学校超时。
  if (['NETWORK', 'TIMEOUT'].includes(e.code)) roomSync.next = Math.min(roomSync.next, Date.now() + 5 * 60000);
  if (['NETWORK', 'TIMEOUT', 'AUTH', 'PAGE', 'PARSE'].includes(e.code) && onlineRooms() && offlineData()) { state.teachingOptions = null; state.teachingConnected = false; useOfflineRooms(); if (state.page === 'rooms' && !state.roomLoading) render(); }
 }
 finally { roomSync.busy = false; syncProgress(); }
 // 没下完：同一份数据续下的，已下好的天已存；换了校区、学期的新数据没下完不会替换原来那份。
 return ok || (keep || !old ? 'partial' : false);
}
// 后台连接教务（不占用界面的加载状态），连上后由 acceptTeachingOptions 接着同步。
// 学校要验证码、或已存的密码不对时（needsUser）不在后台反复提交密码；没连上就隔 3 小时再自动试，手动“连接教务”不受影响。
async function backgroundTeaching({fresh = false, manual = false} = {}) {
 if (onlineRooms()) return true;
 if (teachingConnecting || state.teachingAuto.busy || state.teachingAuto.needsUser || !['android', 'windows'].includes(state.platform)) return false;
 const accountId = state.activeAccountId, ok = await (async () => {
  try {
   const r = await host('connectTeaching', {accountId, fresh});
   if (r?.needsUser && accountId === state.activeAccountId) { state.teachingAuto.needsUser = true; roomsChrome(); }
   if (!r?.connected) return false;
   for (let i = 0; i < 3; i++) {
    if (i) await sleep(1500);
    if (onlineRooms()) return true;
    if (accountId !== state.activeAccountId) return false;
    try { await loadTeachingOptions(); if (state.page === 'rooms') render(); return true; } catch (e) { if (e.code !== 'PAGE') return false; }
   }
  } catch (e) {}
  return false;
 })();
 if (!ok && !manual) roomSync.next = Math.max(roomSync.next, Date.now() + 3 * 3600000);
 return ok;
}
function syncedFor(d, q, day) { return d?.synced === day && same(d.year, q.year) && same(d.term, q.term) && same(d.campus, q.campus); }
function maybeDailyRoomSync() {
 if (!window.CampusRuntimeReady || roomSync.busy || state.preferences.roomOffline === false || Date.now() < roomSync.next || syncedFor(offlineData(), state.preferences.roomQuery || {}, C.nowChina())) return;
 roomSync.next = Date.now() + 30 * 60000;
 if (onlineRooms()) syncOfflineRooms(); else backgroundTeaching();
}
function roomsView() {
 const h = pageHead('空教室', '', '<button class="btn text" data-action="officialTeaching">学生教务页</button>');
 useOfflineRooms();
 if (!state.teachingOptions) return h + teachingConnectCard();
 autoShowRooms();
 return h + (state.teachingOptions.offline ? offlineCard() : syncNote()) + roomFinder() + favoriteRoomsRow() + (state.rooms && !state.roomFormOpen ? roomSummary() : roomForm()) + (state.rooms ? roomResults() : '');
}
// 打开空教室页就有结果：本机数据能回答上次的条件（周次、星期按今天）时直接列出来，不用先点“查询”；要问学校的不自动查。每次启动只做一次。
let roomAutoShown = false;
function chinaMinutes() { const [h, m] = dtf('en-GB', {timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false}).format(new Date()).split(':').map(Number); return (h % 24) * 60 + m; }
// 今天已经上完的节次没必要查：条件是今天、所选节次都已结束时，换成接下来那一段（上午/下午/晚上）还没结束的节次。
function upcomingPeriods(q) {
 const o = state.teachingOptions, list = (o?.periods || []).filter(p => p.time), end = p => { const m = String(p.time).match(/-(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : -1; };
 if (!list.length || !q?.periods?.length || C.weekDate(q.week, q.weekday, o.currentWeek) !== C.nowChina()) return null;
 const now = chinaMinutes(), chosen = list.filter(p => q.periods.map(Number).includes(Number(p.value)));
 if (!chosen.length || chosen.some(p => end(p) > now)) return null;
 const next = list.find(p => end(p) > now);
 return next ? list.filter(p => (p.part || '') === (next.part || '') && Number(p.value) >= Number(next.value)).map(p => Number(p.value)) : null;
}
function autoShowRooms() {
 if (state.rooms || roomAutoShown) return;
 roomAutoShown = true;
 const up = upcomingPeriods(state.preferences.roomQuery);
 if (up?.length) state.preferences.roomQuery = {...state.preferences.roomQuery, periods: up};
 const q = state.preferences.roomQuery, hit = q?.periods?.length && instantRooms(q);
 if (hit) Object.assign(state, {rooms: hit, roomQuery: structuredClone(q), updated: nowStamp(), roomFormOpen: false, roomBuilding: '', roomLimit: ROOM_PAGE, roomsStale: false});
}
function teachingConnectCard() {
 const a = state.teachingAuto;
 if (a.busy) return '<section class="card hero"><div class="hero-icon">' + I.room + '</div><h2>正在连接学生教务…</h2><p class="muted">一般 5–15 秒。</p><div class="loader" aria-hidden="true"><i></i></div></section>';
 if (state.teachingHint && state.teachingConnected) return '<section class="card hero"><div class="hero-icon">' + I.room + '</div><h2>还差一步</h2><p class="muted">' + esc(state.teachingHint) + '</p><button class="btn filled wide" data-action="officialTeaching">打开学生教务页</button><button class="btn text" data-action="teachingOptions">已打开，重新读取</button></section>';
 if (a.needsUser) return '<section class="card hero"><div class="hero-icon">' + I.room + '</div><h2>需要你完成一次验证</h2><p class="muted">学校要求' + (state.hasCredentials ? '验证码或短信' : '学号和密码') + '，完成后自动返回。</p><button class="btn filled wide" data-action="showTeachingLogin">打开登录页</button><button class="btn text" data-action="autoTeaching">重新自动连接</button>' + (state.hasCredentials ? '' : '<button class="btn text" data-action="account">保存密码，下次自动登录</button>') + '</section>';
 return '<section class="card hero"><div class="hero-icon">' + I.room + '</div><h2>连接学生教务</h2><p class="muted">' + esc(a.error || '用统一认证登录教务。连上过一次，以后没网也能查。') + '</p><button class="btn filled wide" data-action="autoTeaching">自动连接</button><button class="btn text" data-action="loginTeaching">在学校页面登录</button></section>';
}
function favoriteRoomsRow() {
 const list = state.favorites.filter(f => f.type === 'room');
 if (!list.length) return '<div id="roomFavs" hidden></div>';
 return '<div class="fav-row" id="roomFavs"><span class="overline">收藏的教室</span><div class="chip-row scroll">' + list.map(f => '<button class="chip fav" data-use-favorite="' + esc(f.key) + '">' + I.starOn + esc(f.name) + '</button>').join('') + '<button class="chip" data-action="manageFavorites">管理</button></div></div>';
}
function selectField(label, name, list, value) { return '<label class="field"><span class="label">' + label + '</span><select name="' + name + '">' + (list || []).map(x => '<option value="' + esc(x.value) + '"' + (same(x.value, value) ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') + '</select></label>'; }
function roomSummary() {
 const o = state.teachingOptions, q = state.roomQuery || {};
 const label = (list, v) => (list || []).find(x => same(x.value, v))?.label || '';
 const parts = [roomDateText(q).replace(/ · $/, ''), '第 ' + q.week + ' 周', '星期' + (WEEKDAYS[(q.weekday || 1) - 1] || ''), '第 ' + periodText(q.periods) + ' 节'].filter(Boolean);
 return '<section class="card query-summary"><div><strong>' + parts.map(x => '<span class="nw">' + esc(x) + '</span>').join(' · ') + '</strong><span class="muted small">' + esc([label(o.xqh_id, q.campus), label(o.jxl_id, q.building) || '全部教学楼'].filter(Boolean).join(' · ')) + '</span></div><button class="btn tonal sm" data-action="editRoomQuery">修改条件</button></section>';
}
// 周次 + 星期对应的日期，如“今天 10/21 · ”；算不出来时为空。
function roomDateText(q) { const date = C.weekDate(q.week, q.weekday || chinaWeekday(), state.teachingOptions?.currentWeek); return date ? (['今天', '明天', '昨天'].includes(dayName(date)) ? dayName(date) + ' ' + md(date) : md(date)) + ' · ' : ''; }
function roomDateLabel(q) { const t = roomDateText(q); return t ? '· ' + t.replace(/ · $/, '') : ''; }
function roomForm() {
 const o = state.teachingOptions, q = state.preferences.roomQuery || {}, today = chinaWeekday();
 const label = (list, v) => (list || []).find(x => same(x.value, v))?.label || '';
 const periods = o.periods?.length ? o.periods : Array.from({length: 12}, (_, i) => ({value: i + 1, label: String(i + 1)}));
 const chosen = (q.periods || []).map(Number);
 return '<form id="roomForm" class="card room-form' + (formAppear ? ' appear' : '') + '">'
  + '<details class="term-box"' + (state.termOpen ? ' open' : '') + '><summary><span>' + esc((label(o.xnm, q.year) + ' ' + label(o.xqm, q.term)).trim() || '学年学期') + '</span><span class="link">更改学期</span></summary><div class="grid2">' + selectField('学年', 'xnm', o.xnm, q.year) + selectField('学期', 'xqm', o.xqm, q.term) + '</div></details>'
  + '<div class="grid2">' + selectField('校区', 'xqh_id', o.xqh_id, q.campus) + selectField('教学楼', 'jxl_id', o.jxl_id, q.building) + '</div>'
  + '<div class="field"><span class="label">教学周</span><div class="stepper"><button type="button" class="icon-btn" data-week="-1" aria-label="上一周">' + I.minus + '</button><input name="week" type="number" inputmode="numeric" min="1" max="53" value="' + esc(q.week || o.currentWeek || 1) + '" required aria-label="教学周"><button type="button" class="icon-btn" data-week="1" aria-label="下一周">' + I.plus + '</button>'
  + (o.currentWeek ? '<button type="button" class="chip' + (Number(q.week) === Number(o.currentWeek) ? ' on' : '') + '" data-action="thisWeek">本周 · 第 ' + esc(o.currentWeek) + ' 周</button>' : '') + '</div></div>'
  + '<div class="field"><span class="label">星期 <span class="muted" id="roomDate">' + esc(roomDateLabel(q)) + '</span></span><div class="seg7" role="radiogroup" aria-label="星期">' + Array.from({length: 7}, (_, i) => '<label class="toggle"><input type="radio" name="weekday" value="' + (i + 1) + '"' + (Number(q.weekday || today) === i + 1 ? ' checked' : '') + '><span' + (today === i + 1 ? ' class="today" title="今天"' : '') + '>' + WEEKDAYS[i] + '</span></label>').join('') + '</div></div>'
  + '<div class="field"><div class="label-row"><span class="label">节次 · 所选节次都无课</span><button type="button" class="btn text" data-action="clearPeriods">清空</button></div>' + periodPresets(periods) + '<div class="periods">' + periods.map(p => '<label class="toggle"><input type="checkbox" name="period" value="' + esc(p.value) + '"' + (chosen.includes(Number(p.value)) ? ' checked' : '') + '><span>' + esc(p.label) + (p.time ? '<small>' + esc(String(p.time).split('-')[0]) + '</small>' : '') + '</span></label>').join('') + '</div></div>'
  + '<button class="btn filled wide' + (state.roomLoading ? ' busy' : '') + '" type="submit"' + (state.roomLoading ? ' disabled' : '') + '>' + I.search + '查询空教室</button></form>';
}
// 节次快捷选择：上午 1–4、下午 5–8、晚上 9 节以后，按学校实际返回的节次裁剪。
function periodPresets(periods) {
 const v = periods.map(p => Number(p.value)).filter(Number.isFinite), max = Math.max(...v);
 const range = (a, b) => v.some(x => x >= a && x <= b) ? a + '–' + Math.min(b, max) : '';
 const items = [['am', '上午', range(1, 4)], ['pm', '下午', range(5, 8)], ['eve', '晚上', max >= 9 ? range(9, 99) : ''], ['all', '全天', '']].filter(x => x[0] === 'all' || x[2]);
 return '<div class="chip-row presets">' + items.map(([k, l, r]) => '<button type="button" class="chip" data-period-preset="' + k + '">' + l + (r ? ' <span class="muted">' + r + '</span>' : '') + '</button>').join('') + '</div>';
}
function applyPeriodPreset(kind) {
 const boxes = $$('#roomForm [name="period"]'), want = {am: v => v >= 1 && v <= 4, pm: v => v >= 5 && v <= 8, eve: v => v >= 9, all: () => true}[kind];
 if (!boxes.length || !want) return;
 boxes.forEach(b => { b.checked = want(Number(b.value)); });
 $('#roomForm').dispatchEvent(new Event('change', {bubbles: true}));
}
const ROOM_PAGE = 60;
let lastRoomsShown = null, lastAreasShown = null;
function renderRoomResults() {
 const el = $('#roomResults');
 if (state.page !== 'rooms' || !el && state.rooms) return render();
 if (!el) return;
 const strip = el.querySelector('.room-filter')?.scrollLeft || 0;
 if (!state.rooms) { el.remove(); return; }
 el.outerHTML = roomResults();
 if (strip) { const f = $('#roomResults .room-filter'); if (f) f.scrollLeft = strip; }
 playSwap(); playTapMorph();
}
function roomResults() {
 const r = state.rooms, q = state.roomQuery || {}, buildings = [...new Set(r.rooms.map(x => x.building).filter(Boolean))];
 if (state.roomBuilding && !buildings.includes(state.roomBuilding)) state.roomBuilding = '';
 let list = r.rooms.filter(x => (!state.roomFavoritesOnly || isFavorite('room', {...x, query: state.roomQuery})) && (!state.roomBuilding || x.building === state.roomBuilding));
 if (state.roomSort === 'cap') list = list.slice().sort((a, b) => (Number(b.capacity) || 0) - (Number(a.capacity) || 0));
 if (state.roomSort === 'long' && r.until) list = list.slice().sort((a, b) => (r.until.final[String(b.id)] ?? -1) - (r.until.final[String(a.id)] ?? -1));
 const bChip = (v, label) => '<button class="chip' + (state.roomBuilding === v ? ' on' : '') + '" data-room-building="' + esc(v) + '" aria-pressed="' + (state.roomBuilding === v) + '">' + esc(label) + '</button>';
 const filters = buildings.length > 1 || r.rooms.length > 8 ? '<div class="room-filter chip-row scroll">' + (buildings.length > 1 ? bChip('', '全部教学楼') + buildings.map(x => bChip(x, x)).join('') : '') + toggleChip('roomSort', '大教室优先', state.roomSort === 'cap') + (r.until ? toggleChip('roomLong', '空得久优先', state.roomSort === 'long') : '') + '</div>' : '';
 const shown = list.slice(0, state.roomLimit || ROOM_PAGE), more = list.length - shown.length, fresh = lastRoomsShown !== r;
 lastRoomsShown = r;
 return '<section id="roomResults" class="card list-card room-results' + (state.roomsStale ? ' stale' : '') + (fresh ? ' fresh' : '') + '"><div class="list-head"><h2>' + (state.roomFavoritesOnly ? '收藏中空闲 ' + list.length + ' 间' : state.roomBuilding ? esc(state.roomBuilding) + ' · ' + list.length + ' 间空闲' : '共 ' + esc(r.total) + ' 间空闲') + '</h2>' + toggleChip('roomFavoritesOnly', '只看收藏', state.roomFavoritesOnly) + '</div>' + filters
  + (state.roomsStale ? '<p class="small list-note stale-note">条件改了，点“查询空教室”更新结果</p>' : '<p class="muted small list-note">' + (state.roomFormOpen ? '第 ' + esc(q.week) + ' 周 · 星期' + (WEEKDAYS[(q.weekday || 1) - 1] || '') + ' · 第 ' + esc(periodText(q.periods)) + ' 节 · ' : '') + '查询于 ' + esc(state.updated) + (r.offline?.local ? ' · 本机数据，' + esc(cacheTime(r.offline.at)) + ' 同步' : '') + (r.until && !r.until.done && !r.until.error ? ' · 正在查后面几节…' : '') + '</p>')
  + (r.offline?.anyBuilding ? '<div class="banner warn"><span>本机数据里对不上这栋楼的名字，下面列出全部教学楼。</span></div>' : '')
  + (r.offline && !r.offline.local ? '<div class="banner ' + (r.offline.approx ? 'warn' : 'info') + '"><span>' + (r.offline.approx ? '离线数据没有 ' + esc(md(r.offline.date)) + '，按 ' + esc(md(r.offline.source)) + '（同为星期' + WEEKDAYS[(q.weekday || 1) - 1] + '）的排课推算，调课、考试和借用可能不同。' : '离线数据 · ' + esc(cacheTime(r.offline.at)) + ' 更新') + '</span></div>' : '')
  + shown.map(roomRow).join('')
  + (more > 0 ? '<button class="btn tonal wide more-rooms" data-action="moreRooms">再显示 ' + Math.min(more, ROOM_PAGE * 2) + ' 间（还有 ' + more + ' 间没显示）</button>' : '')
  + (list.length ? '' : '<div class="empty"><p>' + (state.roomFavoritesOnly ? '收藏的教室在这个时段不是空闲的' : state.roomBuilding ? '这栋楼在这个时段没有空闲教室' : '这个时段没有空闲教室') + '</p>' + (state.roomFavoritesOnly || state.roomBuilding ? '<button class="btn tonal sm" data-action="clearRoomFilter">看全部空教室</button>' : '') + '</div>')
  + pager() + '<p class="muted small list-note">无排课不代表教室开放或无人。</p></section>';
}
function roomRow(x) {
 const item = {...x, query: state.roomQuery}, on = isFavorite('room', item);
 return '<div class="room-row"><button class="room-main" data-room-open="' + esc(x.id) + '" aria-label="查看 ' + esc(x.name) + ' 当天各节占用"><strong>' + esc(x.name) + '</strong><span class="muted">' + esc([x.building, x.campus].filter(Boolean).join(' · ')) + ' · 看全天</span>' + (untilText(x) ? '<span class="until">' + esc(untilText(x)) + '</span>' : '') + '</button>' + (x.reserved ? '<span class="badge warn">已有借用</span>' : '') + '<span class="badge">' + esc(x.capacity || '—') + ' 座</span><button class="icon-btn' + (on ? ' star-on' : '') + '" data-star-type="room" data-star-id="' + esc(x.id) + '" aria-pressed="' + on + '" aria-label="' + (on ? '取消收藏 ' : '收藏 ') + esc(x.name) + '">' + (on ? I.starOn : I.star) + '</button></div>';
}
function pager() {
 const d = state.rooms, size = d?.pageSize || 100;
 if (!d || d.total <= size) return '';
 const page = d.page || 1;
 return '<div class="pager"><span class="muted small">第 ' + page + ' 页 · 本页 ' + d.rooms.length + ' 间</span><div class="actions"><button class="btn tonal sm" data-room-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>上一页</button><button class="btn tonal sm" data-room-page="' + (page + 1) + '"' + (page * size >= d.total ? ' disabled' : '') + '>下一页</button></div></div>';
}
// 查空教室后，在后台接着查所选节次之后的每一节，标出每间教室“空到第几节”。查询按顺序进行，换了条件就停。
async function queryRooms(q, {online = false} = {}) {
 const hit = !online && (!q.page || q.page === 1) && instantRooms(q);
 if (hit) return hit;
 const r = await teaching('rooms', {pageSize: 500, ...q});
 if (!r.until) { const u = syncedUntil(q); if (u) r.until = u; else setTimeout(() => annotateRoomsUntil(r, q), 0); }
 return r;
}
async function annotateRoomsUntil(r, q) {
 const all = roomPeriods(), last = Math.max(...(q.periods || []).map(Number)), later = all.filter(p => p > last);
 if (!r?.rooms?.length || !Number.isFinite(last)) return;
 const token = ++untilToken, alive = new Set(r.rooms.filter(x => !x.reserved).map(x => String(x.id))), final = {};
 r.until = {final, done: false, last: all[all.length - 1] ?? last};
 let reached = last;
 try {
  for (const p of later) {
   if (!alive.size) break;
   if (token !== untilToken || state.rooms !== r) { r.until.error = true; return; }
   const free = new Set();
   for (let page = 1; page <= 3; page++) {
    await sleep(300);
    if (token !== untilToken || state.rooms !== r) { r.until.error = true; return; }
    const res = await teaching('rooms', {...q, periods: [p], page, pageSize: 500});
    (res.rooms || []).filter(x => !x.reserved).forEach(x => free.add(String(x.id)));
    if (page * (res.pageSize || 500) >= (res.total || 0)) break;
   }
   for (const id of [...alive]) if (!free.has(id)) { final[id] = reached; alive.delete(id); }
   reached = p;
   if (token === untilToken && state.rooms === r) renderRoomResults();
  }
  for (const id of alive) final[id] = reached;
  r.until.done = true;
 } catch (e) { r.until.error = true; }
 if (token === untilToken && state.rooms === r) renderRoomResults();
}
function untilText(x) {
 const u = state.rooms?.until, n = u?.final[String(x.id)];
 if (!u || n == null) return '';
 return n >= u.last ? '一直空到最后一节' : '空到第 ' + n + ' 节';
}
async function roomPage(page) { await roomTask(async () => { state.rooms = await queryRooms({...state.roomQuery, page}, {online: true}); state.updated = nowStamp(); state.roomLimit = ROOM_PAGE; }); }
// 空教室自己的加载状态：不和图书馆的读取互相挡（不会再弹“正在读取学校数据”），也不整页重画两遍。
async function roomTask(fn) {
 if (state.roomLoading) return;
 state.roomLoading = true; roomBusyUi();
 try { return await fn(); } catch (e) { fail(e); } finally { state.roomLoading = false; render(); }
}
function roomBusyUi() { $('#progress').hidden = !(state.loading || state.roomLoading); const b = $('#roomForm [type=submit]'); if (b) { b.disabled = state.roomLoading; b.classList.toggle('busy', state.roomLoading); } }
// 查空教室：本机数据能回答的立刻出结果；要问学校时只在查询按钮上转圈。keep：刷新同一条件，保留楼栋筛选和展开的条数。
let roomQueryGen = 0;
async function runRoomQuery(query, {online = false, keep = false} = {}) {
 const q = structuredClone(query), gen = ++roomQueryGen;
 const apply = r => {
  if (gen !== roomQueryGen) { state.roomsStale = !!state.rooms; return; }
  state.rooms = r; state.roomQuery = structuredClone(q); state.updated = nowStamp(); state.roomsStale = false;
  if (!keep) { state.roomFormOpen = false; state.roomBuilding = ''; state.roomLimit = ROOM_PAGE; haptic(r.rooms?.length ? 'confirm' : 'reject'); }
 };
 const hit = !online && instantRooms(q);
 if (hit) { apply(hit); render(); return true; }
 return !!await roomTask(async () => { apply(await queryRooms(q, {online})); return true; });
}
// 改查询条件：只更新表单里的日期和“本周”，不重画整页；本机数据能回答时下面的结果立刻跟着变，否则把旧结果标成“条件已改”。
function roomFormChanged() {
 const q = state.preferences.roomQuery, o = state.teachingOptions || {};
 const date = $('#roomDate');
 if (date) date.textContent = roomDateLabel(q);
 $('#roomForm [data-action="thisWeek"]')?.classList.toggle('on', Number(q.week) === Number(o.currentWeek));
 if (!state.rooms) return;
 const hit = q.periods.length && q.week >= 1 && q.week <= 53 && instantRooms(q);
 roomQueryGen++;
 if (hit) { state.rooms = hit; state.roomQuery = structuredClone(q); state.updated = nowStamp(); state.roomsStale = false; state.roomLimit = ROOM_PAGE; }
 else state.roomsStale = true;
 renderRoomResults();
}
// 进入空教室时在后台自动连接教务：统一认证已登录时直接通过，否则用已存密码自动填写；要验证码时再请本人处理。
async function autoConnectTeaching(force = false, fresh = false) {
 const a = state.teachingAuto;
 if (onlineRooms() || a.busy || teachingConnecting || !force && a.tried || !['android', 'windows'].includes(state.platform)) return;
 Object.assign(a, {tried: true, busy: true, needsUser: false, error: ''});
 roomsChrome();
 let r = null;
 const accountId = state.activeAccountId;
 try { r = await host('connectTeaching', {accountId, fresh}); }
 catch (e) { if (e.code !== 'CLIENT') a.error = e.message; }
 a.busy = false;
 // 等待期间切换了账号：这份结果属于原账号，丢弃。
 if (accountId !== state.activeAccountId || state.teachingAuto !== a) return;
 if (r?.connected) { state.teachingConnected = true; if (!onlineRooms()) await connectTeaching(); else roomsChrome(); return; }
 if (r) { a.needsUser = !!r.needsUser; if (!r.needsUser) a.error = r.offline ? '连不上教务系统（可能在维护，或需要校园网 / VPN），稍后再试。' : '自动连接没有完成' + (r.page ? '（停在 ' + r.page + '）' : '') + '，可以重试，或在学校页面登录。'; }
 roomsChrome();
}
// 学校算的当前周不对时（开学推迟、调过周次），可以自己指定“本周是第几周”；记下指定的那天，之后按日期每周自动加一。
function weekFixed(week) { const f = state.preferences.weekFix; return f?.week && f.day ? C.weekOf(C.nowChina(), f.week, f.day) : week; }
function acceptTeachingOptions(o) {
 state.schoolWeek = o.currentWeek || null; o.currentWeek = weekFixed(o.currentWeek);
 // 本机数据的周次和现在的对不上（之前算错过、或中途改过周次）：作废，接着按现在的周次重下。
 const d = offlineData();
 if (d && o.currentWeek && C.weekOf(C.nowChina(), d.base.week, d.base.day) !== Number(o.currentWeek)) { try { localStorage.removeItem(OFFLINE_KEY); } catch (e) {} offlineMemo = null; if (state.rooms?.offline) state.roomsStale = true; }
 state.teachingOptions = o; applyTeachingDefaults(); state.teachingConnected = true; state.teachingHint = '';
 setTimeout(() => syncOfflineRooms(), 1500);
}
// 先从页面读选项，再带上次的学年、学期、校区向教务真的请求一次：只认页面还在不算连上（离开校园网时页面可能是旧的），教学楼也按这个校区取。
async function loadTeachingOptions() {
 let o = await onlineTeaching('options');
 const q = state.preferences.roomQuery || {}, has = (list, v) => (list || []).some(x => same(x.value, v));
 const p = has(o.xnm, q.year) && has(o.xqm, q.term) && has(o.xqh_id, q.campus) ? {year: q.year, term: q.term, campus: q.campus} : {year: o.xnm.find(x => x.selected)?.value ?? o.xnm[0]?.value, term: o.xqm.find(x => x.selected)?.value ?? o.xqm[0]?.value, campus: o.xqh_id?.find(x => x.selected)?.value ?? o.xqh_id?.[0]?.value ?? ''};
 // 断网、超时、登录失效、返回的不是数据（多半被带回了登录页）都算没连上；其它情况沿用页面上的选项。
 try { o = await onlineTeaching('options', p); } catch (e) { if (['NETWORK', 'TIMEOUT', 'AUTH', 'PARSE'].includes(e.code)) throw e; }
 acceptTeachingOptions(o);
}
// 教务页由学校脚本逐步加载：先探测是否真的打开了“空闲教室查询”，没就绪时重试几次，再给出下一步提示。
// 不占用全局的“正在读取”：连接期间图书馆和本机数据查询照常可用。
async function connectTeaching() {
 if (teachingConnecting) return;
 teachingConnecting = true;
 const before = state.teachingOptions, a = state.teachingAuto;
 a.busy = true; roomsChrome();
 try {
  await (async () => {
   let page = '', last = null;
   for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(1500);
    let status;
    try { status = await onlineTeaching('status'); } catch (e) { if (e.code === 'AUTH') throw e; last = e; continue; }
    page = status?.page || page;
    if (!status?.connected) { last = null; continue; }
    try { await loadTeachingOptions(); return; } catch (e) { last = e; if (e.code !== 'PAGE') throw e; }
   }
   state.teachingConnected = true;
   state.teachingHint = last ? last.message : '已登录教务，但助手没找到“空闲教室查询”页面' + (page ? '（当前停在 ' + page + '）' : '') + '。请在学生教务页打开“空闲教室查询”后返回。';
  })();
 } catch (e) { if (state.teachingOptions?.offline) a.error = e.message || String(e); else fail(e); }
 finally { teachingConnecting = false; a.busy = false; if (state.teachingOptions !== before) render(); else roomsChrome(); }
}
function applyTeachingDefaults() {
 const o = state.teachingOptions;
 if (!o) return;
 const q = state.preferences.roomQuery || {};
 // 每次启动后第一次读取选项时，教学周和星期回到“本周、今天”，其余条件沿用上次。
 if (!roomDefaultsApplied) { roomDefaultsApplied = true; if (o.currentWeek) q.week = o.currentWeek; q.weekday = chinaWeekday(); }
 if (!q.week) q.week = o.currentWeek || 1;
 if (!q.weekday) q.weekday = chinaWeekday();
 if (!Array.isArray(q.periods) || !q.periods.length) q.periods = [1, 2];
 for (const [key, id] of [['year', 'xnm'], ['term', 'xqm'], ['campus', 'xqh_id'], ['building', 'jxl_id']]) {
  const list = o[id] || [];
  if (!list.some(x => same(x.value, q[key]))) q[key] = list.find(x => x.selected)?.value ?? list[0]?.value ?? '';
 }
 state.preferences.roomQuery = q;
}
function roomQueryFromForm(form) { const fd = new FormData(form); return {year: fd.get('xnm'), term: fd.get('xqm'), campus: fd.get('xqh_id'), building: fd.get('jxl_id'), week: Number(fd.get('week')), weekday: Number(fd.get('weekday')), periods: fd.getAll('period').map(Number)}; }
function stepWeek(n) {
 const input = $('#roomForm [name="week"]');
 if (!input) return;
 input.value = String(Math.min(53, Math.max(1, (Number(input.value) || 1) + n)));
 input.dispatchEvent(new Event('change', {bubbles: true}));
}

// 查找教室：按名称看某天第几节空闲、第几节有课。
// 设置里显示的周次：本周第几周、来自教务还是自己设的。
function weekNote() { const w = state.teachingOptions?.currentWeek; return (w ? '本周是第 ' + w + ' 周 · ' : '') + (state.preferences.weekFix ? '自己设定，每周一自动加一' : '按教务系统') ; }
function weekDialog() {
 const o = state.teachingOptions || {}, f = state.preferences.weekFix;
 showDialog('<h2>本周是第几周</h2><p class="muted small">' + (state.schoolWeek ? '教务系统算的是第 ' + esc(state.schoolWeek) + ' 周。' : '') + '开学推迟或调过周次时在这里改，之后每周一自动加一。</p>'
  + '<form id="weekForm" class="week-form"><label class="field"><span class="label">本周是第</span><input id="weekFixInput" name="week" type="number" inputmode="numeric" min="1" max="30" required value="' + esc(o.currentWeek || '') + '"></label><span>周</span></form>'
  + '<div class="dialog-actions">' + (f ? '<button class="btn text" data-action="clearWeekFix">改回教务的周次</button>' : '') + '<button class="btn filled" type="submit" form="weekForm">保存</button></div>', 'week');
}
// 改周次：查询条件里原来是“本周”的跟着换；按旧周次下好的离线数据作废，联网时重新下载。
async function setWeekFix(week) {
 const o = state.teachingOptions, old = o?.currentWeek, today = C.nowChina();
 state.preferences.weekFix = week ? {day: today, week} : null;
 const now = week || (o?.offline ? null : state.schoolWeek) || old;
 if (o && now) o.currentWeek = now;
 const q = state.preferences.roomQuery;
 if (q && Number(q.week) === Number(old)) state.preferences.roomQuery = {...q, week: now};
 const d = offlineData();
 if (d && now && C.weekOf(today, d.base.week, d.base.day) !== Number(now)) { try { localStorage.removeItem(OFFLINE_KEY); } catch (e) {} offlineMemo = null; roomSync.next = 0; if (o?.offline) { state.teachingOptions = null; state.rooms = null; } }
 if (state.rooms && state.roomQuery && Number(state.roomQuery.week) === Number(old)) state.roomsStale = true;
 closeDialog(true); render(); save().catch(report);
 haptic('confirm');
 toast(week ? '已设为第 ' + week + ' 周，之后每周自动往后推' : '已改回教务的周次');
 if (onlineRooms()) setTimeout(() => syncOfflineRooms(), 500);
}
// 查找教室的默认日期：当前查询条件那一天（没有就今天）。选的日期和它一样就按查询条件看，不用推算周次。
function roomFindDefault() { const q = state.roomQuery || state.preferences.roomQuery || {}; return C.weekDate(q.week || state.teachingOptions?.currentWeek, q.weekday || chinaWeekday(), state.teachingOptions?.currentWeek) || C.nowChina(); }
function roomFinder() {
 return '<form id="roomFind" class="card room-find"><div class="find-row"><input id="roomFindInput" name="room" type="search" maxlength="30" placeholder="查找教室，如 301 或 3-301" value="' + esc(state.roomFind) + '" aria-label="教室名称" enterkeyhint="search" autocomplete="off"><button class="btn filled sm" type="submit">' + I.search + '查找</button></div>'
  + '<label class="room-date"><span>查看日期</span><input type="date" name="date" id="roomFindDate" value="' + esc(state.roomFindDate || roomFindDefault()) + '"></label></form>';
}
function roomPeriods() { const o = state.teachingOptions; return (o?.periods?.length ? o.periods : Array.from({length: 12}, (_, i) => ({value: i + 1, label: String(i + 1)}))).map(p => Number(p.value)); }
function openRoomDay({name, exactId = '', title = '', date = '', fromForm = false}) {
 const q = (fromForm ? state.preferences.roomQuery : state.roomQuery || state.preferences.roomQuery) || {}, o = state.teachingOptions || {};
 state.roomDay = {name, exactId, title: title || name, week: Number(q.week) || o.currentWeek || 1, weekday: Number(q.weekday) || chinaWeekday(), token: 0};
 // 指定了日期：按今天所在的教学周推算那天是第几周、星期几
 // 没连上教务时推算不了周次：选的就是默认那天照常看已保存的数据，选了别的日期才提示
 if (date && !Number(o.currentWeek)) { if (date !== roomFindDefault()) { toast('没连上教务，只能看已保存的那一天'); return; } date = ''; }
 if (date) {
  const delta = Math.round((Date.parse(date + 'T12:00:00+08:00') - Date.parse(C.nowChina() + 'T12:00:00+08:00')) / 86400000), wd = chinaWeekday(), week = Number(o.currentWeek) + Math.floor((wd - 1 + delta) / 7);
  if (!Number.isFinite(delta) || !(week >= 1 && week <= 53)) { toast('所选日期不在本学期查询范围'); return; }
  state.roomDay.week = week; state.roomDay.weekday = ((wd - 1 + delta) % 7 + 7) % 7 + 1;
 }
 haptic('tick');
 scanRoomDay();
}
const roomKey = s => String(s || '').toLowerCase().replace(/[\s\-_·.#（）()]/g, '');
// 逐节查询学校“空闲教室”：某节查得到这间教室就是空闲，查不到就是有课或被占用。一节一次请求，按顺序进行。
async function scanRoomDay() {
 const d = state.roomDay;
 if (!d) return;
 const token = ++d.token, periods = roomPeriods(), q = state.preferences.roomQuery || {}, found = new Map(), key = roomKey(d.name);
 const local = localRoomDay(d);
 if (local) {
  Object.assign(d, {loading: false, error: '', done: periods.length, total: periods.length, offline: {date: local.date, source: local.source, approx: local.approx, at: local.at, local: onlineRooms()}, rooms: local.rooms.sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh'))});
  haptic(d.rooms.some(x => Object.keys(x.states).length) ? 'confirm' : 'reject');
  roomDayDialog();
  return;
 }
 Object.assign(d, {loading: true, rooms: null, error: '', done: 0, total: periods.length, offline: null});
 roomDayDialog();
 try {
  for (const p of periods) {
   if (state.roomDay !== d || d.token !== token) return;
   // 弹窗关掉就停，不在后台继续查。
   if (d.done && !($('#dialog').open && $('#dialog').dataset.kind === 'roomDay')) return;
   if (d.done && onlineRooms()) await sleep(300);
   const r = await teaching('rooms', {year: q.year, term: q.term, campus: q.campus, building: '', week: d.week, weekday: d.weekday, periods: [p], name: d.name});
   d.offline = r.offline || null;
   for (const x of r.rooms || []) {
    if (d.exactId ? !same(x.id, d.exactId) : !roomKey(x.name).includes(key)) continue;
    const k = String(x.id);
    if (!found.has(k)) found.set(k, {...x, states: {}});
    found.get(k).states[p] = x.reserved ? 'borrowed' : 'free';
   }
   d.done++;
   if (state.roomDay === d && d.token === token) roomDayProgress();
  }
  d.rooms = [...found.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh'));
  haptic(d.rooms.length ? 'confirm' : 'reject');
 } catch (e) {
  if (state.roomDay !== d || d.token !== token) return;
  d.error = e.message || String(e); haptic('reject');
  if (teachingExpired(e)) closeDialog();
 } finally {
  if (state.roomDay === d && d.token === token) { d.loading = false; if ($('#dialog').open && $('#dialog').dataset.kind === 'roomDay') roomDayDialog(); }
 }
}
// 本机有这一天（离线模式下，或联网时今天同步过）就一次算出全天，不用逐节问学校。
function localRoomDay(d) {
 const data = offlineData(), q = state.preferences.roomQuery || {};
 if (!data || !same(q.year, data.year) || !same(q.term, data.term) || !same(q.campus, data.campus)) return null;
 const r = C.offlineRoomDay(data, d);
 return !r || onlineRooms() && (r.approx || C.cacheAge(r.at).days) ? null : r;
}
function roomDayProgress() { const el = $('#roomDayProgress'), d = state.roomDay; if (el && d) el.textContent = '正在逐节查询 ' + d.done + ' / ' + d.total + '…'; }
function roomDayDialog() {
 const d = state.roomDay, o = state.teachingOptions || {};
 if (!d) return;
 const date = C.weekDate(d.week, d.weekday, o.currentWeek), periods = roomPeriods(), off = '';
 const head = '<h2>' + esc(d.title) + '</h2><div class="day-nav"><button class="icon-btn" data-room-shift="-1" aria-label="前一天"' + (d.loading ? ' disabled' : off) + '>' + I.back + '</button><div><strong>' + (date ? esc(dayName(date)) + ' · ' : '') + '星期' + WEEKDAYS[d.weekday - 1] + '</strong><span class="muted small">第 ' + esc(d.week) + ' 周' + (date ? ' · ' + esc(md(date)) : '') + '</span></div><button class="icon-btn" data-room-shift="1" aria-label="后一天"' + (d.loading ? ' disabled' : off) + '>' + I.chevron + '</button></div>';
 let body;
 if (d.loading) body = '<div class="loader" aria-hidden="true"><i></i></div><p class="muted small center" id="roomDayProgress">正在逐节查询 ' + (d.done || 0) + ' / ' + (d.total || periods.length) + '…</p>';
 else if (d.error) body = '<div class="banner warn"><span>' + esc(d.error) + '</span><button class="btn text" data-room-shift="0">重试</button></div>';
 else if (!d.rooms?.length) body = '<div class="empty"><p>' + (d.offline ? '本机数据里没有找到“' + esc(d.name) + '”。' : '这一天每一节都没查到“' + esc(d.name) + '”空闲。') + '</p><p class="muted small">' + (d.offline ? '名称写法可能不同，试试只输房间号。' : '可能全天有课，或名称写法不同（试试只输房间号）。') + '</p></div>';
 else body = d.rooms.slice(0, 6).map(x => { const day = C.roomDay(periods, x.states); return '<div class="room-day"><div class="room-day-head"><strong>' + esc(x.name) + '</strong><span class="muted small">' + esc([x.building, x.capacity ? x.capacity + ' 座' : ''].filter(Boolean).join(' · ')) + '</span><span class="badge' + (day.freeCount ? ' ok' : '') + '">空闲 ' + day.freeCount + ' 节</span></div><div class="timeline" role="img" aria-label="' + esc(day.text) + '">' + periods.map(p => '<span class="slot ' + (x.states[p] || 'busy') + '">' + p + '</span>').join('') + '</div><p class="small">' + esc(day.text) + '</p></div>'; }).join('')
  + (d.rooms.length > 6 ? '<p class="muted small">还有 ' + (d.rooms.length - 6) + ' 间相近的教室，输入完整名称可缩小范围。</p>' : '');
 const legend = '<div class="legend"><span><i class="slot free"></i>空闲</span><span><i class="slot borrowed"></i>有借用</span><span><i class="slot busy"></i>有课或占用</span></div>';
 showDialog(head + (d.offline && !d.loading ? '<p class="muted small center">' + (d.offline.local ? '本机数据 · ' + esc(cacheTime(d.offline.at)) + ' 同步' : d.offline.approx ? '离线数据没有这一天，按 ' + esc(md(d.offline.source)) + ' 的排课推算' : '离线数据 · ' + esc(cacheTime(d.offline.at)) + ' 更新') + '</p>' : '') + body + (d.rooms?.length ? legend : '') + '<p class="muted small">“有课或占用”含排课、考试和借用，读不到课程名称。</p>', 'roomDay');
 playSwap();
}
function shiftRoomDay(n) {
 const d = state.roomDay;
 if (!d) return;
 if (n) {
  let wd = d.weekday + n, w = d.week;
  if (wd < 1) { wd = 7; w--; } else if (wd > 7) { wd = 1; w++; }
  if (w < 1 || w > 53) return;
  d.weekday = wd; d.week = w;
 }
 haptic('tick');
 scanRoomDay();
}

/* ---------- 我的：账号状态、违约记录、提醒、学习足迹、倒计时 ---------- */
function meView() {
 let h = pageHead('我的', quoteLine(), '', greetLine()) + (petUI ? '<section class="card pet-me-entry"><div class="card-head"><h2>我的学习搭子</h2>' + petUI.entry() + '</div><p class="muted small">去图书馆养奶蛙，慢慢布置自己的小屋。</p></section>' : '');
 const phone = state.platform === 'android', active = state.tasks.filter(t => C.active.includes(t.status));
 // 手机没有单独的任务页：进行中的任务放在上方，已结束的任务和学校记录放在最后。
 const running = phone && active.length ? '<div class="section-head"><h2>正在进行的预约 · ' + active.length + '</h2>' + (state.tasks.length > active.length ? '<button class="btn text" data-action="scrollTasks">已结束</button>' : '') + '</div>' + '<div class="tasks-grid">' + active.map(taskCard).join('') + '</div>' : '';
 const history = phone ? '<div id="meTasks"></div>' + tasksBody(true) : '';
 if (!state.libraryConnected) return h + libraryLoginCard() + running + achievementsCard() + reminderCard() + countdownCard() + history;
 return h + summaryBanner() + profileCard() + running + statsCard() + achievementsCard() + violationsCard() + reminderCard() + countdownCard() + history + donateCard();
}
// ---------- 打开 100 次的感谢：先回顾他自己的入馆数据，最后才顺带一句打赏；一辈子最多两次（100、300），随时可以不再提醒 ----------
function countOpen() {
 const o = state.preferences.opens || {};
 state.preferences.opens = {n: (Number(o.n) || 0) + 1, first: o.first || C.nowChina(), at: Date.now()};
 save().catch(() => {});
}
function thanksDue() {
 const o = state.preferences.opens || {}, t = state.preferences.thanks || {}, shown = t.shown || [];
 if (!PUBLIC || state.preferences.donateHidden || t.never || !o.first) return 0;
 const days = Math.round((Date.parse(C.nowChina() + 'T12:00:00+08:00') - Date.parse(o.first + 'T12:00:00+08:00')) / 86400000);
 if (days < 14) return 0;
 return [100, 300].find(n => o.n >= n && !shown.includes(n) && (n === 100 || shown.includes(100))) || 0;
}
// 只在顺心的时候弹：刚约到座位、或者在“我的”页闲着时；正在读取、开着别的弹窗、不在前台都不弹。
function maybeThanks(delay = 1200) {
 if (!thanksDue()) return;
 setTimeout(() => { const n = thanksDue(); if (n && !state.loading && !$('#dialog').open && !document.hidden && ['me', 'library'].includes(state.page)) thanksDialog(n); }, delay);
}
function thanksDialog(n) {
 const o = state.preferences.opens || {}, log = visitLog(), a = C.achievementStats(log), seats = {};
 for (const v of log) if (v[4]) { const k = (v[3] ? v[3] + ' ' : '') + v[4] + ' 号'; seats[k] = (seats[k] || 0) + 1; }
 const top = Object.entries(seats).sort((x, y) => y[1] - x[1])[0];
 const recap = a.days ? '陪你去了 <b>' + a.days + ' 天</b>图书馆，一共 <b>' + a.hours + ' 小时</b>' + (top && top[1] > 1 ? '，最常坐 <b>' + esc(top[0]) + '</b>' : '') + '。' : '谢谢你一直在用它。';
 const t = state.preferences.thanks || {};
 state.preferences.thanks = {...t, shown: [...new Set([...(t.shown || []), n])]};
 const all = state.preferences.badges || {}, id = state.activeAccountId;
 state.preferences.badges = {...all, [id]: {...(all[id] || {}), ['opens' + n]: (all[id] || {})['opens' + n] || C.nowChina()}};
 save().catch(() => {});
 haptic('confirm');
 showDialog('<div class="celebrate thanks"><div class="thanks-icon">🤝</div><p class="overline">新成就 · 老朋友</p><h2>这是你第 ' + esc(o.n) + ' 次打开工大学伴</h2><p>' + recap + '</p>'
  + '<p class="small muted">这个小工具是一个同学课余写的，没有广告，也不收集数据。如果它帮到了你，可以请作者喝杯奶茶 ☕（完全随意）</p>'
  + '<button class="thanks-qr" data-action="thanksZoom" aria-label="放大收款码"><img src="donate.png" alt="作者的微信收款码"></button>'
  + (state.platform === 'android' ? '<div class="actions center"><button class="btn tonal sm" data-action="saveDonate">保存收款码</button></div>' : '<p class="muted small center">用手机微信扫一扫</p>')
  + '<div class="dialog-actions"><button class="btn text" data-action="thanksNever">不再提醒</button><button class="btn tonal" data-action="thanksLater">下次再说</button></div></div>', 'thanks');
 confetti();
}
function donateCard() {
 if (!PUBLIC || state.preferences.donateHidden) return '';
 return '<section class="card donate"><div class="card-head"><h2>支持作者</h2><button class="btn text sm" data-action="hideDonate">收起</button></div>'
  + '<p class="small">工大学伴免费、没有广告。如果它帮到了你，可以自愿请作者喝杯奶茶；不支持也不影响任何功能。</p>'
  + '<img class="donate-qr" src="donate.png" alt="作者的微信收款码">'
  + (state.platform === 'android' ? '<div class="actions center"><button class="btn tonal sm" data-action="saveDonate">保存到相册</button></div><p class="muted small center">保存后在微信“扫一扫”里从相册选择这张图</p>' : '<p class="muted small center">用手机微信“扫一扫”即可</p>') + '</section>';
}
// 用户协议与隐私说明：首次打开（或条款更新后）必须同意才能使用；同意前不发起任何学校请求。
function legalHtml() { return LEGAL.sections.map(([h, list]) => '<h3>' + esc(h) + '</h3>' + list.map(t => '<p>' + esc(t) + '</p>').join('')).join(''); }
let consentResolve = null;
function askConsent() {
 return new Promise(resolve => {
  consentResolve = resolve;
  showDialog('<h2>用户协议与隐私说明</h2><p class="muted small">请先阅读。同意后才能使用，你可以随时在设置里查看或撤回。</p><div class="legal">' + legalHtml() + '<p class="muted small">版本 ' + esc(LEGAL.version) + ' · ' + esc(LEGAL.date || '') + '</p></div>'
   + '<label class="check"><input type="checkbox" id="consentCheck"><span>我已阅读并同意以上条款，确认只使用本人账号并遵守学校规定</span></label>'
   + '<div class="dialog-actions"><button class="btn text" data-action="declineConsent">不同意</button><button class="btn filled" data-action="acceptConsent" disabled id="consentAccept">同意并继续</button></div>', 'consent');
  $('#dialog .sheet-close')?.remove();
 });
}
function legalDialog() { showDialog('<h2>用户协议与隐私说明</h2><div class="legal">' + legalHtml() + '<p class="muted small">版本 ' + esc(LEGAL.version) + ' · ' + esc(LEGAL.date || '') + (state.preferences.consentAt ? ' · 你于 ' + esc(state.preferences.consentAt) + ' 同意' : '') + '</p></div><div class="dialog-actions"><button class="btn text danger" data-action="withdrawConsent">撤回同意并清除本机数据</button><button class="btn filled" data-action="closeDialog">好</button></div>', 'legal'); }
/* ---------- 考试安排 ---------- */
// 学生教务的“学生考试信息查询”（只读）。结果按学期存在本机，下次打开先显示上次查到的；考试时间、地点以学校教务系统公布为准。
const EXAM_FIELDS = [['ksmc', '考试名称'], ['kssj', '考试时间'], ['cdxqmc', '考场校区'], ['cdmc', '考场'], ['zwh', '座位号'], ['cdbh', '考场编号'], ['cdjc', '考场简称'], ['ksfs', '考试方式'], ['khfs', '考核方式'], ['kch', '课程号'], ['xf', '学分'], ['kkxy', '开课学院'], ['jsxx', '任课教师'], ['jxbmc', '教学班'], ['jxbzc', '教学班组成'], ['sksj', '上课时间'], ['jxdd', '上课地点'], ['xnmc', '学年'], ['xqmmc', '学期'], ['xqmc', '校区'], ['cxbj', '是否重修'], ['zxbj', '是否自修'], ['sjbh', '考试批次']];
const EXAM_HIDE = new Set(['kcmc', 'cdjc']);
let examBusy = false;
// 当前学期：教务查询页里选中的学年学期；没有时按日期推（8 月起是第一学期）。prev：上一学期。
function examTerm(prev = false) {
 const o = state.teachingOptions, pick = list => (list || []).find(x => x.selected)?.value;
 let year = Number(pick(o?.xnm)), term = String(pick(o?.xqm) || '');
 if (!year || !['3', '12'].includes(term)) { const [y, m] = C.nowChina().split('-').map(Number); year = m >= 8 ? y : y - 1; term = m >= 8 || m < 2 ? '3' : '12'; }
 if (prev) { if (term === '3') { year -= 1; term = '12'; } else term = '3'; }
 return {year: String(year), term};
}
function examTermLabel(t) { return t.year + '–' + (Number(t.year) + 1) + ' 第' + (t.term === '3' ? '一' : '二') + '学期'; }
function examInfo(x) {
 const m = String(x.kssj || '').match(/(\d{4}-\d{2}-\d{2})\s*\(?\s*(\d{1,2}:\d{2})\s*[-–~至]\s*(\d{1,2}:\d{2})/), day = m?.[1] || '', pad = t => t.padStart(5, '0');
 const start = m ? pad(m[2]) : '', end = m ? pad(m[3]) : '', now = C.nowChina(), clock = dtf('en-GB', {timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false}).format(new Date());
 const past = day ? day < now || day === now && end && end <= clock : false;
 const place = [x.cdxqmc, x.cdmc].filter(Boolean).join(' · ') + (x.zwh ? ' · 座位 ' + x.zwh : '');
 return {x, key: (x.kch || x.kcmc || '') + '|' + (x.kssj || ''), name: x.kcmc || x.ksmc || '考试', day, start, end, past, place: place || '考场待公布', when: day ? md(day) + ' ' + dtf('zh-CN', {timeZone: 'Asia/Shanghai', weekday: 'short'}).format(new Date(day + 'T12:00:00+08:00')) + (start ? ' ' + start + '–' + end : '') : (x.kssj || '时间待公布')};
}
function examList(c) { return (c?.exams || []).map(examInfo).sort((a, b) => (a.day || '9999') + a.start < (b.day || '9999') + b.start ? -1 : 1); }
function examCountdown(e) { if (e.past) return '已结束'; const n = e.day ? C.daysUntil(e.day) : null; return n == null ? '' : n === 0 ? '今天' : n === 1 ? '明天' : n + ' 天后'; }
function examRow(e) {
 const soon = !e.past && e.day && C.daysUntil(e.day) <= 3;
 return '<button class="exam-row' + (e.past ? ' past' : '') + '" data-exam="' + esc(e.key) + '"><span class="exam-date"><b>' + esc(e.day ? md(e.day) : '待定') + '</b><small>' + esc(examCountdown(e)) + '</small></span>'
  + '<span class="exam-main"><strong>' + esc(e.name) + '</strong><span class="exam-line">' + I.calendar + esc(e.when.replace(/^\S+\s/, '') || e.when) + (soon ? '<i class="badge warn">' + esc(examCountdown(e)) + '</i>' : '') + '</span><span class="exam-line">' + I.map + esc(e.place) + '</span></span>' + I.chevron + '</button>';
}
function examNote() { return '<p class="exam-note muted small">' + I.warn + '<span>考试时间、地点以学校教务系统公布为准，临近考试请再核对一次。<button class="link" data-action="officialExams">打开教务考试信息</button></span></p>'; }
function examsView() {
 const t = examTerm(state.examPrev), c = state.preferences.examCache?.[t.year + '-' + t.term], list = examList(c), coming = list.filter(e => !e.past), done = list.length - coming.length;
 const chips = '<div class="chip-row">' + [['now', '本学期'], ['prev', '上学期']].map(([v, l]) => '<button class="chip' + ((v === 'prev') === !!state.examPrev ? ' on' : '') + '" data-exam-term="' + v + '">' + l + '</button>').join('') + '</div>';
 let body;
 if (state.examError === 'needsLogin') body = '<div class="banner warn"><span>要先登录学生教务才能查考试安排</span><button class="btn text" data-action="showTeachingLogin">登录教务</button></div>';
 else if (state.examError) body = '<div class="banner warn"><span>' + esc(state.examError) + '</span><button class="btn text" data-action="loadExams">重试</button></div>';
 else body = '';
 if (!c) body += examBusy ? '<div class="skel-row"><i class="skel w60"></i><i class="skel w40"></i></div><div class="skel-row"><i class="skel w60"></i><i class="skel w40"></i></div>' : '<p class="muted small">从学生教务读取' + esc(examTermLabel(t)) + '的考试科目、时间和考场。</p><button class="btn tonal" data-action="loadExams">' + I.calendar + '查询考试安排</button>';
 else if (!list.length) body += '<div class="empty small"><p>' + esc(examTermLabel(t)) + '暂时没有考试安排</p><span class="muted small">学校一般在考试前几周公布，可以过些天再刷新</span></div>';
 else body += (coming.length ? '<h3 class="exam-group">即将考试 · ' + coming.length + '</h3><div class="exam-list">' + coming.map(examRow).join('') + '</div>' : '<p class="muted small">这学期的考试都考完了。</p>') + (done ? '<h3 class="exam-group">已结束 · ' + done + '</h3><div class="exam-list">' + list.filter(e => e.past).map(examRow).join('') + '</div>' : '');
 const cal = state.platform === 'android' && coming.some(e => e.day && e.start) ? '<button class="btn tonal" data-action="calendarExams">' + I.calendar + '导入日历（' + coming.filter(e => e.day && e.start).length + ' 场）</button>' : '';
 return pageHead('考试安排', c ? esc(examTermLabel(t)) + ' · ' + esc(cacheTime(c.at)) + ' 查询' : esc(examTermLabel(t)), '<button class="icon-btn" data-action="loadExams" aria-label="刷新考试安排"' + (examBusy ? ' aria-busy="true" disabled' : '') + '>' + I.refresh + '</button>')
  + '<section class="card exams-card">' + chips + body + (cal ? '<div class="exam-actions">' + cal + '</div>' : '') + (c ? '<p class="muted small exam-at">' + esc(examTermLabel(t)) + ' · ' + esc(cacheTime(c.at)) + ' 从教务查询</p>' : '') + examNote() + '</section>';
}
function allExamsDialog() {
 const t = examTerm(state.examPrev), list = examList(state.preferences.examCache?.[t.year + '-' + t.term]);
 showDialog('<h2>' + esc(examTermLabel(t)) + ' 考试安排</h2><div class="exam-list">' + list.map(examRow).join('') + '</div>' + examNote() + '<div class="dialog-actions"><button class="btn filled" data-action="closeDialog">好</button></div>', 'exams');
}
function examDialog(key) {
 const t = examTerm(state.examPrev), e = examList(state.preferences.examCache?.[t.year + '-' + t.term]).find(x => x.key === key);
 if (!e) return;
 const known = new Set(EXAM_FIELDS.map(([k]) => k)), rows = EXAM_FIELDS.filter(([k]) => e.x[k] && !EXAM_HIDE.has(k)).map(([k, l]) => [l, k === 'jsxx' ? String(e.x[k]).replace(/\b\d+\//g, '') : k === 'jxdd' ? [...new Set(String(e.x[k]).split(';'))].join('；') : e.x[k]]);
 // 学校以后多给的字段也照样列出来，不漏信息
 for (const [k, v] of Object.entries(e.x)) if (!known.has(k) && !EXAM_HIDE.has(k) && k !== 'kcmc') rows.push([k, v]);
 showDialog('<h2>' + esc(e.name) + '</h2>' + summary([['时间', esc(e.when) + (examCountdown(e) ? ' <span class="badge' + (e.past ? '' : ' ok') + '">' + esc(examCountdown(e)) + '</span>' : '')], ['地点', esc(e.place)]])
  + '<div class="card list-card exam-detail">' + rows.map(([l, v]) => '<div class="record"><div><span class="muted">' + esc(l) + '</span><strong>' + esc(v) + '</strong></div></div>').join('') + '</div>' + examNote()
  + '<div class="dialog-actions"><button class="btn text" data-action="officialExams">去教务核对</button><button class="btn filled" data-action="closeDialog">好</button></div>', 'exam');
}
// 把还没考的考试写进手机日历（考前一天、一小时提醒）；同一场再导入时更新原来那条
async function calendarExams() {
 const t = examTerm(state.examPrev), list = examList(state.preferences.examCache?.[t.year + '-' + t.term]).filter(e => !e.past && e.day && e.start);
 if (!list.length) { toast('没有可以导入的考试'); return; }
 const at = (day, time) => Date.parse(day + 'T' + time + ':00+08:00');
 const events = list.map(e => ({key: (t.year + '-' + t.term + '|' + e.key), title: e.name + ' 考试', start: at(e.day, e.start), end: at(e.day, e.end || e.start), location: e.place, description: [e.x.ksmc, e.x.ksfs && '考试方式：' + e.x.ksfs, e.x.zwh && '座位号：' + e.x.zwh, e.x.kch && '课程号：' + e.x.kch, '考试时间、地点以学校教务系统公布为准。'].filter(Boolean).join('\n')}));
 try {
  const r = await host('calendarExams', {events});
  haptic('confirm');
  toast('已导入日历' + (r.calendar ? '「' + r.calendar + '」' : '') + '：新增 ' + r.added + ' 场' + (r.updated ? '，更新 ' + r.updated + ' 场' : '') + '，考前一天和一小时提醒');
 } catch (e) { haptic('reject'); toast(C.errorText(e)); }
}
async function loadExams({quiet = false} = {}) {
 if (examBusy) return;
 examBusy = true; state.examError = ''; if (!quiet) render();
 const t = examTerm(state.examPrev);
 try {
  if (!onlineRooms() && !(await backgroundTeaching({manual: true}))) throw Object.assign(Error(state.teachingAuto.needsUser ? '' : '连不上学生教务（可能不在校园网或教务在维护），稍后再试'), {code: state.teachingAuto.needsUser ? 'AUTH' : 'NETWORK'});
  const r = await onlineTeaching('exams', {year: t.year, term: t.term}, 25000);
  state.preferences.examCache = {...(state.preferences.examCache || {}), [t.year + '-' + t.term]: {at: Date.now(), year: t.year, term: t.term, exams: Array.isArray(r?.exams) ? r.exams : []}};
  await save();
  if (!quiet) haptic('confirm');
 } catch (e) { state.examError = e.code === 'AUTH' ? 'needsLogin' : quiet ? '' : C.errorText(e); }
 finally { examBusy = false; if (state.page === 'exams') render(); }
}
function profileCard() {
 const p = state.profile, bad = restricted(), name = p?.name || '我的账号';
 // 学校没有部门信息时会返回“未知部门”，这种占位不显示。
 const sub = [C.maskCard(p?.card || state.username), /^未知/.test(p?.dept || '') ? '' : p?.dept].filter(Boolean).join(' · ') || (state.statusLoading ? '正在读取账号信息…' : '');
 return '<section class="card profile"><div class="profile-top"><div class="avatar" aria-hidden="true">' + (p?.name ? esc(p.name.slice(0, 1)) : I.user) + '</div><div class="profile-main"><h2>' + esc(name) + '</h2><span class="muted small">' + esc(sub) + '</span></div>'
  + (p?.statusText ? '<span class="badge ' + (bad ? 'err' : p.status === '1' ? 'ok' : '') + '">' + esc(p.statusText) + '</span>' : '') + '<button class="icon-btn" data-action="refreshStatus" aria-label="刷新账号状态">' + I.refresh + '</button></div>'
  + (bad ? '<div class="banner error"><span>学校显示账号状态为“' + esc(p.statusText) + '”，可能无法预约座位。</span></div>' : '')
  + (state.statusError ? '<p class="muted small">账号信息读取失败：' + esc(state.statusError) + '</p>' : '')
  + '<div class="conn-list">' + connRow('图书馆', state.libraryConnected, 'loginLibrary') + connRow('学生教务', onlineRooms(), 'autoTeaching', teachingNote()) + '</div>'
  + (p?.validUntil ? '<p class="muted small">证件有效期至 ' + esc(p.validUntil) + '</p>' : '')
  + '<div class="actions"><button class="btn tonal sm" data-action="account">' + (state.supportsAccounts ? '账号与自动登录' : '自动登录设置') + '</button><button class="btn text sm" data-action="settings">外观与通知</button></div></section>';
}
// “2026-10-18 08:30:00” → “10/18 08:30”（今年内省去年份，今天/昨天写出来）。
function shortStamp(v) { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/); if (!m) return String(v || ''); const day = m[1] + '-' + m[2] + '-' + m[3], name = dayName(day); return (name !== md(day) ? name : m[1] === C.nowChina().slice(0, 4) ? md(day) : day) + ' ' + m[4]; }
function violationsCard() {
 const v = state.violations;
 let body;
 if (!v) body = '<p class="muted small">' + (state.statusLoading ? '正在读取违约记录…' : '还没有读取违约记录。') + '</p>';
 else if (!v.total) body = '<div class="big-num ok"><b>0</b><span>普通座位没有违约记录，继续保持 ✨</span></div>';
 else body = '<div class="big-num warn"><b>' + esc(v.total) + '</b><span>次普通座位违约记录</span></div>' + v.items.slice(0, 3).map(x => '<div class="record"><div><strong>' + esc((x.area || '图书馆') + ' ' + x.seat) + '</strong><span class="muted">' + esc(shortStamp(x.time)) + '</span></div>' + (x.status ? '<span class="badge warn">' + esc(x.status) + '</span>' : '') + '</div>').join('');
 return '<section class="card vio"><div class="card-head"><h2>违约记录</h2>' + (v ? '<span class="badge ' + (v.total ? 'warn' : 'ok') + '">普通座位 ' + esc(v.total) + ' 次</span>' : '') + '</div>' + body
  + '<p class="muted small">仅统计普通座位，规则以“预约须知”为准。</p>'
  + '<div class="actions"><button class="btn tonal sm" data-action="rules">预约须知</button><button class="btn text sm" data-action="officialRecords">学校页面</button></div></section>';
}
function reminderCard() {
 const lead = Number(state.preferences.checkinLead ?? 15), next = (state.reminders || []).find(r => r.at > Date.now()), n = state.notify;
 const seg = '<div class="seg">' + [[0, '关闭'], [10, '10 分钟'], [15, '15 分钟'], [30, '30 分钟']].map(([v, l]) => '<label><input type="radio" name="checkinLead" value="' + v + '"' + (lead === v ? ' checked' : '') + '><span>' + l + '</span></label>').join('') + '</div>';
 const perm = state.platform === 'android' && n && !n.allowed && lead ? '<div class="current-tip"><span>通知权限没开，提醒发不出来</span><button class="btn filled sm" data-action="requestNotify">开启</button></div>' : '';
 const where = state.platform === 'android' ? (state.remindersExact === false ? '提醒可能晚到：请在系统设置 → 应用 → 工大学伴 → 闹钟和提醒里允许。' : '助手关闭或手机重启后也会提醒。') : state.platform === 'windows' ? '用 Windows 系统通知提醒，需客户端在运行。' : '';
 return '<section class="card"><div class="card-head"><h2>签到提醒</h2><span class="muted">' + I.bell + '</span></div><p class="muted small">开始前提醒签到</p><form id="remindForm" class="remind-form">' + seg + '</form>' + perm
  + '<p class="small remind-next">' + (!lead ? '已关闭' : next ? '下一次：' + esc(fireText(new Date(next.at).toISOString())) + ' · ' + esc(next.title) : '暂无即将开始的预约') + '</p>' + (where ? '<p class="muted small">' + where + '</p>' : '') + '</section>';
}
// 入馆日历：一格一天，颜色越深待得越久；能往前翻到本机记下的最早那个月。
function calendarBlock() {
 const this_ = C.nowChina().slice(0, 7), month = state.calMonth || this_, log = visitLog(), cal = C.monthCalendar(log, month);
 const prev = shiftMonth(month, -1), next = shiftMonth(month, 1), earliest = String(log[0]?.[2] || this_).slice(0, 7);
 const cells = Array.from({length: cal.offset}, () => '<i class="cal-cell pad"></i>').join('') + cal.days.map(d => '<i class="cal-cell l' + d.level + (d.future ? ' future' : '') + (d.day === C.nowChina() ? ' today' : '') + '" title="' + esc(md(d.day) + (d.hours ? ' · ' + d.hours + ' 小时' : '')) + '"></i>').join('');
 return '<div class="cal"><div class="cal-head"><button class="icon-btn" data-cal="' + prev + '" aria-label="上个月"' + (prev < earliest ? ' disabled' : '') + '>' + I.back + '</button><strong>' + Number(month.slice(5, 7)) + ' 月 · ' + cal.activeDays + ' 天</strong><button class="icon-btn" data-cal="' + next + '" aria-label="下个月"' + (next > this_ ? ' disabled' : '') + '>' + I.chevron + '</button></div>'
  + '<div class="cal-week">' + [...WEEKDAYS].map(w => '<span>' + w + '</span>').join('') + '</div><div class="cal-grid" role="img" aria-label="' + esc(Number(month.slice(5, 7)) + ' 月入馆 ' + cal.activeDays + ' 天，共 ' + cal.hours + ' 小时') + '">' + cells + '</div></div>';
}
function shiftMonth(m, n) { const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); }
function badgesFor(id = state.activeAccountId) { const all = state.preferences.badges || {}; return all[id] || {}; }
// 成就：按本机累积的入馆记录算；每种几级，进度条显示离下一级还差多少，最上面提示最快能拿到的那一个。
function achvStats(id = state.activeAccountId) { return {...C.achievementStats(visitLog(id)), opens: Number(state.preferences.opens?.n) || 0}; }
function achievementList() { return C.achievements(achvStats()).filter(a => a.key !== 'opens' || a.reached); }
function achievementsCard() {
 if (!state.recordsLoaded && !visitLog().length) return '';
 const list = achievementList(), got = badgesFor(), total = list.reduce((a, x) => a + x.tiers.length, 0), have = list.reduce((a, x) => a + x.reached, 0);
 // “老朋友”按打开次数算，不拿来催人多打开
 const near = list.filter(a => a.next && a.key !== 'opens').sort((a, b) => (b.value / b.next) - (a.value / a.next))[0];
 const unit = a => a.label(a.next).replace(/^[^\d]*\d+\s*/, '');
 const tile = a => '<button class="achv' + (a.reached ? ' on' : '') + '" data-achv="' + esc(a.key) + '"><span class="achv-icon">' + a.icon + '</span><b>' + esc(a.name) + '</b>'
  + '<span class="achv-lv">' + (a.reached ? esc(a.label(a.tiers[a.reached - 1])) + (a.reached === a.tiers.length ? ' · 满级' : '') : '未解锁') + '</span>'
  + '<i class="achv-bar"><i class="p' + Math.min(10, Math.round((a.next ? a.value / a.next : 1) * 10)) + '"></i></i></button>';
 return '<section class="card achv-card"><div class="card-head"><h2>成就</h2><span class="muted small">已解锁 ' + have + ' / ' + total + '</span></div>'
  + (near ? '<p class="small achv-near">离「' + esc(near.name) + '」' + (near.reached ? '下一级' : '') + '还差 <b>' + (near.next - near.value) + '</b> ' + esc(unit(near)) + '，冲！</p>' : '<p class="small achv-near">全部满级，太强了！</p>')
  + '<div class="achv-grid badges">' + list.map(tile).join('') + '</div><p class="muted small">按本机记下的入馆记录统计，用得越久越准。</p></section>';
}
function achievementDialog(key) {
 const a = achievementList().find(x => x.key === key), got = badgesFor();
 if (!a) return;
 showDialog('<div class="achv-detail"><div class="achv-icon big">' + a.icon + '</div><h2>' + esc(a.name) + '</h2><p class="muted small">' + esc(a.desc) + ' · 现在 ' +esc(a.label(a.value).replace(/^\S+\s*/, '')) + '</p></div>'
  + '<div class="card list-card">' + a.tiers.map((n, i) => '<div class="record' + (i < a.reached ? '' : ' dim') + '"><div><strong>' + esc(a.label(n)) + '</strong><span class="muted">' + (i < a.reached ? (got[a.key + n] ? '获得于 ' + esc(md(got[a.key + n])) : '已达成') : '还差 ' + (n - a.value) + esc(a.label(0).replace(/^.*?0\s*/, ' '))) + '</span></div><span class="badge' + (i < a.reached ? ' ok' : '') + '">Lv ' + (i + 1) + '</span></div>').join('') + '</div>'
  + '<div class="dialog-actions"><button class="btn filled" data-action="closeDialog">好</button></div>', 'achv');
}
function badgeRow() {
 const got = badgesFor(), list = C.MILESTONES.filter(([id]) => got[id]);
 if (!list.length) return '';
 return '<div class="badges">' + list.map(([id, label]) => '<span class="medal" title="' + esc('获得于 ' + md(got[id])) + '">' + I.medal + esc(label) + '</span>').join('') + '</div>';
}
// 新勋章：记录变化时比对；第一次使用时把已经达成的直接记上，不放礼花。
async function checkMilestones() {
 if (!state.recordsLoaded) return;
 const id = state.activeAccountId, s = stats(), all = state.preferences.badges || {}, first = !all[id], got = {...(all[id] || {})};
 // “老朋友”由感谢弹窗来庆祝，这里不重复放礼花。
 const fresh = C.earnedAchievements(achvStats(id)).filter(m => !got[m.id] && !(m.id.startsWith('opens') && thanksDue()));
 if (!fresh.length && !first) return;
 for (const m of fresh) got[m.id] = C.nowChina();
 state.preferences.badges = {...all, [id]: got};
 await save().catch(() => {});
 if (first || !fresh.length) { render(); return; }
 celebrate(fresh, s);
}
function celebrate(fresh, stats) {
 haptic('confirm');
 const line = '累计 ' + stats.totalHours + ' 小时 · 本月 ' + stats.monthVisits + ' 次 · 连续 ' + stats.streak + ' 天';
 if (!$('#dialog').open) showDialog('<div class="celebrate"><div class="medal-big">' + I.medal + '</div><h2>' + (fresh.length > 1 ? '解锁 ' + fresh.length + ' 个新成就' : '新成就：' + esc(fresh[0].label)) + '</h2>' + (fresh.length > 1 ? '<p>' + fresh.map(m => esc(m.label)).join(' · ') + '</p>' : '') + '<p class="muted small">' + esc(line) + '</p><div class="dialog-actions"><button class="btn filled" data-action="closeDialog">收下</button></div></div>', 'medal');
 else toast('新成就：' + fresh.map(m => m.label).join('、'));
 confetti();
 render();
}
// 小礼花：纯样式动画，2.5 秒后移除；“减少动效”时不放。
function confetti() {
 const root = document.documentElement;
 if (root.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
 const layer = document.createElement('div');
 layer.className = 'confetti';
 for (let i = 0; i < 42; i++) {
  const b = document.createElement('i');
  b.className = 'c' + (i % 5);
  b.style.setProperty('--x', (Math.random() * 100).toFixed(1) + 'vw');
  b.style.setProperty('--dx', ((Math.random() - .5) * 30).toFixed(1) + 'vw');
  b.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
  b.style.setProperty('--d', (Math.random() * .5).toFixed(2) + 's');
  layer.appendChild(b);
 }
 document.body.appendChild(layer);
 // 弹窗在浏览器顶层：礼花也放进顶层（popover），才能盖在弹窗上面。
 if (layer.showPopover) try { layer.setAttribute('popover', 'manual'); layer.showPopover(); } catch (e) {}
 setTimeout(() => layer.remove(), 2600);
}
function summaryDialog(month) {
 const m = C.monthSummary(visitLog(), month), n = Number(month.slice(5, 7));
 if (month < C.nowChina().slice(0, 7)) { state.preferences.summarySeen = month; save().catch(() => {}); }
 const tile = (v, l) => '<div class="stat"><b>' + esc(v) + '</b><span>' + l + '</span></div>';
 const line = !m.visits ? '这个月没有入馆记录。' : m.hours >= 60 ? Math.floor(m.hours) + ' 个小时，都是实打实坐出来的。' : m.longestStreak >= 7 ? '最长连续 ' + m.longestStreak + ' 天，节奏很稳。' : m.activeDays >= 15 ? '一半以上的日子都在图书馆。' : '每一次入馆都算数。';
 showDialog('<div class="summary-card"><span class="overline">' + esc(month.slice(0, 4)) + ' 年 ' + n + ' 月小结</span><h2>' + esc(line) + '</h2><div class="stats">' + tile(m.visits, '入馆次数') + tile(m.hours, '小时') + tile(m.activeDays, '入馆天数') + tile(m.longestStreak, '最长连续') + '</div>'
  + (m.topSeat ? '<p class="small">最常坐：<b>' + esc(m.topSeat.area + ' ' + m.topSeat.no) + '</b> · ' + m.topSeat.count + ' 次</p>' : '') + (m.latest ? '<p class="small">最晚待到：<b>' + esc(m.latest) + '</b></p>' : '')
  + '<p class="muted small">按本机记下的入馆记录统计。</p></div><div class="dialog-actions"><button class="btn filled" data-action="closeDialog">好</button></div>', 'summary');
}
function summaryBanner() {
 const today = C.nowChina(), last = shiftMonth(today.slice(0, 7), -1);
 if (Number(today.slice(8, 10)) > 7 || state.preferences.summarySeen === last || !hasVisits() || !C.monthSummary(visitLog(), last).visits) return '';
 return '<div class="banner info"><span>' + Number(last.slice(5, 7)) + ' 月小结出来了</span><button class="btn text" data-summary="' + last + '">查看</button></div>';
}
function statsCard() {
 if (!hasVisits()) return '<section class="card"><div class="card-head"><h2>学习足迹</h2></div><p class="muted small">按学校预约记录统计本月入馆。</p><div class="actions"><button class="btn tonal sm" data-action="records">读取记录</button></div></section>';
 const s = stats(), tile = (v, l) => '<div class="stat"><b>' + esc(v) + '</b><span>' + l + '</span></div>';
 const quip = s.streak >= 7 ? '连续一周泡图书馆，太强了！' : s.streak >= 3 ? '保持住这个节奏！' : s.monthVisits ? '每一次入馆都算数。' : '本月还没有入馆记录，找个时间去坐坐吧。';
 return '<section class="card"><div class="card-head"><h2>学习足迹</h2><span class="muted small">' + Number(C.nowChina().slice(5, 7)) + ' 月</span></div><div class="stats">' + tile(s.monthVisits, '本月入馆') + tile(s.monthHours, '本月小时') + tile(s.streak, '连续天数') + tile(s.visits, '累计次数') + '</div>'
  + calendarBlock()
  + (s.topArea ? '<p class="small">最常去：<b>' + esc(s.topArea) + '</b> · ' + s.topCount + ' 次</p>' : '') + '<p class="small">' + quip + '</p><p class="muted small">按本机记下的 ' + s.visits + ' 次入馆统计。</p><div class="actions"><button class="btn tonal sm" data-summary="' + (state.calMonth || C.nowChina().slice(0, 7)) + '">月度小结</button></div></section>';
}
function countdownCard() {
 const c = state.preferences.countdown, days = c ? C.daysUntil(c.day) : null;
 if (!c || days == null) return '<section class="card countdown-card"><div><h2>倒计时</h2><p class="muted small">给考研、四六级、期末设个倒计时</p></div><button class="btn tonal sm" data-action="editCountdown">' + I.flag + '添加</button></section>';
 const quip = days < 0 ? '已经过去了，可以换个新目标' : days === 0 ? '加油，你准备好了！' : days <= 7 ? '最后冲刺！' : days <= 30 ? '稳住节奏' : days <= 100 ? '每天进步一点点' : '时间还早，但别松懈';
 return '<section class="card countdown-card"><div><span class="overline">' + esc(c.name) + '</span><div class="cd-days">' + (days > 0 ? '<b>' + days + '</b><span>天</span>' : days === 0 ? '<b>就是今天</b>' : '<b>' + (-days) + '</b><span>天前</span>') + '</div><p class="muted small">' + esc(c.day) + ' · ' + quip + '</p></div><button class="icon-btn" data-action="editCountdown" aria-label="修改倒计时">' + I.calendar + '</button></section>';
}
function countdownDialog() {
 const c = state.preferences.countdown || {};
 showDialog('<h2>倒计时</h2><form id="countdownForm"><label class="field"><span class="label">名称</span><input id="cdName" maxlength="12" placeholder="例如：考研初试" value="' + esc(c.name || '') + '" required></label><label class="field"><span class="label">日期</span><input id="cdDay" type="date" value="' + esc(c.day || '') + '" required></label><p class="muted small">日期以考试安排为准。</p><div class="dialog-actions">' + (c.day ? '<button type="button" class="btn text danger" data-action="clearCountdown">删除</button>' : '<button type="button" class="btn text" data-action="closeDialog">取消</button>') + '<button class="btn filled" type="submit">保存</button></div></form>', 'countdown');
}
// 学校的区域预约须知（违约规则等），按区域缓存；没打开区域时用当前预约或最近预约成功的区域。
async function rulesDialog() {
 const r = state.current[0], id = String(state.areaId || (r && (r.area_id ?? r.areaId)) || bookedTask()?.areaId || state.areas[0]?.id || '');
 if (!/^\d+$/.test(id)) { toast('请先在图书馆页打开一个区域'); return; }
 const name = state.areas.find(a => same(a.id, id))?.name || (same(state.areaId, id) ? state.info?.name : '') || '';
 const show = text => showDialog('<h2>预约须知</h2><p class="muted small">' + esc(name || '所选区域') + ' · 学校规定</p><div class="rules">' + esc(text) + '</div><div class="dialog-actions"><button class="btn text" data-action="officialLibrary">学校页面</button><button class="btn filled" data-action="closeDialog">知道了</button></div>', 'rules');
 if (state.rules[id]) { show(state.rules[id]); return; }
 show('正在读取…');
 try { state.rules[id] = (await api('rules', {areaId: id})).text || '学校没有提供该区域的预约须知。'; if ($('#dialog').dataset.kind === 'rules') show(state.rules[id]); }
 catch (e) { if ($('#dialog').dataset.kind === 'rules') show('读取失败：' + e.message); }
}
// 账号状态与违约记录：后台读取，不占用全局加载状态；5 分钟内不重复读取。
async function loadAccountStatus({force = false} = {}) {
 if (!state.libraryConnected || state.statusLoading || !force && Date.now() - state.statusAt < 300000) return;
 const accountId = state.activeAccountId;
 state.statusLoading = true; state.statusError = '';
 // 账号信息只在“我的”页整块显示；别的页只有顶部账号标签和“账号受限”提示用得到，变了才重画
 const wasRestricted = restricted();
 if (state.page === 'me') render();
 const results = await Promise.allSettled([api('profile', {}, accountId), api('violations', {}, accountId)]);
 // 读取期间切换了账号：结果属于原账号，丢弃。
 if (accountId !== state.activeAccountId) return;
 const ok = results.some(x => x.status === 'fulfilled');
 state.statusLoading = false; state.statusAt = ok ? Date.now() : Date.now() - 240000;
 if (results[0].status === 'fulfilled') state.profile = results[0].value;
 if (results[1].status === 'fulfilled') state.violations = results[1].value;
 const errors = results.filter(x => x.status === 'rejected').map(x => x.reason);
 if (errors.length) { state.statusError = errors[0]?.message || '读取失败'; const auth = errors.find(e => e?.code === 'AUTH'); if (auth) { fail(auth); return; } }
 if (state.page === 'me' || restricted() !== wasRestricted) render(); else updateAccountChip();
}

/* ---------- 签到提醒 ---------- */
function reminderItems() {
 const p = state.preferences, now = Date.now();
 p.manualReminders = (p.manualReminders || []).filter(x => Number(x.at) > now - 3600000);
 const ids = state.supportsAccounts ? state.accounts.map(a => a.id) : [state.activeAccountId];
 // Windows 由界面自己到点发通知：保留刚到点十分钟内的提醒，交给 fireDueReminders。
 return C.checkinReminders({current: state.knownCurrent, tasks: state.tasks, records: state.records, accountIds: ids, leadMinutes: p.checkinLead ?? 15, extra: p.manualReminders, pass: hasPass(), now: state.platform === 'windows' ? now - 600000 : now});
}
// 安卓交给系统闹钟（助手被关掉也会提醒），内容不变时不重复设置。本次运行还没成功读到学校“当前预约”时不替换已设的闹钟，免得把只来自学校列表的提醒取消掉。
let savedNextReminder = 0;
function syncReminders() {
 state.reminders = reminderItems(); state.remindersAt = Date.now();
 if (state.platform === 'windows') { const next = state.reminders.find(r => r.at > Date.now())?.at || 0; if (next !== savedNextReminder) { savedNextReminder = next; save().catch(() => {}); } return; }
 if (state.platform !== 'android' || !state.currentAt) return;
 const key = JSON.stringify(state.reminders.map(x => [x.id, x.at, x.title, x.text]));
 if (key === lastReminders) return;
 lastReminders = key;
 host('reminders', {items: state.reminders}).then(r => { const was = state.remindersExact; state.remindersExact = r?.exact !== false; if (was !== state.remindersExact && state.page === 'me') render(); }).catch(() => { lastReminders = ''; });
}
function fireDueReminders() {
 if (state.platform !== 'windows' || !window.CampusRuntimeReady) return;
 if (Date.now() - state.remindersAt > 60000) syncReminders();
 const now = Date.now(), fired = state.preferences.firedReminders || [];
 let changed = false;
 for (const r of state.reminders) {
  const key = r.id + '@' + r.at;
  if (r.at > now || now - r.at > 600000 || fired.includes(key)) continue;
  fired.push(key); changed = true;
  desktopNotify(r.title, r.text, 'library', true);
  toast(r.title);
 }
 if (changed) { state.preferences.firedReminders = fired.slice(-40); save().catch(() => {}); }
}
function addLeaveReminder(minutes, r) {
 if (!minutes) return;
 const at = Date.now() + minutes * 60000, where = (r.nameMerge || r.areaName || '图书馆') + ' ' + String(r.no || r.name || '');
 state.preferences.manualReminders = [...(state.preferences.manualReminders || []), {id: 'leave:' + r.id + ':' + at, at, title: '暂离已 ' + minutes + ' 分钟', text: where.trim() + ' · 请按学校规定时限回座签到，超时可能被记违约。'}];
}

/* ---------- 入馆码 ---------- */
function passView() {
 const live = liveSeatPayload();
 return pageHead('入馆码', '') + '<section class="card pass-card"><div class="pass-art">' + I.qr + '</div><h2>电子借阅证</h2><p class="muted">打开时屏幕自动调到最亮。</p><button class="btn filled xl" data-action="openPass">' + I.qr + '出示入馆码</button>'
  + (live ? '<div class="pass-booking"><span class="overline">' + (state.current.length ? '当前预约' : '已预约') + '</span><strong>' + esc(live.title) + '</strong><span class="muted small">' + esc(live.text) + '</span></div>' : '')
  + (cheerLine() ? '<p class="cheer center">' + esc(cheerLine()) + '</p>' : '')
  + '</section>';
}

/* ---------- 收藏 ---------- */
function seatItem(x) { return {...x, areaId: state.areaId, areaName: state.info?.name || '', libraryId: state.libraryId}; }
function isFavorite(type, item) { return state.favorites.some(x => x.key === C.favoriteKey(type, item)); }
async function favoriteSelection() {
 const items = state.selection.map(seatItem);
 if (!items.length) return;
 if (items.every(x => isFavorite('seat', x))) {
  const keys = items.map(x => C.favoriteKey('seat', x)), previous = state.favorites.slice();
  state.favorites = state.favorites.filter(f => !keys.includes(f.key));
  await save(); render();
  toast('已取消收藏', async () => { state.favorites = previous; await save(); render(); });
 } else {
  for (const x of items) state.favorites = C.addFavorite(state.favorites, 'seat', x);
  await save(); render();
  toast('已收藏 ' + items.map(x => x.no).join('、') + ' 号座位');
 }
}
async function favoriteClick(b) {
 const ds = b.dataset;
 if (ds.removeFavorite) { await removeFavorite(ds.removeFavorite); return; }
 if (ds.starType) {
  const type = ds.starType, x = (type === 'seat' ? state.seats : state.rooms?.rooms || []).find(y => same(y.id, ds.starId));
  if (!x) return;
  const item = type === 'seat' ? seatItem(x) : {...x, query: state.roomQuery};
  if (isFavorite(type, item)) await removeFavorite(C.favoriteKey(type, item));
  else { state.favorites = C.addFavorite(state.favorites, type, item); afterFavorite(); toast('已加入收藏'); save().catch(report); }
  return;
 }
 const f = state.favorites.find(x => x.key === ds.useFavorite);
 if (!f) return;
 closeDialog();
 if (f.type === 'seat') await useSeatFavorite(f); else await useRoomFavorite(f);
}
async function useSeatFavorite(f) {
 if (libraryInputLocked()) return;
 state.page = 'library'; state.error = '';
 if (!state.libraryConnected) { render(); toast('请先登录图书馆'); return; }
 if (f.libraryId) state.libraryId = f.libraryId;
 state.areaId = f.areaId; state.selection = [];
 await loadLibrary();
 if (state.error) return;
 if (!state.info || !same(state.areaId, f.areaId)) { toast('学校当前没有返回收藏的区域'); return; }
 state.preferences.seatFilter.query = ''; state.preferences.seatFilter.favoriteOnly = false;
 const seat = state.seats.find(x => same(x.id, f.id));
 if (seat?.available) { state.selection = [seat]; toast('已选中 ' + f.no + ' 号，可以直接预约'); }
 else toast(f.no + ' 号' + dayName(state.day) + '不可预约，可以换同区域的其他座位');
 await save();
 render();
}
async function useRoomFavorite(f) {
 state.page = 'rooms'; state.error = '';
 // 收藏的教室按“当前填写的周次、星期、节次”重新查询，只替换校区和教学楼。
 render();
 await roomTask(async () => {
  useOfflineRooms();
  if (!state.teachingOptions) { state.teachingOptions = await teaching('options'); applyTeachingDefaults(); state.teachingConnected = true; }
  const base = state.preferences.roomQuery || {}, q = {...base, campus: f.query?.campus ?? base.campus, building: f.query?.building ?? base.building};
  if (!same(q.campus, base.campus)) state.teachingOptions = await teaching('options', {year: q.year, term: q.term, campus: q.campus});
  state.preferences.roomQuery = q;
  applyTeachingDefaults();
  state.rooms = await queryRooms(state.preferences.roomQuery);
  state.roomQuery = structuredClone(state.preferences.roomQuery);
  state.roomFavoritesOnly = true; state.roomFormOpen = false; state.roomBuilding = ''; state.roomsStale = false; state.roomLimit = ROOM_PAGE; state.updated = nowStamp();
  save().catch(report);
  const free = state.rooms.rooms.some(x => C.favoriteKey('room', {...x, query: state.roomQuery}) === f.key);
  toast(free ? f.name + ' 在所选时段无排课' : '学校本次没有把 ' + f.name + ' 列为空闲');
 });
}
// 收藏变化：空教室页只换收藏行和结果列表，其它页面照常重画；先更新界面，再在后台保存。
function afterFavorite() {
 if (state.page !== 'rooms' || !$('#roomResults') || !$('#roomFavs')) { render(); return; }
 $('#roomFavs').outerHTML = favoriteRoomsRow(); renderRoomResults();
}
async function removeFavorite(key) {
 const previous = state.favorites.slice();
 state.favorites = previous.filter(x => x.key !== key);
 afterFavorite(); refreshFavoritesDialog(); save().catch(report);
 toast('已取消收藏', async () => {
  const removed = previous.find(x => x.key === key);
  if (removed && !state.favorites.some(x => x.key === key)) state.favorites.push(removed);
  await save(); render(); refreshFavoritesDialog();
 });
}
function favoritesDialog() {
 const group = (type, title) => {
  const list = state.favorites.filter(f => f.type === type);
  return '<h3>' + title + '</h3>' + (list.length ? '<div class="card list-card fav-list">' + list.map(f => '<div class="room-row"><div class="room-main"><strong>' + esc(type === 'seat' ? f.no + ' 号座位' : f.name) + '</strong><span class="muted">' + esc(type === 'seat' ? f.areaName : [f.building, f.campus].filter(Boolean).join(' · ')) + '</span></div><button class="btn text sm" data-use-favorite="' + esc(f.key) + '">' + (type === 'seat' ? '查座' : '查询') + '</button><button class="icon-btn star-on" data-remove-favorite="' + esc(f.key) + '" aria-label="取消收藏 ' + esc(f.no || f.name) + '">' + I.starOn + '</button></div>').join('') + '</div>' : '<p class="muted small">' + (type === 'seat' ? '在座位页选中座位后点星标收藏。' : '查询空教室后点教室旁的星标。') + '</p>');
 };
 showDialog('<h2>我的收藏</h2>' + group('seat', '常用座位') + group('room', '收藏的教室') + '<p class="muted small about">点收藏会重新查询是否空闲，不会直接预约。</p>', 'favorites');
}
function refreshFavoritesDialog() { const d = $('#dialog'); if (d.open && d.dataset.kind === 'favorites') favoritesDialog(); }
function favoriteSeatDialog() {
 showDialog('<h2>收藏座位</h2><p class="muted small">' + esc(state.info?.name || '') + '。占用中的座位也能收藏。</p><label class="field"><span class="label">座位号</span><select id="favoriteSeatId">' + state.seats.map(x => '<option value="' + esc(x.id) + '">' + esc(x.no) + (x.available ? ' · 可预约' : ' · 占用中') + '</option>').join('') + '</select></label><div class="dialog-actions"><button class="btn text" data-action="closeDialog">取消</button><button class="btn filled" data-action="confirmFavoriteSeat">加入收藏</button></div>', 'favoriteSeat');
}

/* ---------- 临时签退 ---------- */
function leaveDialog(id) {
 const r = state.current.find(x => same(x.id, id));
 if (!r?.canTemporaryLeave) return;
 pendingLeave = {...r, accountId: state.activeAccountId};
 showDialog('<h2>确认临时签退</h2>' + summary([['座位', esc((r.nameMerge || r.areaName || '图书馆') + ' · ' + (r.no || r.name || ''))]]) + '<p class="muted small">请在学校规定时限内回座签到。</p><label class="field"><span class="label">提醒我回座</span><select id="leaveRemind">' + [[0, '不提醒'], [15, '15 分钟后'], [20, '20 分钟后'], [30, '30 分钟后'], [45, '45 分钟后'], [60, '60 分钟后']].map(([v, l]) => '<option value="' + v + '"' + (v === 20 ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label><div class="dialog-actions"><button class="btn text" data-action="closeDialog">取消</button><button class="btn filled" data-action="confirmLeave">确认签退</button></div>', 'leave');
}
async function confirmLeave() {
 if (leaving || !pendingLeave) return;
 if (pendingLeave.accountId !== state.activeAccountId) throw Error('账号已变化，请刷新当前预约');
 leaving = true;
 const id = String(pendingLeave.id), accountId = pendingLeave.accountId, seat = pendingLeave, remind = Number($('#leaveRemind')?.value || 0);
 pendingLeave = null;
 closeDialog();
 const lock = async () => { leaveLockAt.set(accountId + ':' + id, Date.now()); state.preferences.uncertainLeaveIds = [...new Set([...(state.preferences.uncertainLeaveIds || []), accountId + ':' + id])]; await save(); };
 try {
  await opBusy(async () => {
   let result;
   try { result = await api('temporaryLeave', {id}, accountId); }
   catch (e) { if (e.uncertain || e.code === 'UNCERTAIN') { await lock(); laterRefresh(3000, 12000, 95000); } throw e; }
   state.current = result.current || []; state.currentError = '';
   syncLiveSeat();
   if (result.verified) haptic('confirm');
   if (!result.verified) await lock();
   if (remind) { addLeaveReminder(remind, seat); await save(); syncReminders(); }
   toast((result.verified ? '已暂离，记得按时回座' : '暂离已提交，正在刷新状态') + (remind ? '；' + remind + ' 分钟后提醒你' : ''));
   if (!result.verified) laterRefresh(3000, 12000, 95000);
  });
 } finally { leaving = false; }
}

/* ---------- 结束使用（提前离馆） ---------- */
function checkoutDialog(id) {
 const r = state.current.find(x => same(x.id, id));
 if (!r?.canCheckout) { haptic('reject'); toast('学校当前不允许结束这个预约，请刷新'); return; }
 haptic('tick');
 showDialog('<h2>结束使用，释放座位？</h2>' + summary([['座位', esc((r.nameMerge || r.areaName || '图书馆') + ' · ' + (r.no || r.name || ''))], ['时间', esc(reservationSpan(r).text || '—')]]) + '<p class="muted small">座位会还给学校，之后不能再回来坐。</p><div class="dialog-actions"><button class="btn text" data-action="closeDialog">再坐会儿</button><button class="btn filled danger" data-confirm-checkout="' + esc(r.id) + '">结束使用</button></div>', 'checkout');
}
// 取消预约、结束使用：处理中卡片先变淡、不能重复点；学校确认后卡片先收起，再从列表里去掉，不突然消失
function opCard(attr, id) { return $('[' + attr + '="' + CSS.escape(String(id)) + '"]')?.closest('.card.current, .record'); }
async function collapse(el) {
 if (!el?.animate || !motionOn()) return;
 const h = el.getBoundingClientRect().height;
 // 播放途中卡片被重画替换掉时，旧元素上的动画不会结束：最多等 0.3 秒
 const a = el.animate([{opacity: 1, height: h + 'px', overflow: 'hidden'}, {opacity: 0, height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px', overflow: 'hidden'}], {duration: 240, easing: EASE.out, fill: 'forwards'});
 await Promise.race([a.finished.catch(() => {}), sleep(300)]);
}
function opWorking(...ids) { const w = state.opWorking; return !!w && ids.some(x => x != null && String(x) === w); }
async function confirmCheckout(id) {
 if (checkingOut) return;
 checkingOut = true;
 closeDialog();
 const accountId = state.activeAccountId;
 state.opWorking = String(id);
 try {
  await opBusy(async () => { try {
   const result = await api('checkout', {id: String(id)}, accountId);
   if (accountId !== state.activeAccountId) return;
   if (result.verified) await collapse(opCard('data-checkout', id));
   state.current = result.current || []; state.currentError = ''; state.knownCurrent = state.current;
   // 已经离馆：这个预约的“回座提醒”不用再发。
   state.preferences.manualReminders = (state.preferences.manualReminders || []).filter(x => !String(x.id).startsWith('leave:' + id + ':'));
   lastLive = ''; syncLiveSeat(); syncReminders();
   await save();
   haptic(result.verified ? 'confirm' : 'reject');
   toast(result.verified ? '已结束使用，座位已释放' : '已提交，正在刷新状态');
   if (!result.verified) laterRefresh(3000, 12000);
  } finally { state.opWorking = null; } });
 } finally { checkingOut = false; }
}

/* ---------- 取消预约 ---------- */
function cancelBookingDialog(id) {
 const r = state.records.find(x => same(x.id, id));
 if (!C.cancellableRecord(r)) { haptic('reject'); toast('学校记录显示这个预约现在不能取消，请刷新'); return; }
 haptic('tick');
 showDialog('<h2>取消这个预约？</h2>' + summary([['座位', esc((r.nameMerge || r.areaName || '图书馆') + ' · ' + String(r.no ?? r.name ?? ''))], ['时间', esc(bookingTime(r))]]) + '<p class="muted small">取消后座位会释放给其他同学。</p><div class="dialog-actions"><button class="btn text" data-action="closeDialog">保留预约</button><button class="btn filled danger" data-confirm-cancel="' + esc(r.id) + '">确认取消</button></div>', 'cancelBooking');
}
async function confirmCancelBooking(id) {
 if (cancelling) return;
 cancelling = true;
 closeDialog();
 const accountId = state.activeAccountId, r = state.records.find(x => same(x.id, id));
 state.opWorking = String(id);
 try {
  await opBusy(async () => { try {
   const result = await api('cancelBooking', {id: String(id)}, accountId);
   if (accountId !== state.activeAccountId) return;
   if (result.verified) await collapse(opCard('data-cancel-booking', id));
   state.records = result.records || state.records; state.recordsLoaded = true;
   if (result.verified && r) markTaskCancelled(r);
   await refreshCurrent();
   await save();
   haptic(result.verified ? 'confirm' : 'reject');
   toast(result.verified ? '已取消预约' : '已提交取消，正在刷新记录');
   if (!result.verified) laterRefresh(3000, 12000);
  } finally { state.opWorking = null; } });
 } finally { cancelling = false; }
}
// 本机预约任务约到的就是这个座位时，标记为已取消，不再显示“已预约”和签到提醒。
function markTaskCancelled(r) {
 const t = C.reservationTimes(r);
 if (!t) return;
 for (const x of state.tasks) if (x.status === 'succeeded' && x.bookedSeat && String(x.bookedSeat.no) === String(r.no ?? r.name ?? '') && x.day === t.begin.day && x.start === t.begin.time) { x.bookingCancelled = true; x.message = '已在助手里取消这个预约'; }
 lastLive = ''; syncLiveSeat(); syncReminders();
}

/* ---------- 弹层 ---------- */
function showDialog(html, kind = '') {
 const dlg = $('#dialog'); clearTimeout(dlg.closeTimer); dlg.classList.remove('closing');
 const d = $('#dialog');
 // 弹窗开着时换内容（确认 → 进度 → 结果）：高度平滑过渡；换成另一种弹窗时新内容再淡入，不硬切
 const morph = d.open && motionOn(), from = morph ? d.getBoundingClientRect().height : 0, swap = morph && d.dataset.kind !== kind;
 d.dataset.kind = kind;
 d.innerHTML = '<div class="sheet" tabindex="-1" autofocus><div class="sheet-handle"></div><button class="icon-btn sheet-close" data-action="closeDialog" aria-label="关闭">' + I.close + '</button>' + html + '</div>';
 if (!d.open) { d.showModal(); return; }
 playTapMorph();
 if (!morph) return;
 const to = d.getBoundingClientRect().height;
 if (Math.abs(to - from) > 2) d.animate([{height: from + 'px', overflow: 'hidden'}, {height: to + 'px', overflow: 'hidden'}], {duration: 240, easing: EASE.out});
 if (swap) for (const el of d.querySelectorAll('.sheet > :not(.sheet-handle):not(.sheet-close)')) el.animate([{opacity: 0, transform: 'translateY(6px)'}, {opacity: 1, transform: 'none'}], {duration: 220, delay: 40, easing: 'ease-out', fill: 'backwards'});
}
function closeDialog(force = false) {
 const d = $('#dialog');
 if (!d.open || !force && d.dataset.kind === 'consent') return;
 // 关的时候先往下滑出再真正关闭；期间又打开了新弹窗就不关。
 if (!motionOn()) { d.close(); return; }
 d.classList.add('closing'); clearTimeout(d.closeTimer);
 // 等滑出动画真正播完再关（手机和电脑时长不同，都写在样式表里）；计时器只兜底，免得动画没触发时关不掉
 const finish = () => { clearTimeout(d.closeTimer); d.removeEventListener('animationend', onEnd); if (d.classList.contains('closing')) { d.classList.remove('closing'); d.close(); } };
 const onEnd = e => { if (e.target === d) finish(); };
 d.addEventListener('animationend', onEnd);
 d.closeTimer = setTimeout(finish, 400);
}
// 手机底部弹窗可以往下拖关：弹窗内容滚到顶时按住往下拉，跟手下移、遮罩变淡；拉过 1/4 或甩一下就关，不够就弹回
(() => {
 const d = $('#dialog'), drag = {y0: 0, t0: 0, dy: 0, on: false, track: false};
 const reset = () => { d.style.removeProperty('transform'); d.style.removeProperty('--scrim-o'); d.classList.remove('dragging'); };
 d.addEventListener('touchstart', e => {
  drag.track = innerWidth < 720 && e.touches.length === 1 && d.scrollTop <= 0 && d.dataset.kind !== 'consent' && !e.target.closest('input, select, textarea, .chip-row.scroll, .rules, .legal');
  drag.y0 = e.touches[0].clientY; drag.t0 = Date.now(); drag.dy = 0; drag.on = false;
 }, {passive: true});
 d.addEventListener('touchmove', e => {
  if (!drag.track) return;
  const dy = e.touches[0].clientY - drag.y0;
  if (!drag.on) { if (dy < -4 || d.scrollTop > 0) { drag.track = false; return; } if (dy < 8) return; drag.on = true; d.classList.add('dragging'); d.getAnimations().forEach(a => a.finish()); }
  e.preventDefault();
  drag.dy = Math.max(0, dy - 8);
  d.style.transform = 'translateY(' + drag.dy + 'px)';
  d.style.setProperty('--scrim-o', String(Math.max(0, 1 - drag.dy / (d.offsetHeight || 1))));
 }, {passive: false});
 const end = () => {
  if (!drag.on) { drag.track = false; return; }
  drag.on = drag.track = false;
  const fast = drag.dy / Math.max(1, Date.now() - drag.t0) > .6, from = drag.dy;
  d.classList.remove('dragging');
  if (from > d.offsetHeight / 4 || fast && from > 30) {
   haptic('tick');
   const a = d.animate([{transform: 'translateY(' + from + 'px)'}, {transform: 'translateY(' + (d.offsetHeight + 40) + 'px)'}], {duration: 180, easing: EASE.in, fill: 'forwards'});
   d.classList.add('closing-drag');
   let ran = false;
   const fin = () => { if (ran) return; ran = true; a.cancel(); reset(); d.classList.remove('closing-drag'); if (d.open) d.close(); };
   a.finished.then(fin, fin); setTimeout(fin, 300);
  } else {
   d.animate([{transform: 'translateY(' + from + 'px)'}, {transform: 'none'}], {duration: 360, easing: SPRING.sheet});
   reset();
  }
 };
 d.addEventListener('touchend', end); d.addEventListener('touchcancel', end);
})();
// 教务会话只在本次运行里建立，没连上不一定是没登录，所以文字用“未连接 / 连接”。
// 教务的连接状态按空教室实际在用的来源显示：离线模式下不再显示“已连接”。
function teachingNote() { return state.teachingOptions?.offline ? '没连上，空教室用本机数据' : ''; }
function connRow(name, ok, act, note = '') { const teach = act === 'autoTeaching' || act === 'loginTeaching'; return '<div class="conn-row"><span class="dot' + (ok ? ' ok' : '') + '"></span><div><b>' + name + '</b><span class="muted">' + (note || (ok ? '已连接' : teach ? '未连接' : '未登录')) + '</span></div><button class="btn tonal sm" data-action="' + (ok && teach ? 'loginTeaching' : act) + '">' + (ok ? '重新登录' : teach ? '连接' : '登录') + '</button></div>'; }
function accountDialog() {
 const a = account();
 let h = '<h2>账号与登录</h2>';
 if (state.supportsAccounts) h += '<div class="account-list">' + state.accounts.map(x => '<button class="account-card' + (x.id === state.activeAccountId ? ' selected' : '') + '" data-switch-account="' + esc(x.id) + '"><strong>' + esc(x.label) + '</strong><span class="small">' + esc(x.username || '尚未填写学号') + '</span><small>' + (x.id === state.activeAccountId ? '正在使用' : '点按切换') + '</small></button>').join('') + '</div>' + (state.accounts.length < 2 ? '<button class="btn tonal sm" data-action="addAccount">添加同伴账号</button>' : '') + '<p class="muted small">每个账号独立登录；已有任务仍按原账号执行。</p><h3>' + esc(a.label) + ' 的登录状态</h3>';
 h += '<div class="conn-list">' + connRow('图书馆', state.libraryConnected, 'loginLibrary') + connRow('学生教务', onlineRooms(), 'loginTeaching', teachingNote()) + '</div>';
 h += '<form id="credentialForm"><h3>自动登录（可选）</h3>' + (state.supportsAccounts ? '<label class="field"><span class="label">账号称呼</span><input id="accountName" maxlength="20" value="' + esc(a.label) + '" required></label>' : '')
  + '<label class="field"><span class="label">统一认证学号</span><input id="username" autocomplete="username" value="' + esc(state.username) + '" required></label><label class="field"><span class="label">一号通密码</span><input id="password" type="password" autocomplete="current-password" required></label>'
  + '<label class="check"><input type="checkbox" id="remember" checked><span>本机加密保存，登录过期时自动填写</span></label>'
  + '<p class="muted small">密码只保存在这台' + (state.platform === 'android' ? '手机，由 Android Keystore 加密' : '电脑，由当前 Windows 账户加密') + '。</p>'
  + '<div class="dialog-actions">' + (state.hasCredentials ? '<button type="button" class="btn text danger" data-action="forget">删除已存密码</button>' : '') + '<span class="spacer"></span><button class="btn filled" type="submit">保存并登录</button></div></form>';
 showDialog(h, 'account');
}
function notifySection() {
 if (state.platform !== 'android') return '';
 const n = state.notify || {}, on = state.preferences.seatNotify !== false;
 const row = (title, value, ok, act = '', label = '') => '<div class="conn-row"><span class="dot' + (ok ? ' ok' : '') + '"></span><div><b>' + title + '</b><span class="muted">' + value + '</span></div>' + (act ? '<button type="button" class="btn tonal sm" data-action="' + act + '">' + label + '</button>' : '') + '</div>';
 const live = n.sdk >= 36 ? (n.liveUpdates === false ? row('实时更新', '已被关闭，超级岛不会显示', false, 'openPromotedSettings', '去开启') : row('实时更新', '已开启', true)) : row('实时更新', '需要 Android 16（当前 Android ' + esc(androidName(n.sdk)) + '），只显示普通通知', false);
 const device = n.xiaomi ? '小米 / 澎湃OS ' + esc(String(n.osName || '').replace(/^OS/i, '')) + (n.focusProtocol ? ' · 焦点通知协议 ' + esc(n.focusProtocol) : '') + ' · 超级岛' + (n.island ? '支持' : '未检测到') : '非小米设备，显示为标准通知';
 return '<fieldset class="seg-group"><legend>通知与超级岛</legend><label class="switch-row"><span><b>显示当前预约</b><span class="muted small">常驻通知栏，点按出示入馆码</span></span><input type="checkbox" class="switch" id="seatNotify"' + (on ? ' checked' : '') + '></label>'
  + '<div class="conn-list">' + (n.allowed ? row('通知权限', '已允许' + (!on ? '' : n.seatShown ? '，正在显示' : '，暂无预约可显示'), true) : row('通知权限', '未允许', false, 'enableSeatNotify', '开启')) + live + (n.seatShown && n.sdk >= 36 ? row('系统处理', n.promoted ? '已提升为实时更新' : '未提升为实时更新（系统未接受）', !!n.promoted) : '') + row('小米焦点通知', n.focusAllowed ? '已授予，会使用超级岛专用样式' : '未授予（需要小米审核，个人开发者无法申请）', !!n.focusAllowed) + row('设备', device, !!n.island) + '</div>'
  + '<p class="muted small">超级岛由系统决定是否显示（澎湃OS 3.1 起支持）。小米焦点通知需企业认证，个人开发者用不了。</p>'
  + '<p class="muted small">更快打开：长按桌面图标选“入馆码”，或在控制中心添加“入馆码”磁贴。</p></fieldset>'
  + '<fieldset class="seg-group"><legend>入馆码</legend><label class="switch-row"><span><b>隐藏借还书</b><span class="muted small">入馆码页面只留入馆码；图书馆区域里也不显示“借还书业务”</span></span><input type="checkbox" class="switch" id="hideBorrow"' + (state.preferences.hideBorrow !== false ? ' checked' : '') + '></label></fieldset>'
  + '<fieldset class="seg-group"><legend>震动反馈</legend><label class="switch-row"><span><b>操作时轻震</b><span class="muted small">点按、成功和出错时轻震</span></span><input type="checkbox" class="switch" id="hapticsOn"' + (state.preferences.haptics !== false ? ' checked' : '') + '></label></fieldset>';
}
function androidName(sdk) { return ({24: '7', 25: '7.1', 26: '8', 27: '8.1', 28: '9', 29: '10', 30: '11', 31: '12', 32: '12L', 33: '13', 34: '14', 35: '15', 36: '16'})[sdk] || String(sdk || '?'); }
function settingsDialog() {
 const p = state.preferences;
 const seg = (name, list) => '<div class="seg">' + list.map(([v, l]) => '<label><input type="radio" name="' + name + '" value="' + v + '"' + ((p[name] ?? list[0][0]) === v ? ' checked' : '') + '><span>' + l + '</span></label>').join('') + '</div>';
 showDialog('<h2>设置</h2><form id="settingsForm">' + (NW ? '<fieldset class="seg-group"><legend>外观</legend>' + seg('mascotTheme', [['classic', '经典'], ['naiwa', '奶蛙']]) + '</fieldset>' : '') + '<fieldset class="seg-group"><legend>' + (NW ? '明暗模式' : '主题') + '</legend>' + seg('theme', [['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']]) + '</fieldset><fieldset class="seg-group"' + (NW ? ' data-naiwa-accents' : '') + '><legend>主题色</legend><div class="swatches">' + ACCENTS.map(([id, , name]) => '<label class="swatch"><input type="radio" name="accent" value="' + id + '"' + ((p.accent || 'blue') === id ? ' checked' : '') + '><span class="c-' + id + '"></span><small>' + name + '</small></label>').join('') + '</div></fieldset>' + (NW ? '<p class="naiwa-help" data-naiwa-hint>奶蛙使用暖黄配色；切回经典后恢复你选的主题色。</p>' : '') + '<fieldset class="seg-group"><legend>动画</legend>' + seg('motion', [['auto', '标准'], ['off', '减少动画']]) + '</fieldset>' + (state.platform === 'android' ? '<fieldset class="seg-group"><legend>底栏</legend>' + seg('glass', [['auto', '毛玻璃'], ['off', '不透明']]) + '<p class="muted small">毛玻璃更好看，但更费电；配置较低的手机会自动用不透明。</p></fieldset>' : '') + notifySection()
  + (state.platform === 'windows' ? '<fieldset class="seg-group"><legend>系统通知</legend><label class="switch-row"><span><b>Windows 通知</b><span class="muted small">预约结果、登录失效、签到提醒；窗口在前台时不弹</span></span><input type="checkbox" class="switch" id="desktopNotify"' + (state.preferences.desktopNotify !== false ? ' checked' : '') + '></label><button type="button" class="btn tonal sm" data-action="testNotify">发一条测试通知</button></fieldset><p class="muted small">Ctrl + 1–4 切换功能，Ctrl + R 刷新座位，Esc 关闭弹窗或学校页面。</p>' : '')
  + (PUBLIC ? '<fieldset class="seg-group"><legend>支持作者</legend><label class="switch-row"><span><b>在“我的”页显示收款码</b><span class="muted small">自愿支持，关掉不影响任何功能</span></span><input type="checkbox" class="switch" id="donateOn"' + (state.preferences.donateHidden ? '' : ' checked') + '></label></fieldset>' : '')
  + (PUBLIC ? '<fieldset class="seg-group"><legend>协议与数据</legend><div class="actions"><button type="button" class="btn tonal sm" data-action="legal">用户协议与隐私说明</button><button type="button" class="btn text sm danger" data-action="withdrawConsent">撤回同意并清除本机数据</button></div></fieldset>' : '')
  + '<fieldset class="seg-group"><legend>离线空教室</legend><label class="switch-row"><span><b>每天自动更新</b><span class="muted small">每天第一次打开时，把本校区今天起 7 天各节的空教室存到本机，没网也能查</span></span><input type="checkbox" class="switch" id="roomOfflineOn"' + (p.roomOffline !== false ? ' checked' : '') + '></label><p class="muted small" id="offlineStatus">' + esc(offlineStatus()) + '</p><div class="actions"><button type="button" class="btn tonal sm" data-action="syncRooms">立即更新</button></div>'
  + '<div class="switch-row"><span><b>教学周</b><span class="muted small">' + esc(weekNote()) + '</span></span><button type="button" class="btn tonal sm" data-action="setWeek">修改</button></div></fieldset>'
  + '<fieldset class="seg-group"><legend>每日一句</legend><label class="switch-row"><span><b>标题下显示一句古文</b><span class="muted small">图书馆和我的页，每天换一句</span></span><input type="checkbox" class="switch" id="quotesOn"' + (state.preferences.quotes !== false ? ' checked' : '') + '></label></fieldset>'
  + '<p class="about muted small">工大学伴 ' + SHOWN_VERSION + ' · 非学校官方应用' + '<br>数据只保存在本机，结果以学校系统为准。</p><div class="dialog-actions"><button type="button" class="btn filled" data-action="closeDialog">完成</button></div></form>', 'settings');
 window.NaiwaTheme?.syncSettings();
}
// 主题色：默认蓝色用样式表里调好的值；其他颜色由基色推出浅色/深色两套，写到根元素的 CSS 变量上。
function applyAccent(dark) {
 const root = document.documentElement.style, entry = ACCENTS.find(a => a[0] === state.preferences.accent);
 const vars = {primary: '--primary', onPrimary: '--on-primary', soft: '--primary-soft', onSoft: '--on-primary-soft', seat: '--seat', onSeat: '--on-seat'};
 if (!entry || entry[0] === 'blue') { Object.values(vars).forEach(n => root.removeProperty(n)); return dark ? '#4C93FF' : '#3482FF'; }
 const palette = C.accentPalette(entry[1], dark);
 for (const [key, name] of Object.entries(vars)) root.setProperty(name, palette[key]);
 return palette.primary;
}
function applyAppearance() {
 const p = state.preferences, root = document.documentElement;
 const theme = p.theme === 'system' && typeof state.systemDark === 'boolean' ? (state.systemDark ? 'dark' : 'light') : p.theme;
 root.dataset.theme = theme;
 root.dataset.motion = p.motion;
 // 悬浮底栏毛玻璃：小米 11 上滑动不掉帧，但合成线程忙一倍；内存或核数少的手机、减少动画、选了“不透明”时关掉
 const lowEnd = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
 if (p.glass !== 'off' && p.motion !== 'off' && !lowEnd) root.dataset.glass = ''; else delete root.dataset.glass;
 const dark = theme === 'dark' || theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches;
 const accent = window.NaiwaTheme?.apply(p, dark) || applyAccent(dark);
 window.NaiwaTheme?.syncSettings();
 // 状态栏、手势条跟页面实际背景同色（各主题的深色背景不一样，不能在原生端写死黑色）。
 const bg = (getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g) || []).map(Number);
 host('appearance', {dark, accent, bg: bg.length >= 3 && bg[3] !== 0 ? '#' + bg.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join('') : ''}).catch(() => {});
 // 记下这次的外观，下次冷启动时 boot.js 第一帧就用上
 try { localStorage.setItem('campus.boot.v1', JSON.stringify({data: {...root.dataset}, style: root.style.cssText, system: p.theme === 'system', dark})); } catch (e) {}
}
function go(page) {
 if (!PAGES[page]) return;
 if (pageFor(page) !== state.page) haptic('tick');
 const pages = navPages(), from = pages.indexOf(state.page), to = pages.indexOf(pageFor(page));
 state.page = pageFor(page); state.error = '';
 const animate = from !== to && from >= 0;
 if (animate) transition('tab', render); else render();
 // 手机上所有 WebView 共用一个渲染线程，后台登录教务、读记录会挤掉切页动画的帧：等入场动画播完（约 0.26 秒）再开始。
 const work = () => {
  if (['tasks', 'me'].includes(state.page) && state.libraryConnected && !state.recordsLoaded && !state.reading.records) loadRecords(true);
  if (state.page === 'me') { loadAccountStatus(); maybeThanks(); }
  if (state.page === 'exams') { const t = examTerm(state.examPrev), c = state.preferences.examCache?.[t.year + '-' + t.term]; if (!c) loadExams(); else if (onlineRooms() && Date.now() - c.at > 6 * 3600000) loadExams({quiet: true}); }
  if (state.page === 'rooms' && !onlineRooms()) autoConnectTeaching();
 };
 if (animate && state.platform === 'android' && motionOn()) setTimeout(work, 280); else work();
}
function back() {
 const d = $('#dialog');
 if (d.open && d.dataset.kind === 'consent') return false;
 if (d.open) { closeDialog(); return true; }
 // 正在打开某个区域（座位还没出来）时按返回，回到区域列表，不直接退出应用
 if (state.page === 'library' && (state.info || state.openingArea || state.areaId)) { backToAreas(); return true; }
 if (state.page !== 'library') { go('library'); return true; }
 return false;
}

/* ---------- 事件 ---------- */
async function action(name, arg = '') {
 switch (name) {
  case 'undo': { const undo = undoAction; hideToast(); await undo?.(); break; }
  case 'settings': if (state.platform === 'android') await refreshNotify(); settingsDialog(); break;
  case 'enableSeatNotify': {
   state.preferences.seatNotify = true; await save();
   state.notify = await host('requestNotify');
   lastLive = ''; syncLiveSeat(); render();
   if ($('#dialog').dataset.kind === 'settings') settingsDialog(); else if ($('#dialog').dataset.kind === 'booking') closeDialog();
   toast(state.notify?.allowed ? (liveSeatPayload() ? '已在通知栏显示预约座位' : '有预约时会在通知栏显示') : '通知权限未开启，可在系统设置里打开');
   break;
  }
  case 'requestNotify': state.notify = await host('requestNotify'); lastReminders = ''; syncReminders(); render(); toast(state.notify?.allowed ? '通知已开启，提醒会按时发出' : '通知权限未开启，可在系统设置里打开'); break;
  case 'dismissSeatNotify': state.preferences.seatNotify = false; await save(); render(); toast('不再提示；可在设置里重新打开'); break;
  case 'openPromotedSettings': await host('openNotifySettings', {promoted: true}); break;
  case 'account': case 'manageAccounts': accountDialog(); break;
  case 'favoriteSeat': favoriteSeatDialog(); break;
  case 'confirmFavoriteSeat': {
   const x = state.seats.find(s => same(s.id, $('#favoriteSeatId').value));
   if (!x) throw Error('请选择座位');
   state.favorites = C.addFavorite(state.favorites, 'seat', seatItem(x));
   await save(); closeDialog(); render(); toast('已收藏 ' + x.no + ' 号座位');
   break;
  }
  case 'favoriteSelection': await favoriteSelection(); break;
  case 'manageFavorites': favoritesDialog(); break;
  case 'closeDialog': closeDialog(); break;
  case 'dismissError': state.error = ''; render(); break;
  case 'backToAreas': backToAreas(); break;
  case 'loginLibrary': case 'loginTeaching': closeDialog(); await host('openLogin', {system: name === 'loginTeaching' ? 'teaching' : 'library', auto: state.hasCredentials, accountId: state.activeAccountId}); break;
  case 'refresh': if (state.areaId && state.info) await loadSeats(state.areaId); else await loadLibrary(); break;
  case 'records': await loadRecords(); break;
  case 'refreshCurrent': await busy(refreshCurrent, {kind: 'current'}); break;
  case 'officialCurrent': await host('openOfficial', {target: 'current', accountId: state.activeAccountId}); break;
  case 'seatMap': await host('openOfficial', {target: 'area', areaId: String(state.areaId), day: state.day, seatId: state.selection[0] ? String(state.selection[0].id) : '', accountId: state.activeAccountId}); break;
  case 'seatLocation': { const r = state.current.find(x => same(x.id, arg)) || state.current[0]; if (r) await host('openOfficial', {target: 'area', areaId: String(r.area_id ?? r.areaId ?? ''), day: reservationSpan(r).day || C.nowChina(), seatId: String(r.space_id ?? r.seat_id ?? r.space ?? ''), accountId: state.activeAccountId}); break; }
  case 'officialLibrary': await host('openOfficial', {target: 'library', accountId: state.activeAccountId}); break;
  case 'officialRecords': await host('openOfficial', {target: 'records', accountId: state.activeAccountId}); break;
  case 'officialTeaching': await host('openOfficial', {target: 'teaching', autoReturn: !state.teachingOptions, accountId: state.activeAccountId}); break;
  case 'openPass': closeDialog(); haptic('confirm'); await host('openOfficial', {target: 'pass', accountId: state.activeAccountId}); break;
  case 'confirmLeave': await confirmLeave(); break;
  case 'setWeek': weekDialog(); break;
  case 'clearWeekFix': await setWeekFix(null); break;
  case 'thisWeek': { const input = $('#roomForm [name="week"]'); if (input && state.teachingOptions?.currentWeek) { input.value = String(state.teachingOptions.currentWeek); input.dispatchEvent(new Event('change', {bubbles: true})); } break; }
  case 'clearPeriods': { const form = $('#roomForm'); if (form) { $$('#roomForm [name="period"]').forEach(x => x.checked = false); form.dispatchEvent(new Event('change', {bubbles: true})); } break; }
  case 'book': bookDialog(); break;
  case 'confirmBook': await confirmBook(); break;
  case 'loadExams': await loadExams(); break;
  case 'calendarExams': await calendarExams(); break;
  case 'allExams': allExamsDialog(); break;
  case 'officialExams': closeDialog(); await host('openOfficial', {target: state.platform === 'android' ? 'exams' : 'teaching', accountId: state.activeAccountId}); break;
  case 'retryBook': await retryBook(); break;
  case 'teachingOptions': await connectTeaching(); break;
  case 'forget': {
   const d = await host('forgetCredentials', {accountId: state.activeAccountId});
   if (state.supportsAccounts) acceptAccounts(d); else state.hasCredentials = false;
   closeDialog(); render(); toast('已删除保存的密码');
   break;
  }
  case 'clearDone': await clearDone(); break;
  case 'editRoomQuery': haptic('tick'); state.roomFormOpen = true; formAppear = true; render(); formAppear = false; break;
  case 'goTasks': closeDialog(); go('tasks'); break;
  case 'quickTomorrow': await quickTomorrow(); break;
  case 'acceptConsent': { if (!$('#consentCheck')?.checked) break; state.preferences.consent = LEGAL.version; state.preferences.consentAt = C.nowChina(); await save(); closeDialog(true); haptic('confirm'); const r = consentResolve; consentResolve = null; r?.(); break; }
  case 'declineConsent': if (state.platform === 'android' || state.platform === 'windows') await host('exitApp').catch(() => toast('不同意条款就无法使用，可直接关闭应用')); else toast('不同意条款就无法使用，可直接关闭应用'); break;
  case 'legal': legalDialog(); break;
  case 'withdrawConsent': showDialog('<h2>撤回同意并清除数据？</h2><p class="small">会删除这台' + (state.platform === 'android' ? '手机' : '电脑') + '上保存的学号密码、登录状态、任务、收藏、提醒、空教室结果和全部设置，然后重新打开应用。学校那边的预约记录不受影响。</p><div class="dialog-actions"><button class="btn text" data-action="closeDialog">取消</button><button class="btn filled danger" data-action="confirmWithdraw">清除并撤回</button></div>', 'withdraw'); break;
  case 'confirmWithdraw': closeDialog(); toast('正在清除…'); await host('resetAll'); break;
  case 'thanksZoom': $('#dialog .thanks-qr')?.classList.toggle('big'); break;
  case 'thanksLater': closeDialog(); break;
  case 'thanksNever': state.preferences.thanks = {...(state.preferences.thanks || {}), never: true}; save().catch(() => {}); closeDialog(); toast('好的，不会再提醒。谢谢你一直在用'); break;
  case 'hideDonate': state.preferences.donateHidden = true; await save(); render(); toast('已收起，可在设置里重新打开'); break;
  case 'saveDonate': {
   if ($('#dialog').dataset.kind === 'thanks') state.preferences.thanks = {...(state.preferences.thanks || {}), never: true}; const r = await host('saveDonate'); toast(r?.saved ? '已保存到相册的“工大学伴”文件夹' : '这台手机不支持直接保存，请截图后在微信里识别'); break; }
  case 'syncRooms': {
   if (roomSync.busy) break;
   closeDialog(); toast('正在更新离线空教室…');
   if (!onlineRooms() && state.teachingAuto.needsUser) { toast('教务要先验证登录：到空教室页点“登录教务”'); break; }
   if (!onlineRooms() && !await backgroundTeaching({manual: true})) { toast(state.teachingAuto.needsUser ? '教务要先验证登录：到空教室页点“登录教务”' : '连不上教务，稍后再试'); break; }
   const done = await syncOfflineRooms(true);
   toast(done === true ? '离线空教室已更新' : done === 'partial' ? '没有更新完，已下好的几天可以先用' : '没有更新完，仍在用原来的离线数据');
   break;
  }
  case 'randomSeat': {
   const pool = C.visibleSeats(state.seats, state.preferences.seatFilter, state.favorites, state.areaId).filter(x => x.available && !state.selection.some(y => same(y.id, x.id)));
   if (state.selection.length >= 3) { toast('最多选择 3 个座位'); haptic('reject'); break; }
   if (!pool.length) { toast('当前筛选下没有可选的空座'); break; }
   const seat = pool[Math.floor(Math.random() * pool.length)];
   state.selection.push(seat); haptic('heavy'); render();
   toast(['就它了：', '缘分座位：', '今天坐这儿：'][Math.floor(Math.random() * 3)] + seat.no + (/^[A-Za-z]?\d+$/.test(String(seat.no)) ? ' 号' : ''));
   requestAnimationFrame(() => $('.seat[data-seat="' + CSS.escape(String(seat.id)) + '"]')?.scrollIntoView({block: 'center', behavior: 'smooth'}));
   break;
  }
  case 'clearSeatFilter': state.preferences.seatFilter = {query: '', freeOnly: false, favoriteOnly: false}; render(); await save(); break;
  case 'clearRoomFilter': state.roomFavoritesOnly = false; state.roomBuilding = ''; state.roomLimit = ROOM_PAGE; renderRoomResults(); break;
  case 'moreRooms': haptic('tick'); state.roomLimit = (state.roomLimit || ROOM_PAGE) + ROOM_PAGE * 2; renderRoomResults(); break;
  case 'clearAreaFilter': state.preferences.areaFilter = {floor: '', freeOnly: false, sort: ''}; state.areaQuery = ''; render(); await save(); break;
  case 'autoTeaching': closeDialog(); if (state.page !== 'rooms') { state.page = 'rooms'; state.error = ''; render(); } await autoConnectTeaching(true); break;
  case 'showTeachingLogin': await host('openOfficial', {target: 'teaching', autoReturn: true, accountId: state.activeAccountId}); break;
  case 'refreshStatus': await loadAccountStatus({force: true}); if (!state.statusError) toast('账号状态已刷新'); break;
  case 'rules': await rulesDialog(); break;
  case 'editCountdown': countdownDialog(); break;
  case 'clearCountdown': state.preferences.countdown = null; await save(); closeDialog(); render(); toast('已删除倒计时'); break;
  case 'testNotify': { const r = await host('notify', {title: '工大学伴', text: '通知正常。', page: '', force: true}); if (!r?.shown) toast('系统没有显示通知，请检查 Windows 通知设置'); break; }
  case 'scrollTasks': $('#meTasks')?.scrollIntoView({block: 'start', behavior: 'smooth'}); break;
 }
}
document.addEventListener('click', async e => {
 const d = $('#dialog');
 if (e.target === d) { if (d.dataset.kind !== 'consent') d.close(); return; }
 const b = e.target.closest('button');
 if (!b || b.disabled) return;
 const ds = b.dataset;
 try {
  if (b.id === 'account' && state.platform === 'android') { go('me'); return; }
  if (ds.switchAccount) { if (await selectAccount(ds.switchAccount)) accountDialog(); return; }
  if (ds.taskRecords) { const t = state.tasks.find(x => x.id === ds.taskRecords); if (t) await host('openOfficial', {target: 'records', accountId: t.accountId || 'default'}); return; }
  if (ds.starType || ds.removeFavorite || ds.useFavorite) { haptic('tick'); await favoriteClick(b); return; }
  if (ds.leave) { haptic('tick'); leaveDialog(ds.leave); return; }
  if (ds.achv) { haptic('tick'); achievementDialog(ds.achv); return; }
  if (ds.cal) { const was = state.calMonth || C.nowChina().slice(0, 7); state.calMonth = ds.cal === C.nowChina().slice(0, 7) ? '' : ds.cal; swapNext('.cal-grid', ds.cal > was ? 24 : -24); haptic('tick'); render(); return; }
  if (ds.summary) { haptic('tick'); summaryDialog(ds.summary); render(); return; }
  if (ds.checkout) { checkoutDialog(ds.checkout); return; }
  if (ds.confirmCheckout) { await confirmCheckout(ds.confirmCheckout); return; }
  if (ds.cancelBooking) { cancelBookingDialog(ds.cancelBooking); return; }
  if (ds.exam) { examDialog(ds.exam); return; }
  if (ds.examTerm) { const prev = ds.examTerm === 'prev'; if (prev !== !!state.examPrev) { state.examPrev = prev; state.examError = ''; render(); const t = examTerm(prev); if (!state.preferences.examCache?.[t.year + '-' + t.term]) loadExams(); } return; }
  if (ds.confirmCancel) { await confirmCancelBooking(ds.confirmCancel); return; }
  if (ds.roomOpen) { const x = state.rooms?.rooms.find(r => same(r.id, ds.roomOpen)); if (x) openRoomDay({name: x.name, exactId: x.id, title: x.name}); return; }
  if (ds.roomShift) { const n = Number(ds.roomShift); if (n) swapNext('#dialog .room-day, #dialog .day-nav strong', n > 0 ? 24 : -24); shiftRoomDay(n); return; }
  if (ds.seatLocation) { await action('seatLocation', ds.seatLocation); return; }
  if (ds.roomPage) { await roomPage(Number(ds.roomPage)); return; }
  if (ds.page) { closeDialog(); go(ds.page); return; }
  if (ds.seat) { toggleSeat(ds.seat); return; }
  if (ds.area) { await loadSeats(ds.area, true); return; }
  if (ds.day) { await changeDay(ds.day); return; }
  if (ds.library) { await changeLibrary(ds.library); return; }
  if (ds.toggle || 'roomBuilding' in ds || 'areaFloor' in ds || ds.periodPreset || ds.week) haptic('tick');
  if (['roomFavoritesOnly', 'roomSort', 'roomLong'].includes(ds.toggle) || 'roomBuilding' in ds) swapNext('#roomResults .room-row');
  if (ds.toggle === 'roomFavoritesOnly') { state.roomFavoritesOnly = !state.roomFavoritesOnly; state.roomLimit = ROOM_PAGE; renderRoomResults(); return; }
  if (ds.toggle === 'roomSort') { state.roomSort = state.roomSort === 'cap' ? '' : 'cap'; state.roomLimit = ROOM_PAGE; renderRoomResults(); return; }
  if (ds.toggle === 'roomLong') { state.roomSort = state.roomSort === 'long' ? '' : 'long'; state.roomLimit = ROOM_PAGE; renderRoomResults(); return; }
  if ('roomBuilding' in ds) { state.roomBuilding = ds.roomBuilding; state.roomLimit = ROOM_PAGE; renderRoomResults(); return; }
  if ('areaFloor' in ds) { state.preferences.areaFilter.floor = ds.areaFloor; swapNext('.area-list .area-row'); render(); await save(); return; }
  if (ds.toggle?.startsWith('area:')) { const f = state.preferences.areaFilter, k = ds.toggle.slice(5); if (k === 'sort') f.sort = f.sort ? '' : 'free'; else f[k] = !f[k]; swapNext('.area-list .area-row'); render(); await save(); return; }
  if (ds.periodPreset) { applyPeriodPreset(ds.periodPreset); return; }
  if (ds.toggle) { state.preferences.seatFilter[ds.toggle] = !state.preferences.seatFilter[ds.toggle]; swapNext('.seat-grid'); render(); await save(); return; }
  if (ds.week) { stepWeek(Number(ds.week)); return; }
  if (ds.cancel) { await cancelTask(ds.cancel); return; }
  if (ds.action) await action(ds.action);
 } catch (err) { report(err); }
});
document.addEventListener('change', async e => {
 const el = e.target, id = el.id;
 try {
  if (id === 'activeAccount') { await selectAccount(el.value); return; }
  if (id === 'seatNotify') {
   state.preferences.seatNotify = el.checked; await save();
   if (el.checked && !state.notify?.allowed) state.notify = await host('requestNotify');
   syncLiveSeat(); settingsDialog(); render();
   return;
  }
  if (id === 'desktopNotify') { state.preferences.desktopNotify = el.checked; await save(); return; }
  if (id === 'consentCheck') { $('#consentAccept').disabled = !el.checked; return; }
  if (id === 'donateOn') { state.preferences.donateHidden = !el.checked; await save(); haptic('tick'); render(); return; }
  if (id === 'quotesOn') { state.preferences.quotes = el.checked; await save(); haptic('tick'); render(); return; }
  if (id === 'hideBorrow') { state.preferences.hideBorrow = el.checked; await save(); haptic('tick'); render(); toast(el.checked ? '已隐藏借还书入口和“借还书业务”区域' : '借还书入口和区域都会显示'); return; }
  if (id === 'roomOfflineOn') { state.preferences.roomOffline = el.checked; await save(); haptic('tick'); return; }
  if (id === 'hapticsOn') { state.preferences.haptics = el.checked; await save(); haptic('confirm'); return; }
  if (el.closest?.('#remindForm')) {
   state.preferences.checkinLead = Number(el.value); await save(); syncReminders(); render();
   if (state.platform === 'android' && Number(el.value) && !state.notify?.allowed) toast('需要先开启通知权限，提醒才能发出');
   return;
  }
  if (NW && el.closest?.('#settingsForm') && el.name === 'mascotTheme') {
   if (mascotThemeSaving) return;
   const previous = state.preferences.mascotTheme;
   mascotThemeSaving = true;
   document.querySelectorAll('[name="mascotTheme"]').forEach(x => x.disabled = true);
   try {
    state.preferences.mascotTheme = NaiwaTheme.normalize(el.value);
    applyAppearance(); render(); await save(); haptic('tick');
   } catch (err) {
    state.preferences.mascotTheme = previous;
    applyAppearance(); render();
    document.querySelectorAll('[name="mascotTheme"]').forEach(x => x.checked = x.value === NaiwaTheme.normalize(previous));
    throw err;
   } finally {
    mascotThemeSaving = false;
    document.querySelectorAll('[name="mascotTheme"]').forEach(x => x.disabled = false);
   }
   return;
  }
  if (el.closest?.('#settingsForm')) { haptic('tick'); if (el.name === 'theme' || el.name === 'motion' || el.name === 'glass' || el.name === 'accent') { state.preferences[el.name] = el.value; applyAppearance(); await save(); } return; }
  if (el.closest?.('#roomForm')) {
   if (e.isTrusted) haptic('tick');
   state.preferences.roomQuery = roomQueryFromForm($('#roomForm'));
   save().catch(report);
   if (['xnm', 'xqm', 'xqh_id'].includes(el.name)) {
    await roomTask(async () => { const q = state.preferences.roomQuery; state.teachingOptions = await teaching('options', {year: q.year, term: q.term, campus: q.campus}); q.building = ''; applyTeachingDefaults(); state.rooms = null; });
    return;
   }
   roomFormChanged();
   return;
  }
  if (id === 'libraryId') { await changeLibrary(el.value); return; }
  if (id === 'segment') { state.segment = el.value; state.selection = []; render(); }
 } catch (err) { report(err); }
});
document.addEventListener('toggle', e => { if (e.target.classList?.contains('term-box')) state.termOpen = e.target.open; }, true);
document.addEventListener('submit', async e => {
 e.preventDefault();
 const form = e.target;
 try {
  if (form.id === 'credentialForm') {
   const username = $('#username').value.trim(), password = $('#password').value, remember = $('#remember').checked, accountId = state.activeAccountId, label = $('#accountName')?.value || '';
   const d = await host('credentials', {username, password, remember, accountId, label});
   $('#password').value = '';
   if (state.supportsAccounts) acceptAccounts(d); else { state.username = username; state.hasCredentials = remember; }
   closeDialog(); render();
   await host('openLogin', {system: 'library', auto: true, accountId});
  }
  if (form.id === 'countdownForm') {
   const name = $('#cdName').value.trim(), day = $('#cdDay').value;
   if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error('请填写名称和日期');
   state.preferences.countdown = {name: name.slice(0, 12), day};
   await save(); closeDialog(); render();
   const d = C.daysUntil(day);
   toast(d > 0 ? '距离' + name + '还有 ' + d + ' 天' : '倒计时已保存');
  }
  if (form.id === 'weekForm') { const n = Number(new FormData(form).get('week')); if (!(n >= 1 && n <= 30)) throw Error('请填 1–30 之间的周次'); await setWeekFix(n); return; }
  if (form.id === 'roomFind') {
   const name = String(new FormData(form).get('room') || '').trim();
   if (!name) { haptic('reject'); toast('请输入教室名称或房间号'); return; }
   state.roomFind = name; $('#roomFindInput')?.blur();
   openRoomDay({name, fromForm: true, date: form.querySelector('[name=date]')?.value || ''});
   return;
  }
  if (form.id === 'roomForm') {
   const fd = new FormData(form), week = Number(fd.get('week')), periods = fd.getAll('period').map(Number);
   if (!periods.length || !(week >= 1 && week <= 53)) throw Error('请填写教学周并至少选择一个节次');
   state.preferences.roomQuery = roomQueryFromForm(form);
   save().catch(report);
   if (await runRoomQuery(state.preferences.roomQuery)) window.scrollTo(0, 0);
  }
 } catch (err) { report(err); }
});
function searchInput(el) {
 if (el.id === 'seatSearch') { state.preferences.seatFilter.query = el.value; render(); }
 else if (el.id === 'areaSearch') { state.areaQuery = el.value; render(); }
 else if (el.id === 'roomFindInput') state.roomFind = el.value;
 else if (el.id === 'roomFindDate') state.roomFindDate = el.value;
 else if (el.name === 'week' && el.closest('#roomForm') && state.preferences.roomQuery && Number(el.value) >= 1) state.preferences.roomQuery = {...state.preferences.roomQuery, week: Number(el.value)};
}
// 中文输入法还在拼写时整页重画会把输入框换掉、打断输入：等选好字（compositionend）再处理。
// 悬浮底栏的滑块可以按住拖：按住约 0.25 秒或按下后横着拖，滑块浮起来跟着手指走，经过的图标放大、轻震；松手停在哪个就切到哪个（仿 iOS 26 底栏）
const navDrag = {id: null, timer: 0, on: false, x0: 0, over: null, ate: 0};
function navButtons(nav) { return [...nav.querySelectorAll('button[data-page]')].filter(b => !b.hidden && getComputedStyle(b).display !== 'none'); }
function navDragMove(nav, x) {
 const pill = nav.querySelector('.nav-pill'), r = nav.getBoundingClientRect();
 if (!pill) return;
 // 拖动时滑块以中心放大 1.12 倍、左右各多出 6%，按底栏内侧宽度（不含边框）夹住，贴边时不冒出底栏
 const w = pill.offsetWidth, grow = w * .06, left = Math.min(Math.max(x - r.left - nav.clientLeft - w / 2, 6 + grow), nav.clientWidth - w - 6 - grow);
 pill.style.transform = 'translateX(' + left + 'px) scale(1.12, 1.16)';
 const over = navButtons(nav).find(b => { const q = b.getBoundingClientRect(); return x >= q.left && x < q.right; }) || null;
 if (over !== navDrag.over) { navDrag.over?.classList.remove('lens'); over?.classList.add('lens'); if (navDrag.over && over) haptic('tick'); navDrag.over = over; }
}
function navDragStart(nav, x) {
 navDrag.on = true; nav.classList.add('dragging'); haptic('tap'); navDragMove(nav, x);
}
function navDragEnd(nav, commit) {
 clearTimeout(navDrag.timer);
 const was = navDrag.on, target = navDrag.over;
 navDrag.id = null; navDrag.on = false; navDrag.over?.classList.remove('lens'); navDrag.over = null;
 if (!was) return;
 // 从松手时滑块所在的位置弹到目标，不是先跳回原位再滑
 const pill = nav.querySelector('.nav-pill'), m = pill && new DOMMatrix(getComputedStyle(pill).transform);
 nav.classList.remove('dragging'); navDrag.ate = Date.now() + 400; pillAt = pill ? Math.round(m.e) + ',' + pill.offsetWidth : '';
 if (commit && target && pageFor(target.dataset.page) !== state.page) go(target.dataset.page); else movePill(nav);
}
(() => {
 const nav = $('.nav');
 if (!nav) return;
 nav.addEventListener('pointerdown', e => {
  if (getComputedStyle(nav).position !== 'fixed' || navDrag.id != null || !nav.querySelector('.nav-pill')) return;
  navDrag.id = e.pointerId; navDrag.x0 = e.clientX; navDrag.ate = 0;
  navDrag.timer = setTimeout(() => { if (navDrag.id === e.pointerId) navDragStart(nav, navDrag.x0); }, 250);
 });
 nav.addEventListener('pointermove', e => {
  if (e.pointerId !== navDrag.id) return;
  if (!navDrag.on && Math.abs(e.clientX - navDrag.x0) > 10) { clearTimeout(navDrag.timer); navDragStart(nav, e.clientX); }
  if (navDrag.on) { try { nav.setPointerCapture(e.pointerId); } catch (x) {} navDragMove(nav, e.clientX); }
 });
 nav.addEventListener('pointerup', e => { if (e.pointerId === navDrag.id) navDragEnd(nav, true); });
 nav.addEventListener('pointercancel', e => { if (e.pointerId === navDrag.id) navDragEnd(nav, false); });
 nav.addEventListener('contextmenu', e => e.preventDefault());
 // 拖完松手时浏览器可能补一个点击：只吃松手后 0.4 秒内的这一次，免得又切回按下时那一页。
 // 不能一直挂着等它：拖得远时浏览器不补，之后没有“按下”的点击（无障碍服务点按、脚本）会被误吞
 nav.addEventListener('click', e => { if (Date.now() < navDrag.ate) { navDrag.ate = 0; e.preventDefault(); e.stopPropagation(); } }, true);
})();
document.addEventListener('input', e => { if (!e.isComposing) searchInput(e.target); });
document.addEventListener('compositionend', e => searchInput(e.target));
document.addEventListener('focusin', e => { if (!e.target.matches?.(TEXT_INPUT)) return; imeTarget = e.target; setTimeout(revealInput, 400); if (!e.target.closest('dialog')) { document.body.classList.add('typing'); updateDock(); } });
// 输入法弹出、页面变矮之后，把正在输入的框挪到可见区域中间（弹窗里的也一样）。
let imeTarget = null;
function revealInput() { const el = imeTarget; if (!el || document.activeElement !== el) return; const r = el.getBoundingClientRect(), h = window.visualViewport?.height || window.innerHeight; if (r.top < 60 || r.bottom > h - 16) el.scrollIntoView({block: 'center', behavior: 'smooth'}); }
(window.visualViewport || window).addEventListener('resize', () => requestAnimationFrame(revealInput));
document.addEventListener('focusout', () => setTimeout(() => { if (!document.activeElement?.matches?.(TEXT_INPUT)) { document.body.classList.remove('typing'); updateDock(); } }, 60));
document.addEventListener('keydown', e => {
 if (e.ctrlKey && !e.altKey && /^[1-4]$/.test(e.key)) {
  const page = navPages()[Number(e.key) - 1];
  if (page) { e.preventDefault(); go(page); }
 } else if (e.ctrlKey && e.key.toLowerCase() === 'r') {
  e.preventDefault();
  if (state.page === 'library') { if (state.areaId && state.info) loadSeats(state.areaId); else loadLibrary(); }
 }
});
$('#dialog').addEventListener('cancel', e => { if ($('#dialog').dataset.kind === 'consent') e.preventDefault(); });
// close 事件是异步派发的：关掉后立刻又打开了新弹层时，不能清掉新弹层的类型。
$('#dialog').addEventListener('close', () => { if (!$('#dialog').open) $('#dialog').dataset.kind = ''; });
window.addEventListener('scroll', () => $('#appbar').classList.toggle('scrolled', window.scrollY > 36), {passive: true});
window.addEventListener('resize', updateDock);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (state.preferences.theme === 'system' && typeof state.systemDark !== 'boolean') applyAppearance(); });

const pull = {y: 0, active: false, dist: 0, busy: false, el: null};
function pullIndicator() {
 if (!pull.el) { pull.el = document.createElement('div'); pull.el.className = 'ptr'; pull.el.setAttribute('aria-hidden', 'true'); pull.el.innerHTML = I.refresh; document.body.appendChild(pull.el); }
 return pull.el;
}
function setPull(d) {
 const el = pullIndicator();
 el.classList.add('dragging');
 el.style.transform = 'translate(-50%,' + Math.round(d - 44) + 'px) rotate(' + Math.round(d * 4) + 'deg)';
 el.style.opacity = d > 6 ? String(Math.min(1, d / 64)) : '0';
 el.classList.toggle('ready', d >= 64);
}
function endPull() { const el = pullIndicator(); el.classList.remove('dragging', 'ready'); el.style.transform = ''; el.style.opacity = ''; }
// 按当前页面刷新对应数据：图书馆刷新区域/座位与当前预约，空教室重新查询，任务刷新学校记录。
async function pullRefresh() {
 const el = pullIndicator();
 pull.busy = true; el.classList.add('spin');
 try {
  if (state.page === 'library' || !state.libraryConnected && state.page !== 'rooms') { if (state.libraryConnected && state.areaId && state.info) await loadSeats(state.areaId); else await loadLibrary(); }
  else if (state.page === 'rooms') {
   // 下拉刷新：先试着连上教务，连上了就按同样的条件联网重查一遍；连不上就用本机数据重算。
   if (!onlineRooms()) { if (state.teachingConnected) await connectTeaching(); else await autoConnectTeaching(true); }
   const q = state.roomsStale ? state.preferences.roomQuery : state.roomQuery && {...state.roomQuery, page: state.rooms?.page || 1};
   if (state.rooms && q) await runRoomQuery(q, {online: onlineRooms(), keep: !state.roomsStale});
   else if (onlineRooms()) await roomTask(loadTeachingOptions);
   if (!onlineRooms() && !state.error) { toast('连不上教务，用的是本机数据'); return; }
  }
  else if (state.page === 'tasks' || state.page === 'me') { if (state.page === 'me') await loadAccountStatus({force: true}); await busy(async () => { setRecords(await api('records')); await refreshCurrent(); }, {kind: 'records'}); }
  else await busy(refreshCurrent, {kind: 'current'});
  if (!state.error) toast('已刷新');
 } finally { pull.busy = false; el.classList.remove('spin'); endPull(); }
}
document.addEventListener('touchstart', e => {
 pull.active = !pull.busy && !state.loading && e.touches.length === 1 && window.scrollY <= 0 && !$('#dialog').open && !e.target.closest('.chip-row.scroll, .nav, .lib-side, .appbar, .toast, input, select');
 pull.y = e.touches[0].clientY; pull.dist = 0;
 if (pull.active) document.addEventListener('touchmove', pullMove, {passive: false});
}, {passive: true});
// 非 passive 的 touchmove 会让每次滚动都先等脚本：只在页面顶端按下、可能是下拉刷新时才临时挂上。
function pullMove(e) {
 if (!pull.active) return;
 const dy = e.touches[0].clientY - pull.y;
 if (dy <= 0 || window.scrollY > 0) { if (pull.dist) endPull(); pull.dist = 0; return; }
 pull.dist = Math.min(110, dy * .5);
 setPull(pull.dist);
 if (e.cancelable) e.preventDefault();
}
document.addEventListener('touchcancel', () => { document.removeEventListener('touchmove', pullMove); if (pull.active) { pull.active = false; pull.dist = 0; endPull(); } });
document.addEventListener('touchend', () => {
 document.removeEventListener('touchmove', pullMove);
 if (!pull.active) return;
 pull.active = false;
 if (pull.dist >= 64) { haptic('tick'); pullRefresh(); } else endPull();
 pull.dist = 0;
});


// 旧版本存下的任务说明换成现在的说法（不再让人去学校页面核对）。
const OLD_MESSAGES = [[/请到官方记录核对|请核对官方记录/, '已提交，但预约记录里暂时没有；刷新时会自动再核对'], [/^预约已核验/, '约到了，记得按时签到'], [/^官方记录中已有相同预约/, '这个座位已经约到了，不用重复提交']];
function freshMessage(m) { const hit = OLD_MESSAGES.find(([re]) => re.test(String(m || ''))); return hit ? hit[1] : m; }
async function init() {
 render();
 try {
  const d = await host('ready');
  state.platform = d.platform;
  state.username = d.username || '';
  state.hasCredentials = !!d.hasCredentials;
  state.supportsAccounts = false;
  if (typeof d.systemDark === 'boolean') state.systemDark = d.systemDark;
  if (PAGES[d.launchPage]) state.page = d.launchPage;
  if (d.accountState) acceptAccounts(d.accountState);
  state.tasks = Array.isArray(d.state?.tasks) ? d.state.tasks : [];
  for (const t of state.tasks) {
   t.accountId = t.accountId || 'default';
   t.accountName = t.accountName || account(t.accountId).label;
   if (!Array.isArray(t.seats)) { t.seats = []; t.status = 'failed'; }
   t.message = freshMessage(t.message);
  }
  state.favorites = Array.isArray(d.state?.favorites) ? d.state.favorites : [];
  const saved = d.state?.preferences || {};
  state.preferences = {...state.preferences, ...saved};
  state.preferences.uncertainLeaveIds = (saved.uncertainLeaveIds || []).map(id => String(id).includes(':') ? id : 'default:' + id);
  state.preferences.seatFilter = {freeOnly: true, favoriteOnly: false, ...saved.seatFilter, query: ''};
  state.preferences.areaFilter = {floor: '', freeOnly: false, sort: '', ...saved.areaFilter};
  state.preferences.manualReminders = Array.isArray(saved.manualReminders) ? saved.manualReminders : [];
  state.preferences.firedReminders = Array.isArray(saved.firedReminders) ? saved.firedReminders : [];
  state.libraryId = saved.libraryId || '';
  // 晚上 10 点以后多半是在约明天
  const lateDefault = chinaHour() >= 22 && !window.CampusFixedDay;
  if (lateDefault) state.day = addDays(C.nowChina(), 1);
  state.areaId = saved.areaId || '';
  // v1 是按算错一周的“当前周”下载的（第 8 周实为第 7 周），整份作废。
  try { for (const k of ['qlu.roomCache.v1', 'qlu.roomDayCache.v1', 'qlu.roomOffline.v1']) localStorage.removeItem(k); } catch (e) {}
  applyAppearance();
  $('#platform').textContent = d.platform === 'windows' ? 'Windows · 本机运行' : '安卓 · 本机运行';
  booker = new C.Booker({tasks: state.tasks, api, save, changed: onTasksChanged});
  for (const t of state.tasks) lastStatus.set(t.id, t.status);
  await booker.recover();
  render();
  const asked = PUBLIC && state.preferences.consent !== LEGAL.version;
  if (asked) await askConsent();
  window.CampusRuntimeReady = true;
  countOpen();
  // 紧接着读图书馆时会再画一次；只有弹过协议才需要先刷新一下
  if (asked) render();
  if (state.platform === 'android') { setInterval(tick, 1000); await refreshNotify(); }
  await loadLibrary();
  // 学校还没开放明天的预约时（没有区域），回到今天，不要一打开就是空白
  if (lateDefault && state.libraryConnected && !state.areas.length && state.day !== C.nowChina()) { state.day = C.nowChina(); await loadLibrary(); }
  syncReminders();
  if (['tasks', 'me'].includes(state.page) && state.libraryConnected && !state.recordsLoaded) loadRecords(true);
  if (state.page === 'rooms') autoConnectTeaching();
 } catch (e) { state.error = e.message; $('#platform').textContent = '客户端未连接'; render(); }
}
petUI = window.NaiwaPetUI?.create({getState: () => state, save, render, showDialog, closeDialog, toast, haptic, go, refresh: async () => { const before = state.petRecordsAt; await loadRecords(true); if (state.petRecordsAt === before) throw Error('这次没有同步到学校记录，奶蛙状态先保留'); }}) || null;
init();
})();
