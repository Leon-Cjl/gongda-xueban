import {adb,pkg,connect,sleep,screenshot} from './emulator-driver.mjs';
adb('shell','am','start','-W','-S','-n',pkg+'/cn.qlucampus.personal.EmulatorActivity');
const c=await connect('https://qa.campus.local/');
try{
 for(let i=0;i<80;i++){if(await c.evaluate('!!window.CampusRuntimeReady'))break;await sleep(100);}
 await c.evaluate(`(()=>{const day=n=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date(Date.now()+n*86400000));window.__examData=[{kch:'DEMO1',kcmc:'材料科学基础',ksmc:'期末考试',kssj:day(1)+'(09:00-11:00)',cdxqmc:'模拟校区',cdmc:'1号教学楼 201',zwh:'12'},{kch:'DEMO2',kcmc:'大学物理',ksmc:'补考',kssj:day(2)+'(14:00-16:00)',cdmc:'模拟教学楼 302'},{kch:'DEMO3',kcmc:'工程制图',ksmc:'期末考试',kssj:''},{kch:'DEMO4',kcmc:'高等数学',ksmc:'期中考试',kssj:day(-1)+'(09:00-11:00)',cdmc:'模拟教学楼 101'}];document.querySelector('.nav [data-page="exams"]').click();return true;})()`);
 await sleep(600);await c.evaluate(`document.querySelector('[data-action="loadExams"]').click();true`);await sleep(800);
 if(process.argv[2])screenshot(process.argv[2]);
 console.log('Synthetic demo is open on the emulator; no school writes are enabled by this fixture.');
}finally{c.close();}
