package cn.qlucampus.personal;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.*;
import org.json.*;
import java.util.UUID;
import java.util.concurrent.*;

/** Two-phase calendar synchronization. The sole worker expires after one idle second. */
final class CalendarController {
 static final int PERMISSION_REQUEST=12;
 interface Host{long epoch();String subject();boolean verified();void reply(String id,JSONObject result);void reject(String id,String code,String message);}
 private static final ExecutorService worker=new ThreadPoolExecutor(0,1,1,TimeUnit.SECONDS,new LinkedBlockingQueue<Runnable>(),task->new Thread(task,"campus-calendar-io"));
 private final Activity activity;private final Host host;private final Handler handler=new Handler(Looper.getMainLooper());
 private volatile boolean closed;private boolean permissionAllowRemoval;private CalendarSync.Plan plan;private String planId="",permissionId="",permissionTerm="";private long planEpoch,expires,permissionEpoch;private JSONArray permissionEvents,permissionKeep;
 CalendarController(Activity activity,Host host){this.activity=activity;this.host=host;}
 void preview(String id,JSONArray events,JSONArray keep,String term,boolean allowRemoval){
  if(closed)return;if(!host.verified()){host.reject(id,"AUTH","请先核验当前学校身份");return;}
  if(events==null||events.length()>2000||keep!=null&&keep.length()>2000){host.reject(id,"INVALID","考试日历数据无效");return;}
  if(activity.checkSelfPermission(Manifest.permission.READ_CALENDAR)!=PackageManager.PERMISSION_GRANTED||activity.checkSelfPermission(Manifest.permission.WRITE_CALENDAR)!=PackageManager.PERMISSION_GRANTED){
   if(!permissionId.isEmpty()){host.reject(id,"BUSY","正在等待日历权限");return;}
   permissionId=id;permissionEvents=events;permissionKeep=keep;permissionTerm=term;permissionEpoch=host.epoch();permissionAllowRemoval=allowRemoval;
   activity.requestPermissions(new String[]{Manifest.permission.READ_CALENDAR,Manifest.permission.WRITE_CALENDAR},PERMISSION_REQUEST);return;
  }
  final long epoch=host.epoch();final String subject=host.subject();final CalendarSync sync=new CalendarSync(activity.getApplicationContext());
  worker.execute(()->{try{
   CalendarSync.Plan next=sync.preview(subject,term,events,keep,-1,allowRemoval);
   handler.post(()->{if(closed)return;if(epoch!=host.epoch()||!host.verified()){host.reject(id,"STALE","账号已变化，请重新预览日历");return;}try{
    plan=next;planEpoch=epoch;planId=UUID.randomUUID().toString();expires=SystemClock.elapsedRealtime()+300000;host.reply(id,next.summary().put("planId",planId));
   }catch(Exception failure){host.reject(id,"CLIENT","无法生成日历预览");}});
  }catch(Exception failure){handler.post(()->{if(!closed)host.reject(id,"CLIENT","无法读取目标日历，请核对权限和可写日历");});}});
 }
 void commit(String id,String requested){
  if(closed)return;
  if(plan==null||!planId.equals(requested)||host.epoch()!=planEpoch||!host.verified()||SystemClock.elapsedRealtime()>expires){host.reject(id,"STALE","日历预览已失效，请重新预览");return;}
  final CalendarSync.Plan selected=plan;plan=null;planId="";final long epoch=host.epoch();final String subject=host.subject();final CalendarSync sync=new CalendarSync(activity.getApplicationContext());
  worker.execute(()->{try{
   JSONObject result=sync.commit(selected,subject,()->!closed&&epoch==host.epoch()&&host.verified());
   handler.post(()->{if(!closed){if(epoch==host.epoch())host.reply(id,result);else host.reject(id,"STALE","账号已变化，请在原账号核对日历结果");}});
  }catch(Exception failure){handler.post(()->{if(!closed)host.reject(id,"UNCERTAIN","日历同步未完成，请重新预览核对；未自动重试");});}});
 }
 void permissionsResult(int[] grants){
  if(permissionId.isEmpty())return;String id=permissionId;permissionId="";
  JSONArray events=permissionEvents,keep=permissionKeep;permissionEvents=null;permissionKeep=null;
  if(permissionEpoch!=host.epoch()||!host.verified()){host.reject(id,"STALE","账号已变化，未写入日历");return;}
  boolean allowed=grants.length>0;for(int value:grants)allowed&=value==PackageManager.PERMISSION_GRANTED;
  if(!allowed){host.reject(id,"DENIED","没有日历权限，未写入任何日历条目");return;}preview(id,events,keep,permissionTerm,permissionAllowRemoval);
 }
 void close(){closed=true;plan=null;permissionEvents=null;permissionKeep=null;handler.removeCallbacksAndMessages(null);}
}
