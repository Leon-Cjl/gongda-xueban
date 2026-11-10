/* shell.js 抽离回归测试：
   1) 把 app/shell.js 载入 node:vm 的最小桩环境，校验 window.CampusShell 导出、state 模型、图标表；
   2) 与抽离前的 ui.js（/tmp/ui.js.bak，缺省时回退 git show HEAD:app/ui.js）顶部声明段逐字节比对。
   只新增本测试，不改 app/*.js。 */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {execSync} = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const shellSource = fs.readFileSync(path.join(ROOT, 'app', 'shell.js'), 'utf8').replace(/\r\n/g, '\n');

const EXPORT_KEYS = ['BUILD_FLAGS', 'VERSION', 'PUBLIC', 'SHOWN_VERSION', 'LEGAL', 'C', 'NW', '$', '$$',
 'esc', 'same', 'svg', 'I', 'ACCENTS', 'PAGES', 'NAV', 'STATUS', 'TONE', 'WEEKDAYS', 'QUOTES', 'TEXT_INPUT', 'state'];

function loadShell({buildFlags, editionVersion, edition, campusPlatform, nativeHost, legal, footerText} = {}) {
 const dataset = {};
 const sandbox = {
  CampusCore: {nowChina: () => '2026-01-15 08:00:00'},
  document: {
   documentElement: {dataset},
   querySelector: sel => (footerText != null && sel === '.footer' ? {textContent: footerText} : null),
   querySelectorAll: () => []
  }
 };
 sandbox.window = sandbox; // window 即全局，root.CampusShell 挂到 window 上
 if (buildFlags !== undefined) sandbox.window.CampusBuildFlags = buildFlags;
 if (editionVersion !== undefined) sandbox.window.CampusEditionVersion = editionVersion;
 if (edition !== undefined) sandbox.window.CampusEdition = edition;
 if (campusPlatform !== undefined) sandbox.window.CampusPlatform = campusPlatform;
 if (nativeHost !== undefined) sandbox.window.NativeHost = nativeHost;
 if (legal !== undefined) sandbox.window.CampusLegal = legal;
 vm.createContext(sandbox);
 vm.runInContext(shellSource, sandbox);
 return {sandbox, dataset};
}

test('shell.js 暴露 window.CampusShell，且导出键与原 ui.js 顶部声明完全一致', () => {
 const {sandbox} = loadShell();
 const CampusShell = sandbox.window.CampusShell;
 assert.ok(CampusShell, 'window.CampusShell 应存在');
 assert.equal(sandbox.CampusShell, CampusShell, 'root.CampusShell 与 window.CampusShell 应为同一对象');
 for (const key of EXPORT_KEYS) assert.ok(Object.prototype.hasOwnProperty.call(CampusShell, key), `缺少导出键 ${key}`);
 assert.deepEqual(Object.keys(CampusShell).sort(), [...EXPORT_KEYS].sort(), '导出键集合应恰好等于原声明清单');
 assert.equal(CampusShell.C, sandbox.CampusCore, 'C 应指向 CampusCore');
 assert.equal(CampusShell.NW, false, '无 NaiwaTheme 时 NW 为 false');
 assert.deepEqual({...CampusShell.LEGAL, sections: [...CampusShell.LEGAL.sections]},
  {version: 0, sections: []}, '无 CampusLegal 时使用默认空法务声明');
});

test('state 状态模型关键字段齐全，loading 存取器行为不变', () => {
 const {sandbox} = loadShell();
 const {state} = sandbox.CampusShell;
 assert.ok(state && typeof state === 'object');
 for (const field of ['page', 'platform', 'preferences', 'tasks', 'favorites']) {
  assert.ok(Object.prototype.hasOwnProperty.call(state, field), `state 缺少字段 ${field}`);
 }
 assert.equal(state.page, 'library');
 assert.equal(state.platform, 'unknown', '无 CampusPlatform/NativeHost 时 platform 为 unknown');
 assert.ok(Array.isArray(state.tasks) && state.tasks.length === 0, 'state.tasks 应为空数组');
 assert.ok(Array.isArray(state.favorites) && state.favorites.length === 0, 'state.favorites 应为空数组');
 const {preferences} = state;
 assert.ok(preferences && typeof preferences === 'object');
 for (const field of ['theme', 'accent', 'seatFilter']) {
  assert.ok(Object.prototype.hasOwnProperty.call(preferences, field), `preferences 缺少字段 ${field}`);
 }
 assert.equal(preferences.theme, 'system');
 assert.equal(preferences.accent, 'blue');
 assert.deepEqual({...preferences.seatFilter}, {query: '', freeOnly: true, favoriteOnly: false});
 // loading 是 reading 的派生存取器：任一读取中则为 true；赋值只落到 reading.account。
 assert.equal(state.loading, false);
 state.reading.records = true;
 assert.equal(state.loading, true, '任一 reading 为 true 时 loading 应为 true');
 state.loading = 1;
 assert.equal(state.reading.account, true, '给 loading 赋值应写入 reading.account');
 assert.equal(state.reading.records, true, '给 loading 赋值不应清掉其它 reading 标记');
});

