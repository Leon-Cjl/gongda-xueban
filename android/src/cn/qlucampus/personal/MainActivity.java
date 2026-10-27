package cn.qlucampus.personal;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.drawable.Icon;
import android.provider.Settings;
import android.view.HapticFeedbackConstants;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Build;
import android.content.res.Configuration;
import android.graphics.Typeface;
import android.text.TextUtils;
import android.view.Gravity;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.*;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends Activity {
 static final String LIB="https://libyuyue.qlu.edu.cn/h5/index.html#/mo/home";
 // 教务登录走统一认证入口；直接打开 /jwglxt/ 会落到带图片验证码的正方本地登录页，自动填写无法处理。
 static final String TEACH="https://jw.qlu.edu.cn/sso/ddlogin";
 static final String STUDENT="https://jw.qlu.edu.cn/jwglxt/xtgl/index_initMenu.html?jsdm=xs&echarts=1";
 static final String PASS="https://tyrzfw.chaoxing.com/auth3/qlu/cas/init?isLogout=0&refer=https://mfindqlu.libsp.cn/find/sso/login/qlu/1?page=credential&wxAppid=wx57c739c1c8607ddc&menuType=view";
 static final String ACTION_PASS="cn.qlucampus.personal.PASS",ACTION_PAGE="cn.qlucampus.personal.PAGE",CHANNEL_SEAT="seat_live",POST_NOTIFICATIONS="android.permission.POST_NOTIFICATIONS";
 static final int NOTIFY_SEAT=1001,REQ_NOTIFY=11;
 // 电子借阅证页面里隐藏借书、还书、续借等选项，只留入馆码；只按完整的短文字匹配，页面之后重新渲染出来的也会隐藏（按帧合并处理，开销很小）。
 boolean hideBorrow(){JSONObject p=state.optJSONObject("preferences");return p==null||p.optBoolean("hideBorrow",true);}
 static final String PASS_TRIM="(()=>{if(window.__qluTrim)return;window.__qluTrim=1;const re=/^(自助)?(借书|还书|借还|借还书|续借|借书码|还书码|借还书业务|借阅业务)$/;let queued=false;const hide=()=>{queued=false;for(const el of document.querySelectorAll('button,a,li,span,div,[role=tab],[role=button]')){if(el.dataset.qluHidden)continue;const t=(el.textContent||'').replace(/\\s+/g,'');if(!t||t.length>8||!re.test(t))continue;let x=el;while(x.parentElement&&x.parentElement!==document.body&&(x.parentElement.textContent||'').replace(/\\s+/g,'')===t)x=x.parentElement;x.style.setProperty('display','none','important');x.dataset.qluHidden='1';}};hide();const mo=new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(hide);}});mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true});})()";
 // 教务系统按桌面浏览器适配；手机 UA 下菜单和查询页可能不同。与 Windows 客户端（WebView2）保持一致。
 static final String DESKTOP_UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
 JSONObject officialArgs=new JSONObject();int accent=0;boolean focusAllowed=false;String lastCdjy=null;
 String pendingPage="",notifyRequestId="";boolean mainReady=false;
 final Handler handler=new Handler(Looper.getMainLooper());
 final Map<String,JSONObject> requests=new HashMap<>();
 JSONObject vault=new JSONObject(),state=new JSONObject();
 WebView main,api,teaching;LinearLayout root,official;String current="library";boolean apiReady=false,autoLogin=false,autoUsed=false,foreground=false,restoreTried=false,brightened=false,studentRequested=false;float oldBrightness=-1f;Button done,reload;LinearLayout bar;TextView barTitle,barHint;boolean dark=false,closeOnSession=false,closeOnTeaching=false,sawSso=false;
 // 后台连接教务：等待中的请求编号（并发请求共享同一次连接）、本次尝试序号、跳过验证码登录页的次数、探测请求编号。
 final List<String> connectIds=new ArrayList<>();int connectSeq=0,sloginRedirects=0;String connectProbe="";
 // 入馆码预载：隐藏的借阅证页面、上次加载时间、借阅证自己的自动填写标记（与图书馆登录分开）。
 WebView passWeb;long passAt=0;boolean passAuto=false,passUsed=false,passTrimmed=false;
 // 后台恢复图书馆登录：隐藏页面、自动填写标记、上次尝试时间、尝试序号。
 static final String LIB_CAS="https://sso.qlu.edu.cn/login?service=https%3A%2F%2Flibyuyue.qlu.edu.cn%2Fv4%2Flogin%2Fcas";
 WebView libLogin;boolean bgAuto=false,bgUsed=false;long restoreAt=0;int bgSeq=0;
 // 用户同意《用户协议与隐私说明》之前，不预载入馆码、不在后台登录（界面同意后才会发起学校请求）。
 Boolean publicBuild=null;
 boolean consented(){if(publicBuild==null){try{publicBuild=asset("edition.js").contains("'public'");}catch(Exception e){publicBuild=false;}}if(!publicBuild)return true;JSONObject p=state.optJSONObject("preferences");return p!=null&&p.optInt("consent",0)>0;}
 // 教务的自动填写标记与图书馆分开：后台连接教务不会重新打开图书馆登录页的自动填写；teachingNavFailed 记录教务页最近一次主框架加载是否失败（断网、维护）。
 boolean teachAuto=false,teachUsed=false,teachingNavFailed=false;final Runnable connectTimeout=()->finishConnect(onCdjy()&&!teachingNavFailed,true);
 final Runnable tick=new Runnable(){public void run(){if(foreground){main.evaluateJavascript("window.Campus&&window.Campus.tick()",null);handler.postDelayed(this,1000);}}};
 @Override public void onCreate(Bundle saved){super.onCreate(saved);dark=systemDark(getResources().getConfiguration());try{vault=readVault();state=readJson("state.json");}catch(Exception e){}build();applyColors();handleIntent(getIntent(),true);}
 @Override protected void onNewIntent(Intent i){super.onNewIntent(i);setIntent(i);handleIntent(i,false);}
 // 通知、桌面快捷方式和控制中心磁贴都从这里进入：入馆码直接打开官方电子借阅证，其余切到对应页面。
 void handleIntent(Intent i,boolean cold){if(i==null)return;String a=i.getAction();if(ACTION_PASS.equals(a))openOfficial("pass",false);else if(ACTION_PAGE.equals(a)){String page=i.getStringExtra("page");if(page==null||page.isEmpty())return;if(official!=null&&official.getVisibility()==View.VISIBLE)closeOfficial();if(cold||!mainReady)pendingPage=page;else{JSONObject e=new JSONObject();try{e.put("event","navigate");e.put("page",page);send(e);}catch(Exception x){}}}}
 boolean systemDark(Configuration c){return (c.uiMode&Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES;}
 void build(){
  root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
  // 安卓 15 起强制全面屏，adjustResize 不再缩小页面：底部留白要把输入法的高度也算上，否则键盘会盖住学号密码框和学校登录页。
  root.setOnApplyWindowInsetsListener((v,i)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets s=i.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()),ime=i.getInsets(WindowInsets.Type.ime());v.setPadding(s.left,s.top,s.right,Math.max(s.bottom,ime.bottom));return WindowInsets.CONSUMED;}v.setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());return i.consumeSystemWindowInsets();});
  setContentView(root);main=new WebView(this);configure(main);main.setOverScrollMode(View.OVER_SCROLL_NEVER);main.addJavascriptInterface(new LocalHost(),"NativeHost");
  main.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView w,WebResourceRequest r){Uri u=r.getUrl();if(!"campus.local".equals(u.getHost()))return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));try{String name=u.getPath().replaceFirst("^/","");if(name.contains(".."))return null;String mime=name.endsWith(".js")?"text/javascript":name.endsWith(".css")?"text/css":name.endsWith(".png")?"image/png":name.endsWith(".webp")?"image/webp":name.endsWith(".jpg")?"image/jpeg":"text/html";return new WebResourceResponse(mime,"UTF-8",getAssets().open(name));}catch(Exception e){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}}
   @Override public boolean shouldOverrideUrlLoading(WebView w,WebResourceRequest r){return !"campus.local".equals(r.getUrl().getHost());}
  });
  root.addView(main,new LinearLayout.LayoutParams(-1,0,1));official=new LinearLayout(this);official.setOrientation(LinearLayout.VERTICAL);official.setVisibility(View.GONE);root.addView(official,new LinearLayout.LayoutParams(-1,0,1));
  // 学校官方页面上方的顶栏：返回助手、页面名称、刷新。
  bar=new LinearLayout(this);bar.setOrientation(LinearLayout.HORIZONTAL);bar.setGravity(Gravity.CENTER_VERTICAL);bar.setPadding(dp(4),0,dp(4),0);
  done=new Button(this,null,android.R.attr.borderlessButtonStyle);done.setText("‹ 返回助手");done.setAllCaps(false);done.setTextSize(15);done.setOnClickListener(v->closeOfficial());
  barTitle=new TextView(this);barTitle.setTextSize(16);barTitle.setTypeface(Typeface.DEFAULT_BOLD);barTitle.setSingleLine(true);barTitle.setEllipsize(TextUtils.TruncateAt.END);barTitle.setGravity(Gravity.CENTER);
  reload=new Button(this,null,android.R.attr.borderlessButtonStyle);reload.setText("刷新");reload.setAllCaps(false);reload.setTextSize(15);reload.setOnClickListener(v->{if(officialView!=null)officialView.reload();});
  bar.addView(done,new LinearLayout.LayoutParams(-2,dp(48)));bar.addView(barTitle,new LinearLayout.LayoutParams(0,-2,1));bar.addView(reload,new LinearLayout.LayoutParams(-2,dp(48)));
  official.addView(bar,new LinearLayout.LayoutParams(-1,dp(56)));
  barHint=new TextView(this);barHint.setTextSize(13);barHint.setGravity(Gravity.CENTER);barHint.setPadding(dp(16),0,dp(16),dp(8));official.addView(barHint,new LinearLayout.LayoutParams(-1,-2));
  api=new WebView(this);configure(api);api.addJavascriptInterface(new ApiReply("library"),"QluReply");api.setWebViewClient(new WebViewClient(){@Override public void onPageFinished(WebView w,String url){apiReady=true;handler.postDelayed(()->sessionEvent(!vault.optString("token").isEmpty()),500);}});root.addView(api,new LinearLayout.LayoutParams(1,1));api.setVisibility(View.INVISIBLE);
  if(!vault.optString("token").isEmpty())configureApi();
  main.loadUrl("https://campus.local/index.html");
 }
 int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
 void configure(WebView w){WebSettings s=w.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);w.setBackgroundColor(background());w.setWebChromeClient(new WebChromeClient());CookieManager.getInstance().setAcceptCookie(true);}
 JSONObject json(String s){try{return new JSONObject(s);}catch(Exception e){return new JSONObject();}}
 JSONObject err(String code,String message){JSONObject e=new JSONObject();try{e.put("code",code);e.put("message",message);}catch(Exception x){}return e;}
 void reply(String id,Object value){JSONObject m=new JSONObject();try{m.put("id",id);m.put("ok",true);m.put("data",value==null?JSONObject.NULL:value);send(m);}catch(Exception e){}}
 void reject(String id,String code,String message){JSONObject m=new JSONObject();try{m.put("id",id);m.put("ok",false);m.put("error",err(code,message));send(m);}catch(Exception e){}}
 void send(JSONObject m){main.evaluateJavascript("window.Campus&&window.Campus.receive("+m.toString()+")",null);}
 final class LocalHost {@JavascriptInterface public void post(String text){handler.post(()->handle(json(text)));}}
 void handle(JSONObject m){String id=m.optString("id"),cmd=m.optString("cmd");JSONObject d=m.optJSONObject("data");if(d==null)d=new JSONObject();try{switch(cmd){
  case"ready":JSONObject r=new JSONObject();r.put("platform","android");r.put("systemDark",systemDark(getResources().getConfiguration()));r.put("launchPage",pendingPage);pendingPage="";mainReady=true;handler.postDelayed(this::preloadPass,300);r.put("state",state);r.put("username",vault.optString("username"));r.put("hasCredentials",!vault.optString("password").isEmpty());reply(id,r);break;
  case"appearance":dark=d.optBoolean("dark");try{pageBg=Color.parseColor(d.optString("bg"));}catch(Exception x){pageBg=0;}try{accent=Color.parseColor(d.optString("accent"));}catch(Exception x){accent=0;}applyColors();reply(id,true);break;
  case"liveSeat":reply(id,postSeat(d));break;
  case"notifyState":reply(id,notifyState());break;
  case"requestNotify":requestNotify(id);break;
  case"openNotifySettings":openNotifySettings(d.optBoolean("promoted"));reply(id,true);break;
  case"haptic":{String k=d.optString("kind");boolean r30=Build.VERSION.SDK_INT>=30;int c=k.equals("confirm")?(r30?HapticFeedbackConstants.CONFIRM:HapticFeedbackConstants.VIRTUAL_KEY):k.equals("reject")?(r30?HapticFeedbackConstants.REJECT:HapticFeedbackConstants.LONG_PRESS):k.equals("heavy")?HapticFeedbackConstants.LONG_PRESS:k.equals("tap")?HapticFeedbackConstants.VIRTUAL_KEY:HapticFeedbackConstants.CLOCK_TICK;main.performHapticFeedback(c);reply(id,true);break;}
  case"saveState":state=d;write("state.json",d.toString().getBytes(StandardCharsets.UTF_8));reply(id,true);if(passWeb==null&&consented())handler.postDelayed(this::preloadPass,1500);break;
  case"credentials":restoreTried=false;restoreAt=0;if(d.optString("username").isEmpty()||d.optString("password").isEmpty())throw new Exception("请填写学号和密码");vault.put("username",d.getString("username"));vault.put("password",d.getString("password"));vault.put("remember",d.optBoolean("remember"));saveVault();reply(id,true);break;
  case"forgetCredentials":vault.remove("username");vault.remove("password");saveVault();reply(id,true);break;
  case"openLogin":if(!d.optString("system").equals("teaching")&&libLogin!=null)endBackgroundLogin(false);if(d.optString("system").equals("teaching")){teachAuto=d.optBoolean("auto");teachUsed=false;studentRequested=false;}else{autoLogin=d.optBoolean("auto");autoUsed=false;}openOfficial(d.optString("system").equals("teaching")?"teaching":"library",true);reply(id,true);break;
  case"openOfficial":officialArgs=d;openOfficial(d.optString("target"),false);reply(id,true);break;
  case"library":request(id,"library",d.optString("method"),d.optJSONObject("params"));break;
  case"teaching":request(id,"teaching",d.optString("method"),d.optJSONObject("params"));break;
  case"connectTeaching":connectTeaching(id,d.optBoolean("fresh"));break;
  case"reminders":reply(id,ReminderReceiver.schedule(this,d.optJSONArray("items")));break;
  case"saveDonate":reply(id,saveDonate());break;
  case"exitApp":reply(id,true);handler.postDelayed(this::finishAndRemoveTask,150);break;
  case"resetAll":reply(id,true);handler.postDelayed(this::resetAll,200);break;
  default:reject(id,"CLIENT","未知客户端操作");
 }}catch(Exception e){reject(id,"CLIENT",e.getMessage()==null?"本机操作失败":e.getMessage());}}
 WebView officialView;
 NotificationManager notifications(){return (NotificationManager)getSystemService(NOTIFICATION_SERVICE);}
 boolean notificationsAllowed(){if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return false;return notifications().areNotificationsEnabled();}
 String systemProperty(String key){try{Class<?> c=Class.forName("android.os.SystemProperties");return String.valueOf(c.getMethod("get",String.class,String.class).invoke(null,key,""));}catch(Exception e){return "";}}
 // 只读检测：通知权限、Android 16 实时更新、小米焦点通知协议与超级岛特性；不申请小米私有权限。
 boolean canShowFocus(){try{Bundle b=new Bundle();b.putString("package",getPackageName());Bundle r=getContentResolver().call(Uri.parse("content://miui.statusbar.notification.public"),"canShowFocus",null,b);return r!=null&&r.getBoolean("canShowFocus",false);}catch(Exception e){return false;}}
 JSONObject notifyState()throws Exception{
  JSONObject r=new JSONObject();r.put("allowed",notificationsAllowed());r.put("permissionMissing",Build.VERSION.SDK_INT>=33&&checkSelfPermission(POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED);r.put("sdk",Build.VERSION.SDK_INT);
  Object live=JSONObject.NULL;if(Build.VERSION.SDK_INT>=36)try{live=NotificationManager.class.getMethod("canPostPromotedNotifications").invoke(notifications());}catch(Exception e){}r.put("liveUpdates",live);
  String brand=(Build.MANUFACTURER+" "+Build.BRAND).toLowerCase(Locale.ROOT);r.put("xiaomi",brand.contains("xiaomi")||brand.contains("redmi")||brand.contains("poco"));
  int focus=0;try{focus=Settings.System.getInt(getContentResolver(),"notification_focus_protocol",0);}catch(Exception e){}r.put("focusProtocol",focus);
  r.put("island","true".equals(systemProperty("persist.sys.feature.island")));r.put("osName",systemProperty("ro.mi.os.version.name"));
  focusAllowed=canShowFocus();r.put("focusAllowed",focusAllowed);
  android.service.notification.StatusBarNotification shown=null;for(android.service.notification.StatusBarNotification n:notifications().getActiveNotifications())if(n.getId()==NOTIFY_SEAT)shown=n;
  r.put("seatShown",shown!=null);Object promoted=JSONObject.NULL,promotable=JSONObject.NULL;
  if(shown!=null&&Build.VERSION.SDK_INT>=36){try{int flag=Notification.class.getField("FLAG_PROMOTED_ONGOING").getInt(null);promoted=(shown.getNotification().flags&flag)!=0;}catch(Exception e){}try{promotable=Notification.class.getMethod("hasPromotableCharacteristics").invoke(shown.getNotification());}catch(Exception e){}}
  r.put("promoted",promoted);r.put("promotable",promotable);
  return r;
 }
 PendingIntent launch(String action,String page,int code){Intent i=new Intent(this,MainActivity.class).setAction(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);if(page!=null)i.putExtra("page",page);return PendingIntent.getActivity(this,code,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 // 当前预约的常驻通知。按 Android 16 实时更新的条件构造（持续、有标题、非自定义视图、不着色），系统支持时会显示在状态栏胶囊和小米超级岛。
 JSONObject postSeat(JSONObject d)throws Exception{
  NotificationManager nm=notifications();
  if(d.optBoolean("clear")||d.optString("title").isEmpty()){nm.cancel(NOTIFY_SEAT);return notifyState();}
  if(!notificationsAllowed())return notifyState();
  if(Build.VERSION.SDK_INT>=26&&nm.getNotificationChannel(CHANNEL_SEAT)==null){NotificationChannel c=new NotificationChannel(CHANNEL_SEAT,"当前预约",NotificationManager.IMPORTANCE_DEFAULT);c.setDescription("显示已预约座位所在区域，点按出示入馆码");c.setSound(null,null);c.enableVibration(false);c.setShowBadge(false);c.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);nm.createNotificationChannel(c);}
  int icon=getResources().getIdentifier("ic_stat_seat","drawable",getPackageName());
  Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL_SEAT):new Notification.Builder(this);
  b.setSmallIcon(icon).setContentTitle(d.optString("title")).setContentText(d.optString("text")).setSubText(d.optString("sub","图书馆座位")).setOngoing(true).setOnlyAlertOnce(true).setShowWhen(false).setCategory(Notification.CATEGORY_STATUS).setVisibility(Notification.VISIBILITY_PUBLIC).setColor(accent!=0?accent:Color.rgb(52,130,255)).setContentIntent(launch(ACTION_PASS,null,1));
  if(Build.VERSION.SDK_INT<26)b.setPriority(Notification.PRIORITY_DEFAULT);
  b.addAction(new Notification.Action.Builder(Icon.createWithResource(this,icon),"出示入馆码",launch(ACTION_PASS,null,1)).build());
  b.addAction(new Notification.Action.Builder(Icon.createWithResource(this,icon),"打开助手",launch(ACTION_PAGE,"library",2)).build());
  long end=d.optLong("endAt",0),now=System.currentTimeMillis();if(Build.VERSION.SDK_INT>=26&&end>now)b.setTimeoutAfter(end-now+10*60000L);
  Bundle extras=new Bundle();extras.putBoolean("android.requestPromotedOngoing",true);String chip=d.optString("chip");if(!chip.isEmpty())extras.putString("android.shortCriticalText",chip);
  if(focusAllowed)try{addFocus(extras,d,icon);}catch(Exception e){}
  if(Build.VERSION.SDK_INT>=36){try{Notification.Builder.class.getMethod("setRequestPromotedOngoing",boolean.class).invoke(b,true);}catch(Exception e){}if(!chip.isEmpty())try{Notification.Builder.class.getMethod("setShortCriticalText",String.class).invoke(b,chip);}catch(Exception e){}}
  b.addExtras(extras);
  nm.notify(NOTIFY_SEAT,b.build());
  return notifyState();
 }
 // 只有系统已授予本应用小米焦点通知权限时才附加 miui.focus.param；否则保持标准实时更新通知。
 void addFocus(Bundle extras,JSONObject d,int icon)throws Exception{
  String title=d.optString("title"),text=d.optString("text"),area=d.optString("area",title),seat=d.optString("seat",d.optString("chip"));
  JSONObject pic=new JSONObject().put("type",1).put("pic","miui.focus.pic_seat");
  JSONObject island=new JSONObject().put("islandProperty",1)
   .put("bigIslandArea",new JSONObject().put("imageTextInfoLeft",new JSONObject().put("type",1).put("picInfo",pic).put("textInfo",new JSONObject().put("title",seat.isEmpty()?title:seat).put("content",area))))
   .put("smallIslandArea",new JSONObject().put("picInfo",pic));
  JSONObject v2=new JSONObject().put("protocol",1).put("business","library_seat").put("enableFloat",false).put("updatable",true).put("ticker",seat.isEmpty()?title:seat).put("tickerPic","miui.focus.pic_seat").put("aodTitle",title).put("aodPic","miui.focus.pic_seat")
   .put("param_island",island).put("baseInfo",new JSONObject().put("type",2).put("title",title).put("content",text));
  extras.putString("miui.focus.param",new JSONObject().put("param_v2",v2).toString());
  Bundle pics=new Bundle();pics.putParcelable("miui.focus.pic_seat",Icon.createWithResource(this,icon));extras.putBundle("miui.focus.pics",pics);
 }
 void requestNotify(String id)throws Exception{
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){android.content.SharedPreferences prefs=getSharedPreferences("host",MODE_PRIVATE);boolean asked=prefs.getBoolean("askedNotify",false);if(!asked||shouldShowRequestPermissionRationale(POST_NOTIFICATIONS)){prefs.edit().putBoolean("askedNotify",true).apply();notifyRequestId=id;requestPermissions(new String[]{POST_NOTIFICATIONS},REQ_NOTIFY);return;}}
  if(!notificationsAllowed())openNotifySettings(false);
  reply(id,notifyState());
 }
 @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){super.onRequestPermissionsResult(code,permissions,results);if(code==REQ_NOTIFY&&!notifyRequestId.isEmpty()){String id=notifyRequestId;notifyRequestId="";try{reply(id,notifyState());}catch(Exception e){reject(id,"CLIENT","无法读取通知权限");}}}
 void openNotifySettings(boolean promoted){Intent i=null;if(promoted&&Build.VERSION.SDK_INT>=36)i=new Intent("android.settings.MANAGE_APP_PROMOTED_NOTIFICATIONS");else if(Build.VERSION.SDK_INT>=26)i=new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);if(i!=null)i.putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName());else i=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName()));try{startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}catch(Exception e){try{startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}catch(Exception x){}}}
 int pageBg;
 int background(){return pageBg!=0?pageBg:dark?Color.rgb(0,0,0):Color.rgb(247,247,247);}
 void applyColors(){
  int bg=background(),text=dark?Color.rgb(240,240,240):Color.rgb(26,26,26),muted=dark?Color.rgb(154,154,154):Color.rgb(115,115,115),primary=accent!=0?accent:dark?Color.rgb(76,147,255):Color.rgb(52,130,255);
  root.setBackgroundColor(bg);official.setBackgroundColor(bg);bar.setBackgroundColor(bg);main.setBackgroundColor(bg);
  getWindow().setStatusBarColor(bg);getWindow().setNavigationBarColor(bg);
  if(Build.VERSION.SDK_INT>=30){android.view.WindowInsetsController c=getWindow().getInsetsController();int light=android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;if(c!=null)c.setSystemBarsAppearance(dark?0:light,light);}
  else{View decor=getWindow().getDecorView();int light=View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|(Build.VERSION.SDK_INT>=26?View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR:0),flags=decor.getSystemUiVisibility();decor.setSystemUiVisibility(dark?flags&~light:flags|light);}
  barTitle.setTextColor(text);barHint.setTextColor(muted);done.setTextColor(primary);reload.setTextColor(primary);
 }
 void openOfficial(String target,boolean login){
  // 教务页停在统一认证、登录页或已在空闲教室查询页时原样显示、不重新加载，避免打断后台连接或重复提交密码。
  String tu=teaching==null?null:teaching.getUrl();Uri tp=Uri.parse(tu==null?"":tu);String tpath=tp.getPath()==null?"":tp.getPath();
  boolean reuseTeaching=target.equals("teaching")&&!login&&tu!=null&&!teachingNavFailed&&(needsUser(tp)||tpath.contains("/cdjy/"));
  // 打开教务官方页也允许自动填写统一认证；重新加载时算一次新尝试（重置已填写标记和验证码页跳转计数）。
  if(target.equals("teaching")){if(!login)teachAuto=!vault.optString("password").isEmpty();if(!reuseTeaching){sloginRedirects=0;if(!login)teachUsed=false;}}
  restoreBrightness();
  current=target.equals("teaching")?"teaching":target.equals("pass")?"pass":"library";
  closeOnTeaching=current.equals("teaching")&&(login||officialArgs.optBoolean("autoReturn"));
  String title=current.equals("pass")?"电子借阅证":current.equals("teaching")?"学生教务":target.equals("records")?"预约记录":target.equals("current")?"当前预约":target.equals("area")?"官方座位图":"图书馆";
  String hint=current.equals("pass")?"已临时调到最亮，返回助手后恢复":current.equals("teaching")&&login?"登录后会自动打开“空闲教室查询”，加载完成后自动返回":current.equals("library")&&login?"登录成功后会自动返回助手":target.equals("area")?"学校官方座位图，可查看座位所在位置":current.equals("teaching")&&closeOnTeaching?"打开“空闲教室查询”后会自动返回助手":current.equals("teaching")?"打开“空闲教室查询”后点“返回助手”，助手会读取查询选项":"";
  barTitle.setText(title);barHint.setText(hint);barHint.setVisibility(hint.isEmpty()?View.GONE:View.VISIBLE);
  closeOnSession=login&&current.equals("library");closeOnTeaching=current.equals("teaching")&&(login||officialArgs.optBoolean("autoReturn"));sawSso=false;if(current.equals("teaching")&&!reuseTeaching)studentRequested=false;
  // 教务页不销毁：被别的官方页替换时停回隐藏位置，供后台连接和查询继续使用。
  if(officialView!=null&&officialView!=teaching&&officialView!=passWeb){official.removeView(officialView);officialView.destroy();}else if(officialView!=null&&officialView==teaching&&!current.equals("teaching"))parkTeaching();else if(officialView!=null&&officialView==passWeb&&!current.equals("pass"))parkPass();
  if(current.equals("teaching"))officialView=ensureTeaching();else if(current.equals("pass"))officialView=ensurePass();else{officialView=new WebView(this);configure(officialView);CookieManager.getInstance().setAcceptThirdPartyCookies(officialView,true);if(current.equals("library"))officialView.addJavascriptInterface(new SessionReply(),"QluSession");officialView.setWebViewClient(officialClient(current));}
  if(officialView.getParent()!=null)((android.view.ViewGroup)officialView.getParent()).removeView(officialView);
  officialView.setVisibility(View.VISIBLE);official.addView(officialView,new LinearLayout.LayoutParams(-1,0,1));official.setVisibility(View.VISIBLE);main.setVisibility(View.GONE);
  if(current.equals("pass")){oldBrightness=getWindow().getAttributes().screenBrightness;WindowManager.LayoutParams a=getWindow().getAttributes();a.screenBrightness=1f;getWindow().setAttributes(a);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);brightened=true;}
  String url=current.equals("pass")?PASS:current.equals("teaching")?(login?TEACH:STUDENT):target.equals("records")?"https://libyuyue.qlu.edu.cn/h5/index.html#/mo/profile/seat-record":target.equals("current")?"https://libyuyue.qlu.edu.cn/h5/index.html#/mo/current":target.equals("area")?areaUrl():login?"https://libyuyue.qlu.edu.cn/h5/#/login":LIB;
  String token=vault.optString("token");
  // 借阅证：预载过且不到 3 分钟直接显示；更早的原地刷新（会话还在，很快）；从没加载过才走统一认证入口。
  if(current.equals("pass")){if(passAt==0)loadPass();else if(System.currentTimeMillis()-passAt>3*60000L||passTrimmed!=hideBorrow())refreshPass();}
  else if(current.equals("library")&&!login&&!token.isEmpty()&&url.startsWith("https://libyuyue.qlu.edu.cn/"))officialView.loadDataWithBaseURL("https://libyuyue.qlu.edu.cn/","<!doctype html><meta charset=utf-8><script>sessionStorage.setItem('token',"+JSONObject.quote(token)+");sessionStorage.setItem('isCas','true');location.replace("+JSONObject.quote(url)+")</script>","text/html","UTF-8",null);
  else if(!reuseTeaching)officialView.loadUrl(url);
  else if(current.equals("teaching")&&closeOnTeaching&&onCdjy()){closeOnTeaching=false;handler.postDelayed(()->{if(official.getVisibility()==View.VISIBLE&&current.equals("teaching"))closeOfficial();},1500);}
 }
 // 学校官方座位图：参数只接受数字编号和日期，防止拼接出其他地址。
 String areaUrl(){String area=officialArgs.optString("areaId"),day=officialArgs.optString("day"),seat=officialArgs.optString("seatId");if(!area.matches("\\d{1,9}"))return LIB;String u="https://libyuyue.qlu.edu.cn/h5/index.html#/mo/seat/appointment?id="+area;if(day.matches("\\d{4}-\\d{2}-\\d{2}"))u+="&date="+day;if(seat.matches("\\d{1,9}"))u+="&seat_id="+seat;return u;}
 // 教务页只建一次。不在官方页显示时像 api 一样停在根布局里（1×1、不可见），保持挂在窗口上，后台加载和脚本才能正常运行。
 // 入馆码预载：打开助手后在后台登录并加载官方电子借阅证，停在隐藏位置（1×1、不可见）；点“入馆码”时直接显示。
 WebView ensurePass(){if(passWeb!=null)return passWeb;passWeb=new WebView(this);configure(passWeb);CookieManager.getInstance().setAcceptThirdPartyCookies(passWeb,true);passWeb.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);passWeb.setWebViewClient(officialClient("pass"));parkPass();return passWeb;}
 void parkPass(){if(passWeb==null)return;android.view.ViewParent p=passWeb.getParent();if(p!=root){if(p!=null)((android.view.ViewGroup)p).removeView(passWeb);root.addView(passWeb,new LinearLayout.LayoutParams(1,1));}passWeb.setVisibility(View.INVISIBLE);}
 void loadPass(){ensurePass();passAuto=!vault.optString("password").isEmpty();passUsed=false;passAt=System.currentTimeMillis();passWeb.loadUrl(PASS);}
 boolean onPassPage(){String u=passWeb==null?null:passWeb.getUrl();return u!=null&&"mfindqlu.libsp.cn".equals(Uri.parse(u).getHost());}
 void refreshPass(){if(!onPassPage()){loadPass();return;}passAuto=!vault.optString("password").isEmpty();passUsed=false;passAt=System.currentTimeMillis();passWeb.reload();}
 // 正在显示借阅证时不动它；没加载过就加载，超过 10 分钟就刷新，避免二维码过期。
 void preloadPass(){if(!consented())return;if(official.getVisibility()==View.VISIBLE&&current.equals("pass"))return;if(libLogin!=null){handler.postDelayed(this::preloadPass,3000);return;}if(passWeb==null||passAt==0)loadPass();else if(System.currentTimeMillis()-passAt>10*60000L)refreshPass();}
 WebView ensureTeaching(){if(teaching!=null)return teaching;teaching=new WebView(this);configure(teaching);CookieManager.getInstance().setAcceptThirdPartyCookies(teaching,true);teaching.addJavascriptInterface(new ApiReply("teaching"),"QluReply");WebSettings ts=teaching.getSettings();ts.setUserAgentString(DESKTOP_UA);ts.setUseWideViewPort(true);ts.setLoadWithOverviewMode(true);ts.setSupportZoom(true);ts.setBuiltInZoomControls(true);ts.setDisplayZoomControls(false);teaching.setWebViewClient(officialClient("teaching"));parkTeaching();return teaching;}
 void parkTeaching(){if(teaching==null)return;android.view.ViewParent p=teaching.getParent();if(p!=root){if(p!=null)((android.view.ViewGroup)p).removeView(teaching);root.addView(teaching,new LinearLayout.LayoutParams(1,1));}teaching.setVisibility(View.INVISIBLE);}
 WebViewClient officialClient(final String system){return new WebViewClient(){
  // sawSso 只用于判断图书馆登录是否真的经过统一认证；后台教务连接经过统一认证时不算。
  @Override public boolean shouldOverrideUrlLoading(WebView w,WebResourceRequest r){if(system.equals("library")&&"sso.qlu.edu.cn".equals(r.getUrl().getHost()))sawSso=true;return !"https".equals(r.getUrl().getScheme());}
  @Override public void onPageStarted(WebView w,String url,android.graphics.Bitmap icon){if(system.equals("teaching"))teachingNavFailed=false;else if(system.equals("library")&&"sso.qlu.edu.cn".equals(Uri.parse(url).getHost()))sawSso=true;}
  @Override public void onReceivedError(WebView w,WebResourceRequest r,WebResourceError e){if(system.equals("teaching")&&r.isForMainFrame()){teachingNavFailed=true;if(!connectIds.isEmpty()){final int seq=connectSeq;handler.postDelayed(()->{if(seq==connectSeq&&teachingNavFailed&&!connectIds.isEmpty())finishConnect(false,false);},2000);}}}
  @Override public void onPageFinished(WebView w,String url){Uri u=Uri.parse(url);String path=u.getPath()==null?"":u.getPath();if(system.equals("library")&&"sso.qlu.edu.cn".equals(u.getHost()))sawSso=true;if(system.equals("library")&&"libyuyue.qlu.edu.cn".equals(u.getHost()))readSession(w);if(system.equals("pass")&&!"sso.qlu.edu.cn".equals(u.getHost())){passTrimmed=hideBorrow();if(passTrimmed)w.evaluateJavascript(PASS_TRIM,null);}
   if(system.equals("teaching")&&"jw.qlu.edu.cn".equals(u.getHost())){
    // 未登录访问 /jwglxt/ 会落到验证码登录页：改走统一认证入口，每次尝试最多 2 次，防止统一认证异常时循环；不重置已填写标记，错误密码不会被反复提交。
    if(path.startsWith("/jwglxt/xtgl/login_slogin.html")&&sloginRedirects<2){sloginRedirects++;teachAuto=!vault.optString("password").isEmpty();w.loadUrl(TEACH);return;}
    if(path.contains("/cdjy/"))sloginRedirects=0;
    if(closeOnTeaching&&path.contains("/cdjy/")){closeOnTeaching=false;handler.postDelayed(()->{if(official.getVisibility()==View.VISIBLE&&current.equals("teaching"))closeOfficial();},2000);}
    try{w.evaluateJavascript(asset("agent.js"),null);// 页面没打开成功（断网时也会走到这里）不算连上。
    if(path.contains("/cdjy/cdjy_cxKxcdlb.html")&&!teachingNavFailed){lastCdjy=url;final int seq=connectSeq;final boolean pending=!connectIds.isEmpty();handler.postDelayed(()->{if(!onCdjy())return;if(pending){if(seq==connectSeq)finishConnect(true,true);}else if(!(official.getVisibility()==View.VISIBLE&&officialView==teaching))sessionTeaching(true);},1500);}if(!studentRequested&&url.contains("jsdm=xs"))studentRequested=true;if(!studentRequested&&path.contains("/jwglxt/")&&!path.contains("/cdjy/"))w.evaluateJavascript("!!document.querySelector('input[type=password]')",v->{if(v.equals("false")){studentRequested=true;w.loadUrl(STUDENT);}});}catch(Exception e){}
   }
   if(system.equals("teaching")&&!connectIds.isEmpty()&&"sso.qlu.edu.cn".equals(u.getHost())&&path.startsWith("/login")&&(!teachAuto||teachUsed||vault.optString("password").isEmpty())){final int seq=connectSeq;handler.postDelayed(()->{String now=teaching==null?null:teaching.getUrl();if(seq==connectSeq&&now!=null&&"sso.qlu.edu.cn".equals(Uri.parse(now).getHost()))finishConnect(false,false);},2500);}
   tryFill(w,u,system);}
 };}
 boolean onCdjy(){String url=teaching==null?null:teaching.getUrl();if(url==null)return false;Uri u=Uri.parse(url);return "jw.qlu.edu.cn".equals(u.getHost())&&u.getPath()!=null&&u.getPath().contains("/cdjy/cdjy_cxKxcdlb.html");}
 // 后台静默连接教务：隐藏的教务页走统一认证入口，最终停在“空闲教室查询”；不弹出官方页面。同一时间只跑一次，期间再来的请求共享结果；每个请求只答复一次（成功、超时或界面销毁）。
 void connectTeaching(String id,boolean fresh){
  ensureTeaching();connectIds.add(id);if(connectIds.size()>1)return;
  final int seq=++connectSeq;handler.removeCallbacks(connectTimeout);handler.postDelayed(connectTimeout,35000);
  // fresh：界面发现教务会话已过期（查询页还在但查不出数据），必须重新走一遍登录，不能只看页面结构。
  if(fresh||!onCdjy()){startConnect(seq);return;}
  // 已在查询页：先问页面里的 agent 是否真能用，能用就直接答复，不重新加载。
  final String pid="native-connect-"+seq;connectProbe=pid;
  try{requests.put(pid,new JSONObject().put("system","teaching").put("method","status").put("connect",seq));}catch(Exception e){}
  teaching.evaluateJavascript("window.QluAgent?window.QluAgent.run({id:"+JSONObject.quote(pid)+",method:'status',params:{}}):QluReply.post(JSON.stringify({id:"+JSONObject.quote(pid)+",ok:false}))",null);
  handler.postDelayed(()->{if(requests.remove(pid)!=null)startConnect(seq);},3000);
 }
 void startConnect(int seq){startConnect(seq,0);}
 // 后台正在登录图书馆时最多等 12 秒：登录完统一认证已通过，教务通常不用再填密码。
 void startConnect(int seq,int waited){if(seq!=connectSeq||connectIds.isEmpty()||teaching==null)return;if(libLogin!=null&&waited<12000){handler.postDelayed(()->startConnect(seq,waited+1500),1500);return;}connectProbe="";if(official.getVisibility()==View.VISIBLE&&officialView==teaching)return;sloginRedirects=0;studentRequested=false;teachAuto=!vault.optString("password").isEmpty();teachUsed=false;teaching.loadUrl(TEACH);}
 // 要本人处理的页面：统一认证（验证码、短信、密码错误）或正方验证码登录页。教务入口 /sso/ddlogin 本身不算。
 boolean needsUser(Uri u){String host=u.getHost()==null?"":u.getHost(),path=u.getPath()==null?"":u.getPath();return "sso.qlu.edu.cn".equals(host)||"jw.qlu.edu.cn".equals(host)&&path.startsWith("/jwglxt/xtgl/login_slogin.html");}
 void sessionTeaching(boolean connected){JSONObject e=new JSONObject();try{e.put("event","sessionChanged");e.put("system","teaching");e.put("connected",connected);e.put("probe",true);send(e);}catch(Exception x){}}
 void finishConnect(boolean ok,boolean event){
  if(connectIds.isEmpty())return;handler.removeCallbacks(connectTimeout);if(!connectProbe.isEmpty()){requests.remove(connectProbe);connectProbe="";}
  JSONObject r=new JSONObject();try{r.put("connected",ok);if(!ok){String url=teaching==null?null:teaching.getUrl();Uri u=Uri.parse(url==null?"":url);String host=u.getHost()==null?"":u.getHost(),path=u.getPath()==null?"":u.getPath();r.put("needsUser",!teachingNavFailed&&needsUser(u));r.put("offline",teachingNavFailed);r.put("page",host+path);}}catch(Exception e){}
  List<String> ids=new ArrayList<>(connectIds);connectIds.clear();for(String id:ids)reply(id,r);
  if(ok&&event)sessionTeaching(true);
 }
 // 撤回同意：删除本机保存的账号、会话、状态、提醒、网页存储和缓存，然后重新启动应用。
 void resetAll(){try{ReminderReceiver.schedule(this,new org.json.JSONArray());}catch(Exception e){}try{notifications().cancelAll();}catch(Exception e){}
  for(String f:new String[]{"vault.bin","state.json"})try{new File(getFilesDir(),f).delete();}catch(Exception e){}
  try{getSharedPreferences("reminders",MODE_PRIVATE).edit().clear().commit();getSharedPreferences("host",MODE_PRIVATE).edit().clear().commit();}catch(Exception e){}
  try{CookieManager.getInstance().removeAllCookies(null);CookieManager.getInstance().flush();android.webkit.WebStorage.getInstance().deleteAllData();main.clearCache(true);}catch(Exception e){}
  vault=new JSONObject();state=new JSONObject();
  Intent i=getPackageManager().getLaunchIntentForPackage(getPackageName());if(i!=null){i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK);handler.postDelayed(()->{startActivity(i);finishAndRemoveTask();},300);}else finishAndRemoveTask();}
 // “支持作者”：把收款码存进相册（Android 10 起用 MediaStore，不需要存储权限）；更早的系统请用户截图。
 JSONObject saveDonate(){JSONObject r=new JSONObject();Uri u=null;try{r.put("saved",false);if(Build.VERSION.SDK_INT<29)return r;android.content.ContentValues v=new android.content.ContentValues();v.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME,"工大学伴-支持作者.png");v.put(android.provider.MediaStore.MediaColumns.MIME_TYPE,"image/png");v.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH,"Pictures/工大学伴");u=getContentResolver().insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI,v);if(u==null)return r;try(InputStream in=getAssets().open("donate.png");java.io.OutputStream out=getContentResolver().openOutputStream(u)){byte[] b=new byte[8192];int n;while((n=in.read(b))>0)out.write(b,0,n);}r.put("saved",true);}catch(Exception e){if(u!=null)try{getContentResolver().delete(u,null,null);}catch(Exception x){}}return r;}
 // 签到提醒：交给系统 AlarmManager，由 ReminderReceiver 发通知；清单存本机，重启后由 BootReceiver 重新设置。
 // 关掉的学校图书馆页面原来一直留在后台：它自己仍算“可见”，脚本照常跑（真机测到每秒几千次定时器），所有页面共用一条渲染线程，界面滑动掉到每秒二十几帧。读完会话再过 2.5 秒就销毁。
 void closeOfficial(){if(officialView!=null&&current.equals("library")){readSession(officialView);final WebView closed=officialView;handler.postDelayed(()->{if(officialView==closed&&official.getVisibility()!=View.VISIBLE){official.removeView(closed);closed.destroy();officialView=null;}},2500);}official.setVisibility(View.GONE);main.setVisibility(View.VISIBLE);restoreBrightness();CookieManager.getInstance().flush();if(current.equals("pass")&&officialView!=null){if(officialView==passWeb)parkPass();else{official.removeView(officialView);officialView.destroy();}officialView=null;current="library";}if(current.equals("teaching")&&teaching!=null){parkTeaching();JSONObject e=new JSONObject();try{e.put("event","sessionChanged");e.put("system","teaching");String url=teaching.getUrl();boolean onJw=url!=null&&"jw.qlu.edu.cn".equals(Uri.parse(url).getHost())&&!needsUser(Uri.parse(url))&&!String.valueOf(Uri.parse(url).getPath()).startsWith("/sso/")&&!teachingNavFailed;if(onJw&&lastCdjy!=null&&!url.contains("/cdjy/"))teaching.loadUrl(lastCdjy);e.put("connected",onJw);e.put("probe",true);send(e);}catch(Exception x){}}}
 void sessionEvent(boolean connected){JSONObject e=new JSONObject();try{e.put("event","sessionChanged");e.put("system","library");e.put("connected",connected);send(e);}catch(Exception x){}}
 // 图书馆会话失效时在后台重新登录：隐藏页面走统一认证（统一认证已登录时直接通过，否则用已存密码自动填写），拿到会话就销毁页面。
 // 不弹学校页面；失败（要验证码、断网）时告诉界面，由本人点“打开登录页”。同一次失败后 3 分钟内不再自动重试，避免反复提交密码。
 void autoRestore(){if(!consented()||vault.optString("password").isEmpty()||libLogin!=null)return;if(official.getVisibility()==View.VISIBLE&&current.equals("library"))return;long now=System.currentTimeMillis();if(restoreTried&&now-restoreAt<3*60000L)return;restoreTried=true;restoreAt=now;final int seq=++bgSeq;
  libLogin=new WebView(this);configure(libLogin);CookieManager.getInstance().setAcceptThirdPartyCookies(libLogin,true);libLogin.addJavascriptInterface(new SessionReply(),"QluSession");libLogin.setWebViewClient(officialClient("libbg"));root.addView(libLogin,new LinearLayout.LayoutParams(1,1));libLogin.setVisibility(View.INVISIBLE);
  bgAuto=true;bgUsed=false;libraryLoginEvent("started",false);libLogin.loadUrl(LIB_CAS);pollSession(seq,0);handler.postDelayed(()->{if(seq==bgSeq&&libLogin!=null)endBackgroundLogin(false);},40000);}
 // 学校前端拿到统一认证票据后异步写入会话，页面加载完不一定就有；每秒读一次，最多 45 次。
 void pollSession(int seq,int n){if(seq!=bgSeq||libLogin==null||n>45)return;String u=libLogin.getUrl();if(u!=null&&"libyuyue.qlu.edu.cn".equals(Uri.parse(u).getHost()))readSession(libLogin);handler.postDelayed(()->pollSession(seq,n+1),1000);}
 void endBackgroundLogin(boolean ok){if(libLogin==null)return;String u=libLogin.getUrl();boolean needs=!ok&&u!=null&&"sso.qlu.edu.cn".equals(Uri.parse(u).getHost());bgSeq++;root.removeView(libLogin);libLogin.destroy();libLogin=null;if(ok)restoreTried=false;libraryLoginEvent(ok?"done":"failed",needs);}
 void libraryLoginEvent(String state,boolean needsUser){JSONObject e=new JSONObject();try{e.put("event","libraryLogin");e.put("state",state);e.put("needsUser",needsUser);send(e);}catch(Exception x){}}
 void readSession(WebView w){w.evaluateJavascript("if(location.hostname==='libyuyue.qlu.edu.cn'){let t=sessionStorage.getItem('token');if(t)QluSession.post(t)}",null);}
 final class SessionReply {@JavascriptInterface public void post(String token){if(token==null||token.length()<8||token.length()>8192||!token.matches("[A-Za-z0-9._~+/=:-]+"))return;handler.post(()->{try{boolean fromOfficial=officialView!=null&&officialView.getUrl()!=null&&"libyuyue.qlu.edu.cn".equals(Uri.parse(officialView.getUrl()).getHost()),fromBackground=libLogin!=null&&libLogin.getUrl()!=null&&"libyuyue.qlu.edu.cn".equals(Uri.parse(libLogin.getUrl()).getHost());if(!fromOfficial&&!fromBackground)return;if(fromBackground&&!fromOfficial)handler.post(()->endBackgroundLogin(true));if(token.equals(vault.optString("token"))&&apiReady)return;vault.put("token",token);saveVault();configureApi();if(closeOnSession&&sawSso&&current.equals("library")){closeOnSession=false;handler.postDelayed(()->{if(official.getVisibility()==View.VISIBLE&&current.equals("library"))closeOfficial();},400);}handler.postDelayed(()->{JSONObject e=new JSONObject();try{e.put("event","sessionChanged");e.put("system","library");e.put("connected",true);send(e);}catch(Exception x){}},600);}catch(Exception e){}});}}
 void configureApi(){try{apiReady=false;String token=vault.optString("token");String html="<!doctype html><meta charset=utf-8><script>sessionStorage.setItem('token',"+JSONObject.quote(token)+");"+asset("agent.js")+"</script>";api.loadDataWithBaseURL("https://libyuyue.qlu.edu.cn/",html,"text/html","UTF-8",null);}catch(Exception e){apiReady=false;}}
 void tryFill(WebView w,Uri u,String system){boolean teach=system.equals("teaching"),pass=system.equals("pass"),bg=system.equals("libbg");if(!(teach?teachAuto:pass?passAuto:bg?bgAuto:autoLogin)||(teach?teachUsed:pass?passUsed:bg?bgUsed:autoUsed)||!"sso.qlu.edu.cn".equals(u.getHost())||u.getPath()==null||!u.getPath().startsWith("/login")||vault.optString("password").isEmpty())return;if(teach)teachUsed=true;else if(pass)passUsed=true;else if(bg)bgUsed=true;else autoUsed=true;String js="(()=>{let u=document.querySelector('input[name=username],input#username,input[type=text]'),p=document.querySelector('input[type=password]'),b=document.querySelector('#submitBtn');if(!u||!p||!b)return false;let set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(u,"+JSONObject.quote(vault.optString("username"))+");set.call(p,"+JSONObject.quote(vault.optString("password"))+");for(let x of [u,p]){x.dispatchEvent(new Event('input',{bubbles:true}));x.dispatchEvent(new Event('change',{bubbles:true}));}b.click();return true})()";w.evaluateJavascript(js,null);}
 void request(String id,String system,String method,JSONObject params){
  Set<String> allowed=new HashSet<>(Arrays.asList(system.equals("library")?new String[]{"status","catalog","areas","seats","records","reserve","current","temporaryLeave","profile","violations","rules","cancelBooking","checkout"}:new String[]{"status","options","rooms"}));if(!allowed.contains(method)){reject(id,"CLIENT","未知学校操作");return;}
  if(system.equals("library")&&(!apiReady||vault.optString("token").isEmpty())){if(method.equals("status")){JSONObject d=new JSONObject();try{d.put("connected",false);}catch(Exception x){}reply(id,d);if(vault.optString("token").isEmpty())autoRestore();}else reject(id,"AUTH","请先登录图书馆并返回助手");return;}
  WebView web=system.equals("library")?api:teaching;if(web==null){reject(id,"AUTH","请先打开教务官方页面登录");return;}
  try{JSONObject request=new JSONObject();request.put("id",id);request.put("method",method);request.put("params",params==null?new JSONObject():params);requests.put(id,new JSONObject().put("system",system).put("method",method));web.evaluateJavascript("window.QluAgent?window.QluAgent.run("+request.toString()+"):QluReply.post(JSON.stringify({id:"+JSONObject.quote(id)+",ok:false,error:{code:'AUTH',message:'请先完成学校登录'}}))",null);handler.postDelayed(()->{if(requests.remove(id)!=null)reject(id,(method.equals("reserve")||method.equals("temporaryLeave")||method.equals("cancelBooking")||method.equals("checkout"))?"UNCERTAIN":"TIMEOUT","学校响应超时，请核对登录或预约记录");},method.equals("temporaryLeave")||method.equals("cancelBooking")||method.equals("checkout")?55000:27000);}catch(Exception e){reject(id,"CLIENT","无法请求学校页面");}
 }
 // 每个后台页面一个答复通道：只接受发往该页面的请求的答复，教务页里跳到的其他网站无法冒充图书馆答复。
 final class ApiReply {final String system;ApiReply(String system){this.system=system;}@JavascriptInterface public void post(String text){final JSONObject r=json(text);final String script="window.Campus&&window.Campus.receive("+r.toString()+")";handler.post(()->{if(system.equals("teaching")&&r.optString("event").equals("teachingRoute")){Uri route=Uri.parse(r.optString("url"));if(teaching!=null&&"https".equals(route.getScheme())&&"jw.qlu.edu.cn".equals(route.getHost())&&"/jwglxt/cdjy/cdjy_cxKxcdlb.html".equals(route.getPath()))teaching.loadUrl(route.toString());return;}String id=r.optString("id");JSONObject request=requests.get(id);if(id.isEmpty()||request==null||!system.equals(request.optString("system")))return;requests.remove(id);if(request.has("connect")){int seq=request.optInt("connect");if(seq!=connectSeq)return;JSONObject data=r.optJSONObject("data");if(r.optBoolean("ok")&&data!=null&&data.optBoolean("connected"))finishConnect(true,false);else startConnect(seq);return;}if(!r.optBoolean("ok")&&r.optJSONObject("error")!=null&&r.optJSONObject("error").optString("code").equals("AUTH")&&request.optString("system").equals("library")){try{vault.remove("token");saveVault();autoRestore();}catch(Exception e){}}main.evaluateJavascript(script,null);if(request.optString("system").equals("teaching")&&request.optString("method").equals("status")&&r.optBoolean("ok")&&r.optJSONObject("data")!=null&&r.optJSONObject("data").optBoolean("connected"))finishConnect(true,true);});}}
 String asset(String name)throws Exception {try(InputStream in=getAssets().open(name);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))>0)out.write(b,0,n);return new String(out.toByteArray(),StandardCharsets.UTF_8);}}
 JSONObject readJson(String name){try{return json(new String(read(name),StandardCharsets.UTF_8));}catch(Exception e){return new JSONObject();}}
 byte[] read(String name)throws Exception {try(InputStream in=new FileInputStream(new File(getFilesDir(),name));ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))>0)out.write(b,0,n);return out.toByteArray();}}
 void write(String name,byte[] b)throws Exception{File p=new File(getFilesDir(),name),tmp=new File(getFilesDir(),name+".tmp");try(FileOutputStream f=new FileOutputStream(tmp)){f.write(b);f.getFD().sync();}if(!tmp.renameTo(p))throw new IOException("无法保存本机数据");}
 javax.crypto.SecretKey key()throws Exception{KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);if(!ks.containsAlias("QluCampusVault")){KeyGenerator k=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");k.init(new KeyGenParameterSpec.Builder("QluCampusVault",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());k.generateKey();}return (javax.crypto.SecretKey)ks.getKey("QluCampusVault",null);}
 void saveVault()throws Exception{JSONObject stored=new JSONObject(vault.toString());if(!stored.optBoolean("remember")){stored.remove("username");stored.remove("password");}Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());byte[] iv=c.getIV(),enc=c.doFinal(stored.toString().getBytes(StandardCharsets.UTF_8));ByteArrayOutputStream out=new ByteArrayOutputStream();out.write(iv.length);out.write(iv);out.write(enc);write("vault.bin",out.toByteArray());}
 JSONObject readVault()throws Exception{byte[] b;try{b=read("vault.bin");}catch(FileNotFoundException e){return new JSONObject();}int n=b[0]&255;if(n<12||n>32||b.length<n+17)throw new IOException("无效凭据文件");Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Arrays.copyOfRange(b,1,1+n)));return json(new String(c.doFinal(Arrays.copyOfRange(b,1+n,b.length)),StandardCharsets.UTF_8));}
 void restoreBrightness(){if(!brightened)return;brightened=false;WindowManager.LayoutParams a=getWindow().getAttributes();a.screenBrightness=oldBrightness;getWindow().setAttributes(a);getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);}
 @Override protected void onResume(){super.onResume();foreground=true;if(official!=null&&official.getVisibility()==View.VISIBLE&&current.equals("pass")&&!brightened){oldBrightness=getWindow().getAttributes().screenBrightness;WindowManager.LayoutParams a=getWindow().getAttributes();a.screenBrightness=1f;getWindow().setAttributes(a);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);brightened=true;}handler.removeCallbacks(tick);handler.postDelayed(tick,1000);if(mainReady){JSONObject e=new JSONObject();try{e.put("event","resume");send(e);}catch(Exception x){}handler.postDelayed(this::preloadPass,800);}}
 @Override protected void onPause(){foreground=false;handler.removeCallbacks(tick);if(official!=null&&official.getVisibility()==View.VISIBLE&&current.equals("pass"))closeOfficial();else restoreBrightness();CookieManager.getInstance().flush();super.onPause();}
 @Override public void onBackPressed(){if(official.getVisibility()==View.VISIBLE){closeOfficial();return;}main.evaluateJavascript("window.Campus&&window.Campus.back?window.Campus.back():false",v->{if(!"true".equals(v))exitApp();});}
 void exitApp(){super.onBackPressed();}
 @Override public void onConfigurationChanged(Configuration c){super.onConfigurationChanged(c);JSONObject e=new JSONObject();try{e.put("event","systemTheme");e.put("dark",systemDark(c));send(e);}catch(Exception x){}}
 @Override protected void onDestroy(){finishConnect(false,false);handler.removeCallbacksAndMessages(null);for(WebView w:new WebView[]{main,api,teaching,passWeb,libLogin})if(w!=null){if(w.getParent()!=null)((android.view.ViewGroup)w.getParent()).removeView(w);w.destroy();}super.onDestroy();}
}
