const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../../app/agent.js'),'utf8');
function schoolDocument({year='2026',term='3',campus='1',building='A',menu='N2155'}={}){
 const input=value=>({value}),select=(values,current)=>({value:current,options:values.map(([value,label])=>({value,textContent:label,selected:value===current}))});
 const fields={xnm:input(year),xqm:input(term),gnmkdmKey:input(menu),dm_cx:select([['2026-3','2026–2027 第1学期'],['2026-12','2026–2027 第2学期'],['2025-3','2025–2026 第1学期']],year+'-'+term),xqh_id:select([['1','测试校区']],campus),lh:select([['','全部'],['A','A楼']],building),tabGrid:{},cdjylx:input('normal'),sfbhkc:input('1')};
 const node=(n,label=String(n))=>({getAttribute:()=>String(n),textContent:label});
 return{fields,getElementById:id=>fields[id]||null,querySelector:s=>s==='#dm_cx'?fields.dm_cx:s==='#tabGrid'?fields.tabGrid:s==='#xnm'?fields.xnm:null,querySelectorAll:s=>s.includes('selectTR_ZC')?[node(6),node(7),node(8)]:s.includes('selectTR_JC')?[node(1),node(2),node(3)]:[]};
}
function agent({url='https://libyuyue.qlu.edu.cn/h5/index.html',fetcher,document={},token='qa-session',jquery,frames,currentWeek=7}={}){
 const replies=[],calls=[],ctx={location:new URL(url),document,sessionStorage:{getItem:()=>token},crypto:crypto.webcrypto,TextEncoder,TextDecoder,URL,URLSearchParams,Intl,Date,AbortController,setTimeout,clearTimeout,Uint8Array,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),dqzc:currentWeek};
 ctx.window=ctx;ctx.jQuery=jquery;ctx.QluReply={post:s=>replies.push(JSON.parse(s))};ctx.fetch=async(path,opts)=>{calls.push({path,opts});return fetcher?fetcher(path,opts):response({})};
 if(frames){const original=document.querySelectorAll?.bind(document);document.querySelectorAll=s=>s==='iframe,frame'?frames.map(w=>({contentWindow:w})):original?.(s)||[];}
 vm.runInNewContext(source,ctx);let sequence=0;return{calls,ctx,run:async(method,params={})=>{const id=String(++sequence);await ctx.QluAgent.run({id,method,params});return replies.findLast(x=>x.id===id);}};
}
function response(data){return{ok:true,status:200,json:async()=>({code:0,data})};}
module.exports={agent,schoolDocument,response};