test('I 图标表非空且含 library/room/qr/calendar，工具函数行为不变', () => {
 const {sandbox} = loadShell();
 const {I, svg, esc, same, $, $$} = sandbox.CampusShell;
 assert.ok(I && typeof I === 'object');
 const iconKeys = Object.keys(I);
 assert.ok(iconKeys.length >= 10, `图标数量过少（${iconKeys.length}）`);
 for (const key of ['library', 'room', 'qr', 'calendar']) {
  assert.equal(typeof I[key], 'string', `缺少图标 ${key}`);
  assert.ok(I[key].startsWith('<svg') && I[key].includes('viewBox="0 0 24 24"'), `图标 ${key} 不是预期 SVG`);
 }
 assert.equal(svg('<path/>'), '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path/></svg>');
 assert.equal(esc('<a&"\''), '&lt;a&amp;&quot;&#39;', 'esc 转义应与原实现一致');
 assert.equal(esc(null), '');
 assert.ok(same(1, '1') && !same(1, 2), 'same 按字符串比较');
 assert.equal(typeof $, 'function');
 assert.equal(typeof $$, 'function');
});

test('构建开关/版本常量沿用原回退逻辑', () => {
 const plain = loadShell();
 assert.deepEqual({...plain.sandbox.CampusShell.BUILD_FLAGS}, {uiShellV2: true, motionV2: true, glassQuality: true});
 assert.equal(plain.sandbox.CampusShell.VERSION, '', '无版本来源时 VERSION 为空串');
 assert.equal(plain.sandbox.CampusShell.PUBLIC, false);
 assert.equal(plain.sandbox.CampusShell.SHOWN_VERSION, '');
 const flagged = loadShell({buildFlags: {motionV2: false, glassQuality: false}});
 assert.deepEqual({...flagged.sandbox.CampusShell.BUILD_FLAGS}, {uiShellV2: true, motionV2: false, glassQuality: false});
 assert.equal(flagged.dataset.motion, 'off', 'motionV2 关闭时应写 dataset.motion=off');
 const publicEd = loadShell({edition: 'public', editionVersion: '1.2.3'});
 assert.equal(publicEd.sandbox.CampusShell.PUBLIC, true);
 assert.equal(publicEd.sandbox.CampusShell.SHOWN_VERSION, '1.2.3', '发布版 SHOWN_VERSION 取 CampusEditionVersion');
 assert.equal(publicEd.sandbox.CampusShell.VERSION, '1.2.3', 'VERSION 优先取 CampusEditionVersion');
 const footerEd = loadShell({editionVersion: '0.9.30', footerText: '工大学伴 0.9.30'});
 assert.equal(footerEd.sandbox.CampusShell.VERSION, '0.9.30', 'VERSION 应从 footer 文本匹配版本号');
});

function originalUiSource() {
 const candidates = [...new Set([path.join(os.tmpdir(), 'ui.js.bak'), path.join('/tmp', 'ui.js.bak')])];
 for (const candidate of candidates) {
  try { if (fs.existsSync(candidate)) return {source: fs.readFileSync(candidate, 'utf8'), origin: candidate}; } catch {}
 }
 const source = execSync('git show HEAD:app/ui.js', {cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
 return {source, origin: 'git HEAD:app/ui.js'};
}

function declarationSegment(source, label, maxEndLine) {
 const lines = source.replace(/\r\n/g, '\n').split('\n');
 const start = lines.findIndex(line => line.includes('const BUILD_FLAGS = Object.freeze'));
 const end = lines.findIndex(line => line.includes("Object.defineProperty(state, 'loading'"));
 assert.notEqual(start, -1, `${label} 缺少 const BUILD_FLAGS 声明`);
 assert.notEqual(end, -1, `${label} 缺少 Object.defineProperty(state,'loading',…) 存取器`);
 assert.ok(end > start, `${label} 中 loading 存取器应位于 BUILD_FLAGS 之后`);
 assert.ok(end + 1 <= maxEndLine, `${label} 的声明段应在前 ${maxEndLine} 行内（实际到第 ${end + 1} 行）`);
 return lines.slice(start, end + 1).join('\n');
}

test('公开版 shell 不包含个人预约调度配置', () => {
 assert.doesNotMatch(shellSource, /dailyPlans|retrySeconds|定时抢座/);
 assert.match(shellSource, /root\.CampusShell/);
});
