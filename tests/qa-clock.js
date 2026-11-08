/* Deterministic acceptance clock; never shipped. Keep booking fixtures inside their use window. */
(() => {
 const NativeDate = window.Date, monotonicStart = performance.now();
 const day = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Shanghai'}).format(new NativeDate());
 const start = NativeDate.parse(day + 'T09:00:00+08:00');
 window.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [start + performance.now() - monotonicStart])); }
  static now() { return start + performance.now() - monotonicStart; }
 };
})();
