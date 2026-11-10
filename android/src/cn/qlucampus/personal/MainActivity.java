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
 DurableStateStore stateStorage;boolean destroyed=false,stateLoaded=false,stateLoadFailed=false,fullyDrawnReported=false,memoryConstrained=false;final ArrayList<JSONObject> startupMessages=new ArrayList<>();
 static final String LIB="https://libyuyue.qlu.edu.cn/h5/index.html#/mo/home";
 // 教务登录走统一认证入口；直接打开 /jwglxt/ 会落到带图片验证码的正方本地登录页，自动填写无法处理。
 static final String CDJY="https://jw.qlu.edu.cn/jwglxt/cdjy/cdjy_cxKxcdlb.html?gnmkdm=N2155";
 static final String TEACH="https://jw.qlu.edu.cn/sso/ddlogin",EXAM_PAGE="https://jw.qlu.edu.cn/jwglxt/kwgl/kscx_cxXsksxxIndex.html?gnmkdm=N358105&layout=default";
 // 打开“考试信息”时：不要被自动导航带去空闲教室页；中途先登录的，登录完进到教务后再打开考试信息页
 boolean examPending=false;
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
 final Map<WebView,TrustedReplyChannel> replyChannels=new IdentityHashMap<>();volatile long sessionEpoch=1;
 SubjectState subjectState;boolean sessionSwitching=false,openLoginAfterReady=false;volatile boolean identityVerified=false;String identityExpected="";
 boolean rendererRecovering=false,runtimeSupported=true;
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

 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);stateStorage=new DurableStateStore(getFilesDir());dark=systemDark(getResources().getConfiguration());vault=readVault();
  stateStorage.load((bytes,error)->handler.post(()->{
   if(destroyed)return;
   try{
    if(error!=null)throw error;
    JSONObject loaded=new JSONObject();
    if(bytes!=null&&bytes.length>0){
     String text=StandardCharsets.UTF_8.newDecoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT).decode(java.nio.ByteBuffer.wrap(bytes)).toString();
     JSONTokener parser=new JSONTokener(text);Object decoded=parser.nextValue();
     if(!(decoded instanceof JSONObject)||parser.nextClean()!=0)throw new IOException("本机数据格式无效");loaded=(JSONObject)decoded;
    }
    subjectState=new SubjectState(loaded,vault.optString("subjectId"));state=subjectState.active();identityExpected=vault.optString("username",vault.optString("subjectId"));
   }catch(Exception failure){state=new JSONObject();stateLoadFailed=true;}
   stateLoaded=true;initializeNativeAuthentication();
   if(runtimeSupported&&!vault.optString("token").isEmpty()&&!stateLoadFailed)configureApi();
   ArrayList<JSONObject> queued=new ArrayList<>(startupMessages);startupMessages.clear();for(JSONObject message:queued)handle(message);
   kickAuthenticationRecovery();
  }));
  restoreCookies();build();applyColors();handleIntent(getIntent(),true);
 }

 @Override protected void onNewIntent(Intent i){super.onNewIntent(i);setIntent(i);handleIntent(i,false);}
 // 通知、桌面快捷方式和控制中心磁贴都从这里进入：入馆码直接打开官方电子借阅证，其余切到对应页面。
 void handleIntent(Intent i,boolean cold){if(i==null)return;String a=i.getAction();if(ACTION_PASS.equals(a))openOfficial("pass",false);else if(ACTION_PAGE.equals(a)){String page=i.getStringExtra("page");if(page==null||page.isEmpty())return;if(official!=null&&official.getVisibility()==View.VISIBLE)closeOfficial();if(cold||!mainReady)pendingPage=page;else{JSONObject e=new JSONObject();try{e.put("event","navigate");e.put("page",page);send(e);}catch(Exception x){}}}}
 boolean systemDark(Configuration c){return (c.uiMode&Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES;}
 void build(){
  root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
  // 安卓 15 起强制全面屏，adjustResize 不再缩小页面：底部留白要把输入法的高度也算上，否则键盘会盖住学号密码框和学校登录页。
  root.setOnApplyWindowInsetsListener((v,i)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets s=i.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()),ime=i.getInsets(WindowInsets.Type.ime());v.setPadding(s.left,s.top,s.right,ime.bottom);if(official!=null)official.setPadding(0,0,0,ime.bottom>0?0:s.bottom);if(navBottom!=s.bottom){navBottom=s.bottom;pushInsets();}return WindowInsets.CONSUMED;}v.setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());return i.consumeSystemWindowInsets();});
  setContentView(root);main=new WebView(this);configure(main);runtimeSupported=RuntimeSupport.supports(main.getSettings().getUserAgentString());main.setOverScrollMode(View.OVER_SCROLL_NEVER);main.addJavascriptInterface(new LocalHost(),"NativeHost");
  main.setWebViewClient(new WebViewClient(){
   @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){return recoverRenderer(view);}
   @Override public WebResourceResponse shouldInterceptRequest(WebView w,WebResourceRequest r){Uri u=r.getUrl();if(!TrustedReplyChannel.isOrigin(u.toString(),"https://campus.local"))return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));try{String name=u.getPath().replaceFirst("^/","");if(name.contains(".."))return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));String mime=name.endsWith(".js")?"text/javascript":name.endsWith(".css")?"text/css":name.endsWith(".png")?"image/png":name.endsWith(".webp")?"image/webp":name.endsWith(".jpg")?"image/jpeg":"text/html";return new WebResourceResponse(mime,"UTF-8",getAssets().open(name));}catch(Exception e){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}}
   @Override public boolean shouldOverrideUrlLoading(WebView w,WebResourceRequest r){return !TrustedReplyChannel.isOrigin(r.getUrl().toString(),"https://campus.local");}
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
  api=new WebView(this);configure(api);api.setWebViewClient(new WebViewClient(){@Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){return recoverRenderer(view);}@Override public void onPageStarted(WebView w,String url,android.graphics.Bitmap icon){closeReplyChannel(w);apiReady=false;}@Override public void onPageFinished(WebView w,String url){wireAgent(w,"library");}});root.addView(api,new LinearLayout.LayoutParams(1,1));api.setVisibility(View.INVISIBLE);

  if(runtimeSupported)main.loadUrl("https://campus.local/index.html");else main.loadDataWithBaseURL("https://campus.local/",RuntimeSupport.unavailableHtml(),"text/html","UTF-8",null);
 }
 int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
 void configure(WebView w){WebSettings s=w.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);w.setBackgroundColor(background());w.setWebChromeClient(new WebChromeClient());CookieManager.getInstance().setAcceptCookie(true);}
 JSONObject json(String s){try{return new JSONObject(s);}catch(Exception e){return new JSONObject();}}
 JSONObject err(String code,String message){JSONObject e=new JSONObject();try{e.put("code",code);e.put("message",message);}catch(Exception x){}return e;}
 void reply(String id,Object value){JSONObject m=new JSONObject();try{m.put("id",id);m.put("ok",true);m.put("data",value==null?JSONObject.NULL:value);send(m);}catch(Exception e){}}
 void reject(String id,String code,String message){JSONObject m=new JSONObject();try{m.put("id",id);m.put("ok",false);m.put("error",err(code,message));send(m);}catch(Exception e){}}
 void send(JSONObject m){if(destroyed||main==null)return;main.evaluateJavascript("window.Campus&&window.Campus.receive("+m.toString()+")",null);}
 final class LocalHost {@JavascriptInterface public void post(String text){final JSONObject message=json(text);handler.post(()->{if(destroyed)return;if(!stateLoaded)startupMessages.add(message);else handle(message);});}}
 void handle(JSONObject m){String id=m.optString("id"),cmd=m.optString("cmd");JSONObject d=m.optJSONObject("data");if(d==null)d=new JSONObject();try{if((authStateQuarantined||stateLoadFailed||sessionSwitching)&&Arrays.asList("liveSeat","calendarExams","calendarPreview","calendarCommit","reminders").contains(cmd)){rejectAuthentication(id,"STORAGE","账号数据正在恢复，未写入提醒或日历",true,false);return;}switch(cmd){
  case"ready":{
   // A blocked retry recreates the Activity, so state is truly reread from disk.
   boolean reread=mainReady&&(stateLoadFailed||authStateQuarantined);
   JSONObject r=new JSONObject().put("platform","android").put("foreground",foreground).put("systemDark",systemDark(getResources().getConfiguration())).put("launchPage",pendingPage);
   pendingPage="";mainReady=true;
   if(!stateLoadFailed&&!authStateQuarantined)handler.postDelayed(this::preloadPass,300);
   r.put("state",state).put("subjectId",subjectState==null?"":subjectState.subject()).put("identityVerified",libraryRecovery.verified()).put("legacyAvailable",subjectState!=null&&subjectState.hasLegacy()).put("username",vault.optString("subjectId",vault.optString("username")));
   addAuthenticationMetadata(r);reply(id,r);pushInsets();
   if(reread){final long epoch=sessionEpoch;handler.postDelayed(()->{if(!destroyed&&epoch==sessionEpoch)recreate();},200);break;}
   if(openLoginAfterReady){openLoginAfterReady=false;final long epoch=sessionEpoch;handler.postDelayed(()->{if(!destroyed&&epoch==sessionEpoch&&!sessionSwitching)openLibraryLogin(true);},400);}
   break;
  }
  case"localUiReady":{final long epoch=sessionEpoch;if(mainReady&&d.optLong("sessionEpoch",-1)==epoch&&main!=null)main.postVisualStateCallback(System.nanoTime(),new WebView.VisualStateCallback(){@Override public void onComplete(long requestId){if(!destroyed&&mainReady&&epoch==sessionEpoch&&!fullyDrawnReported){fullyDrawnReported=true;reportFullyDrawn();}}});reply(id,true);break;}
  case"appearance":dark=d.optBoolean("dark");try{pageBg=Color.parseColor(d.optString("bg"));}catch(Exception x){pageBg=0;}try{accent=Color.parseColor(d.optString("accent"));}catch(Exception x){accent=0;}applyColors();reply(id,true);break;
  case"liveSeat":reply(id,postSeat(d));break;
  case"calendarExams":case"calendarPreview":calendars().preview(id,d.optJSONArray("events"),d.optJSONArray("keep"),d.optString("term"),d.optBoolean("allowRemoval",false));break;
  case"calendarCommit":calendars().commit(id,d.optString("planId"));break;
  case"runtimeInfo":{JSONObject info=new JSONObject().put("sdk",Build.VERSION.SDK_INT).put("model",Build.MANUFACTURER+" "+Build.MODEL).put("refreshRate",getWindowManager().getDefaultDisplay().getMode().getRefreshRate());if(Build.VERSION.SDK_INT>=26){android.content.pm.PackageInfo provider=WebView.getCurrentWebViewPackage();if(provider!=null){info.put("provider",provider.packageName);info.put("version",provider.versionName);}}reply(id,info);break;}
  case"notifyState":reply(id,notifyState());break;
  case"requestNotify":requestNotify(id);break;
  case"openNotifySettings":openNotifySettings(d.optBoolean("promoted"));reply(id,true);break;
  case"haptic":{String k=d.optString("kind");boolean r30=Build.VERSION.SDK_INT>=30;int c=k.equals("confirm")?(r30?HapticFeedbackConstants.CONFIRM:HapticFeedbackConstants.VIRTUAL_KEY):k.equals("reject")?(r30?HapticFeedbackConstants.REJECT:HapticFeedbackConstants.LONG_PRESS):k.equals("heavy")?HapticFeedbackConstants.LONG_PRESS:k.equals("tap")?HapticFeedbackConstants.VIRTUAL_KEY:HapticFeedbackConstants.CLOCK_TICK;main.performHapticFeedback(c);reply(id,true);break;}
  case"saveState":saveSubjectState(id,d);break;
  case"credentials":saveCredentials(id,d);break;
  case"legacyStateInfo":if(authStateQuarantined||stateLoadFailed){rejectAuthentication(id,"STORAGE","本机账号数据尚未恢复",true,false);break;}reply(id,subjectState.legacyInfo());break;
  case"adoptLegacyState":if(authStateQuarantined||stateLoadFailed||sessionSwitching){rejectAuthentication(id,"STORAGE","账号数据正在恢复，未导入旧数据",true,false);break;}subjectState.adoptLegacy(identityVerified);state=subjectState.active();persistSubjects(id,true);break;
  case"forgetCredentials":forgetCredentials(id,d);break;
  case"openLogin":if(sessionSwitching||stateLoadFailed){rejectAuthentication(id,stateLoadFailed?"STORAGE":"BUSY","本机账号数据尚未就绪",true,false);break;}if(d.optString("system").equals("teaching")){if(authStateQuarantined){rejectAuthentication(id,"STORAGE","账号数据正在恢复",true,false);break;}teachAuto=d.optBoolean("auto");teachUsed=false;studentRequested=false;openOfficial("teaching",true);}else openLibraryLogin(d.optBoolean("auto"));reply(id,true);break;
  case"openOfficial":if(authStateQuarantined||stateLoadFailed||sessionSwitching){rejectAuthentication(id,"STORAGE","账号数据正在恢复",true,false);break;}officialArgs=d;openOfficial(d.optString("target"),false);reply(id,true);break;
  case"library":if(d.optLong("sessionEpoch",-1)!=sessionEpoch){rejectAuthentication(id,"STALE","旧账号请求已停用",true,false);break;}request(id,"library",d.optString("method"),d.optJSONObject("params"));break;
  case"teaching":if(d.optLong("sessionEpoch",-1)!=sessionEpoch){rejectAuthentication(id,"STALE","旧账号请求已停用",true,false);break;}request(id,"teaching",d.optString("method"),d.optJSONObject("params"));break;
  case"connectTeaching":connectTeaching(id,d.optBoolean("fresh"));break;
  case"reminders":reply(id,ReminderReceiver.schedule(this,d.optJSONArray("items")));break;
  case"saveDonate":reply(id,saveDonate());break;
  case"exitApp":reply(id,true);handler.postDelayed(this::finishAndRemoveTask,150);break;
  case"resetAll":resetRequestId=id;resetAll();break;
  default:reject(id,"CLIENT","未知客户端操作");
 }}catch(Exception e){reject(id,"CLIENT",e.getMessage()==null?"本机操作失败":e.getMessage());}}


 void persistSubjects(String id,boolean reload)throws Exception{
  if(authStateQuarantined||stateLoadFailed||sessionSwitching)throw new IOException("账号数据正在隔离恢复");
  byte[] bytes=subjectState.snapshot().toString().getBytes(StandardCharsets.UTF_8);final long epoch=sessionEpoch;
  stateStorage.save(bytes,failure->handler.post(()->{
   if(destroyed||epoch!=sessionEpoch)return;
   if(failure!=null){if(!id.isEmpty())reject(id,"CLIENT","保存账号所属数据失败，请重试");return;}
   if(!id.isEmpty())try{reply(id,new JSONObject().put("reload",reload));}catch(Exception ignored){}
   if(reload){mainReady=false;handler.postDelayed(()->{if(!destroyed&&epoch==sessionEpoch)main.reload();},150);}
  }));
 }


 static boolean isSchoolWrite(String method){return Arrays.asList("reserve","temporaryLeave","cancelBooking","checkout").contains(method);}


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
 // 考试导入系统日历：点了“导入日历”才申请日历权限；同一场考试再导入时更新原来那条，不重复添加；考前一天、一小时各提醒一次
 CalendarController calendarController;
 CalendarController calendars(){if(calendarController==null)calendarController=new CalendarController(this,new CalendarController.Host(){public long epoch(){return sessionEpoch;}public String subject(){return subjectState==null?"":subjectState.subject();}public boolean verified(){return identityVerified&&!sessionSwitching;}public void reply(String id,JSONObject result){MainActivity.this.reply(id,result);}public void reject(String id,String code,String message){MainActivity.this.reject(id,code,message);}});return calendarController;}
 @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){super.onRequestPermissionsResult(code,permissions,results);if(code==CalendarController.PERMISSION_REQUEST){if(calendarController!=null)calendarController.permissionsResult(results);return;}if(code==REQ_NOTIFY&&!notifyRequestId.isEmpty()){String id=notifyRequestId;notifyRequestId="";try{reply(id,notifyState());}catch(Exception e){reject(id,"CLIENT","无法读取通知权限");}}}
 void openNotifySettings(boolean promoted){Intent i=null;if(promoted&&Build.VERSION.SDK_INT>=36)i=new Intent("android.settings.MANAGE_APP_PROMOTED_NOTIFICATIONS");else if(Build.VERSION.SDK_INT>=26)i=new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);if(i!=null)i.putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName());else i=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName()));try{startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}catch(Exception e){try{startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}catch(Exception x){}}}
 int pageBg;
 int background(){return pageBg!=0?pageBg:dark?Color.rgb(0,0,0):Color.rgb(247,247,247);}
 // 手势小白条的高度告诉网页（CSS 变量 --sab），悬浮底栏和弹窗按它避开
 int navBottom=-1;
 void pushInsets(){if(main==null||navBottom<0)return;float d=getResources().getDisplayMetrics().density;main.evaluateJavascript("document.documentElement&&document.documentElement.style.setProperty('--sab','"+Math.round(navBottom/d)+"px')",null);}
 void applyColors(){
  int bg=background(),text=dark?Color.rgb(240,240,240):Color.rgb(26,26,26),muted=dark?Color.rgb(154,154,154):Color.rgb(115,115,115),primary=accent!=0?accent:dark?Color.rgb(76,147,255):Color.rgb(52,130,255);
  root.setBackgroundColor(bg);official.setBackgroundColor(bg);bar.setBackgroundColor(bg);main.setBackgroundColor(bg);
  getWindow().setStatusBarColor(bg);getWindow().setNavigationBarColor(Build.VERSION.SDK_INT>=30?Color.TRANSPARENT:bg);if(Build.VERSION.SDK_INT>=29)getWindow().setNavigationBarContrastEnforced(false);
  if(Build.VERSION.SDK_INT>=30){android.view.WindowInsetsController c=getWindow().getInsetsController();int light=android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;if(c!=null)c.setSystemBarsAppearance(dark?0:light,light);}
  else{View decor=getWindow().getDecorView();int light=View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|(Build.VERSION.SDK_INT>=26?View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR:0),flags=decor.getSystemUiVisibility();decor.setSystemUiVisibility(dark?flags&~light:flags|light);}
  barTitle.setTextColor(text);barHint.setTextColor(muted);done.setTextColor(primary);reload.setTextColor(primary);
 }
 void openOfficial(String target,boolean login){
  // 教务页停在统一认证、登录页或已在空闲教室查询页时原样显示、不重新加载，避免打断后台连接或重复提交密码。
  String tu=teaching==null?null:teaching.getUrl();Uri tp=Uri.parse(tu==null?"":tu);String tpath=tp.getPath()==null?"":tp.getPath();
  boolean exams=target.equals("exams"),reuseTeaching=(target.equals("teaching")&&!login&&tu!=null&&!teachingNavFailed&&(needsUser(tp)||tpath.contains("/cdjy/")))||(exams&&tu!=null&&!teachingNavFailed&&needsUser(tp)&&teachUsed);
  if(exams&&!reuseTeaching&&!connectIds.isEmpty())finishConnect(false,false);
  // 打开教务官方页也允许自动填写统一认证；重新加载时算一次新尝试（重置已填写标记和验证码页跳转计数）。
  if(target.equals("teaching")||exams){if(!login)teachAuto=!vault.optString("password").isEmpty();if(!reuseTeaching){sloginRedirects=0;if(!login)teachUsed=false;}}
  if(visibleLoginView!=null&&officialView==visibleLoginView&&!(target.equals("library")&&login))afterVisibleLibraryClosed(visibleLoginView);
  restoreBrightness();
  current=target.equals("teaching")||exams?"teaching":target.equals("pass")?"pass":"library";
  closeOnTeaching=current.equals("teaching")&&(login||officialArgs.optBoolean("autoReturn"));
  String title=current.equals("pass")?"电子借阅证":exams?"考试信息":current.equals("teaching")?"学生教务":target.equals("records")?"预约记录":target.equals("current")?"当前预约":target.equals("area")?"官方座位图":"图书馆";
  String hint=current.equals("pass")?"已临时调到最亮，返回助手后恢复":exams?"学校教务系统的考试信息，考试时间、地点以这里为准":current.equals("teaching")&&login?"登录后会自动打开“空闲教室查询”，加载完成后自动返回":current.equals("library")&&login?"登录成功后会自动返回助手":target.equals("area")?"学校官方座位图，可查看座位所在位置":current.equals("teaching")&&closeOnTeaching?"打开“空闲教室查询”后会自动返回助手":current.equals("teaching")?"打开“空闲教室查询”后点“返回助手”，助手会读取查询选项":"";
  barTitle.setText(title);barHint.setText(hint);barHint.setVisibility(hint.isEmpty()?View.GONE:View.VISIBLE);
  closeOnSession=login&&current.equals("library");closeOnTeaching=current.equals("teaching")&&(login||officialArgs.optBoolean("autoReturn"));sawSso=false;if(current.equals("teaching")&&!reuseTeaching)studentRequested=exams;examPending=exams;
  // 教务页不销毁：被别的官方页替换时停回隐藏位置，供后台连接和查询继续使用。
  if(officialView!=null&&officialView!=teaching&&officialView!=passWeb){closeReplyChannel(officialView);official.removeView(officialView);officialView.destroy();}else if(officialView!=null&&officialView==teaching&&!current.equals("teaching"))parkTeaching();else if(officialView!=null&&officialView==passWeb&&!current.equals("pass"))parkPass();
  if(current.equals("teaching"))officialView=ensureTeaching();else if(current.equals("pass"))officialView=ensurePass();else{officialView=new WebView(this);configure(officialView);CookieManager.getInstance().setAcceptThirdPartyCookies(officialView,true);officialView.setWebViewClient(officialClient(current));}
  if(officialView.getParent()!=null)((android.view.ViewGroup)officialView.getParent()).removeView(officialView);
  officialView.setVisibility(View.VISIBLE);official.addView(officialView,new LinearLayout.LayoutParams(-1,0,1));official.setVisibility(View.VISIBLE);main.setVisibility(View.GONE);
  if(current.equals("pass")){oldBrightness=getWindow().getAttributes().screenBrightness;WindowManager.LayoutParams a=getWindow().getAttributes();a.screenBrightness=1f;getWindow().setAttributes(a);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);brightened=true;}
  String url=current.equals("pass")?PASS:exams?EXAM_PAGE:current.equals("teaching")?(login?TEACH:STUDENT):target.equals("records")?"https://libyuyue.qlu.edu.cn/h5/index.html#/mo/profile/seat-record":target.equals("current")?"https://libyuyue.qlu.edu.cn/h5/index.html#/mo/current":target.equals("area")?areaUrl():login?"https://libyuyue.qlu.edu.cn/h5/#/login":LIB;
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
 void preloadPass(){if(destroyed||stateLoadFailed||authStateQuarantined||sessionSwitching||memoryConstrained||!foreground||!consented())return;if(official.getVisibility()==View.VISIBLE&&current.equals("pass"))return;if(libLogin!=null){handler.postDelayed(this::preloadPass,3000);return;}if(passWeb==null||passAt==0)loadPass();else if(System.currentTimeMillis()-passAt>10*60000L)refreshPass();}
 WebView ensureTeaching(){if(teaching!=null)return teaching;teaching=new WebView(this);configure(teaching);CookieManager.getInstance().setAcceptThirdPartyCookies(teaching,true);WebSettings ts=teaching.getSettings();ts.setUserAgentString(DESKTOP_UA);ts.setUseWideViewPort(true);ts.setLoadWithOverviewMode(true);ts.setSupportZoom(true);ts.setBuiltInZoomControls(true);ts.setDisplayZoomControls(false);teaching.setWebViewClient(officialClient("teaching"));parkTeaching();return teaching;}
 void parkTeaching(){if(teaching==null)return;android.view.ViewParent p=teaching.getParent();if(p!=root){if(p!=null)((android.view.ViewGroup)p).removeView(teaching);root.addView(teaching,new LinearLayout.LayoutParams(1,1));}teaching.setVisibility(View.INVISIBLE);}
 WebViewClient officialClient(final String system){return new WebViewClient(){
  @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){return recoverRenderer(view);}
  // sawSso 只用于判断图书馆登录是否真的经过统一认证；后台教务连接经过统一认证时不算。
  @Override public boolean shouldOverrideUrlLoading(WebView w,WebResourceRequest r){if(system.equals("library")&&"sso.qlu.edu.cn".equals(r.getUrl().getHost()))sawSso=true;return !"https".equals(r.getUrl().getScheme());}
  @Override public void onPageStarted(WebView w,String url,android.graphics.Bitmap icon){if(destroyed||!ownsOfficialView(w,system))return;closeReplyChannel(w);if(system.equals("teaching"))teachingNavFailed=false;else if(system.equals("library")&&"sso.qlu.edu.cn".equals(Uri.parse(url).getHost()))sawSso=true;}
  @Override public void onReceivedError(WebView w,WebResourceRequest r,WebResourceError e){if(destroyed||!ownsOfficialView(w,system))return;if(system.equals("libbg")&&r.isForMainFrame()){finishBackgroundFailure(w,activeRestoreAttempt,false);return;}if(system.equals("teaching")&&r.isForMainFrame()){teachingNavFailed=true;if(!connectIds.isEmpty()){final int seq=connectSeq;handler.postDelayed(()->{if(!destroyed&&w==teaching&&seq==connectSeq&&teachingNavFailed&&!connectIds.isEmpty())finishConnect(false,false);},2000);}}}
  @Override public void onPageFinished(WebView w,String url){if(destroyed||!ownsOfficialView(w,system))return;Uri u=Uri.parse(url);String path=u.getPath()==null?"":u.getPath();if(system.equals("library")&&"sso.qlu.edu.cn".equals(u.getHost()))sawSso=true;if((system.equals("library")||system.equals("libbg"))&&"libyuyue.qlu.edu.cn".equals(u.getHost()))readSession(w);if(system.equals("pass")&&!"sso.qlu.edu.cn".equals(u.getHost())){passTrimmed=hideBorrow();if(passTrimmed)w.evaluateJavascript(PASS_TRIM,null);}
   if(system.equals("teaching")&&"jw.qlu.edu.cn".equals(u.getHost())){
    // 未登录访问 /jwglxt/ 会落到验证码登录页：改走统一认证入口，每次尝试最多 2 次，防止统一认证异常时循环；不重置已填写标记，错误密码不会被反复提交。
    if(path.startsWith("/jwglxt/xtgl/login_slogin.html")&&sloginRedirects<2){sloginRedirects++;teachAuto=!vault.optString("password").isEmpty();w.loadUrl(TEACH);return;}
    if(path.contains("/cdjy/"))sloginRedirects=0;if(examPending&&path.contains("/kwgl/"))examPending=false;else if(examPending&&path.startsWith("/jwglxt/")&&!path.contains("login")){examPending=false;w.loadUrl(EXAM_PAGE);return;}
    if(closeOnTeaching&&path.contains("/cdjy/")){closeOnTeaching=false;handler.postDelayed(()->{if(!destroyed&&w==teaching&&officialView==w&&official.getVisibility()==View.VISIBLE&&current.equals("teaching"))closeOfficial();},2000);}
    try{wireAgent(w,"teaching");// 页面没打开成功（断网时也会走到这里）不算连上。
    if(path.contains("/cdjy/cdjy_cxKxcdlb.html")&&!teachingNavFailed){lastCdjy=url;final int seq=connectSeq;final boolean pending=!connectIds.isEmpty();handler.postDelayed(()->{if(destroyed||w!=teaching||!onCdjy())return;if(pending){if(seq==connectSeq)finishConnect(true,true);}else if(!(official.getVisibility()==View.VISIBLE&&officialView==teaching))sessionTeaching(true);},1500);}if(!studentRequested&&url.contains("jsdm=xs"))studentRequested=true;if(!studentRequested&&path.contains("/jwglxt/")&&!path.contains("/cdjy/"))w.evaluateJavascript("!!document.querySelector('input[type=password]')",v->{if(!destroyed&&w==teaching&&v.equals("false")){studentRequested=true;w.loadUrl(STUDENT);}});}catch(Exception e){}
   }
   if(system.equals("teaching")&&!connectIds.isEmpty()&&"sso.qlu.edu.cn".equals(u.getHost())&&path.startsWith("/login")&&(!teachAuto||teachUsed||vault.optString("password").isEmpty())){final int seq=connectSeq;handler.postDelayed(()->{String now=teaching==null?null:teaching.getUrl();if(!destroyed&&w==teaching&&seq==connectSeq&&now!=null&&"sso.qlu.edu.cn".equals(Uri.parse(now).getHost()))finishConnect(false,false);},2500);}
   tryFill(w,u,system);}
 };}
 boolean onCdjy(){String url=teaching==null?null:teaching.getUrl();if(url==null)return false;Uri u=Uri.parse(url);return "jw.qlu.edu.cn".equals(u.getHost())&&u.getPath()!=null&&u.getPath().contains("/cdjy/cdjy_cxKxcdlb.html");}
 // 后台静默连接教务：隐藏的教务页走统一认证入口，最终停在“空闲教室查询”；不弹出官方页面。同一时间只跑一次，期间再来的请求共享结果；每个请求只答复一次（成功、超时或界面销毁）。
 void connectTeaching(String id,boolean fresh){
  if(destroyed||stateLoadFailed||authStateQuarantined||sessionSwitching){rejectAuthentication(id,"STORAGE","账号数据正在恢复，未连接学校",true,false);return;}
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
 void startConnect(int seq,int waited){if(seq!=connectSeq||connectIds.isEmpty()||teaching==null)return;if(libLogin!=null&&waited<12000){handler.postDelayed(()->startConnect(seq,waited+1500),1500);return;}connectProbe="";if(official.getVisibility()==View.VISIBLE&&officialView==teaching)return;examPending=false;sloginRedirects=0;studentRequested=false;teachAuto=!vault.optString("password").isEmpty();teachUsed=false;teaching.loadUrl(TEACH);}
 // 要本人处理的页面：统一认证（验证码、短信、密码错误）或正方验证码登录页。教务入口 /sso/ddlogin 本身不算。
 boolean needsUser(Uri u){String host=u.getHost()==null?"":u.getHost(),path=u.getPath()==null?"":u.getPath();return "sso.qlu.edu.cn".equals(host)||"jw.qlu.edu.cn".equals(host)&&path.startsWith("/jwglxt/xtgl/login_slogin.html");}
 void sessionTeaching(boolean connected){JSONObject e=new JSONObject();try{e.put("event","sessionChanged");e.put("system","teaching");e.put("connected",connected);e.put("probe",true);send(e);}catch(Exception x){}}
 void finishConnect(boolean ok,boolean event){
  if(connectIds.isEmpty())return;handler.removeCallbacks(connectTimeout);if(!connectProbe.isEmpty()){requests.remove(connectProbe);connectProbe="";}
  JSONObject r=new JSONObject();try{r.put("connected",ok);if(!ok){String url=teaching==null?null:teaching.getUrl();Uri u=Uri.parse(url==null?"":url);String host=u.getHost()==null?"":u.getHost(),path=u.getPath()==null?"":u.getPath();r.put("needsUser",!teachingNavFailed&&needsUser(u));r.put("offline",teachingNavFailed);r.put("page",host+path);}}catch(Exception e){}
  List<String> ids=new ArrayList<>(connectIds);connectIds.clear();for(String id:ids)reply(id,r);
  if(ok){CookieManager.getInstance().flush();backupCookies();}if(ok&&event)sessionTeaching(true);
 }

 String resetRequestId="";boolean resetInProgress=false;
 void resetAll(){
  if(resetInProgress){rejectAuthentication(resetRequestId,"BUSY","正在清理本机数据",true,false);return;}
  resetInProgress=true;sessionSwitching=true;
  try{retireSchoolSession();stateStorage.closeAfter(()->handler.post(this::resetAllNow));}
  catch(Exception failure){resetFailed();}
 }
 void resetFailed(){resetInProgress=false;sessionSwitching=false;authStateQuarantined=true;libraryRecovery.storageFailure();publishAuthentication();rejectAuthentication(resetRequestId,"STORAGE","本机数据清理未完成，请关闭后重试",true,false);}

 void resetAllNow(){
  try{
   ReminderReceiver.schedule(this,new org.json.JSONArray());notifications().cancelAll();
   for(String file:new String[]{"vault.bin","state.json","vault.bin.tmp","state.json.tmp"})deleteExplicitResetFile(file);
   if(!getSharedPreferences("reminders",MODE_PRIVATE).edit().clear().commit()||!getSharedPreferences("host",MODE_PRIVATE).edit().clear().commit())throw new IOException("清理偏好未完成");
   final Runnable timeout=()->{if(resetInProgress)resetFailed();};handler.postDelayed(timeout,10000);
   CookieManager.getInstance().removeAllCookies(removed->{
    if(destroyed||!resetInProgress)return;handler.removeCallbacks(timeout);
    try{
     CookieManager.getInstance().flush();WebStorage.getInstance().deleteAllData();clearResourceCache();
     vault=new JSONObject();state=new JSONObject();resetInProgress=false;reply(resetRequestId,true);
     Intent i=getPackageManager().getLaunchIntentForPackage(getPackageName());
     if(i!=null){i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK);handler.postDelayed(()->{startActivity(i);finishAndRemoveTask();},300);}else finishAndRemoveTask();
    }catch(Exception failure){resetFailed();}
   });
  }catch(Exception failure){resetFailed();}
 }

 // “支持作者”：把收款码存进相册（Android 10 起用 MediaStore，不需要存储权限）；更早的系统请用户截图。
 JSONObject saveDonate(){JSONObject r=new JSONObject();Uri u=null;try{r.put("saved",false);if(Build.VERSION.SDK_INT<29)return r;android.content.ContentValues v=new android.content.ContentValues();v.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME,"工大学伴-支持作者.png");v.put(android.provider.MediaStore.MediaColumns.MIME_TYPE,"image/png");v.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH,"Pictures/工大学伴");u=getContentResolver().insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI,v);if(u==null)return r;try(InputStream in=getAssets().open("donate.png");java.io.OutputStream out=getContentResolver().openOutputStream(u)){byte[] b=new byte[8192];int n;while((n=in.read(b))>0)out.write(b,0,n);}r.put("saved",true);}catch(Exception e){if(u!=null)try{getContentResolver().delete(u,null,null);}catch(Exception x){}}return r;}

 void closeOfficial(){final WebView previousView=officialView;try{if(officialView!=null&&current.equals("library")){readSession(officialView);final WebView closed=officialView;handler.postDelayed(()->{if(officialView==closed&&official.getVisibility()!=View.VISIBLE){official.removeView(closed);closed.destroy();officialView=null;}},2500);}official.setVisibility(View.GONE);main.setVisibility(View.VISIBLE);restoreBrightness();CookieManager.getInstance().flush();if(current.equals("pass")&&officialView!=null){if(officialView==passWeb)parkPass();else{official.removeView(officialView);officialView.destroy();}officialView=null;current="library";}if(current.equals("teaching")&&teaching!=null){examPending=false;parkTeaching();JSONObject e=new JSONObject();try{e.put("event","sessionChanged");e.put("system","teaching");String url=teaching.getUrl();boolean onJw=url!=null&&"jw.qlu.edu.cn".equals(Uri.parse(url).getHost())&&!needsUser(Uri.parse(url))&&!String.valueOf(Uri.parse(url).getPath()).startsWith("/sso/")&&!teachingNavFailed;if(onJw&&!url.contains("/cdjy/"))teaching.loadUrl(lastCdjy!=null?lastCdjy:CDJY);e.put("connected",onJw);e.put("probe",true);send(e);}catch(Exception x){}}}finally{afterVisibleLibraryClosed(previousView);}}



 // 学校前端拿到统一认证票据后异步写入会话，页面加载完不一定就有；每秒读一次，最多 45 次。
 void pollSession(int seq,int n){if(seq!=bgSeq||libLogin==null||n>45)return;String u=libLogin.getUrl();if(u!=null&&"libyuyue.qlu.edu.cn".equals(Uri.parse(u).getHost()))readSession(libLogin);handler.postDelayed(()->pollSession(seq,n+1),1000);}


 void closeReplyChannel(WebView web){TrustedReplyChannel channel=replyChannels.remove(web);if(channel!=null)channel.close();}

 void tryFill(WebView w,Uri u,String system){
  if(!ownsOfficialView(w,system)||destroyed||sessionSwitching||!stateLoaded||stateLoadFailed)return;
  boolean teach=system.equals("teaching"),pass=system.equals("pass"),bg=system.equals("libbg");
  String path=u.getPath();boolean trusted=TrustedReplyChannel.isOrigin(u.toString(),"https://sso.qlu.edu.cn")&&("/login".equals(path)||"/login/".equals(path));
  if(bg&&!hasUsableCredentials()&&trusted){final WebView expected=activeRestoreView;final LibraryIdentityRecovery.RestoreAttempt attempt=activeRestoreAttempt;handler.postDelayed(()->finishBackgroundFailure(expected,attempt,true),1500);return;}
  if(!(teach?teachAuto:pass?passAuto:bg?bgAuto:autoLogin)||(teach?teachUsed:pass?passUsed:bg?bgUsed:autoUsed)||!trusted||!hasUsableCredentials())return;
  if(teach)teachUsed=true;else if(pass)passUsed=true;else if(bg)bgUsed=true;else autoUsed=true;
  try{w.evaluateJavascript(asset("sso-form.js")+";CampusSsoForm.fill("+JSONObject.quote(vault.optString("username"))+","+JSONObject.quote(vault.optString("password"))+")",null);}catch(Exception ignored){}
 }
 boolean ownsOfficialView(WebView w,String system){return w!=null&&("libbg".equals(system)?w==activeRestoreView&&w==libLogin:"teaching".equals(system)?w==teaching:"pass".equals(system)?w==passWeb:w==officialView);}




 String asset(String name)throws Exception {try(InputStream in=getAssets().open(name);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))>0)out.write(b,0,n);return new String(out.toByteArray(),StandardCharsets.UTF_8);}}
 JSONObject readJson(String name){try{return json(new String(read(name),StandardCharsets.UTF_8));}catch(Exception e){return new JSONObject();}}
 byte[] read(String name)throws Exception {try(InputStream in=new FileInputStream(new File(getFilesDir(),name));ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))>0)out.write(b,0,n);return out.toByteArray();}}
 void write(String name,byte[] b)throws Exception{File p=new File(getFilesDir(),name),tmp=new File(getFilesDir(),name+".tmp");try(FileOutputStream f=new FileOutputStream(tmp)){f.write(b);f.getFD().sync();}if(!tmp.renameTo(p))throw new IOException("无法保存本机数据");}




 // 学校网站的登录记录（统一认证票据、教务和图书馆会话）存在 WebView 的 Cookies 文件里，手机“清理垃圾”常把它当网页缓存删掉，
 // 之后后台没法悄悄重新登录。退到后台时把这几个站点的登录记录加密存进 vault（和账号放一起，撤回同意时一并删除），启动时缺哪个补哪个。
 static final String[] COOKIE_SITES={"https://sso.qlu.edu.cn/","https://jw.qlu.edu.cn/jwglxt/","https://jw.qlu.edu.cn/sso/","https://libyuyue.qlu.edu.cn/","https://mfindqlu.libsp.cn/"};




 void restoreCookies(){try{JSONObject c=vault.optJSONObject("cookies");if(c==null)return;CookieManager m=CookieManager.getInstance();boolean any=false;for(java.util.Iterator<String> it=c.keys();it.hasNext();){String u=it.next(),have=m.getCookie(u),seen=";"+(have==null?"":have.replace(" ",""))+";";String path=Uri.parse(u).getPath();for(String pair:c.optString(u).split(";\\s*")){int eq=pair.indexOf('=');if(eq<=0||seen.contains(";"+pair.substring(0,eq)+"="))continue;m.setCookie(u,pair+"; Path="+(path==null||path.isEmpty()?"/":path)+"; Secure");any=true;}}if(any)m.flush();}catch(Exception e){}}


 void restoreBrightness(){if(!brightened)return;brightened=false;WindowManager.LayoutParams a=getWindow().getAttributes();a.screenBrightness=oldBrightness;getWindow().setAttributes(a);getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);}
 @Override protected void onResume(){super.onResume();foreground=true;authOnResume();try{send(new JSONObject().put("event","foreground").put("on",true));}catch(Exception ignored){}if(official!=null&&official.getVisibility()==View.VISIBLE&&current.equals("pass")&&!brightened){oldBrightness=getWindow().getAttributes().screenBrightness;WindowManager.LayoutParams a=getWindow().getAttributes();a.screenBrightness=1f;getWindow().setAttributes(a);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);brightened=true;}handler.removeCallbacks(tick);handler.postDelayed(tick,1000);if(mainReady){JSONObject e=new JSONObject();try{e.put("event","resume");send(e);}catch(Exception x){}handler.postDelayed(this::preloadPass,800);}}
 @Override protected void onPause(){foreground=false;authOnPause();try{send(new JSONObject().put("event","foreground").put("on",false));}catch(Exception ignored){}handler.removeCallbacks(tick);if(!rendererRecovering&&official!=null&&official.getVisibility()==View.VISIBLE&&current.equals("pass"))closeOfficial();else restoreBrightness();CookieManager.getInstance().flush();backupCookies();super.onPause();}
 @Override public void onBackPressed(){if(rendererRecovering||main==null)return;if(official.getVisibility()==View.VISIBLE){closeOfficial();return;}final WebView source=main;final long epoch=sessionEpoch;source.evaluateJavascript("window.Campus&&window.Campus.back?window.Campus.back():false",v->{if(destroyed||source!=main||epoch!=sessionEpoch)return;if(!"true".equals(v))exitApp();});}

 boolean recoverRenderer(WebView view){
  closeReplyChannel(view);restoreBrightness();
  if(!rendererRecovering){
   rendererRecovering=true;sessionEpoch++;identityVerified=false;apiReady=false;foreground=false;
   libraryRecovery.reset(sessionEpoch,!vault.optString("token").isEmpty(),hasUsableCredentials());
   identityProbes.clear();credentialSaveSerial++;identityCommitSerial++;visibleLoginSerial++;authReloadSerial++;bgSeq++;
   activeRestoreAttempt=null;activeRestoreView=null;visibleLoginOwner=null;visibleLoginView=null;acceptedLoginTokens.clear();
   for(TrustedReplyChannel channel:replyChannels.values())channel.close();replyChannels.clear();
   for(Map.Entry<String,JSONObject> entry:new ArrayList<>(requests.entrySet())){boolean sentWrite=isSchoolWrite(entry.getValue().optString("method"));rejectAuthentication(entry.getKey(),sentWrite?"UNCERTAIN":"STALE","网页进程已恢复，已发出操作仅核验、不重发",false,sentWrite);}requests.clear();
   destroyed=true;handler.removeCallbacksAndMessages(null);handler.postDelayed(()->{if(!isFinishing())recreate();},100);
  }
  try{if(view.getParent()!=null)((android.view.ViewGroup)view.getParent()).removeView(view);view.destroy();}catch(Exception ignored){}
  if(view==main)main=null;if(view==api)api=null;if(view==teaching)teaching=null;if(view==passWeb)passWeb=null;if(view==libLogin)libLogin=null;if(view==officialView)officialView=null;
  return true;
 }

 void exitApp(){super.onBackPressed();}
 @Override public void onConfigurationChanged(Configuration c){super.onConfigurationChanged(c);JSONObject e=new JSONObject();try{e.put("event","systemTheme");e.put("dark",systemDark(c));send(e);}catch(Exception x){}}
 void releaseHiddenPages(){
  if(destroyed||rendererRecovering)return;memoryConstrained=true;
  if(passWeb!=null&&!(official.getVisibility()==View.VISIBLE&&officialView==passWeb)){
   WebView old=passWeb;passWeb=null;passAt=0;closeReplyChannel(old);if(officialView==old)officialView=null;
   if(old.getParent()!=null)((android.view.ViewGroup)old.getParent()).removeView(old);old.destroy();
  }
  boolean readingTeaching=!connectIds.isEmpty();for(JSONObject request:requests.values())if("teaching".equals(request.optString("system")))readingTeaching=true;
  if(teaching!=null&&!readingTeaching&&!(official.getVisibility()==View.VISIBLE&&officialView==teaching)){
   WebView old=teaching;teaching=null;closeReplyChannel(old);if(officialView==old)officialView=null;
   if(old.getParent()!=null)((android.view.ViewGroup)old.getParent()).removeView(old);old.destroy();
   try{send(new JSONObject().put("event","resourcesReleased"));}catch(Exception ignored){}
  }
 }
 @Override public void onTrimMemory(int level){super.onTrimMemory(level);if(level>=TRIM_MEMORY_RUNNING_LOW)releaseHiddenPages();}
 @Override public void onLowMemory(){super.onLowMemory();releaseHiddenPages();}
 @Override protected void onDestroy(){destroyed=true;identityProbes.clear();credentialSaveSerial++;identityCommitSerial++;visibleLoginSerial++;authReloadSerial++;activeRestoreAttempt=null;activeRestoreView=null;visibleLoginOwner=null;visibleLoginView=null;acceptedLoginTokens.clear();if(calendarController!=null)calendarController.close();for(TrustedReplyChannel channel:replyChannels.values())channel.close();replyChannels.clear();if(stateStorage!=null)stateStorage.close();finishConnect(false,false);handler.removeCallbacksAndMessages(null);Set<WebView> owned=Collections.newSetFromMap(new IdentityHashMap<WebView,Boolean>());for(WebView w:new WebView[]{main,api,teaching,passWeb,libLogin,officialView})if(w!=null&&owned.add(w)){if(w.getParent()!=null)((android.view.ViewGroup)w.getParent()).removeView(w);w.destroy();}super.onDestroy();}

