/* 系统级动效运行时：在现有 CampusMotion 之上做性能增强，纯叠加、不改任何现有函数。
   1) writeBatch    —— rAF 合并 DOM 写入，避免同帧多次读/写交错造成的布局抖动（layout thrashing）。
   2) promote       —— 动画元素自动加 will-change，把 transform/opacity 动画提升到合成层，不触发主线程重排。
   3) armPassive    —— 对常用滚动容器挂被动监听，消除滚动时因 preventDefault 检查产生的卡顿。
   依赖：CampusMotion（motion.js），须在 motion.js 之后、ui.js 之前加载。 */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusMotionRuntime = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  /* ---- rAF 合并写入：把一批 (el, props) 合到同一帧写，读操作（如 getComputedStyle）放到写之前 ---- */
  function createWriter(schedule) {
    const scheduleFrame = schedule || (cb => {
      if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb);
      return setTimeout(cb, 16);
    });
    let queue = [], handle = null;
    function flush() {
      handle = null;
      const jobs = queue; queue = [];
      // 先统一读（computed 样式），再统一写，避免读写在帧内交替
      const reads = [], writes = [];
      for (const job of jobs) {
        if (job.read) reads.push(job);
        else writes.push(job);
      }
      for (const job of reads) { try { job.read(job.el, job.props); } catch (_) {} }
      for (const job of writes) {
        try {
          const el = job.el, p = job.props;
          if (el && el.style && p) for (const k in p) el.style[k] = p[k];
        } catch (_) {}
      }
    }
    function push(el, props, read) {
      if (read) queue.push({ el, props, read });
      else queue.push({ el, props });
      if (handle === null) { const token = {}; handle = token; scheduleFrame(() => { if (handle === token) flush(); }); }
    }
    return { push, flush, pending: () => handle !== null };
  }

  /* ---- 合成层提升：给正在动画的元素加 will-change，结束后回收 ---- */
  const promoted = new WeakMap();
  function promote(el, props) {
    if (!el || el.nodeType !== 1 || !el.style) return () => {};
    const value = Array.isArray(props) ? props.join(', ') : String(props || 'transform, opacity');
    let lease = promoted.get(el);
    if (!lease) { lease = {previous: el.style.willChange || '', values: new Map(), applied: ''}; promoted.set(el, lease); }
    const token = {};
    lease.values.set(token, value);
    const apply = () => {
      const hints = [...new Set([...lease.values.values()].flatMap(v => v.split(',').map(x => x.trim()).filter(Boolean)))];
      lease.applied = hints.join(', '); el.style.willChange = lease.applied;
    };
    apply();
    let done = false;
    return () => {
      if (done) return; done = true;
      lease.values.delete(token);
      // Respect a newer owner outside this runtime.
      if (el.style.willChange === lease.applied) {
        if (lease.values.size) apply();
        else if (lease.previous) el.style.willChange = lease.previous;
        else if (typeof el.style.removeProperty === 'function') el.style.removeProperty('will-change');
        else delete el.style.willChange;
      }
      if (!lease.values.size) promoted.delete(el);
    };
  }

  /* ---- 被动滚动监听：对选择器命中的容器挂 passive 监听，降低滚动卡顿 ---- */
  const passiveArmed = new WeakSet();
  function armPassive(doc, selectors) {
    if (!doc || typeof doc.querySelectorAll !== 'function') return 0;
    const sels = selectors || ['.content', '.sheet-body', '.area-list', '.seat-grid', '.fav-list'];
    let count = 0;
    try {
      for (const sel of sels) {
        for (const el of doc.querySelectorAll(sel)) {
          try {
            if (passiveArmed.has(el)) continue;
            passiveArmed.add(el);
            el.addEventListener('touchstart', () => {}, { passive: true });
            el.addEventListener('touchmove', () => {}, { passive: true });
            el.addEventListener('wheel', () => {}, { passive: true });
            count++;
          } catch (_) {}
        }
      }
    } catch (_) {}
    return count;
  }

  /* ---- 包装现有 motion：play 时自动提升合成层，结束回收 ---- */
  function wrapMotion(motion) {
    if (!motion || typeof motion.play !== 'function') return motion;
    if (motion.__runtimeWrapped) return motion;
    const origPlay = motion.play.bind(motion);
    const origSpring = typeof motion.springRect === 'function' ? motion.springRect.bind(motion) : null;
    const origLiquid = typeof motion.liquidRect === 'function' ? motion.liquidRect.bind(motion) : null;

    function withPromote(el, run) {
      if (!el || el.nodeType !== 1) return run();
      const un = promote(el);
      let result;
      try { result = run(); } catch (e) { un(); throw e; }
      const settle = () => un();
      // finished 是 thenable：动画结束即回收；否则用兜底超时回收，避免泄漏 will-change
      if (result && result.finished && typeof result.finished.then === 'function') result.finished.then(settle, settle);
      else setTimeout(settle, 400);
      return result;
    }

    motion.play = (el, preset, frames, options) => withPromote(el, () => origPlay(el, preset, frames, options));
    if (origSpring) motion.springRect = (el, from, to, min, max, vel) => withPromote(el, () => origSpring(el, from, to, min, max, vel));
    if (origLiquid) motion.liquidRect = (el, from, to, min, max) => withPromote(el, () => origLiquid(el, from, to, min, max));
    motion.__runtimeWrapped = true;
    return motion;
  }

  function create(deps) {
    const d = deps || {};
    const motion = d.motion || globalThis.CampusMotion || null;
    const writer = createWriter(d.schedule);
    const enhanced = motion && motion.create ? wrapMotion(motion.create(d.motionOptions || {})) : null;
    return {
      motion: enhanced,
      writeBatch: writer.push,
      flushWrites: writer.flush,
      promote,
      armPassive: (doc, sels) => armPassive(doc || (typeof document !== 'undefined' ? document : null), sels),
      presets: motion ? motion.presets : { route: 220, feedback: 180, press: 220, sheet: 300, liquid: 360 }
    };
  }

  return { create, createWriter, promote, armPassive, wrapMotion };
});
