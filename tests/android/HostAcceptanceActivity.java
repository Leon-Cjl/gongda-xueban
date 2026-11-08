package cn.qlucampus.personal;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.io.File;
import org.json.*;

/** Uses the real MainActivity handlers and state worker with an isolated synthetic vault/API. */
public class HostAcceptanceActivity extends MainActivity {
 String profileOverride="";
 @Override public File getFilesDir(){File directory=new File(super.getFilesDir(),"synthetic-host-acceptance");directory.mkdirs();return directory;}
 @Override public void onCreate(Bundle saved){if(saved==null&&!getIntent().getBooleanExtra("keepSyntheticState",false)){new File(getFilesDir(),"state.json").delete();new File(getFilesDir(),"state.json.tmp").delete();}WebView.setWebContentsDebuggingEnabled(true);super.onCreate(saved);}
 @Override JSONObject readVault(){super.readVault();try{return new JSONObject().put("username","synthetic-a").put("subjectId","synthetic-a").put("password","synthetic-only").put("remember",true).put("token","synthetic-session-a");}catch(Exception e){throw new IllegalStateException(e);}}
 @Override void saveVault(){}
 @Override void restoreCookies(){}
 @Override void backupCookies(){}
 @Override void preloadPass(){}
 @Override void autoRestore(){}
 @Override WebViewClient officialClient(String system){return new WebViewClient(){@Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return new WebResourceResponse("text/html","UTF-8",new ByteArrayInputStream("<!doctype html><body>合成离线页面".getBytes(java.nio.charset.StandardCharsets.UTF_8)));}};}
 @Override void openOfficial(String target,boolean login){try{vault.put("token","synthetic-session-"+vault.optString("username"));configureApi();}catch(Exception ignored){}}
 @Override void configureApi(){try{
  apiReady=false;String subject=profileOverride.isEmpty()?vault.optString("username"):profileOverride;
  String html="<!doctype html><meta charset=utf-8><script>sessionStorage.setItem('token','synthetic-only');"
   +"window.__qaWrites=0;window.fetch=async function(path,options){if(/space\\/(confirm|leave|cancel|checkout)/.test(path))window.__qaWrites++;let data=[];if(path.includes('/member/my'))data={card:"+JSONObject.quote(subject)+",name:'合成同学',status:1};return new Response(JSON.stringify({code:0,data:data}),{status:200,headers:{'Content-Type':'application/json'}});};<"+"/script>";
  api.loadDataWithBaseURL("https://libyuyue.qlu.edu.cn/",html,"text/html","UTF-8",null);
 }catch(Exception ignored){}}
 @Override void handle(JSONObject message){
  if(message.optString("cmd").equals("qaPassRoute")){super.openOfficial("pass",false);reply(message.optString("id"),true);return;}
  if(message.optString("cmd").equals("qaWindowState")){try{reply(message.optString("id"),new JSONObject().put("officialVisible",official.getVisibility()==android.view.View.VISIBLE).put("brightened",brightened).put("brightnessOverride",getWindow().getAttributes().screenBrightness));}catch(Exception ignored){}return;}
  if(message.optString("cmd").equals("qaSeedLegacy")){final String id=message.optString("id");stateStorage.closeAfter(()->{try{JSONObject legacy=new JSONObject("{\"tasks\":[{\"id\":\"legacy-pending\",\"status\":\"pending\",\"day\":\"2099-12-01\",\"start\":\"09:00\",\"end\":\"11:00\",\"fireAt\":\"2099-12-01T00:00:00Z\",\"seats\":[{\"id\":1,\"no\":\"QA1\"}]},{\"id\":\"legacy-sending\",\"status\":\"submitting\",\"seats\":[]}],\"favorites\":[{\"key\":\"seat:qa:1\",\"type\":\"seat\",\"id\":1}],\"preferences\":{\"examCache\":{\"legacy\":{\"owner\":\"synthetic-other\",\"exams\":[]}}}}");write("state.json",legacy.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));handler.post(()->reply(id,true));}catch(Exception error){handler.post(()->reject(id,"QA","synthetic fixture persistence failed"));}});return;}
  if(message.optString("cmd").equals("qaTrimMemory")){ensureTeaching();ensurePass();onTrimMemory(TRIM_MEMORY_RUNNING_LOW);try{reply(message.optString("id"),new JSONObject().put("passReleased",passWeb==null).put("teachingReleased",teaching==null).put("mainAlive",main!=null).put("apiAlive",api!=null));}catch(Exception ignored){}return;}
  if(message.optString("cmd").equals("qaCountWrites")){api.evaluateJavascript("window.__qaWrites||0",value->{try{reply(message.optString("id"),new JSONObject().put("writes",Integer.parseInt(value)));}catch(Exception ignored){}});return;}
  if(message.optString("cmd").equals("qaTerminateRenderer")){boolean supported=android.os.Build.VERSION.SDK_INT>=29&&main.getWebViewRenderProcess()!=null;try{reply(message.optString("id"),new JSONObject().put("supported",supported));}catch(Exception ignored){}if(supported)handler.postDelayed(()->{if(main!=null&&main.getWebViewRenderProcess()!=null)main.getWebViewRenderProcess().terminate();},300);return;}
  if(message.optString("cmd").equals("qaProfileMismatch")){profileOverride="synthetic-mismatch";identityVerified=false;configureApi();reply(message.optString("id"),true);return;}
  super.handle(message);
 }
}
