(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CampusRoomCoverage=api;})(globalThis,function(){
 'use strict';
 async function scan({periods,query,read,matches=()=>true,seed=[],current=()=>true,progress=()=>{},pause=async()=>{},maxPages=20}){
  const found=new Map(seed.map(x=>[String(x.id),{...x,states:{}}])),coverage={},snapshot=structuredClone(query);
  let error='';
  for(const period of periods){
   if(!current())return null;
   const free=new Map(),seen=new Set(),ids=new Set();let complete=false,pages=0,total=null,received=0;
   try{
    for(let page=1;page<=maxPages;page++){
     if(!current())return null;
     if(page>1||Object.keys(coverage).length)await pause();if(!current())return null;
     const result=await read({...snapshot,periods:[period],page,pageSize:300});if(!current())return null;
     if(!Array.isArray(result?.rooms))throw Error('教室分页结构异常');
     const size=Number(result.pageSize)||300,rows=result.rooms;pages=page;
     const known=result.totalKnown!==false&&Number.isInteger(Number(result.total))&&Number(result.total)>=0;
     if(known&&total!=null&&total!==Number(result.total))throw Error('教室总数在查询中变化，请重试');
     total=known?Number(result.total):null;received+=rows.length;
     const signature=JSON.stringify(rows.map(x=>String(x.id)));
     if(page>1&&seen.has(signature)&&rows.length)throw Error('教务重复返回同一页，缺失节次保持未知');seen.add(signature);
     for(const room of rows){if(ids.has(String(room.id)))throw Error('教室分页存在重复编号');ids.add(String(room.id));}
     for(const room of rows)if(matches(room)){free.set(String(room.id),room.reserved?'borrowed':'free');if(!found.has(String(room.id)))found.set(String(room.id),{...room,states:{}});}
     if(known&&received===total){complete=true;break;}
     if(known&&received>total)throw Error('教室分页数量异常');
     if(rows.length<size){if(known&&received<total)throw Error('教室分页提前结束，缺失节次保持未知');break;}
    }
    if(!complete)error='部分节次未完整查询，灰色斜纹表示未知';
   }catch(failure){error=failure.message||String(failure);}
   coverage[period]={complete,pages,total};
   for(const room of found.values())room.states[period]=free.get(String(room.id))||(complete?'busy':'unknown');
   progress(Object.keys(coverage).length,coverage);
   if(error&&pages===0)break;
  }
  for(const room of found.values())for(const period of periods)if(!room.states[period])room.states[period]=coverage[period]?.complete?'busy':'unknown';
  return{rooms:[...found.values()],coverage,complete:periods.every(p=>coverage[p]?.complete),error};
 }
 return{scan};
});
