const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../app/core.js');
const rec=(day,b,e,no='A203',area='三楼东',status='已完成')=>({beginTime:day+' '+b+':00',endTime:day+' '+e+':00',no,nameMerge:area,status_name:status});
const now=Date.parse('2026-10-21T20:00:00+08:00'),today='2026-10-21';
const records=[rec('2026-10-01','08:00','09:30'),rec('2026-10-02','08:00','11:00'),rec('2026-10-03','08:00','13:00','118','二楼'),rec('2026-10-04','08:00','22:10'),rec('2026-10-10','14:00','15:00','A203','三楼东','已取消'),rec('2026-10-21','14:00','23:00'),rec('2026-09-30','08:00','10:00')];
test('month calendar shades each day by hours and starts on Monday',()=>{
 const c=C.monthCalendar(records,'2026-10',now,today);
 assert.equal(c.days.length,31);assert.equal(c.offset,3); // 2026-10-01 是星期四
 assert.deepEqual(c.days.slice(0,4).map(d=>d.level),[1,2,3,4]);
 assert.equal(c.days[9].level,0,'cancelled bookings do not count');
 assert.equal(c.days[20].hours,6,'an ongoing booking counts up to now');
 assert.equal(c.days[22].future,true);assert.equal(c.activeDays,5);
});
test('month summary finds the usual seat, latest leave and longest run',()=>{
 const m=C.monthSummary(records,'2026-10',now,today);
 assert.equal(m.visits,5);assert.equal(m.activeDays,5);assert.equal(m.longestStreak,4);
 assert.deepEqual(m.topSeat,{area:'三楼东',no:'A203',count:4});assert.equal(m.latest,'22:10');
 assert.equal(C.monthSummary(records,'2026-08',now,today).visits,0);
 assert.equal(C.monthSummary([rec('2026-10-21','14:00','23:30')],'2026-10',now,today).latest,'','an ongoing visit has no leaving time yet');
});
test('milestones follow streak, total hours and monthly visits',()=>{
 assert.deepEqual(C.earnedMilestones({streak:7,totalHours:12,monthVisits:3}).map(m=>m.id),['streak3','streak7','hours10']);
 assert.deepEqual(C.earnedMilestones({}),[]);
});
test('seat visits count only real visits of that seat',()=>{
 assert.equal(C.seatVisits(records,'A203','三楼东',now,today),5);
 assert.equal(C.seatVisits(records,'A203','三楼东 · 自习区',now,today),5,'area names that contain each other match');
 assert.equal(C.seatVisits(records,'118','三楼东',now,today),0);
});
