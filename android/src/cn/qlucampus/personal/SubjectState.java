package cn.qlucampus.personal;

import org.json.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Identity-owned data. Unowned legacy data is retained, never silently assigned to a login. */
final class SubjectState {
 private JSONObject profiles = new JSONObject(), legacy;
 private String subject = "";
 private boolean selected;
 private JSONObject active = new JSONObject();
 SubjectState(JSONObject stored, String subject) throws Exception {
  if(stored.optInt("subjectSchema")==1){profiles=copy(stored.optJSONObject("profiles"));legacy=stored.optJSONObject("legacy");}
  else if(stored.length()>0)legacy=copy(stored);
  select(subject);
 }
 private static JSONObject copy(JSONObject value) throws Exception {return value==null?new JSONObject():new JSONObject(value.toString());}
 static String key(String value) throws Exception {
  byte[] digest=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();
  for(byte b:digest)out.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return out.toString();
 }
 String subject(){return subject;}
 JSONObject active(){return active;}
 boolean hasLegacy(){return legacy!=null&&legacy.length()>0&&!legacy.optBoolean("adopted");}
 void select(String next) throws Exception {
  if(selected)profiles.put(key(subject),copy(active));
  subject=next==null?"":next.trim();active=copy(profiles.optJSONObject(key(subject)));selected=true;
 }
 void replace(JSONObject next) throws Exception {active=copy(next);active.remove("_sessionEpoch");profiles.put(key(subject),copy(active));}
 JSONObject snapshot() throws Exception {
  profiles.put(key(subject),copy(active));
  JSONObject out=new JSONObject().put("subjectSchema",1).put("profiles",copy(profiles));if(legacy!=null)out.put("legacy",copy(legacy));return out;
 }
 JSONObject legacyInfo() throws Exception {return new JSONObject().put("available",hasLegacy()).put("tasks",hasLegacy()?legacy.optJSONArray("tasks")==null?0:legacy.optJSONArray("tasks").length():0);}
 void adoptLegacy(boolean identityVerified) throws Exception {
  if(!identityVerified||subject.isEmpty()||!hasLegacy())throw new IllegalStateException("需要确认当前登录身份后才能恢复旧版数据");
  JSONArray previous=legacy.optJSONArray("tasks"), tasks=active.optJSONArray("tasks");if(tasks==null)tasks=new JSONArray();
  java.util.Set<String> ids=new java.util.HashSet<>();for(int i=0;i<tasks.length();i++)if(tasks.optJSONObject(i)!=null)ids.add(tasks.optJSONObject(i).optString("id"));
  if(previous!=null)for(int i=0;i<previous.length();i++){
   JSONObject task=previous.optJSONObject(i);if(task==null||ids.contains(task.optString("id")))continue;task=copy(task);task.put("subjectId",subject);
   String status=task.optString("status");
   if("pending".equals(status)||"draft".equals(status)||"checking".equals(status)){task.put("status","needs_auth");task.put("message","旧版计划已暂停，请核对本人身份和时间后重新建立");}
   else if("submitting".equals(status)||"verifying".equals(status)){task.put("status","uncertain");task.put("message","旧版操作结果待核验，未自动重发");}
   tasks.put(task);ids.add(task.optString("id"));
  }
  active.put("tasks",tasks);
  JSONArray oldFavorites=legacy.optJSONArray("favorites"),favorites=active.optJSONArray("favorites");if(favorites==null)favorites=new JSONArray();
  java.util.Set<String> keys=new java.util.HashSet<>();for(int i=0;i<favorites.length();i++)if(favorites.optJSONObject(i)!=null)keys.add(favorites.optJSONObject(i).optString("key"));
  if(oldFavorites!=null)for(int i=0;i<oldFavorites.length();i++){JSONObject item=oldFavorites.optJSONObject(i);if(item!=null&&!keys.contains(item.optString("key"))){favorites.put(copy(item));keys.add(item.optString("key"));}}active.put("favorites",favorites);
  // Exam caches and per-account study records remain quarantined; they need fresh school-owned evidence.
  legacy.put("adopted",true);replace(active);
 }
}
