package cn.qlucampus.personal;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.webkit.*;
import android.widget.LinearLayout;
import android.view.WindowInsets;
import java.io.ByteArrayInputStream;

/** Debug APK only. Synthetic school bridge, no account data or external requests. */
public class EmulatorActivity extends Activity {
 WebView web;
 public class Controls{@JavascriptInterface public void textZoom(int percent){runOnUiThread(()->web.getSettings().setTextZoom(Math.max(80,Math.min(200,percent))));}}
 @Override public void onCreate(Bundle saved) {
  super.onCreate(saved);
  WebView.setWebContentsDebuggingEnabled(true);
  LinearLayout root=new LinearLayout(this);
  root.setOnApplyWindowInsetsListener((v,i)->{
   if(Build.VERSION.SDK_INT>=30){android.graphics.Insets s=i.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()),ime=i.getInsets(WindowInsets.Type.ime());v.setPadding(s.left,s.top,s.right,ime.bottom);if(web!=null)web.evaluateJavascript("document.documentElement&&document.documentElement.style.setProperty('--sab','"+Math.round(s.bottom/getResources().getDisplayMetrics().density)+"px')",null);return WindowInsets.CONSUMED;}
   return i;
  });
  web=new WebView(this);web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView w,WebResourceRequest r){return !"qa.campus.local".equals(r.getUrl().getHost());}
   @Override public WebResourceResponse shouldInterceptRequest(WebView w,WebResourceRequest r){
    if(!"qa.campus.local".equals(r.getUrl().getHost()))return empty();
    String name=r.getUrl().getPath().replaceFirst("^/","");if(!name.startsWith("qa/")||name.contains(".."))return empty();
    try{return new WebResourceResponse(name.endsWith(".js")?"text/javascript":name.endsWith(".css")?"text/css":name.endsWith(".png")?"image/png":name.endsWith(".webp")?"image/webp":name.endsWith(".jpg")?"image/jpeg":name.endsWith(".svg")?"image/svg+xml":"text/html","UTF-8",getAssets().open(name));}catch(Exception e){return empty();}
   }
   WebResourceResponse empty(){return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));}
  });
  web.addJavascriptInterface(new Controls(),"QaView");root.addView(web,new LinearLayout.LayoutParams(-1,-1));setContentView(root);
  String scenario=getIntent().getStringExtra("scenario");if(scenario==null||!scenario.matches("[a-z0-9]+"))scenario="emulator";
  String page=getIntent().getStringExtra("page");if(page==null||!page.matches("[a-z]+"))page="";
  boolean acceptance=getIntent().getBooleanExtra("acceptance",false);
  String fixtureExtra="medal".equals(scenario)?"&badges=none&motion=auto":acceptance?"&motion=off":"";
  web.loadUrl("https://qa.campus.local/qa/"+(acceptance?"acceptance.html":"index.html")+"?s=connected&case="+scenario+(acceptance||page.isEmpty()?"":"&page="+page)+"&notify=on&vio=1"+fixtureExtra);
 }
 @Override public void onBackPressed(){web.evaluateJavascript("window.Campus&&Campus.back?Campus.back():false",value->{if(!"true".equals(value))finish();});}
 @Override protected void onDestroy(){if(web!=null)web.destroy();super.onDestroy();}
}
