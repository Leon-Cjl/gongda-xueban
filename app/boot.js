// 首帧外观：页面主体脚本在 body 末尾才跑，之前浏览器已经按默认样式画出一帧（手机上会先看到“任务”和默认蓝色）。
// 这里在 head 里先认出平台，并把上次的主题、主题色原样恢复。读不到就按默认，不影响后面正常渲染。
(function () {
 var root = document.documentElement;
 try {
  var platform = window.CampusPlatform || (window.NativeHost ? 'android' : '');
  if (platform) root.dataset.platform = platform;
  var saved = JSON.parse(localStorage.getItem('campus.boot.v1') || 'null');
  if (saved && saved.data) for (var k in saved.data) if (k !== 'platform' && k !== 'vt') root.dataset[k] = saved.data[k];
  if (saved && typeof saved.style === 'string') root.style.cssText = saved.style;
 } catch (e) {}
})();
