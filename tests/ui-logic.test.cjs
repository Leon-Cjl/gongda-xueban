const {test}=require('node:test');const assert=require('node:assert/strict');
const {parseStamp,reservationTimes,bookedTask,periodText,accentPalette}=require('../app/core.js');
const today='2026-10-20',at=s=>Date.parse(s+'+08:00');

test('school times parse from datetime, bare time and timestamps in Beijing time',()=>{
 assert.deepEqual(parseStamp('2026-10-21 08:00:00','',today),{ms:at('2026-10-21T08:00:00'),day:'2026-10-21',time:'08:00'});
 assert.deepEqual(parseStamp('7:30',today,today),{ms:at('2026-10-20T07:30:00'),day:'2026-10-20',time:'07:30'});
 const ms=at('2026-10-20T22:00:00');
 assert.equal(parseStamp(String(ms/1000)).time,'22:00');assert.equal(parseStamp(String(ms)).day,'2026-10-20');
});
test('unknown or impossible times are rejected instead of guessed',()=>{
 for(const raw of [null,'','签到中','25:00','08:61'])assert.equal(parseStamp(raw,today,today),null);
});
test('reservation span needs both ends and an end after the start',()=>{
 assert.equal(reservationTimes({beginTime:'2026-10-20 08:00'},today),null);
 assert.equal(reservationTimes({beginTime:'2026-10-20 22:00',endTime:'08:00'},today),null);
 const r=reservationTimes({start_time:'08:00',end_time:'22:00',day:'2026-10-21'},today);
 assert.equal(r.begin.day,'2026-10-21');assert.equal(r.end.time,'22:00');
});
const task=(over={})=>({status:'succeeded',bookedSeat:{id:1,no:'118'},accountId:'default',day:'2026-10-20',start:'08:00',end:'22:00',updatedAt:new Date(at('2026-10-20T07:00:00')).toISOString(),...over});
test('booked fallback shows upcoming reservations of the visible account only',()=>{
 const now=at('2026-10-20T07:30:00');
 assert.equal(bookedTask([task()],'default',now).bookedSeat.no,'118');
 assert.equal(bookedTask([task({accountId:'other'})],'default',now),null);
 assert.equal(bookedTask([task({status:'uncertain'})],'default',now),null);
 assert.equal(bookedTask([task({bookedSeat:null})],'default',now),null);
});
test('booked fallback hides started reservations unless the booking just succeeded',()=>{
 const stale=task({updatedAt:new Date(at('2026-10-20T07:00:00')).toISOString()});
 assert.equal(bookedTask([stale],'default',at('2026-10-20T12:00:00')),null,'school list is trusted once the reservation started');
 const fresh=task({updatedAt:new Date(at('2026-10-20T11:55:00')).toISOString()});
 assert.ok(bookedTask([fresh],'default',at('2026-10-20T12:00:00')),'just booked: school list may lag');
 assert.equal(bookedTask([fresh],'default',at('2026-10-20T22:30:00')),null,'never after the end');
});
test('booked fallback picks the earliest upcoming reservation',()=>{
 const a=task({day:'2026-10-21',bookedSeat:{id:2,no:'A2'}}),b=task({day:'2026-10-20',start:'14:00',bookedSeat:{id:3,no:'B3'}});
 assert.equal(bookedTask([a,b],'default',at('2026-10-20T09:00:00')).bookedSeat.no,'B3');
});
test('period text compresses consecutive periods',()=>{
 assert.equal(periodText([3,1,2,5,7,8]),'1–3、5、7–8');assert.equal(periodText([]),'—');assert.equal(periodText(['4','4']),'4');
});
test('accent palette derives light and dark variants and rejects bad input',()=>{
 const light=accentPalette('#FF7A1A',false),dark=accentPalette('#FF7A1A',true);
 assert.equal(light.primary,'#ff7a1a');assert.match(light.soft,/^#[0-9a-f]{6}$/);
 assert.notEqual(dark.primary,light.primary);assert.equal(dark.onPrimary,'#ffffff');
 assert.throws(()=>accentPalette('orange',false));
});
