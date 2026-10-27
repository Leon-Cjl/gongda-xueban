const {test} = require('node:test'), assert = require('node:assert/strict'), C = require('../app/core.js');
// 从小璇璇版合并回来的校验与去重
const at = Date.parse('2026-10-19T08:00:00+08:00');
const base = {areaId: 5, areaName: '测试区域', day: '2026-10-20', start: '08:30', end: '12:00', kind: 3, fireAt: new Date(at + 60000).toISOString(), seats: [{id: 1, no: '001'}]};

test('validDay rejects dates that do not exist on the calendar', () => {
 assert.equal(C.validDay('2026-02-28'), true);
 assert.equal(C.validDay('2026-02-30'), false);
 assert.equal(C.validDay('2026-13-01'), false);
 assert.equal(C.validDay('2026-2-1'), false);
 assert.equal(C.validTime('23:59'), true);
 assert.equal(C.validTime('24:00'), false);
 assert.equal(C.validTime('8:30'), false);
});

test('validateTask refuses impossible dates, malformed times and seats without id', () => {
 assert.ok(C.validateTask(base, at));
 assert.throws(() => C.validateTask({...base, day: '2026-02-30'}, at), /有效区域或使用日期/);
 assert.throws(() => C.validateTask({...base, start: '8:30'}, at), /有效的开始和结束时间/);
 assert.throws(() => C.validateTask({...base, seats: [{no: '001'}]}, at), /座位信息不完整/);
});

test('the same school record listed twice counts once', () => {
 const r = {id: 77, beginTime: '2026-10-05 08:00:00', endTime: '2026-10-05 12:00:00', status_name: '已结束', nameMerge: '三楼东', no: '101'};
 const now = Date.parse('2026-10-06T12:00:00+08:00');
 assert.equal(C.usedVisits([r, {...r}], now, '2026-10-06').length, 1);
 // 没有 id 时按时间 + 区域 + 座位认
 const {id, ...noId} = r;
 assert.equal(C.usedVisits([noId, {...noId}, {...noId, no: '102'}], now, '2026-10-06').length, 2);
});
