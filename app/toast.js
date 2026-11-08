/* Toast lifecycle shared by the view and isolated tests. */
(function(root, factory) {
 const api = factory();
 if (typeof module === 'object' && module.exports) module.exports = api; else root.CampusToast = api;
})(globalThis, function() {
 'use strict';
 function create({show, hide, now = () => performance.now(), schedule = setTimeout, cancel = clearTimeout}) {
  let current = null, timer = null, started = 0, remaining = 0, sequence = 0;
  const pending = [], pauses = new Set();
  function stop() { if (timer !== null) { cancel(timer); timer = null; remaining = Math.max(0, remaining - (now() - started)); } }
  function start() { if (!current || pauses.size || timer !== null) return; started = now(); timer = schedule(() => dismiss(), remaining); }
  function display(item) { stop(); current = item; remaining = item.undo ? 6500 : 4000; sequence++; show(item); start(); }
  function push(text, undo) {
   const item = {text: String(text), undo: typeof undo === 'function' ? undo : null};
   if (current?.undo) {
    if (!item.undo && pending.some(x => !x.undo && x.text === item.text)) return;
    // Ordinary status messages may coalesce; every still-live undo remains available.
    if (!item.undo && pending.filter(x => !x.undo).length >= 4) pending.splice(pending.findIndex(x => !x.undo), 1);
    pending.push(item); return;
   }
   display(item);
  }
  function dismiss(immediate = false) {
   if (!current) return;
   stop(); const item = current, token = ++sequence; current = null;
   hide(item, immediate, () => { if (token !== sequence || current) return; if (pending.length) display(pending.shift()); });
  }
  function pause(reason, active) { if (active) { pauses.add(reason); stop(); } else { pauses.delete(reason); start(); } }
  function undo() { const fn = current?.undo; if (!fn) return; dismiss(true); return fn(); }
  function clear() { pending.length = 0; stop(); const item = current || {text: '', undo: null}; current = null; sequence++; hide(item, true, () => {}); }
  return {push, dismiss, pause, undo, clear, get current() { return current; }, get queued() { return pending.length; }};
 }
 return {create};
});