/* campus-reissue-20261104. MEMBER AND METHOD FRAGMENTS, NOT A COMPLETE MainActivity.
 * Package: cn.qlucampus.personal. Replace same-named existing methods/classes.
 * Required call-site changes are enumerated in MAIN_ACTIVITY_INTEGRATION.md.
 * Do not paste the decompiler evidence into a build. */

private final VaultWriteGuard vaultWrites = new VaultWriteGuard();
private final LibraryIdentityRecovery libraryRecovery = new LibraryIdentityRecovery(1);
private final java.util.Map<String, LibraryIdentityRecovery.Probe> identityProbes = new java.util.HashMap<>();
private final java.util.Map<android.webkit.WebView, String> acceptedLoginTokens = new java.util.IdentityHashMap<>();
private LibraryIdentityRecovery.RestoreAttempt activeRestoreAttempt;
private android.webkit.WebView activeRestoreView;
private LibraryIdentityRecovery.Owner visibleLoginOwner;
private android.webkit.WebView visibleLoginView;
private long visibleLoginSerial;
private long credentialSaveSerial;
private long authReloadSerial;
private long identityCommitSerial;
private boolean authStateQuarantined;

private boolean hasUsableCredentials() {
    return vault.opt("username") instanceof String && vault.opt("password") instanceof String
            && !vault.optString("username").trim().isEmpty() && !vault.optString("password").isEmpty();
}

