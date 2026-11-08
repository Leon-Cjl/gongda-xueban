const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app/boot.js'),'utf8');
function boot(crypto){const context={crypto,document:{documentElement:{dataset:{},style:{}}},localStorage:{getItem:()=>null}};context.window=context;vm.runInNewContext(source,context);return context;}
test('an older supported renderer can create RFC 4122 operation ids with secure random bytes',()=>{
 let calls=0;const c=boot({getRandomValues:bytes=>{calls++;for(let i=0;i<bytes.length;i++)bytes[i]=i;}});assert.equal(c.crypto.randomUUID(),'00010203-0405-4607-8809-0a0b0c0d0e0f');assert.equal(calls,1);assert.equal(JSON.stringify(c.structuredClone({safe:[1,2]})),'{"safe":[1,2]}');
});
test('the existing renderer UUID implementation is preserved',()=>{const native=()=> 'native';assert.equal(boot({randomUUID:native}).crypto.randomUUID,native);});
