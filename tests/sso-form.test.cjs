const {test}=require('node:test'),assert=require('node:assert/strict');
const {choose,fill,cancel}=require('../app/sso-form.js');
function fixture(){
 const input=(type,name='',visible=true)=>({type,name,id:'',disabled:false,readOnly:false,isConnected:true,get value(){return this.stored||'';},events:[],getClientRects:()=>visible?[{}]:[],dispatchEvent(e){this.events.push(e.type);}});
 const hidden=input('hidden','username'),visible=input('text','username'),password=input('password'),captcha=input('hidden','captcha_code');
 let clicks=0;
 const form={querySelectorAll:s=>s.includes('type="password"')?[password]:s.includes('captcha_code')?[captcha]:[visible]};
 const button={...input('submit'),form,click:()=>clicks++};
 const document={documentElement:{},addEventListener(){},removeEventListener(){},querySelectorAll:s=>s.includes('#submitBtn')?[button]:[hidden,visible]};
 const style=()=>({visibility:'visible',display:'block'});
 function Input(){};Object.defineProperty(Input.prototype,'value',{get(){return this.stored||'';},set(v){this.stored=v;}});
 const environment={addEventListener(){},removeEventListener(){},setTimeout(){return 1;},clearTimeout(){},MutationObserver:class{observe(){} disconnect(){}},document,location:{protocol:'https:',hostname:'sso.qlu.edu.cn',pathname:'/login'},getComputedStyle:style,HTMLInputElement:Input,Event:class{constructor(type){this.type=type;}}};
 return {hidden,visible,password,captcha,button,form,document,style,environment,clicks:()=>clicks};
}
test('SSO uses editable fields in the submit button’s form, never a hidden username in another form',()=>{
 const f=fixture();assert.equal(choose(f.document,f.style).username,f.visible);
 assert.equal(fill('synthetic-student','synthetic-password',f.environment).filled,true);
 assert.equal(f.hidden.stored,undefined);assert.equal(f.visible.stored,'synthetic-student');
 assert.deepEqual(f.password.events,['input','change']);assert.equal(f.clicks(),1);
 assert.equal(fill('again','again',f.environment).reason,'submitted');assert.equal(f.clicks(),1);
});
test('a visible captcha prevents submission while hidden captcha plumbing does not',()=>{
 const f=fixture();f.captcha.type='text';f.captcha.getClientRects=()=>[{}];
 assert.equal(fill('a','b',f.environment).reason,'captcha');assert.equal(f.clicks(),0);assert.equal(f.password.stored,undefined);
});
test('hidden, disabled, readonly, and not-yet-rendered fields are never filled',()=>{
 for(const mutation of [f=>f.visible.type='hidden',f=>f.password.disabled=true,f=>f.visible.readOnly=true,f=>f.visible.getClientRects=()=>[]]){
  const f=fixture();mutation(f);assert.equal(fill('a','b',f.environment).reason,'waiting');assert.equal(f.clicks(),0);cancel(f.environment);assert.equal(f.environment.__campusSsoRun.credentials,null);
 }
});
test('autofill is restricted to the university HTTPS login origin',()=>{
 for(const location of [{protocol:'http:',hostname:'sso.qlu.edu.cn',pathname:'/login'},{protocol:'https:',hostname:'evil.example',pathname:'/login'},{protocol:'https:',hostname:'sso.qlu.edu.cn',pathname:'/other'}]){
  const f=fixture();f.environment.location=location;assert.equal(fill('a','b',f.environment).reason,'origin');assert.equal(f.clicks(),0);
 }
});
