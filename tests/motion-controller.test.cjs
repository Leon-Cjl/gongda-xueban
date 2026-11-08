const {test}=require('node:test'),assert=require('node:assert/strict');const {create,sample}=require('../app/motion.js');
function element(){return{style:{},animations:[],animate(frames,options){let resolve,reject;const a={frames,options,playState:'running',finished:new Promise((yes,no)=>{resolve=yes;reject=no}),cancel(){this.playState='idle';reject(Error('cancel'))},finish(){this.playState='finished';resolve()}};this.animations.push(a);return a;}}}
test('physical springs start from the supplied position and px/s velocity',()=>{for(const damping of [20,2*Math.sqrt(500),60]){const s=sample(4,100,30,0,{damping});assert.ok(Math.abs(s.x-4)<1e-6);assert.ok(Math.abs(s.v-30)<1e-6);assert.ok(Math.abs(sample(4,100,30,3,{damping}).x-100)<.01);}});
test('retargeting a capsule preserves the painted position and segment velocity without animating geometry',()=>{
 let now=0;const m=create({clock:()=>now}),el=element(),from={x:0,y:0,w:60,h:40},to={...from,x:100};
 const first=m.springRect(el,from,to);first.currentTime=100;now=170;
 const x=frame=>Number(frame.transform.match(/translate\(([-\d.e]+)/)[1]);
 const fraction=first.currentTime/first.options.duration,index=first.frames.findIndex(f=>f.offset>=fraction),lo=first.frames[index-1],hi=first.frames[index];
 const span=(hi.offset-lo.offset)*first.options.duration/1000,velocity=(x(hi)-x(lo))/span;
 const position=x(lo)+(x(hi)-x(lo))*(fraction-lo.offset)/(hi.offset-lo.offset),a=m.springRect(el,to,from);
 assert.ok(Math.abs(x(a.frames[0])-position)<1e-7);
 assert.ok(Math.abs(x(a.frames[1])-sample(position,0,velocity,1/120).x)<1e-7);
 assert.ok(a.frames.every(f=>!('width'in f)&&!('height'in f)));assert.equal(el.animations[0].playState,'idle');
});
test('a new animation only cancels overlapping properties on the same element',()=>{const m=create(),el=element();const a=m.play(el,'press',[{transform:'scale(.9)'},{transform:'none'}]);const b=m.play(el,'feedback',[{opacity:0},{opacity:1}]);assert.equal(a.playState,'running');m.play(el,'press',[{transform:'scale(.95)'},{transform:'none'}]);assert.equal(a.playState,'idle');assert.equal(b.playState,'running');});
test('motion-off and missing WAAPI use final state immediately',async()=>{const el=element(),m=create({enabled:()=>false});await m.play(el,'sheet',[{opacity:0},{opacity:1}],{fill:'forwards'}).finished;assert.equal(el.animations.length,0);assert.equal(el.style.opacity,1);delete el.animate;assert.doesNotThrow(()=>create().springRect(el,{x:0,y:0,w:1,h:1},{x:2,y:0,w:1,h:1}));});
test('removing a view cancels only its owned animations',()=>{const m=create(),a=element(),b=element(),root={contains:el=>el===a};const x=m.play(a,'route',[{opacity:0},{opacity:1}]),y=m.play(b,'route',[{opacity:0},{opacity:1}]);m.cancelTree(root);assert.equal(x.playState,'idle');assert.equal(y.playState,'running');});
