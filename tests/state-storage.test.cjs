const {test} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {spawnSync} = require('node:child_process');
test('native state storage is durable, ordered and drained before reset', () => {
 const root = path.resolve(__dirname, '..'), jdkRoot = path.join(root, 'tools/jdk');
 const jdk = process.env.GONGDA_TEST_JDK || (fs.existsSync(jdkRoot) && fs.readdirSync(jdkRoot).map(p => path.join(jdkRoot, p)).find(p => fs.existsSync(path.join(p, 'bin/javac.exe'))));
 assert.ok(jdk, 'existing build JDK required');
 const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gongda-store-test-'));
 try {
  const source = path.join(root, 'android/src/cn/qlucampus/personal/DurableStateStore.java');
  const tests = path.join(__dirname, 'java/cn/qlucampus/personal/DurableStateStoreTest.java');
  const compile = spawnSync(path.join(jdk, 'bin/javac.exe'), ['-encoding', 'UTF-8', '-d', out, source, tests], {encoding: 'utf8'});
  assert.equal(compile.status, 0, compile.stderr);
  const run = spawnSync(path.join(jdk, 'bin/java.exe'), ['-cp', out, 'cn.qlucampus.personal.DurableStateStoreTest'], {encoding: 'utf8', timeout: 20000});
  assert.equal(run.status, 0, run.stderr); assert.match(run.stdout, /PASS:/);
 } finally { fs.rmSync(out, {recursive: true, force: true}); }
});
