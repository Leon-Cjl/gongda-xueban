param(
 [string]$ToolsRoot,     # 放 jdk / android-platform / android-build 的目录，默认 .\tools
 [string]$KeyStorePath,  # 自己的签名；不给就在 android\signing 里生成一把本机签名（不进 git）
 [string]$KeyAlias='gongda'
)
$ErrorActionPreference='Stop'
# 安卓包：javac → d8 → aapt2 → zipalign → apksigner。不需要 Gradle。
# 工具目录结构：tools\jdk\<JDK 17>\bin\javac.exe、tools\android-platform\**\android.jar、tools\android-build\**\aapt2.exe（build-tools 35）
$taskRoot=$PSScriptRoot
$taskTools=if($ToolsRoot){[IO.Path]::GetFullPath($ToolsRoot)}else{Join-Path $taskRoot 'tools'}
$taskJdk=(Get-ChildItem -LiteralPath "$taskTools\jdk" -Directory | Select-Object -First 1).FullName
$taskPlatform=Get-ChildItem -LiteralPath "$taskTools\android-platform" -Filter android.jar -Recurse | Select-Object -First 1 -ExpandProperty FullName
$taskBuild=(Get-ChildItem -LiteralPath "$taskTools\android-build" -Filter aapt2.exe -Recurse | Select-Object -First 1).Directory.FullName
if(-not $taskJdk -or -not $taskPlatform -or -not $taskBuild){throw '缺少 JDK、android.jar 或 build-tools，见 README 的“构建”一节'}
$taskManifest="$taskRoot\android\AndroidManifest.xml"
$taskVersion=([xml](Get-Content -LiteralPath $taskManifest -Raw -Encoding UTF8)).manifest.versionName
$taskStage="$taskRoot\android\build";$taskOut="$taskRoot\dist"
if(Test-Path -LiteralPath $taskStage){Remove-Item -LiteralPath $taskStage -Recurse -Force}
New-Item -ItemType Directory -Path $taskStage,$taskOut,"$taskStage\classes","$taskStage\dex" -Force | Out-Null

# 1. Java
$taskSources=Get-ChildItem -LiteralPath "$taskRoot\android\src" -Filter '*.java' -Recurse | Select-Object -ExpandProperty FullName
& "$taskJdk\bin\javac.exe" -encoding UTF-8 -source 8 -target 8 -classpath $taskPlatform -d "$taskStage\classes" $taskSources
if($LASTEXITCODE -ne 0){throw 'Java compilation failed'}
$taskClassFiles=Get-ChildItem -LiteralPath "$taskStage\classes" -Filter '*.class' -Recurse | Select-Object -ExpandProperty FullName
& "$taskJdk\bin\java.exe" -cp "$taskBuild\lib\d8.jar" com.android.tools.r8.D8 --min-api 24 --lib $taskPlatform --output "$taskStage\dex" $taskClassFiles
if($LASTEXITCODE -ne 0){throw 'D8 failed'}

# 2. 界面：去掉整行注释后打进 assets
Copy-Item -LiteralPath "$taskRoot\app" -Destination "$taskStage\app" -Recurse
& node "$taskRoot\tools\strip-comments.cjs" "$taskStage\app"
if($LASTEXITCODE -ne 0){throw 'Comment stripping failed'}

# 3. 资源与打包
& "$taskBuild\aapt2.exe" compile --dir "$taskRoot\android\res" -o "$taskStage\resources.zip"
if($LASTEXITCODE -ne 0){throw 'Resource compilation failed'}
& "$taskBuild\aapt2.exe" link -I $taskPlatform --manifest $taskManifest -A "$taskStage\app" -o "$taskStage\unsigned.apk" "$taskStage\resources.zip"
if($LASTEXITCODE -ne 0){throw 'Resource packaging failed'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskArchive=[System.IO.Compression.ZipFile]::Open("$taskStage\unsigned.apk",[System.IO.Compression.ZipArchiveMode]::Update)
try{[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive,"$taskStage\dex\classes.dex",'classes.dex') | Out-Null}finally{$taskArchive.Dispose()}
& "$taskBuild\zipalign.exe" -f -p 4 "$taskStage\unsigned.apk" "$taskStage\aligned.apk"
if($LASTEXITCODE -ne 0){throw 'Zip alignment failed'}

# 4. 签名：用你给的 keystore（apksigner 会交互式询问密码），否则在 android\signing 生成一把本机签名
$taskApk="$taskOut\工大学伴-$taskVersion.apk"
if($KeyStorePath){
 & "$taskJdk\bin\java.exe" -jar "$taskBuild\lib\apksigner.jar" sign --ks ([IO.Path]::GetFullPath($KeyStorePath)) --ks-key-alias $KeyAlias --out $taskApk "$taskStage\aligned.apk"
}else{
 $taskKey="$taskRoot\android\signing\local.jks";$taskPassFile="$taskRoot\android\signing\local.pass"
 if(-not (Test-Path -LiteralPath $taskKey)){
  New-Item -ItemType Directory -Path "$taskRoot\android\signing" -Force | Out-Null
  $taskPass=-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 24 | ForEach-Object {[char]$_})
  [IO.File]::WriteAllText($taskPassFile,$taskPass,[Text.UTF8Encoding]::new($false))
  & "$taskJdk\bin\keytool.exe" -genkeypair -keystore $taskKey -storepass $taskPass -keypass $taskPass -alias $KeyAlias -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Local Build' -noprompt
  if($LASTEXITCODE -ne 0){throw 'Signing key generation failed'}
 }
 $taskPass=[IO.File]::ReadAllText($taskPassFile).Trim()
 & "$taskJdk\bin\java.exe" -jar "$taskBuild\lib\apksigner.jar" sign --ks $taskKey --ks-key-alias $KeyAlias --ks-pass "pass:$taskPass" --key-pass "pass:$taskPass" --out $taskApk "$taskStage\aligned.apk"
}
if($LASTEXITCODE -ne 0){throw 'APK signing failed'}
& "$taskJdk\bin\java.exe" -jar "$taskBuild\lib\apksigner.jar" verify $taskApk
if($LASTEXITCODE -ne 0){throw 'APK signature verification failed'}
Get-Item -LiteralPath $taskApk | Select-Object FullName,Length
