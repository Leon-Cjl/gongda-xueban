package cn.qlucampus.personal;
import java.util.regex.*;
final class RuntimeSupport {
 static final int MIN_CHROMIUM=86;
 static boolean supports(String userAgent){
  if(userAgent==null)return false;Matcher found=Pattern.compile("(?:Chrome|Chromium)/(\\d+)").matcher(userAgent);
  try{return found.find()&&Integer.parseInt(found.group(1))>=MIN_CHROMIUM;}catch(Exception failure){return false;}
 }
 static String unavailableHtml(){return "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'><meta charset=utf-8><title>更新系统网页组件</title><body><h1>需要更新系统网页组件</h1><p>当前 Android System WebView 版本过旧或无法识别。请在系统应用商店更新 Android System WebView 或 Chrome 后重新打开工大学伴。</p><p>本机数据已保留，本次没有发起学校预约操作。</p></body>";}
}
