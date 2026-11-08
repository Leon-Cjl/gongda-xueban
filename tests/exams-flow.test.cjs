const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app/ui.js'), 'utf8');
const featureSource = fs.readFileSync(path.join(__dirname, '../app/exams.js'), 'utf8');
const block = source.slice(source.indexOf('async function teachingSettled()'), source.indexOf('const examFeature ='));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return {promise, resolve, reject}; };
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function setup(extra = {}) {
 const state = {activeAccountId: 'default', username: 'student-a', page: 'exams', platform: 'android', preferences: {}, teachingAuto: {}, schoolTerm: {year: '2026', term: '3'}};
 const calls = {save: 0, render: 0, haptic: [], queued: [], toast: []};
 const context = vm.createContext({
  state, Date, JSON, Array, Set, Error, Intl,
  C: {nowChina: () => '2026-10-29', daysUntil: () => 1, errorText: e => e.message || e.code},
  dtf: locale => ({format: () => locale === 'en-GB' ? '08:00' : '周五'}), md: day => day.slice(5), esc,
  I: {calendar: '', map: '', chevron: '', warn: '', refresh: ''},
  pageHead: title => title, cacheTime: () => '10/29 08:00', summary: rows => JSON.stringify(rows),
  showDialog: html => { calls.dialog = html; },
  teachingConnecting: false, teachingEpoch: 0, sleep: async () => {}, onlineRooms: () => true,
  backgroundTeaching: async () => true, useOfflineRooms: () => { calls.dropped = (calls.dropped || 0) + 1; },
  onlineTeaching: async () => ({exams: [],totalKnown:true,total:0}), save: async () => { calls.save++; },
  render: () => { calls.render++; }, haptic: kind => calls.haptic.push(kind),
  setTimeout: fn => calls.queued.push(fn), toast: text => calls.toast.push(text), ...extra
 });
 vm.runInContext(featureSource + '\n' + block, context);
 context.examsTest = context.CampusExams.create({...context, onlineTeaching: (...args) => context.onlineTeaching(...args), refreshView: context.render});
 return {state, calls, context, ...context.examsTest};
}
const cache = exams => ({year: '2026', term: '3', owner: 'student-a', at: Date.now(), exams});
const sample = (extra = {}) => ({kch: 'MATH', kcmc: '高等数学', ksmc: '期末', kssj: '', ...extra});

