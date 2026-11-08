const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const C = require('../app/core.js'), Toast = require('../app/toast.js');
const {agent, schoolDocument} = require('./helpers/agent-harness.cjs');
const url = 'https://jw.qlu.edu.cn/jwglxt/cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155';
const params = {year: '2026', term: '3', week: 7, weekday: 2, periods: [1]};
const html = '<!doctype html><html><h5>用户登录</h5></html>';

test('both teaching reads classify redirected/login HTML responses without treating malformed JSON as expired', async () => {
 for (const method of ['rooms', 'exams']) {
  for (const response of [
   {ok: true, status: 200, redirected: true, url: 'https://sso.qlu.edu.cn/login', text: async () => html},
   {ok: true, status: 200, text: async () => '\uFEFF' + html},
   {ok: false, status: 401, text: async () => ''}
  ]) {
   const a = agent({url, document: schoolDocument(), fetcher: async () => response});
   const r = await a.run(method, params);
   assert.equal(r.ok, false); assert.ok(['AUTH', 'EXPIRED'].includes(r.error.code));
  }
  const bad = agent({url, document: schoolDocument(), fetcher: async () => ({ok: true, text: async () => '<html>系统维护中</html>'})});
  assert.equal((await bad.run(method, params)).error.code, 'PARSE');
  const valid = agent({url, document: schoolDocument(), fetcher: async () => ({ok: true, text: async () => JSON.stringify({items: [], totalResult: 0})})});
  assert.equal((await valid.run(method, params)).ok, true);
 }
});

test('school jQuery parser errors also recognize the login HTML and preserve true format errors', async () => {
 for (const [text, expected] of [[html, 'EXPIRED'], ['unexpected response', 'PARSE']]) {
  const a = agent({url, document: schoolDocument(), jquery: {ajax: options => options.error({status: 200, responseText: text}, 'parsererror')}});
  assert.equal((await a.run('rooms', params)).error.code, expected);
 }
});

test('foreground teaching reads share one recovery and replay once using their original parameter snapshots', async () => {
 const source = fs.readFileSync(path.join(__dirname, '../app/ui.js'), 'utf8');
 const state = {activeAccountId: 'a', username: 'one', teachingOptions: {}};
 let release, connections = 0;
 const gate = new Promise(resolve => { release = resolve; }), calls = new Map();
 const context = vm.createContext({state, structuredClone,
  onlineTeaching: async (method, p) => { const n = (calls.get(p.week) || 0) + 1; calls.set(p.week, n); if (n === 1) throw Object.assign(Error('expired'), {code: 'EXPIRED'}); return p; },
  offlineCovers: () => false, teachingSettled: async () => {}, dropTeaching() {},
  backgroundTeaching: async () => { connections++; await gate; return true; }
 });
 vm.runInContext(source.match(/^const inputOwner = .*$/m)[0], context);
 vm.runInContext(source.slice(source.indexOf('async function teaching(method'), source.indexOf('function offlineCovers(')), context);
 const p = {week: 7}, a = context.teaching('rooms', p), b = context.teaching('rooms', {week: 8});
 p.week = 99; await new Promise(setImmediate); release();
 assert.equal((await a).week, 7); assert.equal((await b).week, 8);
 assert.equal(connections, 1); assert.deepEqual([...calls.values()], [2, 2]);
 context.onlineTeaching = async () => { throw Object.assign(Error('format'), {code: 'PARSE'}); };
 await assert.rejects(context.teaching('rooms', {week: 9}), e => e.code === 'PARSE');
 assert.equal(connections, 1, 'a format error cannot trigger another password attempt');
});

test('same-parity offline samples beat a nearer opposite week, and unavoidable mismatch is disclosed', () => {
 const d = {base: {day: '2026-10-21', week: 7}, periods: [1], rooms: [['a', '101', 'A', 60]], days: {
  '2026-10-14': {week: 6, s: '1'}, '2026-10-21': {week: 7, s: '0'}
 }};
 const hit = C.offlineDay(d, 8, 3);
 assert.equal(hit.source, '2026-10-14'); assert.equal(hit.parityMismatch, false);
 assert.equal(C.offlineRooms(d, {week: 8, weekday: 3, periods: [1]}).rooms.length, 1);
 delete d.days['2026-10-14'];
 assert.equal(C.offlineRooms(d, {week: 8, weekday: 3, periods: [1]}).parityMismatch, true);
 assert.equal(C.offlineRoomDay(d, {week: 8, weekday: 3, name: '101'}).parityMismatch, true);
});

