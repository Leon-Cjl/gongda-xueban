const {test} = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
// boot.js：冷启动第一帧恢复上次的外观；跟随系统而系统已换深浅色时不套用旧颜色
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'boot.js'), 'utf8');
function run(saved, systemDark, extra = {}) {
 const root = {dataset: {}, style: {cssText: ''}};
 const store = {'campus.boot.v1': saved == null ? null : JSON.stringify(saved)};
 vm.runInNewContext(src, {document: {documentElement: root}, localStorage: {getItem: k => store[k] ?? null}, matchMedia: () => ({matches: systemDark}), window: extra});
 return root;
}
const saved = {data: {theme: 'dark', motion: 'off', platform: 'windows', vt: 'tab'}, style: '--primary: #ffcc00;', system: true, dark: true};

test('restores the saved look when the system mode has not changed', () => {
 const r = run(saved, true, {NativeHost: {}});
 assert.equal(r.dataset.platform, 'android');
 assert.equal(r.dataset.theme, 'dark');
 assert.equal(r.dataset.motion, 'off');
 assert.equal(r.dataset.vt, undefined);
 assert.equal(r.style.cssText, '--primary: #ffcc00;');
});

test('skips the old colors after the system switched between light and dark', () => {
 const r = run(saved, false);
 assert.equal(r.dataset.theme, undefined);
 assert.equal(r.style.cssText, '');
 assert.equal(r.dataset.motion, 'off');
});

test('a fixed theme is restored whatever the system mode', () => {
 const r = run({...saved, system: false}, false, {CampusPlatform: 'windows'});
 assert.equal(r.dataset.platform, 'windows');
 assert.equal(r.dataset.theme, 'dark');
 assert.equal(r.style.cssText, '--primary: #ffcc00;');
});

test('missing or broken saved data falls back to the stylesheet defaults', () => {
 assert.equal(run(null, false).dataset.theme, undefined);
 const root = {dataset: {}, style: {cssText: ''}};
 vm.runInNewContext(src, {document: {documentElement: root}, localStorage: {getItem: () => '{bad'}, matchMedia: () => ({matches: false}), window: {}});
 assert.equal(root.dataset.theme, undefined);
});
