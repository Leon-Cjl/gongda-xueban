// Compare the adapter with the downloaded school's actual queryFunc, without a network connection.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {agent,schoolDocument}=require('./helpers/agent-harness.cjs');
const official=path.join(__dirname,'../research/teaching-room-official.js');
test('adapter parameters agree with the school queryFunc on its real field names and encoding',{skip:!fs.existsSync(official)},async()=>{
 const values={xqh_id:'1',xnm:'2026',xqm:'3',lh:'A',cdjylx:'normal',sfbhkc:'1',cdyysqkz:'0'};let expected;
 function $(selector){const node=typeof selector==='object'?selector:null;let out;const target={val:(...args)=>args.length?out:values[String(selector).replace(/^#/,'')]||'',size:()=>0,hasClass:()=>false,attr:()=>node?.value,each(fn){let ns=[];if(selector==='#selectTR_ZC .selectTH.ui-selected')ns=[{value:7}];if(selector==='#selectTR_XQJ .ui-selected')ns=[{value:2}];if(selector==='#selectTR_JC .selectTH.ui-selected')ns=[{value:1},{value:2}];ns.forEach((n,i)=>fn(i,n));return out;}};out=new Proxy(target,{get:(o,k)=>o[k]||(()=>out)});return out;}
 $.ajax=()=>{};const ctx={jQuery:$,$,xxdm:'test',jsdm:'xs',isCdjysqflg:0,_path:'/jwglxt',search:(id,map)=>{expected=map;}};
 const source=fs.readFileSync(official,'utf8');assert.ok(source.includes('function queryFunc(){'));vm.runInNewContext(source.slice(source.indexOf('function queryFunc(){')),ctx);ctx.queryFunc();assert.ok(expected);
 let sent;const a=agent({url:'https://jw.qlu.edu.cn/jwglxt/cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155',document:schoolDocument(),jquery:{ajax:o=>{sent=o.data;o.success({items:[],totalResult:0});}}});const r=await a.run('rooms',{year:'2026',term:'3',campus:'1',building:'A',week:7,weekday:2,periods:[1,2]});assert.equal(r.ok,true);
 for(const key of ['xqh_id','xnm','xqm','lh','zcd','xqj','jcd','jyfs','cdjylx','sfbhkc'])assert.equal(String(sent[key]),String(expected[key]),key);
});