test('release velocity detects a late flick, excludes an old pause, and cancellation can spring back', () => {
 assert.equal(C.gestureVelocity([[0, 0], [8, 900], [45, 940], [70, 980]], 980), 62 / 80);
 assert.equal(C.gestureVelocity([[0, 0], [80, 100], [80, 300]], 300), 0);
 assert.equal(C.gestureVelocity([[0, 0], [80, 100], [50, 140]], 140), -30 / 40);
 assert.ok(C.sheetOffset(-200) < 0 && C.sheetOffset(-200) > -30);
 assert.equal(C.sheetOffset(100), 92);
});

test('current period uses actual school times and the selected date, with boundaries handled precisely', () => {
 const day = '2026-10-29';
 assert.equal(C.periodState('08:00-08:45', day, day, 480), 'now');
 assert.equal(C.periodState('08:00-08:45', day, day, 525), 'past');
 assert.equal(C.periodState('08:00-08:45', day, day, 479), '');
 assert.equal(C.periodState('08:00-08:45', '2026-10-30', day, 500), '');
 assert.equal(C.periodState('未提供', day, day, 500), '');
});

function clock() {
 let now = 0, seq = 0; const timers = new Map(), shown = [], hidden = [];
 const t = Toast.create({show: item => shown.push(item.text), hide: (item, immediate, done) => { hidden.push(item.text); done(); },
  now: () => now, schedule: (fn, ms) => { const id = ++seq; timers.set(id, {fn, at: now + ms}); return id; }, cancel: id => timers.delete(id)});
 const advance = ms => { const target = now + ms; for (;;) { const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0]; if (!next || next[1].at > target) break; timers.delete(next[0]); now = next[1].at; next[1].fn(); } now = target; };
 return {t, advance, shown, hidden};
}
test('new status messages cannot erase undo and multiple undos keep their own callbacks', () => {
 const {t, advance, shown} = clock(); let first = 0, second = 0;
 t.push('removed one', () => first++); t.push('refreshing'); t.push('removed two', () => second++);
 assert.equal(t.current.text, 'removed one'); assert.equal(t.queued, 2);
 t.undo(); assert.equal(first, 1); assert.equal(t.current.text, 'refreshing');
 advance(4000); assert.equal(t.current.text, 'removed two'); t.undo(); t.undo();
 assert.equal(second, 1); assert.deepEqual(shown, ['removed one', 'refreshing', 'removed two']);
});
test('hidden/held/focused time does not consume an undo deadline; resume uses the remaining time', () => {
 const {t, advance} = clock(); t.push('undo', () => {}); advance(2000);
 t.pause('hidden', true); t.pause('press', true); advance(30000);
 t.pause('hidden', false); advance(10000); assert.ok(t.current);
 t.pause('press', false); advance(4499); assert.ok(t.current); advance(1); assert.equal(t.current, null);
});
test('a stale fade-out completion never clears a newer toast or its undo callback', () => {
 const done = []; let undone = 0;
 const t = Toast.create({show() {}, hide: (item, immediate, next) => done.push(next), schedule: () => 1, cancel() {}, now: () => 0});
 t.push('old'); t.dismiss(); t.push('new', () => undone++); done.shift()();
 assert.equal(t.current.text, 'new'); t.undo(); assert.equal(undone, 1);
});
test('clearing an account removes its queued undo callbacks and cancels their timers', () => {
 const {t, advance, shown} = clock(); let undone = false;
 t.push('old-account-undo', () => { undone = true; }); t.push('old-account-status');
 t.clear(); t.undo(); advance(30000);
 assert.equal(undone, false); assert.equal(t.current, null); assert.equal(t.queued, 0);
 t.push('new-account'); assert.deepEqual(shown, ['old-account-undo', 'new-account']);
});
