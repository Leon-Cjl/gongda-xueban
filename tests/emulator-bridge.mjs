import fs from 'node:fs';
import {adb,pkg,connect,sleep} from './emulator-driver.mjs';
const output=process.argv[2];if(!output)throw Error('Pass an output JSON path');
adb('shell','am','start','-S','-n',pkg+'/cn.qlucampus.personal.BridgeAcceptanceActivity');
const c=await connect('https://trusted.campus.test/');
try{
 let result;for(let i=0;i<100;i++){result=await c.evaluate('window.__bridgeResult||null');if(result)break;await sleep(100);}
 if(!result)throw Error('Native bridge acceptance timed out');result.runtimeErrors=c.errors;
 fs.writeFileSync(output,JSON.stringify(result,null,2));
 const failed=result.checks.filter(x=>!x.ok);console.log(JSON.stringify({checks:result.checks.length,failed,runtimeErrors:c.errors.length}));
 if(failed.length||c.errors.length)process.exitCode=1;
}finally{c.close();}
