/* 工大学伴 · 共享界面外壳（shell）：构建开关、版本常量、主题调色、SVG 图标、全局状态模型。
   由 ui.js 顶部抽离，逐字节一致；ui.js 通过 window.CampusShell 桥接引用，行为不变。
   抽取边界：原 ui.js 的纯声明段（构建开关/常量/图标/状态模型 + reading/loading 存取器）。 */
(function(root){
"use strict";
const BUILD_FLAGS = Object.freeze({uiShellV2: window.CampusBuildFlags?.uiShellV2 !== false, motionV2: window.CampusBuildFlags?.motionV2 !== false, glassQuality: window.CampusBuildFlags?.glassQuality !== false});
if (!BUILD_FLAGS.motionV2) document.documentElement.dataset.motion = 'off';
if (!BUILD_FLAGS.glassQuality) delete document.documentElement.dataset.glass;
const VERSION = window.CampusEditionVersion || document.querySelector('.footer')?.textContent.match(/工大学伴\s+(\d+(?:\.\d+)+)/)?.[1] || '';
// 公开版提供立即预约。
const PUBLIC = window.CampusEdition === 'public';
const SHOWN_VERSION = PUBLIC ? (window.CampusEditionVersion || '') : VERSION;
const LEGAL = window.CampusLegal || {version: 0, sections: []};
const C = CampusCore;
// 可选奶蛙主题和小屋。
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
 bootPending: true, bootError: '', localStateBlocked: false, vaultState: 'unknown', restartPersistence: 'none', authProtocol: false, libraryAuth: null,
 catalog: [], areas: [], seats: [], selection: [], records: [], recordsLoaded: false, current: [], currentError: '',
 day: C.nowChina(), libraryId: '', areaId: '', start: '', end: '', kind: 3, segment: '', info: null,
 loading: false, error: '', updated: '', teachingOptions: null, rooms: null, roomQuery: null, roomFavoritesOnly: false, roomFormOpen: true, termOpen: false, teachingHint: '',
 bookingId: '', favorites: [], notify: null, currentAt: 0, knownCurrent: [],
 profile: null, violations: null, statusAt: 0, statusLoading: false, statusError: '', rules: {}, reminders: [], remindersAt: 0, areaQuery: '', roomBuilding: '', roomSort: '',
 teachingAuto: {busy: false, tried: false, needsUser: false, error: ''},
 roomDay: null, roomFind: '', roomFindDate: '', calMonth: '', roomLoading: false, roomsStale: false, roomLimit: 0, libraryAuto: {busy: false, needsUser: false},
 preferences: {...(NW ? {mascotTheme: 'naiwa'} : {}), theme: 'system', motion: 'auto', quality: 'standard', glass: 'auto', accent: 'blue', seatNotify: true, roomQuery: null, seatFilter: {query: '', freeOnly: true, favoriteOnly: false}, areaFilter: {floor: '', freeOnly: false, sort: ''}, checkinLead: 15, countdown: null, manualReminders: [], firedReminders: [], desktopNotify: true}
};
// 读取标记按用途分开：读入馆记录、提交签退等不再挡住换日期和选座。state.loading 只是“有任何一种在读”，给进度条和通用判断用。
state.reading = {library: false, current: false, records: false, op: false, account: false};
Object.defineProperty(state, 'loading', {get: () => Object.values(state.reading).some(Boolean), set: v => { state.reading.account = !!v; }});

root.CampusShell = {BUILD_FLAGS, VERSION, PUBLIC, SHOWN_VERSION, LEGAL, C, NW, $, $$, esc, same, svg, I, ACCENTS, PAGES, NAV, STATUS, TONE, WEEKDAYS, QUOTES, TEXT_INPUT, state};
})(typeof globalThis!=="undefined"?globalThis:this);
