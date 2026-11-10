/* 自查自纠：index.html 引用的本地脚本与样式，必须与 app/ 目录实际文件一致，
   防止架构调整后出现清单缺失、多余引用或加载顺序错误（构建链隐性错误）。 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appDir = path.join(__dirname, '..', 'app');
const html = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');

const referenced = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const styles = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m => m[1]);
const preloads = [...html.matchAll(/<link rel="preload" href="([^"]+)" as="script">/g)].map(m => m[1]);

test('every referenced local script exists in app/', () => {
  for (const name of referenced) {
    assert.ok(fs.existsSync(path.join(appDir, name)), `缺失脚本文件: ${name}`);
  }
});

test('no duplicate script entries', () => {
  assert.equal(new Set(referenced).size, referenced.length, `存在重复脚本: ${referenced.filter((n, i) => referenced.indexOf(n) !== i)}`);
});

test('stylesheet exists', () => {
  for (const name of styles) assert.ok(fs.existsSync(path.join(appDir, name)), `缺失样式: ${name}`);
});

test('shell.js loads before ui.js (CampusShell must exist before ui.js destructures it)', () => {
  const shellIdx = referenced.indexOf('shell.js');
  const uiIdx = referenced.indexOf('ui.js');
  assert.ok(shellIdx !== -1, 'index.html 未引用 shell.js');
  assert.ok(uiIdx !== -1, 'index.html 未引用 ui.js');
  assert.ok(shellIdx < uiIdx, `shell.js（${shellIdx}）必须在 ui.js（${uiIdx}）之前加载`);
});

test('core.js loads before shell.js and ui.js (shell reads CampusCore)', () => {
  const coreIdx = referenced.indexOf('core.js');
  const shellIdx = referenced.indexOf('shell.js');
  const uiIdx = referenced.indexOf('ui.js');
  assert.ok(coreIdx !== -1 && coreIdx < shellIdx && shellIdx < uiIdx, `顺序应为 core < shell < ui，实际 core=${coreIdx} shell=${shellIdx} ui=${uiIdx}`);
});

test('every preload has a matching script tag', () => {
  for (const name of preloads) assert.ok(referenced.includes(name), `preload 了但未以 script 加载: ${name}`);
});

/* 构建侧自查自纠：发布脚本必须整目录收集 app/（新增模块文件自动带入），
   不得逐个硬编码 .js 清单（否则漏文件导致发布版缺模块）。允许 build-*.ps1 只锚定 <script src="ui.js">。 */
const rootDir = path.join(__dirname, '..');
const buildScripts = fs.readdirSync(rootDir).filter(f => /^build-.*\.ps1$/.test(f));

test('存在至少一个构建脚本', () => {
  assert.ok(buildScripts.length > 0, '未找到 build-*.ps1 构建脚本');
});

for (const script of buildScripts) {
  const body = fs.readFileSync(path.join(rootDir, script), 'utf8');
  test(`${script} 整目录收集 app/（不逐个硬编码 .js 清单）`, () => {
    const copiesWholeApp =
      /Copy-Item[^`\n]*['"]?app['"]?[^`\n]*-Recurse/i.test(body) ||   // Copy-Item ... app ... -Recurse
      /-A\s+["']?\$taskRoot[\\/]+app["']?/i.test(body);               // aapt2 -A "$taskRoot\app"
    assert.ok(copiesWholeApp, `${script} 未整目录收集 app/，新增模块文件会被漏掉`);
  });
  test(`${script} 不逐个硬编码 app/ 内的 js 模块清单（允许 ui.js 锚点与非 app 文件）`, () => {
    // app/ 内的界面模块清单才受"整目录拷贝"约束；research/ 等目录的单个文件拷贝与 ui.js 注入锚点不算
    const appModules = new Set(fs.readdirSync(appDir).filter(f => f.endsWith('.js')));
    const hardcoded = [...body.matchAll(/Copy-Item[^\n]*?([\w-]+\.js)/g)]
      .map(m => m[1])
      .filter(name => appModules.has(name) && name !== 'ui.js');
    assert.equal(hardcoded.length, 0, `${script} 逐个硬编码了 app/ 模块: ${hardcoded.join(', ')}`);
  });
}
