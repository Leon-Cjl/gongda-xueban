/* 系统级动效运行时 CampusMotionRuntime 的自查自纠单测（纯逻辑，node 可跑，无 DOM 依赖）。 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const rt = require(path.join(__dirname, '..', 'app', 'motion-runtime.js'));

test('createWriter 合并多写到同一帧', async () => {
  let frames = 0;
  const writer = rt.createWriter(cb => { frames++; setTimeout(cb, 0); return frames; });
  const el = { style: {} };
  writer.push(el, { transform: 'translateX(1px)' });
  writer.push(el, { opacity: '0.5' });
  assert.ok(writer.pending(), '入队后应处于挂起');
  await new Promise(r => setTimeout(r, 5));
  assert.equal(frames, 1, '同帧多次 push 只应触发一次 rAF');
  assert.equal(el.style.transform, 'translateX(1px)');
  assert.equal(el.style.opacity, '0.5');
  assert.ok(!writer.pending(), 'flush 后不再挂起');
});

test('createWriter 先读后写（读回调拿到写之前的值）', async () => {
  const order = [];
  const writer = rt.createWriter(cb => { setTimeout(cb, 0); return 1; });
  const el = { style: {} };
  writer.push(el, null, (e) => order.push('read'));
  writer.push(el, { a: '1' }, null);
  writer.push(el, null, () => order.push('read2'));
  await new Promise(r => setTimeout(r, 5));
  // 读操作应全部排在写操作之前
  assert.deepEqual(order, ['read', 'read2']);
});

test('promote 设置并还原 will-change，结束时回收', () => {
  const el = { nodeType: 1, style: {} };
  const un = rt.promote(el, ['transform', 'opacity']);
  assert.equal(el.style.willChange, 'transform, opacity');
  un();
  assert.ok(!('will-change' in el.style) || el.style.willChange === '', '还原后应移除 will-change');
});

test('promote 对非元素安全返回空回收', () => {
  const un = rt.promote(null);
  assert.equal(typeof un, 'function');
  un();
});

test('wrapMotion 保持 play 语义并自动回收 will-change', async () => {
  let played = 0;
  const motion = {
    play(el, preset, frames, opts) {
      played++;
      let resolve;
      const finished = new Promise(r => (resolve = r));
      // 模拟动画异步结束
      setTimeout(() => resolve(), 5);
      return { finished, cancel() {}, finish() { resolve(); } };
    },
    springRect() { return this.play({}, 'sheet', [], {}); },
    liquidRect() { return this.play({}, 'sheet', [], {}); }
  };
  const wrapped = rt.wrapMotion(motion);
  assert.equal(wrapped, motion, 'wrapMotion 应原地包装并返回同一对象');
  const el = { nodeType: 1, style: {} };
  wrapped.play(el, 'feedback', [{ opacity: 1 }, { opacity: 0 }], {});
  assert.equal(played, 1);
  assert.equal(el.style.willChange, 'transform, opacity', '动画中应提升合成层');
  await new Promise(r => setTimeout(r, 20));
  assert.ok(!el.style.willChange, '动画结束后应回收 will-change');
  // 幂等
  assert.equal(rt.wrapMotion(motion), motion);
});

test('armPassive 对 mock document 挂被动监听并计数', () => {
  let attached = 0;
  const el = { addEventListener: () => attached++ };
  const doc = { querySelectorAll: sel => (sel === '.content' ? [el, { addEventListener: () => attached++ }] : []) };
  const n = rt.armPassive(doc, ['.content']);
  assert.equal(n, 2);
  assert.equal(attached, 6); // 2 元素 × 3 类事件
  // 无 doc 时安全
  assert.equal(rt.armPassive(null), 0);
});

test('create 组装 motion + writer + 默认 presets', () => {
  const api = rt.create({});
  assert.ok(api.writeBatch && typeof api.writeBatch === 'function');
  assert.ok(typeof api.flushWrites === 'function');
  assert.ok(api.promote && typeof api.promote === 'function');
  assert.equal(api.presets.sheet, 300);
});

test('overlapping animation leases keep hints until the last owner ends', () => {
 const el={nodeType:1,style:{willChange:'scroll-position'}};
 const a=rt.promote(el,['transform']),b=rt.promote(el,['opacity']);
 a();assert.equal(el.style.willChange,'opacity');a();assert.equal(el.style.willChange,'opacity');
 b();assert.equal(el.style.willChange,'scroll-position');
 const c=rt.promote(el),d=rt.promote(el);d();assert.equal(el.style.willChange,'transform, opacity');c();assert.equal(el.style.willChange,'scroll-position');
});
test('runtime cleanup respects a newer external will-change owner', () => {
 const el={nodeType:1,style:{willChange:''}},un=rt.promote(el);el.style.willChange='contents';un();assert.equal(el.style.willChange,'contents');
});
test('repeated passive setup cannot accumulate listeners', () => {
 let count=0;const el={addEventListener(){count++;}},doc={querySelectorAll:()=>[el]};
 assert.equal(rt.armPassive(doc,['a','b']),1);assert.equal(rt.armPassive(doc,['a']),0);assert.equal(count,3);
});
test('a manually flushed frame cannot consume writes belonging to a later frame', () => {
 const frames=[],writer=rt.createWriter(cb=>{frames.push(cb);return frames.length;}),el={style:{}};
 writer.push(el,{opacity:'0.2'});writer.flush();writer.push(el,{opacity:'0.8'});
 frames[0]();assert.equal(el.style.opacity,'0.2');assert.equal(writer.pending(),true);frames[1]();assert.equal(el.style.opacity,'0.8');assert.equal(writer.pending(),false);
});
