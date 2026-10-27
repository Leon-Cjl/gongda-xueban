const {test} = require('node:test'), assert = require('node:assert/strict'), C = require('../app/core.js');
// 合成记录：2026-10-05（周一）起连续 5 天，其中两天 8 点开始；10-10（周六）再去一次；另有一条已取消的不算。
const rec = (day, b, e, no = '101', area = '三楼东 · 自习区', status = '已结束') => ({beginTime: day + ' ' + b + ':00', endTime: day + ' ' + e + ':00', status_name: status, nameMerge: area, no});
const records = [
 rec('2026-10-05', '08:00', '12:00'), rec('2026-10-06', '08:10', '11:00'), rec('2026-10-07', '13:00', '17:00', '102', '二楼 · 中文阅览区'),
 rec('2026-10-08', '14:00', '18:00'), rec('2026-10-09', '09:00', '12:00', '7', '四楼 · 外文期刊'), rec('2026-10-10', '10:00', '12:00'),
 rec('2026-10-11', '08:00', '12:00', '101', '三楼东 · 自习区', '用户取消'),
];
const now = Date.parse('2026-10-20T12:00:00+08:00'), today = '2026-10-20';

test('visit log merges school records without duplicates and skips cancelled ones', () => {
 const once = C.mergeVisitLog([], records, now, today), twice = C.mergeVisitLog(once, records.slice(2), now, today);
 assert.equal(once.length, 6);
 assert.deepEqual(twice, once);
 assert.equal(C.mergeVisitLog(once, [rec('2026-10-19', '09:00', '10:00')], now, today).length, 7);
});

test('achievement stats count streaks, early days, weekends, areas, seats and full weeks', () => {
 const s = C.achievementStats(C.mergeVisitLog([], records, now, today));
 assert.equal(s.streak, 6);
 assert.equal(s.days, 6);
 assert.equal(s.early, 2);
 assert.equal(s.weekend, 1);
 assert.equal(s.explorer, 3);
 assert.equal(s.seat, 4);
 assert.equal(s.week, 1);
 assert.equal(s.hours, 19);
});

test('early bird counts 8:30 sharp and prefers the sign-in time over a booking that starts at opening', () => {
 const log = C.mergeVisitLog([], [
  rec('2026-10-12', '08:30', '12:00'),
  {...rec('2026-10-13', '08:00', '12:00'), signTime: '2026-10-13 10:15:00'},
  {...rec('2026-10-14', '09:00', '12:00'), signTime: '2026-10-14 08:20:00'},
  rec('2026-10-15', '08:31', '12:00'),
 ], now, today);
 assert.equal(C.achievementStats(log).early, 2);
 // 旧版本记下的 5 项日志照样能算
 assert.equal(C.achievementStats([[Date.parse('2026-10-16T07:50:00+08:00'), 3600000, '2026-10-16', 'A', '1']]).early, 1);
});

test('a visit later cancelled or marked as a no-show leaves the local log', () => {
 const live = rec('2026-10-19', '08:00', '12:00', '101', '三楼东 · 自习区', '待签到');
 const once = C.mergeVisitLog([], [live], Date.parse('2026-10-19T08:20:00+08:00'), '2026-10-19');
 assert.equal(once.length, 1);
 assert.equal(C.mergeVisitLog(once, [{...live, status_name: '违约'}], now, today).length, 0);
});

test('hours use the actual leave time when the school records an early checkout', () => {
 const log = C.mergeVisitLog([], [{...rec('2026-10-12', '08:00', '22:00'), finishTime: '2026-10-12 11:00:00'}], now, today);
 assert.equal(C.achievementStats(log).hours, 3);
});

test('footprint, calendar and monthly summary read the accumulated log, including visits the school list no longer returns', () => {
 const log = C.mergeVisitLog([], records, now, today);
 // 学校这次只返回了最后两条：按日志算仍是全部 6 次
 const s = C.libraryStats(C.mergeVisitLog(log, records.slice(-2), now, today), now, today);
 assert.equal(s.visits, 6);
 const cal = C.monthCalendar(log, '2026-10', now, today), m = C.monthSummary(log, '2026-10', now, today);
 assert.equal(cal.activeDays, 6);
 assert.equal(m.visits, 6);
 assert.equal(m.latest, '18:00');
 assert.equal(C.seatVisits(log, '101', '三楼东 · 自习区', now, today), 4);
});

test('an in-progress visit in the log keeps counting until it ends and has no leave time yet', () => {
 const at = Date.parse('2026-10-20T10:00:00+08:00'), log = C.mergeVisitLog([], [rec('2026-10-20', '08:00', '12:00')], at, today);
 const later = C.usedVisits(log, Date.parse('2026-10-20T11:00:00+08:00'), today)[0];
 assert.equal(later.ms, 3 * 3600000);
 assert.equal(later.endTime, '');
 assert.equal(C.usedVisits(log, now, today)[0].endTime, '12:00');
});

test('achievement levels use the old badge ids so earned badges carry over', () => {
 const a = C.achievements({streak: 7, hours: 12});
 const streak = a.find(x => x.key === 'streak');
 assert.equal(streak.reached, 2);
 assert.equal(streak.next, 14);
 assert.deepEqual(C.earnedAchievements({streak: 7, hours: 12}).map(x => x.id), ['streak3', 'streak7', 'hours10']);
 assert.equal(C.earnedAchievements({streak: 3})[0].label, '连续入馆 · 连续 3 天');
});