private javax.crypto.SecretKey existingVaultKey() throws Exception {
    java.security.KeyStore store = java.security.KeyStore.getInstance("AndroidKeyStore");
    store.load(null);
    if (!store.containsAlias("QluCampusVault"))
        throw new java.security.GeneralSecurityException("Existing vault key is unavailable");
    java.security.Key key = store.getKey("QluCampusVault", null);
    if (!(key instanceof javax.crypto.SecretKey))
        throw new java.security.GeneralSecurityException("Existing vault key is invalid");
    return (javax.crypto.SecretKey) key;
}

private javax.crypto.SecretKey vaultKeyForWrite(boolean explicitReplacement) throws Exception {
    java.security.KeyStore store = java.security.KeyStore.getInstance("AndroidKeyStore");
    store.load(null);
    if (store.containsAlias("QluCampusVault")) return existingVaultKey();
    if (vaultWrites.state() == VaultWriteGuard.State.READY
            || vaultWrites.state() == VaultWriteGuard.State.UNREADABLE && !explicitReplacement)
        throw new java.security.GeneralSecurityException("Refusing to replace a missing vault key implicitly");
    javax.crypto.KeyGenerator generator = javax.crypto.KeyGenerator.getInstance("AES", "AndroidKeyStore");
    generator.init(new android.security.keystore.KeyGenParameterSpec.Builder("QluCampusVault",
            android.security.keystore.KeyProperties.PURPOSE_ENCRYPT | android.security.keystore.KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE).build());
    return generator.generateKey();
}

