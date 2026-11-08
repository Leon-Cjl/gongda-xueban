const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {create}=require('../app/motion.js');
const source=fs.readFileSync(require.resolve('../app/ui.js'),'utf8');
const closeSource=source.slice(source.indexOf('function closeDialog(force = false)'),source.indexOf('// 只有明确拖柄接管关闭'));
function fixture(){
 const classes=new Set(),timers=new Map();let next=0;
 const d={open:true,dataset:{kind:'settings'},style:{setProperty(){}},classList:{contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x)},getBoundingClientRect:()=>({top:100,height:600}),close(){this.open=false;this.closed=(this.closed||0)+1;},animations:[],animate(){let resolve,reject;const a={playState:'running',finished:new Promise((yes,no)=>{resolve=yes;reject=no}),finish(){this.playState='finished';resolve();},cancel(){this.playState='idle';reject(Error('cancelled'));}};this.animations.push(a);return a;}};
 const c={$:()=>d,overlayRevision:0,sheetPresentation:()=>({top:100,opacity:1}),clearSlideMotion(){},motion:create(),motionOn:()=>true,document:{hidden:false},innerWidth:393,EASE:{in:'ease-in'},setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(c);vm.runInContext(closeSource,c);return {c,d,timers};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('normal sheet exit cancels its finished forwards effect before reuse',async()=>{const {c,d}=fixture();c.closeDialog();const exit=d.animations[0];exit.finish();await flush();assert.equal(d.closed,1);assert.equal(exit.playState,'idle','finished forwards animation must not survive close');d.open=true;assert.equal(d.animations.filter(a=>a.playState==='finished').length,0);});
test('sheet timeout fallback cancels animation and closes only once',async()=>{const {c,d,timers}=fixture();c.closeDialog();[...timers.values()][0]();await flush();assert.equal(d.closed,1);assert.equal(d.animations[0].playState,'idle');});
test('a retired close cannot dismiss a replacement sheet',async()=>{const {c,d}=fixture();c.closeDialog();d.closeCleanup();c.overlayRevision++;d.classList.remove('closing');c.motion.cancel(d);await flush();assert.equal(d.open,true);assert.equal(d.closed,undefined);});
