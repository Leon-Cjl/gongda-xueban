const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
// 学校页面里的 agent 支持的方法，两个宿主都必须放行；漏一个，界面上的功能在真机上会直接报“未知学校操作”。
test('both hosts allow every library and teaching method the agent implements',()=>{
 const agent=read('app/agent.js');
 const body=(name)=>agent.slice(agent.indexOf('async function '+name+'('),agent.indexOf('\n }',agent.indexOf('async function '+name+'(')));
 const methods=src=>[...new Set([...src.matchAll(/method==='([A-Za-z]+)'/g)].map(m=>m[1]))];
 const lib=methods(body('library')),teach=methods(body('teaching'));
 assert.ok(lib.includes('cancelBooking')&&teach.includes('rooms'));
 const android=read('android/src/cn/qlucampus/personal/MainActivity.java'),windows=read('windows/Program.cs');
 const list=(src,re)=>{const m=src.match(re);assert.ok(m,'whitelist not found');return [...m[1].matchAll(/"([A-Za-z]+)"/g)].map(x=>x[1]);};
 const aLib=list(android,/system\.equals\("library"\)\?new String\[\]\{([^}]*)\}/),aTeach=list(android,/:new String\[\]\{("status","options"[^}]*)\}/);
 const wLib=list(windows,/system=="library"\?new\[\]\{([^}]*)\}/),wTeach=list(windows,/:new\[\]\{("status","options"[^}]*)\}/);
 for(const m of lib){assert.ok(aLib.includes(m),'Android missing '+m);assert.ok(wLib.includes(m),'Windows missing '+m);}
 for(const m of teach){assert.ok(aTeach.includes(m),'Android missing teaching '+m);assert.ok(wTeach.includes(m),'Windows missing teaching '+m);}
});
test('submitting methods are treated as uncertain on timeout by the UI and both hosts',()=>{
 const ui=read('app/ui.js'),android=read('android/src/cn/qlucampus/personal/MainActivity.java'),windows=read('windows/Program.cs');
 for(const m of ['reserve','temporaryLeave','cancelBooking','checkout']){
  assert.ok(ui.includes("['reserve', 'temporaryLeave', 'cancelBooking', 'checkout'].includes(data.method)"));
  assert.ok(android.includes('method.equals("'+m+'")'),'Android timeout '+m);
  assert.ok(windows.includes('method=="'+m+'"'),'Windows timeout '+m);
 }
});