private void validateVaultObject(org.json.JSONObject object) throws Exception {
    for (String key : new String[]{"username", "password", "token", "subjectId"}) {
        if (object.has(key) && !(object.opt(key) instanceof String))
            throw new java.io.IOException("Invalid vault field type");
        if (object.optString(key).length() > ("token".equals(key) ? 8192 : 16384))
            throw new java.io.IOException("Invalid vault field length");
    }
    if (object.has("remember") && !(object.opt("remember") instanceof Boolean))
        throw new java.io.IOException("Invalid remember flag");
    if (object.has("cookies")) {
        org.json.JSONObject cookies = object.optJSONObject("cookies");
        if (cookies == null) throw new java.io.IOException("Invalid cookie backup");
        java.util.Iterator<String> names = cookies.keys();
        while (names.hasNext()) {
            String name = names.next();
            if (!java.util.Arrays.asList(COOKIE_SITES).contains(name) || !(cookies.opt(name) instanceof String))
                throw new java.io.IOException("Invalid cookie backup entry");
        }
    }
}

org.json.JSONObject readVault() {
    vaultWrites.loaded(VaultWriteGuard.State.UNREADABLE);
    java.io.File file = new java.io.File(getFilesDir(), "vault.bin");
    try {
        android.system.Os.stat(file.getAbsolutePath());
    } catch (android.system.ErrnoException e) {
        if (e.errno == android.system.OsConstants.ENOENT) vaultWrites.loaded(VaultWriteGuard.State.ABSENT);
        return new org.json.JSONObject();
    } catch (Exception e) {
        return new org.json.JSONObject();
    }
    try {
        String plain = VaultCodec.decrypt(read("vault.bin"), existingVaultKey());
        org.json.JSONTokener parser = new org.json.JSONTokener(plain);
        Object decoded = parser.nextValue();
        if (!(decoded instanceof org.json.JSONObject) || parser.nextClean() != 0)
            throw new java.io.IOException("Invalid vault JSON");
        org.json.JSONObject result = (org.json.JSONObject) decoded;
        validateVaultObject(result);
        vaultWrites.loaded(VaultWriteGuard.State.READY);
        return result;
    } catch (Exception e) {
        // Preserve the encrypted original and key. Do not log sensitive values.
        return new org.json.JSONObject();
    }
}

