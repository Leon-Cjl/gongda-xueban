param([string]$WebView2Dir)  # 放 Microsoft.Web.WebView2.Core.dll / WinForms.dll / WebView2Loader.dll 的目录，默认 .\tools\webview2
$ErrorActionPreference='Stop'
# 电脑版：.NET Framework 自带的 csc 编译，绿色免安装，输出 dist\工大学伴-电脑版-<版本>\
$taskRoot=$PSScriptRoot
$taskWebView=if($WebView2Dir){[IO.Path]::GetFullPath($WebView2Dir)}else{Join-Path $taskRoot 'tools\webview2'}
if(-not (Test-Path -LiteralPath "$taskWebView\Microsoft.Web.WebView2.Core.dll")){throw '缺少 WebView2 SDK 的 dll，见 README 的“构建”一节'}
$taskVersion=([xml](Get-Content -LiteralPath "$taskRoot\android\AndroidManifest.xml" -Raw -Encoding UTF8)).manifest.versionName
$taskOut="$taskRoot\dist";$taskName="工大学伴-电脑版-$taskVersion";$taskStage="$taskOut\$taskName"
if(Test-Path -LiteralPath $taskStage){Remove-Item -LiteralPath $taskStage -Recurse -Force}
New-Item -ItemType Directory -Path $taskStage -Force | Out-Null

Copy-Item -LiteralPath "$taskRoot\app" -Destination "$taskStage\app" -Recurse
& node "$taskRoot\tools\strip-comments.cjs" "$taskStage\app"
if($LASTEXITCODE -ne 0){throw 'Comment stripping failed'}
Copy-Item -LiteralPath "$taskRoot\windows\app.config" -Destination "$taskStage\工大学伴.exe.config"
Get-ChildItem -LiteralPath $taskWebView -Filter '*.dll' | Where-Object Name -ne 'Microsoft.Web.WebView2.Wpf.dll' | Copy-Item -Destination $taskStage
$taskSource="$taskOut\Program.cs"
$taskText=[IO.File]::ReadAllText("$taskRoot\windows\Program.cs",[Text.Encoding]::UTF8)
$taskText=[regex]::Replace($taskText,'Assembly(File)?Version\("[0-9.]+"\)',"Assembly`$1Version(`"$taskVersion.0`")")
[IO.File]::WriteAllText($taskSource,$taskText,[Text.UTF8Encoding]::new($true))
$taskCompiler='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $taskCompiler /nologo /target:winexe /platform:x64 /optimize+ /win32manifest:"$taskRoot\windows\app.manifest" "/win32icon:$taskRoot\windows\campus.ico" "/resource:$taskRoot\windows\campus.ico,Campus.Icon" /out:"$taskStage\工大学伴.exe" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll /reference:System.Security.dll /reference:"$taskStage\Microsoft.Web.WebView2.Core.dll" /reference:"$taskStage\Microsoft.Web.WebView2.WinForms.dll" $taskSource
if($LASTEXITCODE -ne 0){throw 'Windows compilation failed'}
Remove-Item -LiteralPath $taskSource
Get-Item -LiteralPath "$taskStage\工大学伴.exe" | Select-Object FullName,Length
