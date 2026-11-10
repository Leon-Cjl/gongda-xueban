param([string]$AppDirectory='',[ValidateSet('public')][string]$Edition='public',[string]$Version='')
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskStage=Join-Path $taskRoot 'android/build/emulator-debug'
$taskJdk=(Get-ChildItem -LiteralPath "$taskRoot/tools/jdk" -Directory | Select-Object -First 1).FullName
$taskPlatform=Get-ChildItem -LiteralPath "$taskRoot/tools/android-platform" -Filter android.jar -Recurse | Select-Object -First 1 -ExpandProperty FullName
$taskBuild=(Get-ChildItem -LiteralPath "$taskRoot/tools/android-build" -Filter aapt2.exe -Recurse | Select-Object -First 1).Directory.FullName
$taskPrepare=@("$PSScriptRoot/prepare-emulator.py",$taskStage,'--edition',$Edition)
if($AppDirectory){$taskPrepare+=@('--app-dir',$AppDirectory)}
if($Version){$taskPrepare+=@('--version',$Version)}
& py -3.12 @taskPrepare
if($LASTEXITCODE){throw 'Debug staging failed'}
New-Item -ItemType Directory -Force -Path "$taskStage/classes","$taskStage/dex" | Out-Null
$taskSources=@(Get-ChildItem -LiteralPath "$taskRoot/android/src" -Filter '*.java' -Recurse | Select-Object -ExpandProperty FullName)+@(Get-ChildItem -LiteralPath "$PSScriptRoot/android" -Filter '*.java' | Select-Object -ExpandProperty FullName)
& "$taskJdk/bin/javac.exe" -encoding UTF-8 -source 8 -target 8 -classpath $taskPlatform -d "$taskStage/classes" $taskSources
if($LASTEXITCODE){throw 'Debug Java compilation failed'}
$taskClasses=Get-ChildItem -LiteralPath "$taskStage/classes" -Filter '*.class' -Recurse | Select-Object -ExpandProperty FullName
& "$taskJdk/bin/java.exe" -cp "$taskBuild/lib/d8.jar" com.android.tools.r8.D8 --min-api 24 --lib $taskPlatform --output "$taskStage/dex" $taskClasses
if($LASTEXITCODE){throw 'Debug DEX failed'}
& "$taskBuild/aapt2.exe" compile --dir "$taskStage/res" -o "$taskStage/resources.zip"
if($LASTEXITCODE){throw 'Debug resources failed'}
& "$taskBuild/aapt2.exe" link -I $taskPlatform --manifest "$taskStage/AndroidManifest.xml" -A "$taskStage/assets" -o "$taskStage/unsigned.apk" "$taskStage/resources.zip"
if($LASTEXITCODE){throw 'Debug packaging failed'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskZip=[IO.Compression.ZipFile]::Open("$taskStage/unsigned.apk",[IO.Compression.ZipArchiveMode]::Update)
try{[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskZip,"$taskStage/dex/classes.dex",'classes.dex')|Out-Null}finally{$taskZip.Dispose()}
& py -3.12 "$PSScriptRoot/prepare-emulator.py" $taskStage normalize
if($LASTEXITCODE){throw 'Debug ZIP normalization failed'}
& "$taskBuild/zipalign.exe" -f -p 4 "$taskStage/unsigned.apk" "$taskStage/aligned.apk"
if($LASTEXITCODE){throw 'Debug alignment failed'}
$taskKey="$taskStage/debug.keystore"
if(-not(Test-Path -LiteralPath $taskKey)){
 & "$taskJdk/bin/keytool.exe" -genkeypair -keystore $taskKey -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Android Debug,O=Android,C=US' -noprompt
 if($LASTEXITCODE){throw 'Debug key generation failed'}
}
& "$taskJdk/bin/java.exe" -jar "$taskBuild/lib/apksigner.jar" sign --ks $taskKey --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$taskStage/gongda-emulator-debug.apk" "$taskStage/aligned.apk"
if($LASTEXITCODE){throw 'Debug signing failed'}
& "$taskJdk/bin/java.exe" -jar "$taskBuild/lib/apksigner.jar" verify "$taskStage/gongda-emulator-debug.apk"
if($LASTEXITCODE){throw 'Debug signature verification failed'}
Get-Item -LiteralPath "$taskStage/gongda-emulator-debug.apk" | Select-Object FullName,Length
