/* UI acceptance fixture, synthetic data only. Not included in release packages. */
(()=>{let saved=JSON.parse(localStorage.getItem('qa-state')||'{"tasks":[]}');const seats=Array.from({length:48},(_,i)=>({id:i+1,no:String(i+1).padStart(3,'0'),available:i%7!==1,status:i%7!==1?1:2}));
const opts={xnm:[{value:'2026',label:'2026–2027',selected:true}],xqm:[{value:'3',label:'第 1 学期',selected:true}],xqh_id:[{value:'1',label:'测试校区',selected:true}],jxl_id:[{value:'a',label:'测试教学楼',selected:true}]};
window.NativeHost={post(text){const m=JSON.parse(text);let data=true;switch(m.cmd){
case'ready':data={platform:'windows',state:saved,username:'',hasCredentials:false};break;
case'saveState':saved=m.data;localStorage.setItem('qa-state',JSON.stringify(saved));break;
case'library':switch(m.data.method){case'status':data={connected:true};break;case'catalog':data={libraries:[{id:'1',name:'界面测试图书馆 · 模拟数据'}]};break;case'areas':data={areas:[{id:'10',name:'模拟阅览区 A',floor:'二层',free:41,total:48}]};break;case'seats':data={areaId:'10',name:'模拟阅览区 A',kind:3,start:'08:00',end:'22:00',segments:[],seats};break;case'records':data=[];break;default:throw Error('UI fixture never makes reservations');}break;
case'teaching':data=m.data.method==='options'?opts:m.data.method==='status'?{connected:true}:{total:2,rooms:[{id:'r1',name:'测试教室 101',campus:'测试校区',building:'模拟教学楼',capacity:60},{id:'r2',name:'测试教室 102',campus:'测试校区',building:'模拟教学楼',capacity:80}]};break;
case'openOfficial':case'openLogin':return setTimeout(()=>Campus.receive({id:m.id,ok:false,error:{code:'QA',message:'界面验收环境不打开学校或提交预约'}}),20);
}setTimeout(()=>Campus.receive({id:m.id,ok:true,data}),40);}};
})();
