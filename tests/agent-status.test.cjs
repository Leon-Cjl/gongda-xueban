const {test}=require('node:test'),assert=require('node:assert/strict');
const {agent,schoolDocument,response}=require('./helpers/agent-harness.cjs');
// 学校原始字段（与缓存的官方 H5 一致）→ 助手界面字段；只读接口，不触发任何提交。
test('profile maps the school fields and never passes phone or e-mail to the UI',async()=>{
 const a=agent({fetcher:async()=>response({name:'测试同学',id:'2024000000',card:'2024000000',deptName:'测试学部',status:3,date:'2028-06-30',mobile:'13800000000',email:'qa@example.com'})});
 const r=await a.run('profile');
 assert.equal(a.calls[0].path,'/v4/member/my');
 assert.deepEqual(r.data,{name:'测试同学',card:'2024000000',dept:'测试学部',status:'3',statusText:'临时禁止',validUntil:'2028-06-30'});
 assert.ok(!JSON.stringify(r.data).includes('138')&&!JSON.stringify(r.data).includes('@'));
 for(const [code,text] of [['1','正常'],['0','注销'],['2','挂失'],['9','未知状态']]){const b=agent({fetcher:async()=>response({status:code})});assert.equal((await b.run('profile')).data.statusText,text);}
});
test('violations read 普通座位 records with the official field names',async()=>{
 const a=agent({fetcher:async()=>response({total:3,current_page:1,last_page:1,data:[{nameMerge:'二楼 · 中文阅览区',name:'118',renegeTime:'2026-10-17 08:30:00',status_name:'未签到'},{nameMerge:'三楼东',no:'A203',beginTime:'2026-10-11 14:30:00',statusMsg:'未签到'}]})});
 const r=await a.run('violations');
 assert.equal(a.calls[0].path,'/v4/member/seatRenege');assert.equal(JSON.parse(a.calls[0].opts.body).type,1);
 assert.equal(r.data.total,3);
 assert.deepEqual(r.data.items[0],{area:'二楼 · 中文阅览区',seat:'118',time:'2026-10-17 08:30:00',status:'未签到'});
 assert.deepEqual(r.data.items[1],{area:'三楼东',seat:'A203',time:'2026-10-11 14:30:00',status:'未签到'});
});
test('area rules need a numeric area id and come back as plain text only',async()=>{
 const bad=agent();assert.equal((await bad.run('rules',{areaId:'1;drop'})).error.code,'INVALID');assert.equal(bad.calls.length,0);
 const a=agent({fetcher:async()=>response({type:'content',content:'<p>预约须知</p><p>请按时签到</p>'})});
 // 测试环境没有浏览器的 DOMParser：用只去标签的替身验证读取的是 content 字段、结果是纯文本。
 a.ctx.DOMParser=class{parseFromString(html){const text=String(html).replace(/<\/p>/g,'\n').replace(/<[^>]+>/g,'');return{querySelectorAll:()=>[],body:{textContent:text}};}};
 const r=await a.run('rules',{areaId:'12'});
 assert.equal(a.calls[0].path,'/v4/space/rule');assert.equal(JSON.parse(a.calls[0].opts.body).id,'12');
 assert.equal(r.data.text,'预约须知\n请按时签到');assert.ok(!r.data.text.includes('<'));
});
test('teaching status reports which page the school left open',async()=>{
 const a=agent({url:'https://jw.qlu.edu.cn/jwglxt/xtgl/index_initMenu.html',document:{querySelectorAll:()=>[],querySelector:()=>null,getElementById:()=>null}});
 const r=await a.run('status');
 assert.deepEqual(r.data,{connected:false,page:'/jwglxt/xtgl/index_initMenu.html'});
 const b=agent({url:'https://jw.qlu.edu.cn/jwglxt/cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155',document:schoolDocument()});
 assert.equal((await b.run('status')).data.connected,true);
});