test('same course with multiple pending exams opens each original detail', () => {
 const s = setup();
 s.state.preferences.examCache = {'2026-3': cache([sample(), sample(), sample({ksmc: '补考'})])};
 const list = s.examList(s.state.preferences.examCache['2026-3']);
 assert.equal(new Set(list.map(e => e.key)).size, 3);
 for (const item of list) { s.examDialog(item.key); assert.ok(s.calls.dialog.includes(item.x.ksmc)); }
});
test('pending exams get their own group and never imply all exams finished', () => {
 const s = setup();
 s.state.preferences.examCache = {'2026-3': cache([sample(), sample({kssj: '2026-10-30(09:00-11:00)'})])};
 const html = s.examsView();
 assert.ok(html.includes('即将考试 · 1') && html.includes('时间待公布 · 1'));
 assert.ok(html.includes('导入日历（1 场）'));
 s.state.preferences.examCache['2026-3'].exams = [sample()];
 assert.ok(!s.examsView().includes('都已结束'));
});
test('a reply arriving after changing account does not save or overwrite the new cache', async () => {
 const gate = deferred(), s = setup({onlineTeaching: () => gate.promise});
 const run = s.loadExams();
 await new Promise(setImmediate);
 s.state.username = 'student-b';
 const next = {owner: 'student-b', exams: []};
 s.state.preferences.examCache = {'new': next};
 gate.resolve({exams: [sample()]});
 assert.equal(await run, false);
 assert.equal(s.state.preferences.examCache.new, next);
 assert.equal(s.calls.save, 0);
 assert.equal(s.calls.haptic.length, 0);
 assert.equal(s.calls.queued.length, 1, 'new account can query once the old request releases its lock');
});
test('failure from the old account does not invalidate the new session or show its error', async () => {
 const gate = deferred(), s = setup({onlineTeaching: () => gate.promise});
 const run = s.loadExams();
 await new Promise(setImmediate);
 s.state.activeAccountId = 'other'; s.state.examError = 'new-account-error';
 gate.reject(Object.assign(Error('old-network-error'), {code: 'NETWORK'}));
 assert.equal(await run, false);
 assert.equal(s.state.examError, 'new-account-error');
 assert.equal(s.calls.dropped, undefined);
});
test('account changing while connection is pending cannot dispatch an exam request', async () => {
 const gate = deferred(); let requests = 0;
 const s = setup({onlineRooms: () => false, backgroundTeaching: () => gate.promise, onlineTeaching: async () => { requests++; return {exams: []}; }});
 const run = s.loadExams();
 await new Promise(setImmediate);
 s.state.username = 'student-b'; gate.resolve(true);
 assert.equal(await run, false); assert.equal(requests, 0);
});
test('malformed replies preserve the previous cache without resubmitting credentials', async () => {
 let requests = 0;
 const s = setup({onlineTeaching: async () => { requests++; return {unexpected: true}; }});
 const previous = cache([sample()]); s.state.preferences.examCache = {'2026-3': previous};
 assert.equal(await s.loadExams(), false);
 assert.equal(requests, 1);
 assert.equal(s.state.preferences.examCache['2026-3'], previous);
 assert.equal(s.calls.save, 0);
 assert.ok(s.state.examError.includes('格式有变化'));
});
test('a valid empty list replaces old exams; a quiet network error keeps data and marks stale', async () => {
 const s = setup(); s.state.preferences.examCache = {'2026-3': cache([sample()])};
 assert.equal(await s.loadExams(), true);
 assert.equal(s.state.preferences.examCache['2026-3'].exams.length, 0);
 s.context.onlineTeaching = async () => { throw Object.assign(Error('网络连接失败'), {code: 'NETWORK'}); };
 assert.equal(await s.loadExams({quiet: true}), false);
 assert.equal(s.state.examError, '');
 assert.ok(s.examsView().includes('仍显示这份缓存：网络连接失败'));
});
test('pull to refresh on exams never calls library even when library is disconnected', async () => {
 const s = setup(), indicator = {classList: {add() {}, remove() {}}};
 let endCount = 0, result = true;
 Object.assign(s.context, {pull: {busy: false}, pullIndicator: () => indicator, endPull: () => endCount++,
  loadExams: async () => result, loadLibrary: () => assert.fail('must not read library'),
  loadSeats: () => assert.fail('must not read seats'), busy: () => assert.fail('must not read reservations')});
 const start = source.indexOf('async function pullRefresh()');
 vm.runInContext(source.slice(start, source.indexOf("\ndocument.addEventListener('touchstart'", start)), s.context);
 await s.context.pullRefresh();
 assert.deepEqual(s.calls.toast, ['考试安排已更新']);
 result = false; await s.context.pullRefresh();
 assert.equal(s.calls.toast.length, 1, 'no success message for failure or an already busy query');
 assert.equal(s.context.pull.busy, false); assert.equal(endCount, 2);
});
test('unchanged exam data keeps the cached array and requests metadata-only UI updates', async () => {
 const data = [sample()], refreshes = [], s = setup({onlineTeaching: async () => ({exams: data})});
 s.state.preferences.examCache = {'2026-3': cache(data)};
 s.context.examsTest = s.context.CampusExams.create({...s.context, teachingSettled: s.context.teachingSettled, dropTeaching: s.context.dropTeaching, refreshView: options => refreshes.push(options.contentChanged)});
 assert.equal(await s.context.examsTest.loadExams(), true);
 assert.equal(s.state.preferences.examCache['2026-3'].exams, data);
 assert.deepEqual(refreshes, [false, false]);
});
