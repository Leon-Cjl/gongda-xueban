package cn.qlucampus.personal;

import android.net.Uri;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.webkit.WebView;
import java.net.URI;
import java.util.UUID;
import java.util.function.LongSupplier;
import org.json.JSONObject;

/** A top-document message port. No callable Java object is exposed to remote frames. */
final class TrustedReplyChannel {
 interface Receiver { void receive(String text); }
 private final WebView view;
 private final String origin;
 private final long epoch;
 private final LongSupplier currentEpoch;
 private final boolean appOwnedDocument;
 private WebMessagePort nativePort, pagePort;
 private boolean closed, ready;

 static boolean isOrigin(String url, String expected) {
  try {
   URI actual = new URI(url), target = new URI(expected);
   int actualPort = actual.getPort() == -1 ? 443 : actual.getPort();
   int targetPort = target.getPort() == -1 ? 443 : target.getPort();
   return "https".equals(actual.getScheme()) && actual.getRawUserInfo() == null
    && target.getHost().equals(actual.getHost()) && actualPort == targetPort;
  } catch (Exception error) { return false; }
 }

 TrustedReplyChannel(WebView view, String origin, long epoch, LongSupplier currentEpoch,
                     Receiver receiver, Runnable onReady) {
  this(view,origin,epoch,currentEpoch,receiver,onReady,false);
 }
 TrustedReplyChannel(WebView view, String origin, long epoch, LongSupplier currentEpoch,
                     Receiver receiver, Runnable onReady,boolean appOwnedDocument) {
  this.view = view; this.origin = origin; this.epoch = epoch; this.currentEpoch = currentEpoch;
  this.appOwnedDocument=appOwnedDocument;
  if (!appOwnedDocument&&!isOrigin(view.getUrl(), origin)) { closed = true; return; }
  try {
   WebMessagePort[] ports = view.createWebMessageChannel(); nativePort = ports[0]; pagePort = ports[1];
   nativePort.setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
    @Override public void onMessage(WebMessagePort port, WebMessage message) {
     if (!valid() || message == null || message.getData() == null || message.getData().length() > 1048576) return;
     String text = message.getData();
     if (!ready) {
      if (!"{\"event\":\"channelReady\"}".equals(text)) return;
      ready = true; onReady.run(); return;
     }
     receiver.receive(text);
    }
   });
   String nonce = UUID.randomUUID().toString();
   String script = "(function(){if(window!==top||location.origin!==" + JSONObject.quote(origin) + ")return false;"
    + "let port=null;const pending=[];window.QluReply=Object.freeze({post:function(text){if(typeof text!=='string'||text.length>1048576)return;if(port)port.postMessage(text);else if(pending.length<32)pending.push(text);}});"
    + "const receive=function(e){if(e.data!==" + JSONObject.quote(nonce) + "||e.ports.length!==1||location.origin!==" + JSONObject.quote(origin) + ")return;"
    + "window.removeEventListener('message',receive);port=e.ports[0];port.postMessage('{\"event\":\"channelReady\"}');pending.splice(0).forEach(text=>port.postMessage(text));};"
    + "window.addEventListener('message',receive);return true;})()";
   view.evaluateJavascript(script, result -> {
    if (!valid() || !"true".equals(result)) { close(); return; }
    try { view.postWebMessage(new WebMessage(nonce, new WebMessagePort[]{pagePort}), Uri.parse(origin)); }
    catch (Exception error) { close(); }
   });
  } catch (Exception error) { close(); }
 }

 boolean valid() { return !closed && epoch == currentEpoch.getAsLong() && (appOwnedDocument||isOrigin(view.getUrl(), origin)); }
 boolean ready() { return ready && valid(); }
 void close() {
  closed = true; ready = false;
  try { if (nativePort != null) nativePort.close(); } catch (Exception ignored) {}
  try { if (pagePort != null) pagePort.close(); } catch (Exception ignored) {}
 }
}
