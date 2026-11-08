"""Stage latest personal UI and an isolated synthetic activity; never alter release files."""
from pathlib import Path
import argparse, json, shutil, sys, zipfile

root=Path(__file__).resolve().parents[1]
stage=Path(sys.argv[1]).resolve()
if len(sys.argv)>2 and sys.argv[2]=='normalize':
    apk=stage/'unsigned.apk'
    with zipfile.ZipFile(apk) as z: entries=[(i.filename.replace('\\','/'),z.read(i)) for i in z.infolist()]
    with zipfile.ZipFile(apk,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for name,data in entries: z.writestr(name,data,compress_type=zipfile.ZIP_STORED if name=='resources.arsc' else zipfile.ZIP_DEFLATED)
    raise SystemExit
parser=argparse.ArgumentParser()
parser.add_argument('--app-dir',type=Path)
parser.add_argument('--edition',choices=['personal','public'],default='personal')
parser.add_argument('--version')
options=parser.parse_args(sys.argv[2:])
stage.mkdir(parents=True,exist_ok=True)
import xml.etree.ElementTree as ET
version=ET.parse(root/'android/AndroidManifest.xml').getroot().get('{http://schemas.android.com/apk/res/android}versionName')
assets=stage/'assets'
if assets.exists():
    assert stage.is_relative_to((root/'android/build').resolve()) and assets.resolve().is_relative_to(stage), 'Unsafe QA asset cleanup'
    shutil.rmtree(assets)
shutil.copytree(options.app_dir.resolve() if options.app_dir else root/'app',assets,dirs_exist_ok=True)
(assets/'edition.js').write_text(f"window.CampusEdition='{options.edition}';window.CampusEditionVersion='{options.version or version}';",encoding='utf-8')
shutil.copy2(root/'android/public/donate.png',assets/'donate.png')
index=(assets/'index.html').read_bytes().decode('utf-8')
import re
index=re.sub(r'工大学伴 [0-9.]+ · 个人使用版','工大学伴 '+version+' 调试',index)
(assets/'index.html').write_bytes(index.encode('utf-8'))
qa=assets/'qa';shutil.copytree(assets,qa,ignore=shutil.ignore_patterns('qa'),dirs_exist_ok=True)
for name in ['mock-android.js','phone-acceptance.js','qa-clock.js']: shutil.copy2(root/'tests'/name,qa/name)
(qa/'qa-platform.js').write_text("window.CampusPlatform='android';window.NativeHost={};if(location.pathname.endsWith('/acceptance.html'))localStorage.clear();",encoding='utf-8')
preview=index.replace('<script src="boot.js">','<script src="qa-platform.js"></script><script src="boot.js">',1).replace('<script src="core.js">','<script src="mock-android.js"></script><script src="core.js">',1)
(qa/'index.html').write_bytes(preview.encode('utf-8'))
acceptance=preview.replace('<head>','<head><script src="qa-clock.js"></script>',1).replace('<script src="ui.js"></script>','<script src="ui.js"></script><script src="phone-acceptance.js"></script>',1)
(qa/'acceptance.html').write_bytes(acceptance.encode('utf-8'))
shutil.copytree(root/'android/res',stage/'res',dirs_exist_ok=True)
package='cn.qlucampus.gongda.debug'
shortcuts=stage/'res/xml/shortcuts.xml'
shortcuts.write_bytes(shortcuts.read_bytes().replace(b'cn.qlucampus.personal',package.encode()))
manifest=(root/'android/AndroidManifest.xml').read_bytes().decode('utf-8')
manifest=manifest.replace('package="cn.qlucampus.personal"',f'package="{package}"').replace('android:name=".','android:name="cn.qlucampus.personal.')
manifest=manifest.replace('android:label="工大学伴"','android:label="工大学伴·调试" android:debuggable="true" android:testOnly="true"')
manifest=manifest.replace('</application>','<activity android:name="cn.qlucampus.personal.EmulatorActivity" android:exported="true" android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden|uiMode" android:windowSoftInputMode="adjustResize"/></application>')
(stage/'AndroidManifest.xml').write_bytes(manifest.encode('utf-8'))
manifest=manifest.replace('</application>','<activity android:name="cn.qlucampus.personal.BridgeAcceptanceActivity" android:exported="true"/></application>')
manifest=manifest.replace('</application>','<activity android:name="cn.qlucampus.personal.HostAcceptanceActivity" android:exported="true"/></application>')
(stage/'AndroidManifest.xml').write_bytes(manifest.encode('utf-8'))
print(json.dumps({'package':package,'hostVersion':version,'edition':options.edition,'uiVersion':options.version or version,'assetsBytes':sum(p.stat().st_size for p in assets.rglob('*') if p.is_file())}))
