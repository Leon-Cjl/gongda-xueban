package cn.qlucampus.personal;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.text.TextUtils;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.*;

/** 预约签到提醒：由系统 AlarmManager 按时唤起，应用没在运行也能发通知；不常驻后台。 */
public class ReminderReceiver extends BroadcastReceiver {
 static final String ACTION="cn.qlucampus.personal.REMIND",CHANNEL="reminder";
 @Override public void onReceive(Context c,Intent i){
  if(i==null||!ACTION.equals(i.getAction()))return;
  NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
  // 没有通知权限或用户关了通知：直接放弃，不报错。
  if(nm==null||!allowed(c))return;
  try{
   if(Build.VERSION.SDK_INT>=26&&nm.getNotificationChannel(CHANNEL)==null){NotificationChannel ch=new NotificationChannel(CHANNEL,"预约提醒",NotificationManager.IMPORTANCE_HIGH);ch.setDescription("预约开始前提醒签到，避免违约");ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);nm.createNotificationChannel(ch);}
   int code=i.getIntExtra("code",0),icon=c.getResources().getIdentifier("ic_stat_seat","drawable",c.getPackageName());
   String title=i.getStringExtra("title"),text=i.getStringExtra("text");if(title==null||title.isEmpty())title="预约提醒";if(text==null)text="";
   Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(c,CHANNEL):new Notification.Builder(c);
   b.setSmallIcon(icon).setContentTitle(title).setContentText(text).setStyle(new Notification.BigTextStyle().bigText(text)).setCategory(Notification.CATEGORY_REMINDER).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PUBLIC).setColor(Color.rgb(52,130,255)).setShowWhen(true).setContentIntent(open(c,MainActivity.ACTION_PASS,null,31));
   if(Build.VERSION.SDK_INT<26)b.setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_SOUND);
   b.addAction(new Notification.Action.Builder(Icon.createWithResource(c,icon),"出示入馆码",open(c,MainActivity.ACTION_PASS,null,32)).build());
   b.addAction(new Notification.Action.Builder(Icon.createWithResource(c,icon),"打开助手",open(c,MainActivity.ACTION_PAGE,"library",33)).build());
   // 通知编号直接用请求码（同一批里互不相同），两条提醒不会互相覆盖。
   nm.notify(code,b.build());
  }catch(Exception e){}
 }
 static boolean allowed(Context c){NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);if(nm==null)return false;if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(MainActivity.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return false;return nm.areNotificationsEnabled();}
 // 请求码与常驻座位通知（1、2）和磁贴（3）错开。
 static PendingIntent open(Context c,String action,String page,int code){Intent i=new Intent(c,MainActivity.class).setAction(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);if(page!=null)i.putExtra("page",page);return PendingIntent.getActivity(c,code,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 static String cut(String s,int n){if(s.length()<=n)return s;int e=Character.isHighSurrogate(s.charAt(n-1))?n-1:n;return s.substring(0,e);}
 static PendingIntent alarm(Context c,int code,String title,String text,int flags){Intent i=new Intent(c,ReminderReceiver.class).setAction(ACTION);if(title!=null)i.putExtra("title",title).putExtra("text",text).putExtra("code",code);return PendingIntent.getBroadcast(c,code,i,flags|PendingIntent.FLAG_IMMUTABLE);}
 // 整体替换上一批：先取消旧闹钟，再按时间先后设置最多 12 条；清单存在本机，手机重启后由 BootReceiver 重新设置。
 // 精确闹钟：Android 12–12L 默认允许（SCHEDULE_EXACT_ALARM），13 起用 USE_EXACT_ALARM；系统仍不允许时退回近似时间，并如实返回 exact:false。
 static JSONObject schedule(Context c,JSONArray items)throws Exception{
  AlarmManager am=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);SharedPreferences prefs=c.getSharedPreferences("reminders",0);
  for(String s:prefs.getString("codes","").split(","))try{PendingIntent old=alarm(c,Integer.parseInt(s.trim()),null,null,PendingIntent.FLAG_NO_CREATE);if(old!=null){am.cancel(old);old.cancel();}}catch(Exception e){}
  boolean exact=Build.VERSION.SDK_INT<31||am.canScheduleExactAlarms();long now=System.currentTimeMillis();List<JSONObject> list=new ArrayList<>();
  if(items!=null)for(int i=0;i<items.length();i++){JSONObject it=items.optJSONObject(i);if(it!=null&&it.optLong("at")>now+15000&&it.optLong("at")<=now+8*86400000L)list.add(it);}
  Collections.sort(list,(a,b)->Long.compare(a.optLong("at"),b.optLong("at")));Set<Integer> codes=new LinkedHashSet<>();JSONArray kept=new JSONArray();
  for(JSONObject it:list){if(codes.size()>=12)break;int code=20000+(it.optString("id").hashCode()&0x7fff);while(codes.contains(code))code=20000+((code-19999)&0x7fff);long at=it.optLong("at");
   String title=cut(it.optString("title"),60),text=cut(it.optString("text"),200);PendingIntent pi=alarm(c,code,title,text,PendingIntent.FLAG_UPDATE_CURRENT);
   try{if(exact)am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pi);else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pi);}catch(SecurityException e){exact=false;am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pi);}
   codes.add(code);kept.put(new JSONObject().put("id",it.optString("id")).put("at",at).put("title",title).put("text",text));}
  prefs.edit().putString("codes",TextUtils.join(",",codes)).putString("items",kept.toString()).apply();
  return new JSONObject().put("scheduled",codes.size()).put("exact",exact).put("allowed",allowed(c));
 }
}
