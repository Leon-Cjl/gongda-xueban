package cn.qlucampus.personal;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/** 控制中心“入馆码”磁贴：只在控制中心展开时由系统绑定，不常驻后台。 */
public class PassTileService extends TileService {
 @Override public void onStartListening(){
  Tile tile=getQsTile();
  if(tile==null)return;
  tile.setState(Tile.STATE_INACTIVE);
  if(Build.VERSION.SDK_INT>=29)tile.setSubtitle("工大学伴");
  tile.updateTile();
 }
 @Override public void onClick(){
  if(isLocked())unlockAndRun(this::openPass);else openPass();
 }
 void openPass(){
  Intent intent=new Intent(this,MainActivity.class).setAction(MainActivity.ACTION_PASS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);
  if(Build.VERSION.SDK_INT>=34)startActivityAndCollapse(PendingIntent.getActivity(this,3,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
  else startActivityAndCollapse(intent);
 }
}