private void commitVault(org.json.JSONObject proposed, boolean explicitReplacement, long expectedEpoch) throws Exception {
    if (destroyed || expectedEpoch != sessionEpoch) throw new IllegalStateException("Stale vault owner");
    validateVaultObject(proposed);
    boolean complete = !proposed.optString("username").trim().isEmpty() && !proposed.optString("password").isEmpty();
    if (!vaultWrites.mayWrite(explicitReplacement, complete))
        throw new java.io.IOException("Unreadable vault is preserved; explicit complete credentials are required");
    org.json.JSONObject inMemory = new org.json.JSONObject(proposed.toString());
    org.json.JSONObject persisted = new org.json.JSONObject(inMemory.toString());
    if (!persisted.optBoolean("remember")) {
        persisted.remove("username");
        persisted.remove("password");
    }
    byte[] encrypted = VaultCodec.encrypt(persisted.toString(), vaultKeyForWrite(explicitReplacement && complete));
    write("vault.bin", encrypted); // Existing write: file fsync, then checked same-directory rename.
    vault = inMemory;             // Publish only after the actual write returns successfully.
    vaultWrites.committed();
    libraryRecovery.credentials(hasUsableCredentials());
}

void saveVault() throws Exception {
    commitVault(new org.json.JSONObject(vault.toString()), false, sessionEpoch);
}

private void initializeNativeAuthentication() {
    libraryRecovery.reset(sessionEpoch, !vault.optString("token").isEmpty(), hasUsableCredentials());
    identityVerified = false;
    if (vaultWrites.state() == VaultWriteGuard.State.UNREADABLE || stateLoadFailed) libraryRecovery.storageFailure();
}

private boolean authEligible() {
    return !destroyed && runtimeSupported && foreground && stateLoaded && !stateLoadFailed
            && !sessionSwitching && consented() && vaultWrites.loadCompleted()
            && vaultWrites.state() != VaultWriteGuard.State.UNREADABLE;
}

private org.json.JSONObject addAuthenticationMetadata(org.json.JSONObject target) throws org.json.JSONException {
    LibraryIdentityRecovery.Snapshot a = libraryRecovery.snapshot();
    if (a.epoch != sessionEpoch) throw new IllegalStateException("Authentication scope was not reset");
    boolean blocked = authStateQuarantined || stateLoadFailed;
    target.put("localStateBlocked", blocked);
    if (blocked && target.has("state")) {
        target.put("state", new org.json.JSONObject()).put("subjectId", "").put("legacyAvailable", false);
    }
    target.put("sessionEpoch", sessionEpoch);
    target.put("vaultState", vaultWrites.wireState());
    target.put("hasCredentials", hasUsableCredentials());
    target.put("restartPersistence", vaultWrites.persistence(hasUsableCredentials(), vault.optBoolean("remember")));
    target.put("libraryAuth", new org.json.JSONObject().put("epoch", a.epoch).put("generation", a.generation)
            .put("revision", a.revision).put("phase", a.phase).put("code", a.code).put("retryAt", a.retryAt));
    return target;
}

private void publishAuthentication() {
    identityVerified = libraryRecovery.verified();
    try {
        send(addAuthenticationMetadata(new org.json.JSONObject().put("event", "libraryAuth")
                .put("system", "library").put("connected", identityVerified)));
    } catch (Exception ignored) { }
}

void sessionEvent(boolean ignoredConnectedArgument) {
    identityVerified = libraryRecovery.verified();
    if (identityVerified) { android.webkit.CookieManager.getInstance().flush(); backupCookies(); }
    try {
        send(addAuthenticationMetadata(new org.json.JSONObject().put("event", "sessionChanged")
                .put("system", "library").put("connected", identityVerified)));
    } catch (Exception ignored) { }
}

void libraryLoginEvent(String status, boolean needsUser) {
    try {
        send(addAuthenticationMetadata(new org.json.JSONObject().put("event", "libraryLogin")
                .put("status", status).put("needsUser", needsUser)));
    } catch (Exception ignored) { }
}

private void rejectAuthentication(String id, String code, String message, boolean notSent, boolean uncertain) {
    if (id == null || id.isEmpty()) return;
    try {
        org.json.JSONObject error = new org.json.JSONObject().put("code", code).put("message", message);
        if (uncertain) error.put("uncertain", true);
        else if (notSent) error.put("notSent", true);
        send(addAuthenticationMetadata(new org.json.JSONObject().put("id", id).put("ok", false).put("error", error)));
    } catch (Exception ignored) { }
}

private void scheduleAuthReload(long ownerEpoch) {
    final long revision = ++authReloadSerial;
    mainReady = false;
    handler.postDelayed(() -> {
        if (!destroyed && sessionEpoch == ownerEpoch && revision == authReloadSerial && main != null) main.reload();
    }, 150);
}

