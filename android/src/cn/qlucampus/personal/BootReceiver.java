package cn.qlucampus.personal;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONArray;

/** 手机重启或应用更新后，系统闹钟会被清空：按本机保存的清单重新设置还没到点的签到提醒，设完即退出，不常驻。 */
public class BootReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context c,Intent i){
  String a=i==null?null:i.getAction();
  if(!Intent.ACTION_BOOT_COMPLETED.equals(a)&&!Intent.ACTION_MY_PACKAGE_REPLACED.equals(a))return;
  try{ReminderReceiver.schedule(c,new JSONArray(c.getSharedPreferences("reminders",0).getString("items","[]")));}catch(Exception e){}
 }
}
