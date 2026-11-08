/* Read-only bridge queue: caller deadlines do not release the underlying transport. */
(function(root, factory) {
 const api = factory();
 if (typeof module === 'object' && module.exports) module.exports = api;
 else root.CampusReadQueue = api;
})(globalThis, function() {
 'use strict';
 const stable = value => JSON.stringify(value, function(key, item) {
  if (item && Object.prototype.toString.call(item) === '[object Object]') return Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]]));
  return item;
 });
 const stale = () => Object.assign(Error('查询条件或账号已变化'), {code: 'STALE'});
 function create({send, scope, setTimer = setTimeout, clearTimer = clearTimeout}) {
  const entries = new Map(), queue = []; let active = null;
  const finishWaiter = (waiter, error, data) => {
   if (waiter.done) return;
   waiter.done = true; clearTimer(waiter.timer);
   error ? waiter.reject(error) : waiter.resolve(data);
  };
  const startDeadline = waiter => {
   if (waiter.limit > 0) waiter.timer = setTimer(() => finishWaiter(waiter, Object.assign(Error('教务响应太慢'), {code: 'TIMEOUT', slow: true})), waiter.limit);
  };
  function pump() {
   if (active) return;
   queue.sort((a, b) => a.priority - b.priority);
   const entry = queue.shift(); if (!entry) return;
   if (stable(scope()) !== entry.ownerKey) {
    entries.delete(entry.key); entry.waiters.forEach(w => finishWaiter(w, stale())); pump(); return;
   }
   if (entry.waiters.every(w => w.done)) { entries.delete(entry.key); pump(); return; }
   active = entry; entry.started = true;
   Promise.resolve().then(() => {
    if (stable(scope()) !== entry.ownerKey) throw stale();
    return send(entry.method, entry.params, entry.owner);
   }).then(
    data => complete(null, data), error => complete(error)
   );
   function complete(error, data) {
    if (stable(scope()) !== entry.ownerKey) error = stale();
    entries.delete(entry.key); active = null;
    entry.waiters.forEach(w => finishWaiter(w, error, data)); pump();
   }
  }
  function request(method, params = {}, {limit = 0, priority = 0} = {}) {
   if (!['status', 'options', 'rooms', 'exams'].includes(method)) return Promise.reject(Error('此队列只处理只读查询'));
   const owner = {...scope()}, ownerKey = stable(owner), snapshot = JSON.parse(JSON.stringify(params));
   const key = ownerKey + '|' + method + '|' + stable(snapshot);
   let entry = entries.get(key);
   if (!entry) { entry = {key, owner, ownerKey, method, params: snapshot, priority, waiters: [], started: false}; entries.set(key, entry); queue.push(entry); }
   entry.priority = Math.min(entry.priority, priority);
   const result = new Promise((resolve, reject) => {
    const waiter = {resolve, reject, limit, timer: null, done: false}; entry.waiters.push(waiter);
    // Caller patience includes waiting in the queue; dispatch must not reset this timer.
    startDeadline(waiter);
   });
   pump(); return result;
  }
  return {request};
 }
 return {create};
});
