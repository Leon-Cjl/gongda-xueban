/* 架构边界测试：shell.js 抽离后，ui.js 不再自带构建开关/状态模型，
   改由 window.CampusShell 桥接；index.html 先加载 shell.js 再加载 ui.js。 */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const uiSource = fs.readFileSync(path.join(ROOT, 'app', 'ui.js'), 'utf8');
const shellSource = fs.readFileSync(path.join(ROOT, 'app', 'shell.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8');

const EXPORT_KEYS = ['BUILD_FLAGS', 'VERSION', 'PUBLIC', 'SHOWN_VERSION', 'LEGAL', 'C', 'NW', '$', '$$',
 'esc', 'same', 'svg', 'I', 'ACCENTS', 'PAGES', 'NAV', 'STATUS', 'TONE', 'WEEKDAYS', 'QUOTES', 'TEXT_INPUT', 'state'];

test('ui.js 不再自行定义 BUILD_FLAGS/state，改为解构 window.CampusShell', () => {
 assert.ok(!uiSource.includes('const BUILD_FLAGS = Object.freeze'), 'ui.js 不应再定义 BUILD_FLAGS');
 assert.ok(!uiSource.includes('const state = {'), 'ui.js 不应再定义 state');
 const destructure = uiSource.match(/const\s*\{([\s\S]*?)\}\s*=\s*window\.CampusShell\s*;/);
 assert.ok(destructure, 'ui.js 应含 window.CampusShell 解构引用');
 const names = destructure[1].split(',').map(name => name.trim()).filter(Boolean);
 for (const key of EXPORT_KEYS) assert.ok(names.includes(key), `ui.js 解构缺少 ${key}`);
});

test('shell.js 负责挂载 CampusShell，且不反向依赖桥接', () => {
 assert.ok(shellSource.includes('root.CampusShell ='), 'shell.js 应含 root.CampusShell 赋值');
 assert.ok(!shellSource.includes('= window.CampusShell'), 'shell.js 不应再从 window.CampusShell 读取');
});

test('index.html 先加载 shell.js 再加载 ui.js', () => {
 const shellAt = indexHtml.indexOf('<script src="shell.js">');
 const uiAt = indexHtml.indexOf('<script src="ui.js">');
 assert.notEqual(shellAt, -1, 'index.html 应加载 shell.js');
 assert.notEqual(uiAt, -1, 'index.html 应加载 ui.js');
 assert.ok(shellAt < uiAt, 'shell.js 必须在 ui.js 之前加载');
});
