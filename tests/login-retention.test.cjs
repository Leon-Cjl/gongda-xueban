const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('native login retention survives pause, transport failure and subsequent verified-session expiry',()=>{
 const jdk=process.env.GONGDA_TEST_JDK || fs.readdirSync(path.join(root,'tools/jdk')).map(n=>path.join(root,'tools/jdk',n)).find(p=>fs.existsSync(path.join(p,'bin/javac.exe')));
 const out=path.join(root,'android/build/login-retention-test');fs.mkdirSync(out,{recursive:true});
 const compile=spawnSync(path.join(jdk,'bin/javac.exe'),['-encoding','UTF-8','-d',out,path.join(root,'android/src/cn/qlucampus/personal/LibraryIdentityRecovery.java'),path.join(__dirname,'java/cn/qlucampus/personal/LoginRetentionTest.java')],{encoding:'utf8'});assert.equal(compile.status,0,compile.stderr);
 const result=spawnSync(path.join(jdk,'bin/java.exe'),['-cp',out,'cn.qlucampus.personal.LoginRetentionTest'],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/PASS: 29 login retention policy checks/);
});

test('the actual native retry scheduler wakes after an exhausted probe round and scopes callbacks to the current identity',()=>{
 const source=fs.readFileSync(path.join(root,'android/src/cn/qlucampus/personal/MainActivity.java'),'utf8');
 const start=source.indexOf('private void retryIdentityLater()'),opening=source.indexOf('{',start);let depth=1,end=opening+1;for(;end<source.length&&depth;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}
 const method=source.slice(start,end),out=path.join(root,'android/build/login-retention-test');
 const java=[
 'package cn.qlucampus.personal; public class NativeRetryTest {',
 'LibraryIdentityRecovery libraryRecovery=new LibraryIdentityRecovery(1);Runnable authenticationRetry;boolean eligible=true;int calls;Handler handler=new Handler();',
 'boolean authEligible(){return eligible;}void kickAuthenticationRecovery(){calls++;}',
 'static class Handler {java.util.List<Runnable> queue=new java.util.ArrayList<>();void removeCallbacks(Runnable r){queue.remove(r);}void postDelayed(Runnable r,long delay){if(delay<0)throw new AssertionError();queue.add(r);}}',
 method,
 'static void check(boolean v){if(!v)throw new AssertionError();}',
 'public static void main(String[] args){NativeRetryTest h=new NativeRetryTest();long now=System.currentTimeMillis();h.libraryRecovery.reset(1,true,true);',
 'LibraryIdentityRecovery.Probe p=h.libraryRecovery.beginProbe(now-10000,true);h.libraryRecovery.retryable(p,"NETWORK",now-9000);p=h.libraryRecovery.beginProbe(now-7000,true);h.libraryRecovery.retryable(p,"TIMEOUT",now-6000);',
 'check(h.libraryRecovery.probesThisRound()==2);h.retryIdentityLater();check(h.handler.queue.size()==1);Runnable first=h.authenticationRetry;',
 'h.retryIdentityLater();check(h.handler.queue.size()==1&&h.authenticationRetry!=first);Runnable current=h.authenticationRetry;h.handler.queue.clear();current.run();check(h.calls==1);',
 'h.retryIdentityLater();Runnable old=h.authenticationRetry;h.libraryRecovery.reset(2,false,true);old.run();check(h.calls==1);',
 'LibraryIdentityRecovery.RestoreAttempt r=h.libraryRecovery.beginRestore(now,true);h.libraryRecovery.restoreFailed(r,false,now);h.retryIdentityLater();check(h.authenticationRetry!=null);h.eligible=false;h.authenticationRetry.run();check(h.calls==1);',
 'h.retryIdentityLater();check(h.authenticationRetry==null);System.out.println("PASS: native retry scheduling");}}'
 ].join('\n');
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'NativeRetryTest.java'),java);
 const jdk=process.env.GONGDA_TEST_JDK || fs.readdirSync(path.join(root,'tools/jdk')).map(n=>path.join(root,'tools/jdk',n)).find(p=>fs.existsSync(path.join(p,'bin/javac.exe')));
 const compile=spawnSync(path.join(jdk,'bin/javac.exe'),['-encoding','UTF-8','-cp',out,'-d',out,path.join(out,'NativeRetryTest.java')],{encoding:'utf8'});assert.equal(compile.status,0,compile.stderr);
 const run=spawnSync(path.join(jdk,'bin/java.exe'),['-cp',out,'cn.qlucampus.personal.NativeRetryTest'],{encoding:'utf8',timeout:10000});assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/PASS: native retry scheduling/);
});
