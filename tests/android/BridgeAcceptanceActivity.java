package cn.qlucampus.personal;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.*;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.json.*;

/** Synthetic origins only. This Activity is never included in a production manifest. */
public class BridgeAcceptanceActivity extends Activity {
 WebView web; TrustedReplyChannel channel; long epoch=1; int accepted=0; boolean running=false,finished=false;
 final Handler handler=new Handler(Looper.getMainLooper()); final JSONArray checks=new JSONArray();
 void check(boolean ok,String name){try{checks.put(new JSONObject().put("ok",ok).put("name",name));}catch(Exception ignored){}}
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);WebView.setWebContentsDebuggingEnabled(true);web=new WebView(this);setContentView(web);
  web.getSettings().setJavaScriptEnabled(true);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView w,WebResourceRequest r){
    String html="<!doctype html><body>合成来源消息通道验收";
    if("evil.campus.test".equals(r.getUrl().getHost()))html+="<script>parent.postMessage({evilBridge:typeof NativeHost!=='undefined'||typeof QluReply!=='undefined'},'*');try{parent.QluReply.post('{\"id\":\"forged\"}')}catch(e){}<"+"/script>";
    return new WebResourceResponse("text/html","UTF-8",new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8)));
   }
   @Override public void onPageFinished(WebView w,String url){if(running)return;running=true;runChecks();}
  });web.loadUrl("https://trusted.campus.test/");
 }
 void runChecks(){
  runSubjectChecks();
  runCalendarChecks();
  check(RuntimeSupport.supports("Chrome/86.0.0")&&!RuntimeSupport.supports("Chrome/85.0.0")&&!RuntimeSupport.supports("unknown"),"minimum renderer support fails closed for old and unknown providers");
  check(TrustedReplyChannel.isOrigin("https://trusted.campus.test/path","https://trusted.campus.test"),"exact HTTPS origin is accepted");
  for(String bad:new String[]{"http://trusted.campus.test/","https://trusted.campus.test.evil/","https://trusted.campus.test:444/","https://name@trusted.campus.test/"})check(!TrustedReplyChannel.isOrigin(bad,"https://trusted.campus.test"),"untrusted origin rejected: "+bad);
  channel=new TrustedReplyChannel(web,"https://trusted.campus.test",epoch,()->epoch,text->{if("{\"id\":\"valid\"}".equals(text))accepted++;else check(false,"unexpected synthetic message");},()->{
   check(channel.ready(),"message port becomes ready after the top-document handshake");
   web.evaluateJavascript("window.__evilBridge=null;addEventListener('message',e=>{if(e.origin==='https://evil.campus.test'&&'evilBridge' in e.data)window.__evilBridge=e.data.evilBridge;});QluReply.post('{\"id\":\"valid\"}');const f=document.createElement('iframe');f.src='https://evil.campus.test/';document.body.append(f);",null);
   handler.postDelayed(()->{
    check(accepted==1,"only the trusted top-document message reaches native");
    web.evaluateJavascript("window.__evilBridge===false",result->{
     check("true".equals(result),"cross-origin frame has no callable native or reply bridge");
     epoch++;web.evaluateJavascript("QluReply.post('{\"id\":\"valid\"}')",null);
     handler.postDelayed(()->{
      check(accepted==1,"old-session messages are rejected after the epoch changes");channel.close();
      check(!channel.ready(),"closing the channel invalidates its readiness");finishChecks();
     },200);
    });
   },600);
  });
  handler.postDelayed(()->{if(!finished){check(false,"native channel handshake timed out");finishChecks();}},6000);
 }
 void runSubjectChecks(){try{
  JSONObject legacy=new JSONObject("{\"tasks\":[{\"id\":\"old-pending\",\"status\":\"pending\"},{\"id\":\"old-writing\",\"status\":\"submitting\"}],\"favorites\":[{\"key\":\"seat:1:2\"}],\"preferences\":{\"examCache\":{\"owner\":\"synthetic-a\"}}}");
  SubjectState store=new SubjectState(legacy,"synthetic-b");check(!store.active().has("tasks")&&store.hasLegacy(),"unowned legacy data stays isolated from a new identity");
  store.replace(new JSONObject("{\"tasks\":[{\"id\":\"b\"}]}"));store.select("synthetic-a");check(!store.active().has("tasks"),"switching to another identity does not reveal the previous tasks");
  store.replace(new JSONObject("{\"tasks\":[{\"id\":\"a\"}]}"));store.select("synthetic-b");check("b".equals(store.active().getJSONArray("tasks").getJSONObject(0).getString("id")),"switching back restores only that identity's data");
  store=new SubjectState(store.snapshot(),"synthetic-b");check("b".equals(store.active().getJSONArray("tasks").getJSONObject(0).getString("id")),"identity partitions survive serialization and reconstruction");
  boolean blocked=false;try{store.adoptLegacy(false);}catch(IllegalStateException expected){blocked=true;}check(blocked,"unverified identities cannot claim legacy data");
  store.adoptLegacy(true);JSONArray tasks=store.active().getJSONArray("tasks");
  check("needs_auth".equals(tasks.getJSONObject(1).getString("status"))&&"uncertain".equals(tasks.getJSONObject(2).getString("status")),"legacy pending writes are paused and interrupted writes remain uncertain");
  check("synthetic-b".equals(tasks.getJSONObject(1).getString("subjectId"))&&!store.active().has("preferences"),"confirmed adoption binds tasks and does not adopt private exam caches");
  check(!store.hasLegacy()&&store.snapshot().getJSONObject("legacy").getBoolean("adopted"),"adoption is one-time and retains the original legacy archive");
 }catch(Exception failure){check(false,"subject state checks failed: "+failure.getClass().getSimpleName());}}
 void runCalendarChecks(){try{
  String owner=CalendarSync.ownerKey("synthetic-a"),other=CalendarSync.ownerKey("synthetic-b");
  JSONArray existing=new JSONArray();existing.put(new JSONObject().put("id",1).put("key","2026-3|a").put("owner",owner).put("title","old").put("start",100).put("end",200).put("location","").put("description",""));
  existing.put(new JSONObject().put("id",2).put("key","2026-3|gone").put("owner",owner));existing.put(new JSONObject().put("id",3).put("key","2026-3|foreign").put("owner",other));existing.put(new JSONObject().put("id",4).put("key","2025-3|past").put("owner",owner));
  JSONArray events=new JSONArray().put(new JSONObject().put("key","2026-3|a").put("title","new").put("start",100).put("end",200).put("location","").put("description","")).put(new JSONObject().put("key","2026-3|b").put("title","new b").put("start",300).put("end",400));
  JSONObject diff=CalendarSync.diff(existing,events,new JSONArray(),owner,"2026-3",true);
  check(diff.getJSONArray("add").length()==1&&diff.getJSONArray("update").length()==1&&diff.getJSONArray("remove").length()==1,"calendar preview computes actual add/update/remove counts");
  check(diff.getJSONArray("remove").getJSONObject(0).getLong("id")==2,"calendar removal stays within the current identity and term");
  check(!owner.equals(other)&&owner.length()==64,"calendar ownership uses distinct school-subject namespaces");
  check(CalendarSync.diff(existing,events,new JSONArray(),owner,"2026-3",false).getJSONArray("remove").length()==0,"incomplete school data cannot remove calendar events");
  boolean blocked=false;events.put(events.getJSONObject(0));try{CalendarSync.diff(existing,events,new JSONArray(),owner,"2026-3",true);}catch(IllegalArgumentException expected){blocked=true;}check(blocked,"duplicate event identities are rejected before provider writes");
 }catch(Exception failure){check(false,"calendar plan checks failed: "+failure.getClass().getSimpleName());}}
 void finishChecks(){finished=true;try{JSONObject result=new JSONObject().put("synthetic",true).put("checks",checks);web.evaluateJavascript("window.__bridgeResult="+result.toString()+";document.body.textContent=JSON.stringify(window.__bridgeResult)",null);}catch(Exception ignored){}}
 @Override protected void onDestroy(){handler.removeCallbacksAndMessages(null);if(channel!=null)channel.close();if(web!=null)web.destroy();super.onDestroy();}
}