private void failedAuthSwitch(long ownerEpoch, String requestId) {
    if (destroyed || ownerEpoch != sessionEpoch) return;
    sessionSwitching = false;
    authStateQuarantined = true;
    state = new org.json.JSONObject();
    openLoginAfterReady = false;
    libraryRecovery.storageFailure();
    publishAuthentication();
    rejectAuthentication(requestId, "STORAGE", "本机保存未完成，已保留可恢复的数据，请重试", true, false);
    scheduleAuthReload(ownerEpoch);
}

void backupCookies() {
    if (destroyed || sessionSwitching || authStateQuarantined || stateLoadFailed || vaultWrites.state() == VaultWriteGuard.State.UNREADABLE) return;
    try {
        org.json.JSONObject cookies = new org.json.JSONObject();
        for (String site : COOKIE_SITES) {
            String value = android.webkit.CookieManager.getInstance().getCookie(site);
            if (value != null && !value.isEmpty()) cookies.put(site, value);
        }
        if (cookies.length() == 0 || cookies.toString().equals(String.valueOf(vault.optJSONObject("cookies")))) return;
        org.json.JSONObject next = new org.json.JSONObject(vault.toString());
        next.put("cookies", cookies);
        commitVault(next, false, sessionEpoch);
    } catch (Exception e) {
        // Background backup failures never erase credentials or announce successful persistence.
    }
}

void saveSubjectState(String requestId, org.json.JSONObject data) {
    if (authStateQuarantined || stateLoadFailed) {
        rejectAuthentication(requestId, "STORAGE", "账号所属数据正在隔离恢复，未覆盖旧数据", true, false); return;
    }
    if (sessionSwitching || !stateLoaded || data.optLong("_sessionEpoch", -1) != sessionEpoch) {
        rejectAuthentication(requestId, "STALE", "账号会话已变化，旧页面未写入", true, false); return;
    }
    try {
        subjectState.replace(data);
        state = subjectState.active();
        persistSubjects(requestId, false);
    } catch (Exception e) {
        rejectAuthentication(requestId, "STORAGE", "本机数据保存未完成", true, false);
    }
}

void forgetCredentials(String requestId, org.json.JSONObject data) {
    if (sessionSwitching || !stateLoaded || data.optLong("sessionEpoch", -1) != sessionEpoch) {
        rejectAuthentication(requestId, "STALE", "账号会话已变化，未删除凭据", true, false);
        return;
    }
    try {
        org.json.JSONObject next = new org.json.JSONObject(vault.toString());
        next.remove("username"); next.remove("password"); next.put("remember", false);
        commitVault(next, false, sessionEpoch);
        reply(requestId, addAuthenticationMetadata(new org.json.JSONObject().put("saved", true)));
    } catch (Exception e) {
        rejectAuthentication(requestId, "STORAGE", "没有完成删除，原凭据文件仍受保护", true, false);
    }
}

void saveCredentials(String requestId, org.json.JSONObject data) {
    String username = data.opt("username") instanceof String ? data.optString("username").trim() : "";
    String password = data.opt("password") instanceof String ? data.optString("password") : "";
    if (username.isEmpty() || password.isEmpty() || username.length() > 16384 || password.length() > 16384) {
        rejectAuthentication(requestId, "INVALID", "请填写完整学号和密码", true, false); return;
    }
    if (!stateLoaded || stateLoadFailed) {
        rejectAuthentication(requestId, "STORAGE", "本机账号数据尚未就绪，请先重试读取", true, false); return;
    }
    if (sessionSwitching || data.optLong("sessionEpoch", -1) != sessionEpoch) {
        rejectAuthentication(requestId, "STALE", "账号会话已变化，未保存旧表单", true, false); return;
    }
    sessionSwitching = true;
    try { retireSchoolSession(); }
    catch (Exception e) { failedAuthSwitch(sessionEpoch, requestId); return; }
    final long epoch = sessionEpoch;
    final long operation = ++credentialSaveSerial;
    try {
        org.json.JSONObject next = new org.json.JSONObject(vault.toString());
        next.remove("token"); next.remove("cookies"); next.remove("subjectId");
        next.put("username", username).put("password", password).put("remember", data.optBoolean("remember"));
        commitVault(next, true, epoch);
        identityExpected = username;
        final Runnable timeout = () -> {
            if (operation == credentialSaveSerial && sessionSwitching && epoch == sessionEpoch) {
                ++credentialSaveSerial;
                failedAuthSwitch(epoch, requestId);
            }
        };
        handler.postDelayed(timeout, 10_000);
        android.webkit.CookieManager.getInstance().removeAllCookies(ignored -> {
            if (destroyed || epoch != sessionEpoch || operation != credentialSaveSerial || !sessionSwitching) return;
            try {
                android.webkit.CookieManager.getInstance().flush();
                SubjectState nextSubjects = new SubjectState(subjectState.snapshot(), "");
                byte[] bytes = nextSubjects.snapshot().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
                stateStorage.save(bytes, error -> handler.post(() -> {
                    if (destroyed || epoch != sessionEpoch || operation != credentialSaveSerial || !sessionSwitching) return;
                    handler.removeCallbacks(timeout);
                    ++credentialSaveSerial;
                    if (error != null) { failedAuthSwitch(epoch, requestId); return; }
                    subjectState = nextSubjects;
                    state = nextSubjects.active();
                    authStateQuarantined = false;
                    sessionSwitching = false;
                    openLoginAfterReady = true;
                    try {
                        reply(requestId, addAuthenticationMetadata(new org.json.JSONObject().put("reload", true)));
                    } catch (Exception e) { failedAuthSwitch(epoch, requestId); return; }
                    scheduleAuthReload(epoch);
                }));
            } catch (Exception e) {
                handler.removeCallbacks(timeout);
                ++credentialSaveSerial;
                failedAuthSwitch(epoch, requestId);
            }
        });
    } catch (Exception e) {
        ++credentialSaveSerial;
        failedAuthSwitch(epoch, requestId);
    }
}

void retireSchoolSession() {
    authStateQuarantined = true;
    state = new org.json.JSONObject();
    sessionEpoch++;
    identityVerified = false; apiReady = false;
    bgSeq++; connectSeq++; credentialSaveSerial++; visibleLoginSerial++; authReloadSerial++; identityCommitSerial++;
    activeRestoreAttempt = null; activeRestoreView = null;
    visibleLoginOwner = null; visibleLoginView = null; acceptedLoginTokens.clear();
    libraryRecovery.reset(sessionEpoch, false, hasUsableCredentials());
    identityProbes.clear();
    try { send(addAuthenticationMetadata(new org.json.JSONObject().put("event", "identityChanging"))); }
    catch (Exception ignored) { }
    for (Object value : new java.util.ArrayList<>(replyChannels.values())) {
        try { ((TrustedReplyChannel) value).close(); } catch (Exception ignored) { }
    }
    replyChannels.clear();
    for (Object item : new java.util.ArrayList<>(requests.entrySet())) {
        java.util.Map.Entry<?, ?> entry = (java.util.Map.Entry<?, ?>) item;
        org.json.JSONObject request = (org.json.JSONObject) entry.getValue();
        boolean sentWrite = isSchoolWrite(request.optString("method"));
        rejectAuthentication((String) entry.getKey(), LibraryIdentityRecovery.staleResultCode(sentWrite),
                sentWrite ? "会话已变化，已发送操作只核验，不自动重发" : "会话已变化，旧读取已停用", false, sentWrite);
    }
    requests.clear();
    try { finishConnect(false, false); } catch (Exception ignored) { }
    java.util.Set<android.webkit.WebView> seen = java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
    for (android.webkit.WebView view : new android.webkit.WebView[]{teaching, passWeb, libLogin, officialView}) {
        if (view == null || view == api || !seen.add(view)) continue;
        try {
            if (view.getParent() instanceof android.view.ViewGroup) ((android.view.ViewGroup) view.getParent()).removeView(view);
            view.stopLoading(); view.destroy();
        } catch (Exception ignored) { }
    }
    teaching = null; passWeb = null; libLogin = null; officialView = null;
    if (official != null) official.setVisibility(android.view.View.GONE);
    if (main != null) main.setVisibility(android.view.View.VISIBLE);
    restoreBrightness();
    if (api != null) { api.stopLoading(); api.loadUrl("about:blank"); }
    try {
        org.json.JSONObject retired = new org.json.JSONObject(vault.toString());
        retired.remove("token"); retired.remove("cookies");
        vault = retired; // Retire authorization in memory. No implicit write to unreadable storage.
    } catch (Exception ignored) { }
}

private void kickAuthenticationRecovery() {
    if (!authEligible()) return;
    if (!vault.optString("token").isEmpty()) verifyLibraryIdentity();
    else autoRestore();
    retryIdentityLater();
}

void verifyLibraryIdentity() {
    if (!authEligible() || !apiReady || api == null) return;
    LibraryIdentityRecovery.Probe ticket = libraryRecovery.beginProbe(System.currentTimeMillis(), true);
    if (ticket == null) return;
    String id = "native-identity-" + ticket.owner.epoch + "-" + ticket.serial;
    identityProbes.put(id, ticket);
    publishAuthentication();
    request(id, "library", "profile", new org.json.JSONObject());
}

private Runnable authenticationRetry;
private void retryIdentityLater() {
    if (authenticationRetry != null) handler.removeCallbacks(authenticationRetry);
    authenticationRetry = null;
    LibraryIdentityRecovery.Snapshot snapshot = libraryRecovery.snapshot();
    if (!authEligible() || !"retryable".equals(snapshot.phase) || "STORAGE".equals(snapshot.code) || snapshot.retryAt == 0) return;
    final LibraryIdentityRecovery.Owner owner = libraryRecovery.owner();
    final long revision = snapshot.revision;
    authenticationRetry = () -> {
        authenticationRetry = null;
        if (!libraryRecovery.owns(owner) || libraryRecovery.snapshot().revision != revision || !authEligible()) return;
        kickAuthenticationRecovery();
    };
    handler.postDelayed(authenticationRetry, Math.max(0, snapshot.retryAt - System.currentTimeMillis()));
}

private boolean rejectCurrentLibraryToken(LibraryIdentityRecovery.Owner owner) {
    if (!libraryRecovery.owns(owner)) return false;
    try {
        org.json.JSONObject next = new org.json.JSONObject(vault.toString());
        next.remove("token");
        commitVault(next, false, owner.epoch);
        libraryRecovery.rejectedToken(owner);
        apiReady = false; identityVerified = false;
        publishAuthentication();
        autoRestore();
        return true;
    } catch (Exception e) {
        libraryRecovery.storageFailure();
        publishAuthentication();
        return false;
    }
}

