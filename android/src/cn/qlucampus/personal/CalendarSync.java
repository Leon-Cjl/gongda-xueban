package cn.qlucampus.personal;

import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import org.json.*;
import java.util.*;

/** Reads only application-owned events. A preview is immutable and commits as one provider batch. */
final class CalendarSync {
 static final class Plan {
  final String owner,term,fingerprint,calendarName;final long calendarId;final boolean allowRemoval;
  final JSONArray events,keep;final JSONObject diff;
  Plan(String owner,String term,String fingerprint,long calendarId,String calendarName,JSONArray events,JSONArray keep,JSONObject diff,boolean allowRemoval){this.owner=owner;this.term=term;this.fingerprint=fingerprint;this.calendarId=calendarId;this.calendarName=calendarName;this.events=events;this.keep=keep;this.diff=diff;this.allowRemoval=allowRemoval;}
  JSONObject summary()throws Exception{return new JSONObject().put("calendar",calendarName).put("added",diff.getJSONArray("add").length()).put("updated",diff.getJSONArray("update").length()).put("removed",diff.getJSONArray("remove").length()).put("unchanged",diff.getInt("unchanged"));}
 }
 final ContentResolver resolver;final String packageName;
 CalendarSync(Context context){resolver=context.getContentResolver();packageName=context.getPackageName();}
 static String ownerKey(String subject)throws Exception{return SubjectState.key("qlu|"+subject);}
 static String eventUri(String owner,String key){return "campus://exam/"+owner+"/"+Uri.encode(key);}
 static JSONObject diff(JSONArray existing,JSONArray events,JSONArray keep,String owner,String term,boolean allowRemoval)throws Exception{
  if(!term.matches("\\d{4}-\\d{1,2}"))throw new IllegalArgumentException("考试学期无效");
  Map<String,JSONObject> previous=new LinkedHashMap<>();String prefix=term+"|";
  for(int i=0;i<existing.length();i++){JSONObject row=existing.optJSONObject(i);if(row!=null&&owner.equals(row.optString("owner"))&&row.optString("key").startsWith(prefix))if(previous.put(row.getString("key"),row)!=null)throw new IllegalArgumentException("目标日历存在重复考试，请先核对");}
  JSONArray add=new JSONArray(),update=new JSONArray(),remove=new JSONArray();Set<String> retain=new HashSet<>(),seen=new HashSet<>();int unchanged=0;
  if(keep!=null)for(int i=0;i<keep.length();i++)if(keep.optString(i).startsWith(prefix))retain.add(keep.optString(i));
  for(int i=0;i<events.length();i++){
   JSONObject next=events.getJSONObject(i);String key=next.optString("key");
   if(!key.startsWith(prefix)||!seen.add(key)||next.optLong("start")<=0||next.optLong("end")<=next.optLong("start"))throw new IllegalArgumentException("考试日历条目无效或重复");
   retain.add(key);JSONObject old=previous.get(key),copy=new JSONObject(next.toString());
   if(old==null)add.put(copy);else{
    boolean same=true;for(String field:new String[]{"title","start","end","location","description"})if(!String.valueOf(old.opt(field)).equals(String.valueOf(next.opt(field))))same=false;
    if(same)unchanged++;else{copy.put("id",old.getLong("id"));update.put(copy);}
   }
  }
  for(Map.Entry<String,JSONObject> entry:previous.entrySet())if(allowRemoval&&!retain.contains(entry.getKey()))remove.put(entry.getValue());
  return new JSONObject().put("add",add).put("update",update).put("remove",remove).put("unchanged",unchanged);
 }
 Plan preview(String subject,String term,JSONArray events,JSONArray keep,long target,boolean allowRemoval)throws Exception{
  String owner=ownerKey(subject);long calendar=-1;String name="";
  try(Cursor cursor=resolver.query(CalendarContract.Calendars.CONTENT_URI,new String[]{"_id","calendar_displayName","isPrimary"},"calendar_access_level>=? AND visible=1",new String[]{String.valueOf(CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR)},"_id ASC")){
   while(cursor!=null&&cursor.moveToNext()){if(target>=0&&cursor.getLong(0)!=target)continue;if(calendar<0||cursor.getInt(2)==1){calendar=cursor.getLong(0);name=cursor.getString(1);if(target>=0||cursor.getInt(2)==1)break;}}
  }
  if(calendar<0)throw new IllegalStateException("手机上没有可写入的目标日历");
  JSONArray existing=new JSONArray();String uriPrefix="campus://exam/"+owner+"/",marker="[工大学伴:"+owner+"]\n";
  try(Cursor cursor=resolver.query(CalendarContract.Events.CONTENT_URI,new String[]{"_id","customAppUri","title","dtstart","dtend","eventLocation","description"},"customAppPackage=? AND calendar_id=? AND deleted=0",new String[]{packageName,String.valueOf(calendar)},"_id ASC")){
   while(cursor!=null&&cursor.moveToNext()){
    String uri=cursor.getString(1),description=cursor.getString(6);if(uri==null||!uri.startsWith(uriPrefix)||description==null||!description.startsWith(marker))continue;
    String key=Uri.decode(uri.substring(uriPrefix.length()));if(!key.startsWith(term+"|"))continue;
    existing.put(new JSONObject().put("id",cursor.getLong(0)).put("owner",owner).put("key",key).put("title",cursor.getString(2)).put("start",cursor.getLong(3)).put("end",cursor.getLong(4)).put("location",cursor.getString(5)==null?"":cursor.getString(5)).put("description",description.substring(marker.length())));
   }
  }
  return new Plan(owner,term,SubjectState.key(existing.toString()),calendar,name,new JSONArray(events.toString()),keep==null?new JSONArray():new JSONArray(keep.toString()),diff(existing,events,keep,owner,term,allowRemoval),allowRemoval);
 }
 JSONObject commit(Plan plan,String subject,java.util.function.BooleanSupplier allowed)throws Exception{
  if(!plan.owner.equals(ownerKey(subject)))throw new IllegalStateException("日历预览不属于当前身份");
  Plan current=preview(subject,plan.term,plan.events,plan.keep,plan.calendarId,plan.allowRemoval);
  if(!current.fingerprint.equals(plan.fingerprint))throw new IllegalStateException("日历条目已变化，请重新预览");
  ArrayList<ContentProviderOperation> operations=new ArrayList<>();String marker="[工大学伴:"+plan.owner+"]\n";
  for(String group:new String[]{"add","update"}){JSONArray rows=plan.diff.getJSONArray(group);for(int i=0;i<rows.length();i++){
   JSONObject row=rows.getJSONObject(i);ContentValues values=new ContentValues();values.put("calendar_id",plan.calendarId);values.put("title",row.optString("title"));values.put("eventLocation",row.optString("location"));values.put("description",marker+row.optString("description"));values.put("dtstart",row.getLong("start"));values.put("dtend",row.getLong("end"));values.put("eventTimezone","Asia/Shanghai");values.put("hasAlarm",1);values.put("customAppPackage",packageName);values.put("customAppUri",eventUri(plan.owner,row.getString("key")));
   if(group.equals("update"))operations.add(ContentProviderOperation.newUpdate(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,row.getLong("id"))).withValues(values).withExpectedCount(1).build());
   else{int index=operations.size();operations.add(ContentProviderOperation.newInsert(CalendarContract.Events.CONTENT_URI).withValues(values).build());for(int minutes:new int[]{1440,60})operations.add(ContentProviderOperation.newInsert(CalendarContract.Reminders.CONTENT_URI).withValueBackReference("event_id",index).withValue("minutes",minutes).withValue("method",CalendarContract.Reminders.METHOD_ALERT).build());}
  }}
  JSONArray removed=plan.diff.getJSONArray("remove");for(int i=0;i<removed.length();i++)operations.add(ContentProviderOperation.newDelete(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,removed.getJSONObject(i).getLong("id"))).withExpectedCount(1).build());
  if(!allowed.getAsBoolean())throw new IllegalStateException("账号会话已变化");
  if(!operations.isEmpty())resolver.applyBatch(CalendarContract.AUTHORITY,operations);return plan.summary();
 }
}
