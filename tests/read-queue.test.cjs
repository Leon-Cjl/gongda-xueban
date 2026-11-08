const {test} = require('node:test'), assert = require('node:assert/strict');
const {create} = require('../app/read-queue.js');
const flush = () => new Promise(setImmediate);
function gate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return {promise, resolve, reject}; }
function fixture() {
 let owner = {accountId: 'a', username: 'one', epoch: 0}, n = 0;
 const requests = [], timers = new Map();
 const q = create({scope: () => owner, send: (method, params, scope) => { const d = gate(); requests.push({method, params, scope, ...d}); return d.promise; },
  setTimer: fn => { timers.set(++n, fn); return n; }, clearTimer: id => timers.delete(id)});
 return {q, requests, timers, switch: value => { owner = value; }, expire: () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); }};
}
test('identical reads share transport and preserve a snapshot of query parameters', async () => {
 const f = fixture(), params = {year: '2026', week: 7, periods: [1, 2]};
 const a = f.q.request('rooms', params), b = f.q.request('rooms', {...params});
 params.week = 8; params.periods.push(3); await flush();
 assert.equal(f.requests.length, 1); assert.equal(f.requests[0].params.week, 7); assert.deepEqual(f.requests[0].params.periods, [1, 2]);
 f.requests[0].resolve({rooms: []}); assert.deepEqual(await a, await b);
});
test('a caller timing out does not release the transport or send the next request', async () => {
 const f = fixture(), slow = f.q.request('rooms', {week: 7}, {limit: 8});
 const timeout = assert.rejects(slow, e => e.code === 'TIMEOUT' && e.slow);
 const next = f.q.request('exams', {}); await flush(); f.expire(); await timeout; await flush();
 assert.equal(f.requests.length, 1);
 f.requests[0].resolve({rooms: []}); await flush(); assert.equal(f.requests.length, 2);
 f.requests[1].resolve({exams: []}); await next;
});
test('each consumer of a shared read has its own deadline', async () => {
 const f = fixture(), a = f.q.request('options', {}, {limit: 1});
 const timedOut = assert.rejects(a, {code: 'TIMEOUT'}), b = f.q.request('options');
 await flush(); f.expire(); await timedOut;
 f.requests[0].resolve({ready: true}); assert.equal((await b).ready, true); assert.equal(f.requests.length, 1);
});
test('foreground reads overtake queued background reads without interrupting active transport', async () => {
 const f = fixture(), active = f.q.request('status'), background = f.q.request('rooms', {week: 1}, {priority: 1}), foreground = f.q.request('exams');
 await flush(); f.requests[0].resolve({}); await active; await flush(); assert.equal(f.requests[1].method, 'exams');
 f.requests[1].resolve({}); await foreground; await flush(); assert.equal(f.requests[2].method, 'rooms');
 f.requests[2].resolve({}); await background;
});
test('account changes discard late results and queued old-account reads', async () => {
 const f = fixture(), active = f.q.request('status'), queued = f.q.request('rooms', {week: 7});
 const rejected = Promise.all([assert.rejects(active, {code: 'STALE'}), assert.rejects(queued, {code: 'STALE'})]);
 await flush(); f.switch({accountId: 'b', username: 'two', epoch: 0}); f.requests[0].resolve({}); await rejected;
 assert.equal(f.requests.length, 1);
});
test('transport failure drains the queue and clears deduplication state', async () => {
 const f = fixture(), a = f.q.request('status'), rejected = assert.rejects(a, /offline/), b = f.q.request('exams');
 await flush(); f.requests[0].reject(Error('offline')); await rejected; await flush();
 f.requests[1].resolve({exams: []}); await b;
 const retry = f.q.request('status'); await flush(); assert.equal(f.requests.length, 3); f.requests[2].resolve({}); await retry;
});
test('write operations are rejected before any transport dispatch', async () => {
 const f = fixture(); await assert.rejects(f.q.request('reserve')); assert.equal(f.requests.length, 0);
});
test('a switch before the dispatch microtask sends no old-account request', async () => {
 const f = fixture(), read = f.q.request('status'), rejected = assert.rejects(read, {code: 'STALE'});
 f.switch({accountId: 'b', username: 'two', epoch: 1}); await rejected; assert.equal(f.requests.length, 0);
});

test('the caller deadline includes time spent behind an active background read', {timeout: 2000}, async () => {
 const f = fixture(), active = f.q.request('rooms', {week: 7}, {priority: 1});
 await flush();
 let settled = false, failure;
 const queued = f.q.request('exams', {}, {limit: 8}).catch(e => { settled = true; failure = e; });
 f.expire(); await flush();
 assert.equal(settled, true, 'foreground deadline must not wait for the background transport to finish');
 assert.equal(failure.code, 'TIMEOUT'); assert.equal(f.requests.length, 1);
 f.requests[0].resolve({rooms: []}); await active; await queued; await flush();
 assert.equal(f.requests.length, 1, 'a fully expired queued read must never be sent');
});

test('dispatching a queued read does not restart its caller timer', {timeout: 2000}, async () => {
 const f = fixture(), active = f.q.request('status'); await flush();
 const queued = f.q.request('exams', {}, {limit: 8});
 const before = [...f.timers.keys()];
 assert.equal(before.length, 1, 'timer is armed while waiting');
 f.requests[0].resolve({}); await active; await flush();
 assert.deepEqual([...f.timers.keys()], before, 'the original deadline is retained after dispatch');
 f.requests[1].resolve({exams: []}); await queued;
 assert.equal(f.timers.size, 0);
});

test('an expired queued consumer cannot cancel another live consumer of the same read', {timeout: 2000}, async () => {
 const f = fixture(), active = f.q.request('status'); await flush();
 const expired = f.q.request('exams', {}, {limit: 1});
 const rejected = assert.rejects(expired, {code: 'TIMEOUT'});
 const alive = f.q.request('exams');
 f.expire(); await rejected;
 f.requests[0].resolve({}); await active; await flush();
 assert.equal(f.requests.length, 2);
 f.requests[1].resolve({exams: ['synthetic']}); assert.deepEqual(await alive, {exams: ['synthetic']});
});

test('a classroom caller can fall back to local data while another teaching transport is still active', {timeout: 2000}, async () => {
 const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
 const ui = fs.readFileSync(path.join(__dirname, '../app/ui.js'), 'utf8');
 const f = fixture(), active = f.q.request('status'); await flush();
 const cached = {rooms: [{id: 'synthetic-cached-room'}]}, notices = [];
 const context = vm.createContext({structuredClone, state: {activeAccountId: 'a', username: 'one', teachingOptions: {}},
  offlineCovers: () => true, onlineRooms: () => true, offlineTeaching: () => cached,
  onlineTeaching: (method, params, limit) => f.q.request(method, params, {limit}), toast: text => notices.push(text),
  goOfflineRooms: () => assert.fail('a waiting timeout must not discard a valid connection')});
 vm.runInContext(ui.match(/^const inputOwner = .*$/m)[0], context);
 vm.runInContext(ui.slice(ui.indexOf('async function teaching(method'), ui.indexOf('function offlineCovers(')), context);
 const result = context.teaching('rooms', {week: 7, periods: [1]});
 f.expire(); assert.equal(await result, cached); assert.equal(notices.length, 1);
 assert.equal(f.requests.length, 1, 'only the original active request was sent');
 f.requests[0].resolve({}); await active; await flush();
 assert.equal(f.requests.length, 1, 'the abandoned classroom read is never dispatched later');
});