void verifiedLibraryReply(org.json.JSONObject response) {
    String id = response.optString("id");
    LibraryIdentityRecovery.Probe ticket = identityProbes.remove(id);
    if (ticket == null || !libraryRecovery.owns(ticket) || destroyed) return;
    org.json.JSONObject error = response.optJSONObject("error");
    String errorCode = error == null ? "NETWORK" : error.optString("code", "NETWORK");
    if (!response.optBoolean("ok")) {
        if ("AUTH".equals(errorCode) || "EXPIRED".equals(errorCode)) rejectCurrentLibraryToken(ticket.owner);
        else {
            libraryRecovery.retryable(ticket, errorCode, System.currentTimeMillis());
            publishAuthentication(); retryIdentityLater();
        }
        return;
    }
    org.json.JSONObject profile = response.optJSONObject("data");
    String subject = profile == null || !(profile.opt("card") instanceof String) ? "" : profile.optString("card").trim();
    if (subject.isEmpty()) {
        libraryRecovery.retryable(ticket, "BAD_RESPONSE", System.currentTimeMillis());
        publishAuthentication(); retryIdentityLater(); return;
    }
    if (!identityExpected.isEmpty() && !identityExpected.equals(subject)) {
        libraryRecovery.mismatch(ticket); publishAuthentication(); return;
    }
    boolean changingSubject = !subject.equals(subjectState.subject());
    String verifiedToken = vault.optString("token");
    sessionSwitching = true;
    try { if (changingSubject) retireSchoolSession(); }
    catch (Exception e) { failedAuthSwitch(sessionEpoch, ""); return; }
    final long epoch = sessionEpoch;
    final long commitSerial = ++identityCommitSerial;
    try {
        org.json.JSONObject next = new org.json.JSONObject(vault.toString());
        next.put("token", verifiedToken).put("subjectId", subject);
        commitVault(next, false, epoch);
        if (changingSubject) libraryRecovery.installedToken(false);
        final LibraryIdentityRecovery.Owner commitOwner = libraryRecovery.owner();
        SubjectState nextSubjects = new SubjectState(subjectState.snapshot(), subject);
        byte[] bytes = nextSubjects.snapshot().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        final Runnable timeout = () -> {
            if (commitSerial != identityCommitSerial || !libraryRecovery.owns(commitOwner) || !sessionSwitching) return;
            ++identityCommitSerial; sessionSwitching = false; libraryRecovery.storageFailure(); publishAuthentication();
            if (changingSubject) scheduleAuthReload(epoch);
        };
        handler.postDelayed(timeout, 10_000);
        stateStorage.save(bytes, failure -> handler.post(() -> {
            if (destroyed || sessionEpoch != epoch || !libraryRecovery.owns(commitOwner) || commitSerial != identityCommitSerial) return;
            handler.removeCallbacks(timeout); ++identityCommitSerial;
            sessionSwitching = false;
            if (failure != null) {
                libraryRecovery.storageFailure(); publishAuthentication();
                if (changingSubject) scheduleAuthReload(epoch);
                return;
            }
            subjectState = nextSubjects; state = nextSubjects.active(); identityExpected = subject;
            authStateQuarantined = false;
            if (changingSubject) {
                // The new epoch rechecks identity after reload; never carry an old epoch's verified bit.
                configureApi();
                scheduleAuthReload(epoch);
            } else if (libraryRecovery.verifiedAfterCommit(ticket)) {
                sessionEvent(true);
            }
        }));
    } catch (Exception e) {
        ++identityCommitSerial; sessionSwitching = false;
        libraryRecovery.storageFailure(); publishAuthentication();
        if (changingSubject) scheduleAuthReload(epoch);
    }
}

void autoRestore() {
    if (!authEligible() || libLogin != null || official != null && official.getVisibility() == android.view.View.VISIBLE && "library".equals(current)) return;
    final LibraryIdentityRecovery.RestoreAttempt attempt = libraryRecovery.beginRestore(System.currentTimeMillis(), true);
    if (attempt == null) return;
    final android.webkit.WebView view = new android.webkit.WebView(this);
    activeRestoreAttempt = attempt; activeRestoreView = view; libLogin = view;
    final int sequence = ++bgSeq;
    try {
        configure(view);
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(view, true);
        view.setWebViewClient(officialClient("libbg"));
        root.addView(view, new android.widget.LinearLayout.LayoutParams(1, 1));
        view.setVisibility(android.view.View.INVISIBLE);
        bgAuto = true; bgUsed = false;
        libraryLoginEvent("started", false);
        view.loadUrl(LIB_CAS);
        pollSession(sequence, 0);
        handler.postDelayed(() -> {
            if (view != activeRestoreView || attempt != activeRestoreAttempt || !libraryRecovery.owns(attempt)) return;
            String url = view.getUrl();
            // A transport timeout away from SSO is not a request for user verification.
            boolean challenge = bgUsed && url != null && needsUser(android.net.Uri.parse(url));
            finishBackgroundFailure(view, attempt, challenge);
        }, 40_000);
    } catch (Exception e) { finishBackgroundFailure(view, attempt, false); }
}

private void disposeBackgroundView(android.webkit.WebView expected, LibraryIdentityRecovery.RestoreAttempt attempt) {
    if (expected == null || expected != activeRestoreView || expected != libLogin || attempt != activeRestoreAttempt) return;
    bgSeq++;
    activeRestoreView = null; activeRestoreAttempt = null; libLogin = null;
    acceptedLoginTokens.remove(expected);
    closeReplyChannel(expected);
    if (expected.getParent() instanceof android.view.ViewGroup) ((android.view.ViewGroup) expected.getParent()).removeView(expected);
    expected.stopLoading(); expected.destroy();
}

private void finishBackgroundFailure(android.webkit.WebView expected, LibraryIdentityRecovery.RestoreAttempt attempt, boolean needsUser) {
    if (expected != activeRestoreView || attempt != activeRestoreAttempt || !libraryRecovery.owns(attempt)) return;
    libraryRecovery.restoreFailed(attempt, needsUser, System.currentTimeMillis());
    disposeBackgroundView(expected, attempt);
    libraryLoginEvent("failed", needsUser); publishAuthentication(); retryIdentityLater();
}

void endBackgroundLogin(boolean success) {
    // Only synchronous user actions may use this convenience entry.
    // Every asynchronous callback MUST call the expected-view/attempt overload above.
    android.webkit.WebView view = activeRestoreView;
    LibraryIdentityRecovery.RestoreAttempt attempt = activeRestoreAttempt;
    if (view == null || attempt == null) return;
    if (success) { disposeBackgroundView(view, attempt); libraryLoginEvent("done", false); }
    else finishBackgroundFailure(view, attempt, true);
}

void openLibraryLogin(boolean automaticFill) {
    if (destroyed || sessionSwitching || !stateLoaded || stateLoadFailed) throw new IllegalStateException("Local state is not ready");
    if (activeRestoreView != null) disposeBackgroundView(activeRestoreView, activeRestoreAttempt);
    visibleLoginSerial++;
    visibleLoginOwner = libraryRecovery.beginVisibleLogin();
    identityVerified = false; apiReady = false;
    if (api != null) closeReplyChannel(api);
    if (!automaticFill) identityExpected = "";
    autoLogin = automaticFill; autoUsed = false;
    try {
        openOfficial("library", true);
        visibleLoginView = officialView;
        acceptedLoginTokens.remove(visibleLoginView);
        publishAuthentication();
    } catch (RuntimeException error) {
        libraryRecovery.endVisibleLogin(visibleLoginOwner);
        visibleLoginView = null;
        if (!vault.optString("token").isEmpty()) configureApi();
        publishAuthentication();
        throw error;
    }
}

private void afterVisibleLibraryClosed(android.webkit.WebView previousView) {
    if (previousView != visibleLoginView) return;
    visibleLoginSerial++;
    acceptedLoginTokens.remove(previousView);
    boolean cancelledBeforeToken = libraryRecovery.owns(visibleLoginOwner);
    libraryRecovery.endVisibleLogin(visibleLoginOwner);
    visibleLoginView = null; visibleLoginOwner = null;
    if (cancelledBeforeToken && !vault.optString("token").isEmpty()) configureApi();
    kickAuthenticationRecovery();
}

void readSession(android.webkit.WebView view) {
    if (view == null || destroyed || sessionSwitching || !TrustedReplyChannel.isOrigin(view.getUrl(), "https://libyuyue.qlu.edu.cn")) return;
    final boolean hidden = view == activeRestoreView && view == libLogin;
    final LibraryIdentityRecovery.RestoreAttempt restore = hidden ? activeRestoreAttempt : null;
    if (!hidden && (view != visibleLoginView || view != officialView)) return;
    final LibraryIdentityRecovery.Owner owner = libraryRecovery.owner();
    final long visibleSerial = visibleLoginSerial;
    view.evaluateJavascript("location.origin==='https://libyuyue.qlu.edu.cn'&&window===top?sessionStorage.getItem('token'):null", raw -> {
        if (destroyed || sessionSwitching || !libraryRecovery.owns(owner)
                || !TrustedReplyChannel.isOrigin(view.getUrl(), "https://libyuyue.qlu.edu.cn")) return;
        if (hidden) {
            if (view != activeRestoreView || restore != activeRestoreAttempt || !libraryRecovery.owns(restore)) return;
        } else if (view != visibleLoginView || view != officialView || visibleSerial != visibleLoginSerial) return;
        final Object decoded;
        try { decoded = new org.json.JSONTokener(raw).nextValue(); } catch (Exception invalid) { return; }
        if (!(decoded instanceof String)) return;
        String token = (String) decoded;
        if (token.length() < 8 || token.length() > 8192 || !token.matches("[A-Za-z0-9._~+/=:-]+")) return;
        if (token.equals(acceptedLoginTokens.get(view))) return;
        try {
            org.json.JSONObject next = new org.json.JSONObject(vault.toString());
            next.put("token", token);
            commitVault(next, false, owner.epoch);
            android.webkit.CookieManager.getInstance().flush();
            backupCookies();
            acceptedLoginTokens.put(view, token);
            libraryRecovery.installedToken(true);
            identityVerified = false;
            if (hidden) { disposeBackgroundView(view, restore); libraryLoginEvent("done", false); }
            configureApi(); publishAuthentication();
            if (!hidden && closeOnSession && sawSso && "library".equals(current)) {
                closeOnSession = false;
                final LibraryIdentityRecovery.Owner acceptedOwner = libraryRecovery.owner();
                handler.postDelayed(() -> {
                    if (!destroyed && libraryRecovery.owns(acceptedOwner) && officialView == view
                            && visibleLoginSerial == visibleSerial && official.getVisibility() == android.view.View.VISIBLE) closeOfficial();
                }, 400);
            }
        } catch (Exception e) {
            libraryRecovery.storageFailure();
            if (hidden) disposeBackgroundView(view, restore);
            publishAuthentication();
        }
    });
}

void configureApi() {
    apiReady = false;
    if (destroyed || vault.optString("token").isEmpty()) return;
    final LibraryIdentityRecovery.Owner owner = libraryRecovery.owner();
    for (Object item : new java.util.ArrayList<>(requests.entrySet())) {
        java.util.Map.Entry<?, ?> entry = (java.util.Map.Entry<?, ?>) item;
        org.json.JSONObject pending = (org.json.JSONObject) entry.getValue();
        if (!"library".equals(pending.optString("system"))) continue;
        String pendingId = (String) entry.getKey();
        requests.remove(pendingId); identityProbes.remove(pendingId);
        boolean sentWrite = isSchoolWrite(pending.optString("method"));
        rejectAuthentication(pendingId, LibraryIdentityRecovery.staleResultCode(sentWrite),
                "连接已更新，旧写操作只核验，不自动重发", false, sentWrite);
    }
    android.webkit.WebView old = api;
    if (old != null) {
        closeReplyChannel(old); old.stopLoading();
        if (old.getParent() instanceof android.view.ViewGroup) ((android.view.ViewGroup) old.getParent()).removeView(old);
        old.destroy();
    }
    final android.webkit.WebView view = new android.webkit.WebView(this);
    api = view;
    try {
        configure(view);
        view.setWebViewClient(new android.webkit.WebViewClient() {
            @Override public void onPageStarted(android.webkit.WebView source, String url, android.graphics.Bitmap icon) {
                if (source == api && libraryRecovery.owns(owner)) { closeReplyChannel(source); apiReady = false; }
            }
            @Override public void onPageFinished(android.webkit.WebView source, String url) {
                if (source == api && libraryRecovery.owns(owner)) wireAgent(source, "library");
            }
            @Override public boolean onRenderProcessGone(android.webkit.WebView source, android.webkit.RenderProcessGoneDetail detail) {
                return recoverRenderer(source);
            }
        });
        root.addView(view, new android.widget.LinearLayout.LayoutParams(1, 1));
        view.setVisibility(android.view.View.INVISIBLE);
        view.loadDataWithBaseURL("https://libyuyue.qlu.edu.cn/", "<!doctype html><meta charset=utf-8><script>sessionStorage.setItem('token',"
                + org.json.JSONObject.quote(vault.optString("token")) + ");" + asset("agent.js") + "</script>", "text/html", "UTF-8", null);
    } catch (Exception e) {
        apiReady = false;
        LibraryIdentityRecovery.Probe ticket = libraryRecovery.beginProbe(System.currentTimeMillis(), authEligible());
        if (ticket != null) libraryRecovery.retryable(ticket, "NETWORK", System.currentTimeMillis());
        publishAuthentication();
    }
}

void wireAgent(android.webkit.WebView view, String system) {
    String origin = "library".equals(system) ? "https://libyuyue.qlu.edu.cn" : "https://jw.qlu.edu.cn";
    closeReplyChannel(view);
    if (view != api && !TrustedReplyChannel.isOrigin(view.getUrl(), origin)) return;
    final long epoch = sessionEpoch;
    final LibraryIdentityRecovery.Owner owner = libraryRecovery.owner();
    TrustedReplyChannel channel = new TrustedReplyChannel(view, origin, epoch, () -> sessionEpoch,
            raw -> {
                if ("library".equals(system) && (!libraryRecovery.owns(owner) || view != api)) return;
                new ApiReply(system, view, epoch, owner).post(raw);
            }, () -> {
                if (destroyed || epoch != sessionEpoch || "library".equals(system) && (!libraryRecovery.owns(owner) || view != api)) return;
                try {
                    view.evaluateJavascript(asset("agent.js"), ignored -> {
                        if (!destroyed && epoch == sessionEpoch && "library".equals(system) && view == api && libraryRecovery.owns(owner)) {
                            apiReady = true; verifyLibraryIdentity();
                        }
                    });
                } catch (Exception ignored) { }
            }, view == api);
    replyChannels.put(view, channel);
}

void request(String id, String system, String method, org.json.JSONObject params) {
    boolean writeRequest = isSchoolWrite(method);
    if (writeRequest && !foreground) { rejectAuthentication(id, "PAUSED", "助手不在前台，未向学校提交", true, false); return; }
    if (sessionSwitching) { rejectAuthentication(id, "BUSY", "账号会话正在切换", true, false); return; }
    boolean library = "library".equals(system);
    if (library && "status".equals(method)) {
        kickAuthenticationRecovery();
        try { reply(id, addAuthenticationMetadata(new org.json.JSONObject().put("connected", libraryRecovery.verified()))); }
        catch (Exception e) { rejectAuthentication(id, "STORAGE", "本机状态不可读", true, false); }
        return;
    }
    LibraryIdentityRecovery.Probe probe = identityProbes.get(id);
    boolean internalProbe = library && "profile".equals(method) && probe != null && libraryRecovery.owns(probe);
    if ((authStateQuarantined || stateLoadFailed) && !internalProbe) {
        rejectAuthentication(id, "STORAGE", "账号所属数据正在隔离恢复，未向学校发送请求", true, false); return;
    }
    if (library && !libraryRecovery.verified() && !internalProbe || "teaching".equals(system) && "exams".equals(method) && !libraryRecovery.verified()) {
        rejectAuthentication(id, "NOT_READY", "学校身份核验尚未完成", true, false); return;
    }
    java.util.Set<String> allowed = new java.util.HashSet<>(java.util.Arrays.asList(library
            ? new String[]{"catalog", "areas", "seats", "records", "reserve", "current", "temporaryLeave", "profile", "violations", "rules", "cancelBooking", "checkout"}
            : new String[]{"status", "options", "rooms", "exams"}));
    if ((!library && !"teaching".equals(system)) || !allowed.contains(method)) {
        rejectAuthentication(id, "INVALID", "未知学校操作", true, false); return;
    }
    android.webkit.WebView view = library ? api : teaching;
    if (view == null || library && (!apiReady || vault.optString("token").isEmpty())) {
        if (internalProbe) {
            identityProbes.remove(id);
            libraryRecovery.retryable(probe, "NETWORK", System.currentTimeMillis());
            publishAuthentication(); retryIdentityLater();
        } else rejectAuthentication(id, "NOT_READY", "学校连接尚未就绪", true, false);
        return;
    }
    final LibraryIdentityRecovery.Owner owner = libraryRecovery.owner();
    final org.json.JSONObject meta = new org.json.JSONObject();
    try {
        meta.put("system", system).put("method", method).put("authEpoch", owner.epoch).put("authGeneration", owner.generation);
        org.json.JSONObject payload = new org.json.JSONObject().put("id", id).put("method", method)
                .put("params", params == null ? new org.json.JSONObject() : params);
        requests.put(id, meta);
        view.evaluateJavascript("window.QluAgent?window.QluAgent.run(" + payload + "):QluReply.post(JSON.stringify({id:"
                + org.json.JSONObject.quote(id) + ",ok:false,error:{code:'NOT_READY',message:'学校页面尚未就绪'}}))", null);
        handler.postDelayed(() -> {
            if (requests.get(id) != meta) return;
            requests.remove(id);
            LibraryIdentityRecovery.Probe pendingProbe = identityProbes.remove(id);
            boolean currentOwner = owner.epoch == sessionEpoch && (!library || libraryRecovery.owns(owner));
            if (pendingProbe != null) {
                if (libraryRecovery.retryable(pendingProbe, "TIMEOUT", System.currentTimeMillis())) {
                    publishAuthentication(); retryIdentityLater();
                }
                return;
            }
            rejectAuthentication(id, writeRequest ? "UNCERTAIN" : currentOwner ? "TIMEOUT" : "STALE",
                    writeRequest ? "学校响应超时，操作结果待核验，未自动重发" : "学校响应超时，请重试", false, writeRequest);
        }, writeRequest && !"reserve".equals(method) ? 55_000 : 27_000);
    } catch (Exception e) {
        requests.remove(id);
        LibraryIdentityRecovery.Probe pendingProbe = identityProbes.remove(id);
        if (pendingProbe != null) {
            libraryRecovery.retryable(pendingProbe, "NETWORK", System.currentTimeMillis());
            publishAuthentication(); retryIdentityLater();
        } else rejectAuthentication(id, writeRequest ? "UNCERTAIN" : "NETWORK", "学校页面请求未完成", false, writeRequest);
    }
}

final class ApiReply {
    final String system;
    final android.webkit.WebView source;
    final long epoch;
    final LibraryIdentityRecovery.Owner owner;
    ApiReply(String system, android.webkit.WebView source, long epoch, LibraryIdentityRecovery.Owner owner) {
        this.system = system; this.source = source; this.epoch = epoch; this.owner = owner;
    }
    void post(String raw) {
        if (raw == null || raw.length() > 2 * 1024 * 1024) return;
        final org.json.JSONObject response;
        try { response = new org.json.JSONObject(raw); } catch (Exception invalid) { return; }
        handler.post(() -> {
            if (destroyed || epoch != sessionEpoch || source != ("library".equals(system) ? api : teaching)) return;
            if ("teaching".equals(system) && "teachingRoute".equals(response.optString("event"))) {
                android.net.Uri uri = android.net.Uri.parse(response.optString("url"));
                if (TrustedReplyChannel.isOrigin(uri.toString(), "https://jw.qlu.edu.cn")
                        && "/jwglxt/cdjy/cdjy_cxKxcdlb.html".equals(uri.getPath())) teaching.loadUrl(uri.toString());
                return;
            }
            String id = response.optString("id");
            org.json.JSONObject request = (org.json.JSONObject) requests.get(id);
            if (id.isEmpty() || request == null || !system.equals(request.optString("system"))) return;
            if ("library".equals(system) && (request.optLong("authEpoch", -1) != owner.epoch
                    || request.optLong("authGeneration", -1) != owner.generation)) return;
            requests.remove(id);
            if (identityProbes.containsKey(id)) { verifiedLibraryReply(response); return; }
            if (request.has("connect")) {
                int sequence = request.optInt("connect");
                if (sequence == connectSeq) {
                    org.json.JSONObject data = response.optJSONObject("data");
                    if (response.optBoolean("ok") && data != null && data.optBoolean("connected")) finishConnect(true, false);
                    else startConnect(sequence);
                }
                return;
            }
            try {
                boolean sentWrite = isSchoolWrite(request.optString("method"));
                if ("library".equals(system) && !libraryRecovery.owns(owner)) {
                    response.put("ok", false);
                    org.json.JSONObject stale = new org.json.JSONObject().put("code", LibraryIdentityRecovery.staleResultCode(sentWrite))
                            .put("message", "旧会话回包已停用；已发送写操作只核验");
                    if (sentWrite) stale.put("uncertain", true);
                    response.put("error", stale); response.remove("data");
                } else if ("library".equals(system) && !response.optBoolean("ok")) {
                    org.json.JSONObject error = response.optJSONObject("error");
                    String code = error == null ? "" : error.optString("code");
                    if ("AUTH".equals(code) || "EXPIRED".equals(code)) {
                        if (!rejectCurrentLibraryToken(owner)) response.put("error", new org.json.JSONObject()
                                .put("code", "STORAGE").put("message", "认证恢复受本机存储错误阻止，凭据未清除"));
                    }
                }
                addAuthenticationMetadata(response);
                send(response); // Serialize the MODIFIED object now. Never forward a prebuilt raw JS string.
                org.json.JSONObject data = response.optJSONObject("data");
                if ("teaching".equals(system) && "status".equals(request.optString("method"))
                        && response.optBoolean("ok") && data != null && data.optBoolean("connected")) finishConnect(true, true);
            } catch (Exception e) {
                rejectAuthentication(id, isSchoolWrite(request.optString("method")) ? "UNCERTAIN" : "NETWORK",
                        "学校回包处理未完成", false, isSchoolWrite(request.optString("method")));
            }
        });
    }
}

private void authOnPause() {
    if (authenticationRetry != null) handler.removeCallbacks(authenticationRetry);
    authenticationRetry = null;
    libraryRecovery.suspend(System.currentTimeMillis());
    if (activeRestoreView != null) disposeBackgroundView(activeRestoreView, activeRestoreAttempt);
    publishAuthentication();
}

private void authOnResume() { kickAuthenticationRecovery(); }

void clearResourceCache() {
    if (main != null) main.clearCache(true);
}

private void deleteExplicitResetFile(String name) throws android.system.ErrnoException {
    try { android.system.Os.remove(new java.io.File(getFilesDir(), name).getAbsolutePath()); }
    catch (android.system.ErrnoException e) { if (e.errno != android.system.OsConstants.ENOENT) throw e; }
}

}
