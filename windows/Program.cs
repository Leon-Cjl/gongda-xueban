using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

// 通知（系统 toast）显示的来源名取自 FileDescription = AssemblyTitle
[assembly: System.Reflection.AssemblyTitle("工大学伴")]
[assembly: System.Reflection.AssemblyProduct("工大学伴")]
[assembly: System.Reflection.AssemblyDescription("工大学伴")]
[assembly: System.Reflection.AssemblyVersion("0.9.25.0")]
[assembly: System.Reflection.AssemblyFileVersion("0.9.25.0")]

static class Program {
 [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
 [DllImport("shcore.dll")] static extern int SetProcessDpiAwareness(int awareness);
 [STAThread] static void Main(string[] args) {
  try{SetProcessDpiAwarenessContext(new IntPtr(-4));}catch{try{SetProcessDpiAwareness(2);}catch{}}
  bool selftest=args.Contains("--selftest")||args.Contains("--ui-test"), created;
  int wipe=Array.IndexOf(args,"--wipe");if(wipe>=0&&!selftest&&CampusForm.PublicBuild(CampusForm.AppRoot)){int pid;if(wipe+1<args.Length&&int.TryParse(args[wipe+1],out pid)){try{System.Diagnostics.Process.GetProcessById(pid).WaitForExit(15000);}catch{}}CampusForm.WipeData(Path.Combine(CampusForm.AppRoot,"data"));}
  using(var mutex=new Mutex(true,selftest?"QluCampusSelfTest":CampusForm.PublicBuild(CampusForm.AppRoot)?"GongdaXuebanApp":"QluCampusPersonalApp",out created)) {
   if(!created){MessageBox.Show("工大学伴已经运行，请从系统托盘打开。","工大学伴");return;}
   Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
   Application.Run(new CampusForm(selftest,args.Contains("--ui-test")));
  }
 }
}

sealed class CampusForm:Form {
 const string Library="https://libyuyue.qlu.edu.cn/h5/index.html#/mo/home";
 const string Teaching="https://jw.qlu.edu.cn/sso/ddlogin";
 const string StudentMenu="https://jw.qlu.edu.cn/jwglxt/xtgl/index_initMenu.html?jsdm=xs&echarts=1";
 readonly string root=AppDomain.CurrentDomain.BaseDirectory, dataDir;
 internal static readonly string AppRoot=AppDomain.CurrentDomain.BaseDirectory;
 // 发布版（app\edition.js 标为 public）：单账号；数据放在程序旁的 data 文件夹，删掉程序文件夹即全部删除。
 static bool? publicBuild;
 internal static bool PublicBuild(string appRoot){if(publicBuild==null){try{publicBuild=File.ReadAllText(Path.Combine(appRoot,"app","edition.js")).Contains("'public'");}catch{publicBuild=false;}}return publicBuild.Value;}
 // 撤回同意：只删本应用写下的文件和目录（WebView2 子进程退出稍慢，删不掉时重试几秒）。
 internal static void WipeData(string dir){if(!Directory.Exists(dir))return;for(int i=0;i<20;i++){bool left=false;foreach(var f in new[]{"vault.bin","vault.bin.tmp","state.json","state.json.tmp","教学查询诊断.json","教学查询诊断.json.tmp"}){var p=Path.Combine(dir,f);try{if(File.Exists(p))File.Delete(p);}catch{left=true;}}foreach(var d in new[]{"webview","profiles"}){var p=Path.Combine(dir,d);try{if(Directory.Exists(p))Directory.Delete(p,true);}catch{left=true;}}if(!left)return;Thread.Sleep(500);}}
 async void QuitSoon(bool wipe){await Task.Delay(200);if(wipe){try{System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(Application.ExecutablePath,"--wipe "+System.Diagnostics.Process.GetCurrentProcess().Id){UseShellExecute=false,WorkingDirectory=root});}catch{}}exiting=true;Close();}
 readonly JavaScriptSerializer json=new JavaScriptSerializer{MaxJsonLength=16*1024*1024};
 readonly WebView2 ui=new WebView2();
 readonly Dictionary<string,WebView2> school=new Dictionary<string,WebView2>();
 readonly Dictionary<string,TaskCompletionSource<Dictionary<string,object>>> requests=new Dictionary<string,TaskCompletionSource<Dictionary<string,object>>>();
 readonly Panel official=new Panel{Dock=DockStyle.Fill,Visible=false};
 readonly Panel bar=new Panel{Dock=DockStyle.Top,Height=44,BackColor=Color.FromArgb(232,240,229)};
 readonly Button done=new Button{Text="完成操作，返回助手",Dock=DockStyle.Right,Width=190};
 readonly Label officialTitle=new Label{Text="学校官方页面",Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleLeft};
 readonly NotifyIcon tray=new NotifyIcon{Text="工大学伴",Visible=false};
 readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer{Interval=500};
 Dictionary<string,object> vault=new Dictionary<string,object>(),appState=new Dictionary<string,object>();
 string current="library",currentAccountId="default";bool exiting,selftest,uiReady;
 // 自动填写标记按系统分开：教务的后台连接不会重新打开图书馆页的自动填写，反之亦然。
 sealed class AccountRuntime{public bool AutoUsed,AutoRequested,TeachAutoUsed,TeachAutoRequested,TeachingNavFailed,TeachingStuck,RestoreTried,StudentRoleRequested;public int SloginRedirects;public DateTime RestoreAt;public string BootstrapId="";}
 readonly Dictionary<string,AccountRuntime> runtimes=new Dictionary<string,AccountRuntime>();
 readonly Dictionary<string,Task<WebView2>> schoolReady=new Dictionary<string,Task<WebView2>>();
 readonly Dictionary<string,Task<CoreWebView2Environment>> environments=new Dictionary<string,Task<CoreWebView2Environment>>();
 readonly Dictionary<string,string> requestOwners=new Dictionary<string,string>();
 readonly Dictionary<string,Task<object>> teachingConnects=new Dictionary<string,Task<object>>();string notifyPage="";bool teachingAutoReturn;
 string ActiveAccountId{get{return Str(vault,"activeAccountId");}}
 Dictionary<string,object> Accounts(){return Obj(vault,"accounts");}
 string AccountId(string id=null){if(String.IsNullOrEmpty(id))id=ActiveAccountId;if(!Accounts().ContainsKey(id)||!(id=="default"||System.Text.RegularExpressions.Regex.IsMatch(id,"^a[0-9a-f]{32}$")))throw new Exception("账号不存在，请重新选择");return id;}
 Dictionary<string,object> Account(string id=null){return Obj(Accounts(),AccountId(id));}
 AccountRuntime Runtime(string id){AccountRuntime r;if(!runtimes.TryGetValue(id,out r)){r=new AccountRuntime();runtimes[id]=r;}return r;}
 string ProfileFolder(string id){id=AccountId(id);return id=="default"?Path.Combine(dataDir,"webview"):Path.Combine(dataDir,"profiles",id,"webview");}
 void InitializeAccounts(){if(Accounts().Count==0){string legacy=Path.Combine(dataDir,"vault.bin"),backup=Path.Combine(dataDir,"vault-v0.3-backup.bin");if(File.Exists(legacy)&&!File.Exists(backup))File.Copy(legacy,backup);var original=new Dictionary<string,object>(vault);original.Remove("accounts");original.Remove("activeAccountId");original["label"]="我的账号";vault=new Dictionary<string,object>{{"accounts",new Dictionary<string,object>{{"default",original}}},{"activeAccountId","default"}};}if(!Accounts().ContainsKey(ActiveAccountId))vault["activeAccountId"]=Accounts().Keys.First();}
 object AccountState(){return new{activeAccountId=ActiveAccountId,accounts=Accounts().Select(x=>{var a=(Dictionary<string,object>)x.Value;return new{id=x.Key,label=Str(a,"label"),username=Str(a,"username"),hasCredentials=!String.IsNullOrEmpty(Str(a,"password")),hasSession=!String.IsNullOrEmpty(Str(a,"token"))};}).ToArray()};}
 object ManageAccounts(Dictionary<string,object> d){string action=Str(d,"action");if(action=="add")throw new Exception("只能使用本人账号");else if(action=="switch")vault["activeAccountId"]=AccountId(Str(d,"accountId"));else if(action!="list")throw new Exception("未知账号操作");SaveVault();return AccountState();}
 bool AccountExecuting(string id){object rows;if(!appState.TryGetValue("tasks",out rows))return false;var list=rows as System.Collections.IEnumerable;return list!=null&&list.Cast<object>().OfType<Dictionary<string,object>>().Any(t=>(String.IsNullOrEmpty(Str(t,"accountId"))?"default":Str(t,"accountId"))==id&&new[]{"checking","submitting","verifying"}.Contains(Str(t,"status")));}
 void StoreCredentials(Dictionary<string,object> d){string id=AccountId(Str(d,"accountId")),username=Str(d,"username").Trim(),password=Str(d,"password");if(AccountExecuting(id))throw new Exception("该账号任务正在执行，完成后再修改凭据");if(username==""||password=="")throw new Exception("请填写学号和密码");var a=Account(id);if(Str(a,"username")!=""&&Str(a,"username")!=username&&Str(a,"token")!="")throw new Exception("该账号已绑定学号，请切换到另一个账号配置");if(Accounts().Any(x=>x.Key!=id&&Str((Dictionary<string,object>)x.Value,"username")==username))throw new Exception("两个账号不能使用同一学号");a["username"]=username;a["password"]=password;a["remember"]=Bool(d,"remember");string label=Str(d,"label").Trim();if(label!="")a["label"]=label.Substring(0,Math.Min(20,label.Length));Runtime(id).RestoreTried=false;SaveVault();}
 bool dark;int captionResult;readonly bool fixture;int fixtureSubmits,fixtureLeaves,fixtureCancels;bool fixtureAway;
 [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd,int attribute,ref int value,int size);
 public CampusForm(bool test,bool uiTest) {
  fixture=uiTest;
  selftest=test;dataDir=test?Path.Combine(root,"qa-data"):PublicBuild(root)?Path.Combine(root,"data"):DataDirectory(root);Directory.CreateDirectory(dataDir);
  Text="工大学伴";AutoScaleMode=AutoScaleMode.Dpi;AutoScaleDimensions=new SizeF(96,96);Width=1180;Height=850;MinimumSize=new Size(410,650);StartPosition=FormStartPosition.CenterScreen;KeyPreview=true;
  using(var stream=typeof(CampusForm).Assembly.GetManifestResourceStream("Campus.Icon"))using(var embedded=new Icon(stream,32,32))Icon=(Icon)embedded.Clone();tray.Icon=Icon;
  try{using(var key=Registry.CurrentUser.OpenSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize"))dark=Convert.ToInt32(key.GetValue("AppsUseLightTheme",1))==0;}catch{}
  HandleCreated+=(s,e)=>ApplyTheme(dark);
  ui.Dock=DockStyle.Fill;Controls.Add(ui);bar.Controls.Add(officialTitle);bar.Controls.Add(done);official.Controls.Add(bar);Controls.Add(official);
  done.Click+=async(s,e)=>await CloseOfficial();
  KeyDown+=async(s,e)=>{if(e.KeyCode==Keys.Escape&&official.Visible){e.Handled=true;await CloseOfficial();}};
  tray.DoubleClick+=(s,e)=>Restore();tray.BalloonTipClicked+=async(s,e)=>{Restore();string page=notifyPage;if(page!=""){try{if(official.Visible)await CloseOfficial();await Ui(new{@event="navigate",page=page});}catch{}}};var menu=new ContextMenuStrip();menu.Items.Add("打开工大学伴",null,(s,e)=>Restore());menu.Items.Add("退出",null,(s,e)=>{Restore();Close();});tray.ContextMenuStrip=menu;
  Resize+=(s,e)=>{if(WindowState==FormWindowState.Minimized){tray.Visible=true;Hide();}};
  FormClosing+=OnClosing;
  timer.Tick+=async(s,e)=>{if(uiReady)try{await ui.CoreWebView2.ExecuteScriptAsync("window.Campus && window.Campus.tick()");}catch{}};
  Load+=async(s,e)=>{try{await Start();if(!selftest)tray.Visible=true;}catch(Exception x){if(selftest){File.WriteAllText(Path.Combine(root,"selftest-error.txt"),x.ToString());exiting=true;Close();}else MessageBox.Show("客户端初始化失败："+x.Message,"工大学伴");}};
 }
 async Task Start(){
  appState=fixture?new Dictionary<string,object>():ReadJson(Path.Combine(dataDir,"state.json"));vault=fixture?new Dictionary<string,object>():ReadVault();InitializeAccounts();
  var env=await EnvironmentFor("default");
  await ui.EnsureCoreWebView2Async(env);ui.CoreWebView2.Settings.AreHostObjectsAllowed=false;ui.CoreWebView2.Settings.AreDevToolsEnabled=false;
  ui.CoreWebView2.SetVirtualHostNameToFolderMapping("campus.local",Path.Combine(root,"app"),CoreWebView2HostResourceAccessKind.Deny);
  ui.CoreWebView2.NavigationStarting+=(s,e)=>{Uri u;if(!Uri.TryCreate(e.Uri,UriKind.Absolute,out u)||u.Host!="campus.local")e.Cancel=true;};
  await ui.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync((fixture?"window.CampusFixedDay=true;":"")+"window.CampusPlatform=\"windows\";document.addEventListener(\"DOMContentLoaded\",()=>document.documentElement.dataset.platform=\"windows\");");
  ui.CoreWebView2.WebMessageReceived+=OnUiMessage;
  ui.CoreWebView2.NavigationCompleted+=async(s,e)=>{
   if(!e.IsSuccess)return;uiReady=true;timer.Start();
   if(selftest){await Task.Delay(1800);if(fixture){object adapter;try{adapter=await TestSchoolAdapter(env);}catch(Exception x){adapter=new{ok=false,error=x.Message};}File.WriteAllText(Path.Combine(root,"adapter-preflight.json"),json.Serialize(adapter),Encoding.UTF8);await ui.CoreWebView2.ExecuteScriptAsync(File.ReadAllText(Path.Combine(root,"qa","ui-acceptance.js")));for(int i=0;i<100;i++){await Task.Delay(200);if(await ui.CoreWebView2.ExecuteScriptAsync("!!window.UIAcceptanceResult")=="true")break;}}
    var type=await ui.CoreWebView2.ExecuteScriptAsync("JSON.stringify({title:document.title,core:typeof CampusCore.Booker,ui:typeof Campus.receive,ready:window.CampusRuntimeReady===true,acceptance:window.UIAcceptanceResult,body:document.body.innerText})");
    var result=new Dictionary<string,object>{{"webviewLoaded",true},{"page",type},{"dpapiRoundTrip",TestEncryption()},{"accountVault",TestAccountVault()},{"profileIsolation",fixture?(object)await TestProfileIsolation():null},{"detectsPersistedTasks",TestTaskDetection()},{"dataMigration",TestDataMigration()},{"captionColorResult",captionResult},{"dpiScale",CreateGraphics().DpiX/96f}};
    File.WriteAllText(Path.Combine(root,"selftest.json"),json.Serialize(result),Encoding.UTF8);
    using(var stream=File.Create(Path.Combine(root,"selftest.png")))await ui.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);
    if(fixture){File.WriteAllText(Path.Combine(root,"ui-state.json"),json.Serialize(new{state=appState,submissions=fixtureSubmits,temporaryLeaves=fixtureLeaves,cancels=fixtureCancels}));ClientSize=new Size(475,950);await Task.Delay(500);using(var stream=File.Create(Path.Combine(root,"selftest-mobile.png")))await ui.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);}
    exiting=true;Close();}
  };
  ui.CoreWebView2.Navigate("https://campus.local/index.html");
 }
 void ApplyTheme(bool value){dark=value;BackColor=value?Color.FromArgb(17,22,17):Color.FromArgb(247,250,245);bar.BackColor=value?Color.FromArgb(39,53,40):Color.FromArgb(232,240,229);officialTitle.ForeColor=value?Color.FromArgb(225,233,223):Color.FromArgb(27,36,29);done.BackColor=bar.BackColor;done.ForeColor=officialTitle.ForeColor;done.FlatStyle=FlatStyle.Flat;done.FlatAppearance.BorderSize=0;
  if(!IsHandleCreated)return;try{int enabled=value?1:0;DwmSetWindowAttribute(Handle,20,ref enabled,4);int background=ColorTranslator.ToWin32(BackColor),text=ColorTranslator.ToWin32(officialTitle.ForeColor);captionResult=DwmSetWindowAttribute(Handle,35,ref background,4);DwmSetWindowAttribute(Handle,36,ref text,4);}catch{captionResult=-1;}}
 async Task CloseOfficial(){official.Visible=false;teachingAutoReturn=false;await Probe(current,currentAccountId);}

 bool TestTaskDetection(){var previous=appState;try{appState=json.Deserialize<Dictionary<string,object>>("{\"tasks\":[{\"status\":\"pending\"}]}");return HasTasks();}finally{appState=previous;}}
 bool TestDataMigration(){string project=Path.Combine(dataDir,"migration-check",Guid.NewGuid().ToString("N"),"齐鲁校园助手"),app=Path.Combine(project,"Windows_v0.3.0"),previous=Path.Combine(project,"Windows_v0.2.0","data");Directory.CreateDirectory(app);Directory.CreateDirectory(Path.Combine(previous,"webview"));File.WriteAllText(Path.Combine(previous,"state.json"),"{}");string selected=DataDirectory(app);return selected==Path.Combine(project,"个人数据")&&File.Exists(Path.Combine(selected,"state.json"))&&!Directory.Exists(previous);}
 bool TestEncryption(){var b=Encoding.UTF8.GetBytes("local-encryption-test");return Encoding.UTF8.GetString(ProtectedData.Unprotect(ProtectedData.Protect(b,null,DataProtectionScope.CurrentUser),null,DataProtectionScope.CurrentUser))=="local-encryption-test";}
 bool TestAccountVault(){var original=vault;try{vault=new Dictionary<string,object>{{"username","fixture-one"},{"password","fixture-secret"},{"token","fixture-token"},{"remember",true}};InitializeAccounts();bool migrated=Str(Account("default"),"token")=="fixture-token";string id="a"+Guid.NewGuid().ToString("N");Accounts()[id]=new Dictionary<string,object>{{"username","fixture-two"},{"password","not-remembered"},{"remember",false},{"label","模拟同伴"}};vault["activeAccountId"]=id;SaveVault();var stored=ReadVault();bool separate=Str(Obj(Obj(stored,"accounts"),"default"),"password")=="fixture-secret"&&!Obj(Obj(stored,"accounts"),id).ContainsKey("password");string summary=json.Serialize(AccountState());return migrated&&separate&&!summary.Contains("\"password\"")&&!summary.Contains("\"token\"")&&Str(stored,"activeAccountId")==id;}finally{vault=original;SaveVault();}}
 async Task<object> TestProfileIsolation(){
  string id="a"+Guid.NewGuid().ToString("N");Accounts()[id]=new Dictionary<string,object>{{"label","隔离测试"}};var views=new List<WebView2>();
  try{
   foreach(string aid in new[]{"default",id}){var web=new WebView2{Width=1,Height=1,Visible=false};views.Add(web);Controls.Add(web);await web.EnsureCoreWebView2Async(await EnvironmentFor(aid));web.CoreWebView2.SetVirtualHostNameToFolderMapping("isolation.local",Path.Combine(root,"qa","fixtures"),CoreWebView2HostResourceAccessKind.Deny);var loaded=new TaskCompletionSource<bool>();web.CoreWebView2.NavigationCompleted+=(s,e)=>loaded.TrySetResult(e.IsSuccess);web.CoreWebView2.Navigate("https://isolation.local/isolation.html");if(await Task.WhenAny(loaded.Task,Task.Delay(8000))!=loaded.Task||!await loaded.Task)throw new Exception("Isolation fixture did not load");}
   await views[0].CoreWebView2.ExecuteScriptAsync("document.cookie='qaProfile=A; path=/';localStorage.setItem('qaProfile','A')");
   bool empty=await views[1].CoreWebView2.ExecuteScriptAsync("!document.cookie.includes('qaProfile=A')&&localStorage.getItem('qaProfile')===null")=="true";
   await views[1].CoreWebView2.ExecuteScriptAsync("document.cookie='qaProfile=B; path=/';localStorage.setItem('qaProfile','B')");
   bool preserved=await views[0].CoreWebView2.ExecuteScriptAsync("document.cookie.includes('qaProfile=A')&&!document.cookie.includes('qaProfile=B')&&localStorage.getItem('qaProfile')==='A'")=="true";
   return new{ok=empty&&preserved,cookiesIsolated=empty&&preserved,localStorageIsolated=empty&&preserved,profileDirectoriesDistinct=ProfileFolder("default")!=ProfileFolder(id),realNetworkRequests=0};
  }finally{foreach(var web in views){Controls.Remove(web);web.Dispose();}Accounts().Remove(id);}
 }
 async Task<object> TestSchoolAdapter(CoreWebView2Environment env){
  var web=new WebView2{Width=1,Height=1,Visible=false};Controls.Add(web);
  try{
   await web.EnsureCoreWebView2Async(env);web.CoreWebView2.SetVirtualHostNameToFolderMapping("jw.qlu.edu.cn",Path.Combine(root,"qa","fixtures"),CoreWebView2HostResourceAccessKind.Deny);
   await web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(File.ReadAllText(Path.Combine(root,"app","agent.js")));
   var replies=new Dictionary<string,TaskCompletionSource<Dictionary<string,object>>>();var loaded=new TaskCompletionSource<bool>();
   web.CoreWebView2.NavigationCompleted+=(s,e)=>loaded.TrySetResult(e.IsSuccess);
   web.CoreWebView2.WebMessageReceived+=(s,e)=>{var m=json.Deserialize<Dictionary<string,object>>(e.WebMessageAsJson);TaskCompletionSource<Dictionary<string,object>> t;if(replies.TryGetValue(Str(m,"id"),out t))t.TrySetResult(m);};
   web.CoreWebView2.Navigate("https://jw.qlu.edu.cn/home.html");if(await Task.WhenAny(loaded.Task,Task.Delay(8000))!=loaded.Task||!await loaded.Task)throw new Exception("Fixture navigation failed");
   Func<string,Dictionary<string,object>,Task<Dictionary<string,object>>> call=async(method,p)=>{var t=new TaskCompletionSource<Dictionary<string,object>>();replies[method]=t;await web.CoreWebView2.ExecuteScriptAsync("window.QluAgent.run("+json.Serialize(new{id=method,method=method,@params=p})+")");if(await Task.WhenAny(t.Task,Task.Delay(8000))!=t.Task)throw new Exception("Fixture adapter timeout: "+method);var r=await t.Task;if(!Bool(r,"ok"))throw new Exception(Str(Obj(r,"error"),"message"));return Obj(r,"data");};
   var options=await call("options",new Dictionary<string,object>());object yearRows;if(!options.TryGetValue("xnm",out yearRows)||!(yearRows is System.Collections.ICollection)||((System.Collections.ICollection)yearRows).Count!=2)throw new Exception("Combined semester parsing failed");
   var rooms=await call("rooms",new Dictionary<string,object>{{"year","2026"},{"term","3"},{"campus","1"},{"building","A"},{"week",7},{"weekday",2},{"periods",new[]{1,2}}});object roomRows;if(!rooms.TryGetValue("rooms",out roomRows)||!(roomRows is System.Collections.ICollection)||((System.Collections.ICollection)roomRows).Count!=1)throw new Exception("Iframe query did not produce a row");
   return new{ok=true,realWebViewDOM=true,embeddedPage=true,hiddenYearAndCombinedSemester=true,officialJQueryPath=true,realNetworkRequests=0};
  }finally{Controls.Remove(web);web.Dispose();}
 }
 Dictionary<string,object> ReadJson(string p){try{if(File.Exists(p))return json.Deserialize<Dictionary<string,object>>(File.ReadAllText(p));}catch{}return new Dictionary<string,object>();}
 Dictionary<string,object> ReadVault(){try{var p=Path.Combine(dataDir,"vault.bin");if(File.Exists(p))return json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(p),null,DataProtectionScope.CurrentUser)));}catch{}return new Dictionary<string,object>();}
 void SaveVault(){var stored=json.Deserialize<Dictionary<string,object>>(json.Serialize(vault));foreach(var value in Obj(stored,"accounts").Values){var a=(Dictionary<string,object>)value;if(!Bool(a,"remember"))a.Remove("password");}var b=ProtectedData.Protect(Encoding.UTF8.GetBytes(json.Serialize(stored)),null,DataProtectionScope.CurrentUser);Atomic(Path.Combine(dataDir,"vault.bin"),b);}
 void Atomic(string p,byte[] bytes){string temp=p+".tmp";File.WriteAllBytes(temp,bytes);if(File.Exists(p))File.Replace(temp,p,null);else File.Move(temp,p);}
 string Str(Dictionary<string,object> d,string key){object v;return d.TryGetValue(key,out v)&&v!=null?Convert.ToString(v):"";}
 bool Bool(Dictionary<string,object> d,string key){object v;return d.TryGetValue(key,out v)&&v is bool&&(bool)v;}
 Dictionary<string,object> Obj(Dictionary<string,object> d,string key){object v;return d.TryGetValue(key,out v)&&v is Dictionary<string,object>?(Dictionary<string,object>)v:new Dictionary<string,object>();}
 async Task Ui(object value){if(ui.CoreWebView2!=null)await ui.CoreWebView2.ExecuteScriptAsync("window.Campus.receive("+json.Serialize(value)+")");}
 async void OnUiMessage(object sender,CoreWebView2WebMessageReceivedEventArgs e){
  Uri source;if(!Uri.TryCreate(e.Source,UriKind.Absolute,out source)||source.Host!="campus.local")return;
  Dictionary<string,object> m;try{m=json.Deserialize<Dictionary<string,object>>(e.WebMessageAsJson);}catch{return;}
  string id=Str(m,"id");object output=null;try{var d=Obj(m,"data");string accountId=AccountId(Str(d,"accountId"));object result=null;switch(Str(m,"cmd")){
   case"ready":result=new{platform="windows",supportsAccounts=false,accountState=AccountState(),hasCredentials=!String.IsNullOrEmpty(Str(Account(),"password")),username=Str(Account(),"username"),state=appState};break;
   case"appearance":ApplyTheme(Bool(d,"dark"));result=true;break;
   case"saveState":if(!d.ContainsKey("tasks"))throw new Exception("缺少任务数据");appState=d;Atomic(Path.Combine(dataDir,"state.json"),Encoding.UTF8.GetBytes(json.Serialize(d)));result=true;break;
   case"accounts":result=ManageAccounts(d);break;
   case"credentials":StoreCredentials(d);result=AccountState();break;
   case"forgetCredentials":Account(accountId).Remove("password");SaveVault();result=AccountState();break;
   case"openLogin":await OpenLogin(Str(d,"system"),Bool(d,"auto"),accountId);result=true;break;
   case"openOfficial":officialArgs=d;await OpenOfficial(Str(d,"target"),accountId);result=true;break;
   case"library":if(fixture)result=FixtureCall("library",Str(d,"method"));else if(selftest)result=new{connected=false};else result=await LibraryCall(Str(d,"method"),Obj(d,"params"),accountId);break;
   case"teaching":result=fixture?FixtureCall("teaching",Str(d,"method")):await Call("teaching",Str(d,"method"),Obj(d,"params"),accountId);break;
   case"connectTeaching":result=fixture?(object)new{connected=true}:selftest?(object)new{connected=false,needsUser=false,page=""}:await ConnectTeaching(accountId,Bool(d,"fresh"));break;
   case"notify":result=new{shown=Notify(d)};break;
   case"exitApp":QuitSoon(false);result=true;break;
   case"resetAll":if(!PublicBuild(root)||selftest)throw new Exception("不支持的客户端操作");QuitSoon(true);result=true;break;
   default:throw new Exception("未知客户端操作");
  }output=new{id=id,ok=true,data=result};}
  catch(SchoolException x){output=new{id=id,ok=false,error=new{code=x.Code,message=x.Message,uncertain=x.Uncertain}};}
  catch(Exception x){output=new{id=id,ok=false,error=new{code="CLIENT",message=x.Message}};}
  if(Str(m,"cmd")=="teaching"&&!selftest)TeachingDiagnostic(Str(Obj(m,"data"),"method"),output);
  await Ui(output);
 }
 void TeachingDiagnostic(string method,object output){try{var result=json.Deserialize<Dictionary<string,object>>(json.Serialize(output));var d=Obj(result,"data");var err=Obj(result,"error");object rows;int count=d.TryGetValue("rooms",out rows)&&rows is System.Collections.ICollection?((System.Collections.ICollection)rows).Count:0;var record=new{version="0.4.0",time=DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(8)).ToString("o"),method=method,ok=Bool(result,"ok"),code=Str(err,"code"),message=Str(err,"message"),roomCount=count,total=Str(d,"total"),currentWeek=Str(d,"currentWeek")};Atomic(Path.Combine(dataDir,"教学查询诊断.json"),Encoding.UTF8.GetBytes(json.Serialize(record)));}catch{}}
 object FixtureCall(string system,string method){
  if(method=="status")return new{connected=true};
  if(system=="teaching"){
   if(method=="options")return new{currentWeek=7,xnm=new[]{new{value="2026",label="2026–2027",selected=true}},xqm=new[]{new{value="3",label="第 1 学期",selected=true}},xqh_id=new[]{new{value="1",label="测试校区",selected=true}},jxl_id=new[]{new{value="a",label="模拟教学楼",selected=true}}};
   if(method=="rooms")return new{total=2,rooms=new[]{new{id="r1",name="测试教室 101",campus="测试校区",building="模拟教学楼",capacity=60},new{id="r2",name="测试教室 102",campus="测试校区",building="模拟教学楼",capacity=80}}};
  }
  if(method=="catalog")return new{libraries=new[]{new{id="1",name="界面验收 · 模拟图书馆"}}};
  if(method=="areas")return new{areas=new[]{new{id="10",name="模拟阅览区 A",floor="二层",free=41,total=48}}};
  if(method=="seats")return new{areaId="10",name="模拟阅览区 A",kind=3,start="08:00",end="22:00",segments=new object[0],seats=Enumerable.Range(1,48).Select(i=>new{id=i,no=i.ToString("000"),available=i%7!=2,status=i%7!=2?1:2}).ToArray()};
  if(method=="current")return FixtureCurrent();
  if(method=="temporaryLeave"){fixtureLeaves++;fixtureAway=true;return new{verified=true,current=FixtureCurrent()};}
  if(method=="checkout"){fixtureCancels++;return new{verified=true,current=new object[0]};}
  if(method=="cancelBooking"){fixtureCancels++;return new{verified=true,records=new object[0]};}
  if(method=="records")return new object[0];
  if(method=="profile")return new{name="测试同学",card="2024000000",dept="测试学院",status="1",statusText="正常",validUntil="2028-06-30"};
  if(method=="violations")return new{total=1,items=new[]{new{area="模拟阅览区 A",seat="012",time="2026-10-01 08:30:00",status="未签到"}}};
  if(method=="rules")return new{text="模拟预约须知：预约开始后请按时签到。"};
  if(method=="reserve")fixtureSubmits++;
  throw new Exception("UI acceptance fixture never submits reservations");
 }
 object[] FixtureCurrent(){return new object[]{new{id="qa-reservation",type=1,no="001",nameMerge="模拟阅览区 A",statusMsg=fixtureAway?"暂离中":"使用中",canTemporaryLeave=!fixtureAway,temporarilyAway=fixtureAway}};}
 static string DataDirectory(string appRoot){
  string local=Path.Combine(appRoot,"data");var parent=Directory.GetParent(appRoot.TrimEnd(Path.DirectorySeparatorChar));
  // 交付目录：工大学伴\个人版\<版本>\电脑版（旧版在 个人版\旧版\<版本>\电脑版），账号数据放 个人版\个人数据，各版本共用
  for(var up=parent;up!=null&&up.Parent!=null;up=up.Parent){if(up.Name=="个人版"&&up.Parent.Name=="工大学伴"){string data=Path.Combine(up.FullName,"个人数据");Directory.CreateDirectory(data);return data;}if(up.Name=="齐鲁校园助手")break;}
  if(parent==null||parent.Name!="齐鲁校园助手")return local;
  string project=Path.GetFullPath(parent.FullName)+Path.DirectorySeparatorChar,shared=Path.GetFullPath(Path.Combine(project,"个人数据"));
  if(Directory.Exists(shared))return shared;
  foreach(var previous in Directory.GetDirectories(project,"Windows_v*").OrderByDescending(x=>x)){
   if(Path.GetFullPath(previous).TrimEnd(Path.DirectorySeparatorChar)==Path.GetFullPath(appRoot).TrimEnd(Path.DirectorySeparatorChar))continue;
   string source=Path.GetFullPath(Path.Combine(previous,"data"));
   if(!source.StartsWith(project,StringComparison.OrdinalIgnoreCase)||!shared.StartsWith(project,StringComparison.OrdinalIgnoreCase))throw new IOException("数据目录超出项目范围");
   if(!Directory.Exists(source)||!Directory.Exists(Path.Combine(source,"webview"))||(File.GetAttributes(source)&FileAttributes.ReparsePoint)!=0)continue;
   try{Directory.Move(source,shared);return shared;}catch(IOException){return source;}catch(UnauthorizedAccessException){return source;}
  }
  return shared;
 }
 Task<CoreWebView2Environment> EnvironmentFor(string accountId){accountId=AccountId(accountId);Task<CoreWebView2Environment> task;if(!environments.TryGetValue(accountId,out task)){task=CoreWebView2Environment.CreateAsync(null,ProfileFolder(accountId));environments[accountId]=task;}return task;}
 async Task<WebView2> EnsureSchool(string system,string accountId=null){
  accountId=AccountId(accountId);string key=system+":"+accountId;Task<WebView2> task;
  if(!schoolReady.TryGetValue(key,out task)){task=CreateSchool(system,accountId);schoolReady[key]=task;}
  try{return await task;}catch{schoolReady.Remove(key);throw;}
 }
 async Task<WebView2> CreateSchool(string system,string accountId){
  if(system!="library"&&system!="teaching")throw new Exception("未知学校入口");
  var web=new WebView2{Dock=DockStyle.Fill,Visible=false};school[system+":"+accountId]=web;official.Controls.Add(web);bar.BringToFront();
  await web.EnsureCoreWebView2Async(await EnvironmentFor(accountId));
  web.CoreWebView2.Settings.AreHostObjectsAllowed=false;web.CoreWebView2.Settings.AreDevToolsEnabled=false;web.CoreWebView2.Settings.IsStatusBarEnabled=true;
  await web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(File.ReadAllText(Path.Combine(root,"app","agent.js")));
  if(system=="library")await UpdateBootstrap(web,accountId);
  web.CoreWebView2.NavigationStarting+=(s,e)=>{Uri u;if(!Uri.TryCreate(e.Uri,UriKind.Absolute,out u)||u.Scheme!="https")e.Cancel=true;};
  web.CoreWebView2.WebMessageReceived+=async(s,e)=>{Uri u;if(!Uri.TryCreate(e.Source,UriKind.Absolute,out u))return;
   if(system=="library"&&u.Host!="libyuyue.qlu.edu.cn"||system=="teaching"&&u.Host!="jw.qlu.edu.cn")return;
   Dictionary<string,object> reply;try{reply=json.Deserialize<Dictionary<string,object>>(e.WebMessageAsJson);}catch{return;}
   if(system=="teaching"&&Str(reply,"event")=="teachingRoute"){Uri route;if(Uri.TryCreate(Str(reply,"url"),UriKind.Absolute,out route)&&route.Scheme=="https"&&route.Host=="jw.qlu.edu.cn"&&route.AbsolutePath=="/jwglxt/cdjy/cdjy_cxKxcdlb.html")web.CoreWebView2.Navigate(route.AbsoluteUri);return;}
   var a=Account(accountId);
   if(reply.ContainsKey("session")&&system=="library"){string v=Str(reply,"session");if(v.Length>0&&v!=Str(a,"token")){a["token"]=v;Runtime(accountId).RestoreTried=false;SaveVault();await UpdateBootstrap(web,accountId);}return;}
   TaskCompletionSource<Dictionary<string,object>> t;string rid=Str(reply,"id"),owner;
   if(requestOwners.TryGetValue(rid,out owner)&&owner==system+":"+accountId&&requests.TryGetValue(rid,out t)){requests.Remove(rid);requestOwners.Remove(rid);t.TrySetResult(reply);}
  };
  web.CoreWebView2.NavigationCompleted+=async(s,e)=>{var r=Runtime(accountId);if(system=="teaching")r.TeachingNavFailed=!e.IsSuccess;if(!e.IsSuccess)return;Uri at=web.Source;
   if(system=="teaching"&&at!=null&&at.Host=="jw.qlu.edu.cn"){if(at.AbsolutePath.Contains("/cdjy/")){r.SloginRedirects=0;
     // 从“打开登录页/在学校页面登录”进来：到达空闲教室查询页后自动回到助手
     if(teachingAutoReturn&&official.Visible&&web.Visible&&currentAccountId==accountId){teachingAutoReturn=false;await Task.Delay(1500);if(official.Visible&&web.Visible&&current=="teaching")await CloseOfficial();}}
    // 正方本地登录页有图片验证码，无法自动填写：改走统一认证；每次尝试最多两次，且不重置已填写标记，避免错误密码被反复提交
    else if(String.Equals(at.AbsolutePath,"/jwglxt/xtgl/login_slogin.html",StringComparison.OrdinalIgnoreCase)){if(r.SloginRedirects<2){r.SloginRedirects++;r.StudentRoleRequested=false;if(Str(Account(accountId),"password")!="")r.TeachAutoRequested=true;web.CoreWebView2.Navigate(Teaching);}return;}}
   if(system=="teaching"&&at!=null&&at.Host=="sso.qlu.edu.cn"&&at.AbsolutePath.StartsWith("/login"))r.TeachingStuck=!r.TeachAutoRequested||r.TeachAutoUsed||Str(Account(accountId),"password")=="";
   await TryFill(web,accountId,system);if(system=="teaching"&&!r.StudentRoleRequested&&web.Source!=null&&web.Source.Host=="jw.qlu.edu.cn"&&web.Source.AbsolutePath.Contains("/jwglxt/")&&!web.Source.AbsolutePath.Contains("/cdjy/")){string password=await web.CoreWebView2.ExecuteScriptAsync("!!document.querySelector('input[type=password]')");if(password=="false"){r.StudentRoleRequested=true;web.CoreWebView2.Navigate(StudentMenu);}}};
  web.KeyDown+=async(s,e)=>{if(e.KeyCode==Keys.Escape&&official.Visible){e.Handled=true;await CloseOfficial();}};
  web.CoreWebView2.Navigate(system=="library"?Library:Teaching);return web;
 }
 async Task UpdateBootstrap(WebView2 web,string accountId){
  var r=Runtime(accountId);if(!String.IsNullOrEmpty(r.BootstrapId))web.CoreWebView2.RemoveScriptToExecuteOnDocumentCreated(r.BootstrapId);
  r.BootstrapId=await web.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("if(location.protocol==='https:'&&location.hostname==='libyuyue.qlu.edu.cn'&&!sessionStorage.getItem('token')){var t="+json.Serialize(Str(Account(accountId),"token"))+";if(t){sessionStorage.setItem('token',t);sessionStorage.setItem('isCas','true');}}");
 }
 async Task TryFill(WebView2 web,string accountId,string system){
  Uri u;var r=Runtime(accountId);var a=Account(accountId);bool teach=system=="teaching";
  if(!(teach?r.TeachAutoRequested:r.AutoRequested)||(teach?r.TeachAutoUsed:r.AutoUsed)||web.Source==null||!Uri.TryCreate(web.Source.AbsoluteUri,UriKind.Absolute,out u)||u.Host!="sso.qlu.edu.cn"||!u.AbsolutePath.StartsWith("/login"))return;
  string username=Str(a,"username"),password=Str(a,"password");if(username==""||password=="")return;if(teach)r.TeachAutoUsed=true;else r.AutoUsed=true;
  string js="(()=>{let u=document.querySelector('input[name=username],input#username,input[type=text]'),p=document.querySelector('input[type=password]'),b=document.querySelector('#submitBtn');if(!u||!p||!b)return false;let set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(u,"+json.Serialize(username)+");set.call(p,"+json.Serialize(password)+");for(let x of [u,p]){x.dispatchEvent(new Event('input',{bubbles:true}));x.dispatchEvent(new Event('change',{bubbles:true}));}b.click();return true})()";
  await web.CoreWebView2.ExecuteScriptAsync(js);
 }
 async Task OpenLogin(string system,bool auto,string accountId){
  accountId=AccountId(accountId);if(AccountExecuting(accountId))throw new Exception("该账号任务正在执行，完成后再重新登录");if(system!="teaching")system="library";var r=Runtime(accountId);if(system=="teaching"){r.StudentRoleRequested=false;r.SloginRedirects=0;r.TeachAutoRequested=auto;r.TeachAutoUsed=false;teachingAutoReturn=true;}else{r.AutoRequested=auto;r.AutoUsed=false;}
  var web=await EnsureSchool(system,accountId);current=system;currentAccountId=accountId;ShowOfficial(web,Str(Account(accountId),"label")+" · "+(system=="library"?"图书馆统一认证":"学生教务"));web.CoreWebView2.Navigate(system=="library"?"https://libyuyue.qlu.edu.cn/h5/#/login":Teaching);
 }
 void ShowOfficial(WebView2 web,string title){foreach(var w in school.Values)w.Visible=false;web.Visible=true;officialTitle.Text="  "+title;bar.BringToFront();official.Visible=true;official.BringToFront();}
 Dictionary<string,object> officialArgs=new Dictionary<string,object>();
 // School seat map for one area; ids must be numeric and the date ISO, so no other URL can be built.
 string AreaUrl(){string area=Str(officialArgs,"areaId"),day=Str(officialArgs,"day"),seat=Str(officialArgs,"seatId");if(!System.Text.RegularExpressions.Regex.IsMatch(area,"^\\d{1,9}$"))return Library;string u="https://libyuyue.qlu.edu.cn/h5/index.html#/mo/seat/appointment?id="+area;if(System.Text.RegularExpressions.Regex.IsMatch(day,"^\\d{4}-\\d{2}-\\d{2}$"))u+="&date="+day;if(System.Text.RegularExpressions.Regex.IsMatch(seat,"^\\d{1,9}$"))u+="&seat_id="+seat;return u;}
 async Task OpenOfficial(string target,string accountId){
  accountId=AccountId(accountId);if(target=="pass")throw new Exception("电脑版已移除签到码，请使用手机展示");
  if(AccountExecuting(accountId))throw new Exception("该账号预约任务正在执行，完成后再打开官方页面");
  string system=target=="teaching"?"teaching":"library";var r=Runtime(accountId);
  bool created=system=="teaching"&&!schoolReady.ContainsKey("teaching:"+accountId);
  if(system=="teaching")teachingAutoReturn=Bool(officialArgs,"autoReturn");
  current=system;currentAccountId=accountId;var web=await EnsureSchool(system,accountId);ShowOfficial(web,Str(Account(accountId),"label")+" · "+(system=="teaching"?"学生空闲教室查询":"学校官方页面"));
  // 停在统一认证/验证码登录页（要本人验证）或已在空闲教室页：原样显示，不重新加载，也不重新打开自动填写，避免把错误密码再提交一次
  if(system=="teaching"&&!created&&!r.TeachingNavFailed&&(NeedsUser(web.Source)||web.Source!=null&&web.Source.Host=="jw.qlu.edu.cn"&&web.Source.AbsolutePath.Contains("/cdjy/")))return;
  // 新的一次打开：已保存密码时允许统一认证自动填写一次
  if(system=="teaching"){r.SloginRedirects=0;r.TeachAutoUsed=false;if(Str(Account(accountId),"password")!="")r.TeachAutoRequested=true;}
  // 刚创建的教务页已在走统一认证入口
  if(created)return;
  if(system=="teaching"&&r.TeachingNavFailed){web.CoreWebView2.Navigate(Teaching);return;}
  if(system=="teaching"&&web.Source!=null&&web.Source.Host=="jw.qlu.edu.cn"){try{var status=await Call("teaching","status",new Dictionary<string,object>(),accountId) as Dictionary<string,object>;if(status!=null&&Bool(status,"connected"))return;}catch{}}
  web.CoreWebView2.Navigate(target=="records"?"https://libyuyue.qlu.edu.cn/h5/index.html#/mo/profile/seat-record":system=="teaching"?StudentMenu:target=="current"?"https://libyuyue.qlu.edu.cn/h5/index.html#/mo/current":target=="area"?AreaUrl():Library);
 }
 // 后台静默连接空闲教室：不显示官方页面；同一账号同时只跑一次，重复请求共用同一结果
 // 总时限 45 秒：学校页面卡住（脚本无响应、弹窗）时也按时答复，且不把卡住的尝试缓存给后面的请求。
 Task<object> ConnectTeaching(string accountId,bool fresh){Task<object> t;if(teachingConnects.TryGetValue(accountId,out t)&&!t.IsCompleted)return t;t=WithDeadline(RunConnectTeaching(accountId,fresh));teachingConnects[accountId]=t;return t;}
 static async Task<object> WithDeadline(Task<object> run){if(await Task.WhenAny(run,Task.Delay(45000))==run)return await run;return new{connected=false,needsUser=false,offline=false,page=""};}
 // 要本人处理的页面：统一认证（验证码、短信、密码错误）或正方验证码登录页。教务入口 /sso/ddlogin 本身不算。
 static bool NeedsUser(Uri at){return at!=null&&(at.Host=="sso.qlu.edu.cn"||at.Host=="jw.qlu.edu.cn"&&String.Equals(at.AbsolutePath,"/jwglxt/xtgl/login_slogin.html",StringComparison.OrdinalIgnoreCase));}
 // fresh：界面发现教务会话已过期（查询页还在但查不出数据），必须重新走一遍登录，不能只看页面结构。
 async Task<object> RunConnectTeaching(string accountId,bool fresh){
  var web=await EnsureSchool("teaching",accountId);var r=Runtime(accountId);if(!fresh&&await TeachingConnected(web,accountId))return new{connected=true};
  // 新的一次尝试；用户正在官方页面里操作这个教务页时不打断，只等待
  r.TeachingStuck=false;
  if(!(official.Visible&&web.Visible)){r.SloginRedirects=0;r.StudentRoleRequested=false;r.TeachAutoUsed=false;r.TeachAutoRequested=Str(Account(accountId),"password")!="";web.CoreWebView2.Navigate(Teaching);}
  DateTime until=DateTime.UtcNow.AddSeconds(35);
  while(DateTime.UtcNow<until){await Task.Delay(1000);
   // 统一认证页需要本人处理（没存密码，或自动填写过一次后又回到登录页）：不必等满 35 秒
   if(r.TeachingStuck&&web.Source!=null&&web.Source.Host=="sso.qlu.edu.cn"){await Task.Delay(1500);if(web.Source!=null&&web.Source.Host=="sso.qlu.edu.cn")return new{connected=false,needsUser=true,offline=false,page=web.Source.Host+web.Source.AbsolutePath};}
   if(await TeachingConnected(web,accountId)){try{await Ui(new{@event="sessionChanged",system="teaching",accountId=accountId,connected=true,probe=true});}catch{}return new{connected=true};}}
  Uri at=web.Source;return new{connected=false,needsUser=!r.TeachingNavFailed&&NeedsUser(at),offline=r.TeachingNavFailed,page=at==null?"":at.Host+at.AbsolutePath};
 }
 async Task<bool> TeachingConnected(WebView2 web,string accountId){
  Uri at=web.Source;if(web.CoreWebView2==null||at==null||at.Host!="jw.qlu.edu.cn"||!at.AbsolutePath.Contains("/cdjy/cdjy_cxKxcdlb.html"))return false;
  try{if(await web.CoreWebView2.ExecuteScriptAsync("typeof window.QluAgent==='object'")!="true")return false;var d=await Call("teaching","status",new Dictionary<string,object>(),accountId) as Dictionary<string,object>;return d!=null&&Bool(d,"connected");}catch{return false;}
 }
 // 窗口不在前台（或 force）时用托盘气泡提示，Windows 10/11 显示为系统通知；自检模式不弹任何提示
 bool Notify(Dictionary<string,object> d){
  if(selftest)return false;string title=Str(d,"title").Trim(),text=Str(d,"text").Trim();if(text==""){text=title;title="";}if(text=="")return false;if(title=="")title="工大学伴";
  // 学校官方页面盖在助手界面上时，界面里的提示看不到，也按“不在前台”处理
  if(!Bool(d,"force")&&Visible&&WindowState!=FormWindowState.Minimized&&Form.ActiveForm==this&&!official.Visible)return false;
  string page=Str(d,"page");notifyPage=System.Text.RegularExpressions.Regex.IsMatch(page,"^[A-Za-z0-9_-]{1,32}$")?page:"";
  tray.Visible=true;tray.ShowBalloonTip(8000,Cut(title,60),Cut(text,250),ToolTipIcon.Info);return true;
 }
 static string Cut(string s,int n){if(s.Length<=n)return s;if(Char.IsHighSurrogate(s[n-1]))n--;return s.Substring(0,n);}
 async Task Probe(string system,string accountId){bool connected=false;try{var d=await Call(system,"status",new Dictionary<string,object>(),accountId) as Dictionary<string,object>;connected=d!=null&&Bool(d,"connected");}catch{}await Ui(new{@event="sessionChanged",system=system,accountId=accountId,connected=connected});}
 async Task<object> LibraryCall(string method,Dictionary<string,object> p,string accountId){
  object result=null;SchoolException failure=null;try{result=await Call("library",method,p,accountId);}catch(SchoolException e){failure=e;}
  bool missing=failure!=null&&failure.Code=="AUTH";var status=result as Dictionary<string,object>;if(method=="status"&&status!=null&&!Bool(status,"connected"))missing=true;
  var r=Runtime(accountId);if(missing&&method!="reserve"&&method!="temporaryLeave"&&method!="cancelBooking"&&method!="checkout"&&(!r.RestoreTried||DateTime.UtcNow-r.RestoreAt>TimeSpan.FromMinutes(3))&&!String.IsNullOrEmpty(Str(Account(accountId),"password"))){r.RestoreTried=true;r.RestoreAt=DateTime.UtcNow;if(await AutoRestoreLibrary(accountId))return await Call("library",method,p,accountId);}
  if(failure!=null)throw failure;return result;
 }
 async Task<bool> AutoRestoreLibrary(string accountId){
  var r=Runtime(accountId);r.AutoRequested=true;r.AutoUsed=false;var web=await EnsureSchool("library",accountId);web.CoreWebView2.Navigate("https://sso.qlu.edu.cn/login?service=https%3A%2F%2Flibyuyue.qlu.edu.cn%2Fv4%2Flogin%2Fcas");
  DateTime until=DateTime.UtcNow.AddSeconds(40);for(int i=0;i<45&&DateTime.UtcNow<until;i++){await Task.Delay(800);if(web.Source==null||web.Source.Host!="libyuyue.qlu.edu.cn")continue;try{var result=await Call("library","status",new Dictionary<string,object>(),accountId) as Dictionary<string,object>;if(result!=null&&Bool(result,"connected"))return true;}catch(SchoolException e){if(e.Code!="AUTH")break;}catch{break;}}
  if(accountId==ActiveAccountId){current="library";currentAccountId=accountId;ShowOfficial(web,Str(Account(accountId),"label")+" · 请完成学校验证后返回助手");}return false;
 }
 async Task<object> Call(string system,string method,Dictionary<string,object> p,string accountId=null){
  accountId=AccountId(accountId);var allowed=system=="library"?new[]{"status","catalog","areas","seats","records","reserve","current","temporaryLeave","profile","violations","rules","cancelBooking","checkout"}:new[]{"status","options","rooms"};if(!allowed.Contains(method))throw new Exception("不支持的学校操作");
  var web=await EnsureSchool(system,accountId);
  for(int i=0;i<30;i++){if(web.CoreWebView2!=null&&web.Source!=null&&web.Source.Host==(system=="library"?"libyuyue.qlu.edu.cn":"jw.qlu.edu.cn")){if(await web.CoreWebView2.ExecuteScriptAsync("typeof window.QluAgent==='object'")=="true")break;}if(i==29)throw new SchoolException("AUTH","请先在该账号的官方页面完成登录",false);await Task.Delay(400);}
  string id=Guid.NewGuid().ToString("N");var pending=new TaskCompletionSource<Dictionary<string,object>>();requests[id]=pending;requestOwners[id]=system+":"+accountId;
  try{
   await web.CoreWebView2.ExecuteScriptAsync("window.QluAgent.run("+json.Serialize(new{id=id,method=method,@params=p})+")");
   if(await Task.WhenAny(pending.Task,Task.Delay(method=="temporaryLeave"||method=="cancelBooking"||method=="checkout"?55000:27000))!=pending.Task)throw new SchoolException((method=="reserve"||method=="temporaryLeave"||method=="cancelBooking"||method=="checkout")?"UNCERTAIN":"TIMEOUT","学校页面响应超时，请核对登录和网络状态",method=="reserve"||method=="temporaryLeave"||method=="cancelBooking"||method=="checkout");
   var reply=await pending.Task;if(!Bool(reply,"ok")){var err=Obj(reply,"error");if(system=="library"&&Str(err,"code")=="AUTH"){Account(accountId).Remove("token");SaveVault();await UpdateBootstrap(web,accountId);}throw new SchoolException(Str(err,"code"),Str(err,"message"),Bool(err,"uncertain"));}return reply.ContainsKey("data")?reply["data"]:null;
  }finally{requests.Remove(id);requestOwners.Remove(id);}
 }
 void Restore(){Show();WindowState=FormWindowState.Normal;Activate();}
 // 界面把下一次签到提醒的时间（毫秒时间戳）随状态一起保存；24 小时内还有提醒就算“未发出”
 bool HasUpcomingReminder(){object v;if(!appState.TryGetValue("nextReminder",out v)||v==null)return false;double at;if(!double.TryParse(Convert.ToString(v,System.Globalization.CultureInfo.InvariantCulture),System.Globalization.NumberStyles.Float,System.Globalization.CultureInfo.InvariantCulture,out at))return false;double now=(DateTime.UtcNow-new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc)).TotalMilliseconds;return at>now&&at-now<86400000;}
 bool HasTasks(){object list;if(!appState.TryGetValue("tasks",out list))return false;var items=list as System.Collections.IEnumerable;if(items==null)return false;return items.Cast<object>().OfType<Dictionary<string,object>>().Any(x=>new[]{"pending","checking","submitting","verifying"}.Contains(Str(x,"status")));}
 void OnClosing(object sender,FormClosingEventArgs e){
  bool reminder=!exiting&&!selftest&&!HasTasks()&&HasUpcomingReminder();
  if(!exiting&&!selftest&&(HasTasks()||reminder)){
   var result=MessageBox.Show(reminder?"还有签到提醒没有发出。选择“是”最小化到托盘继续运行；选择“否”退出，提醒不会再弹出。":"还有预约任务。选择“是”最小化到托盘继续运行；选择“否”退出并停止本机执行。","工大学伴",MessageBoxButtons.YesNoCancel,MessageBoxIcon.Information);
   if(result!=DialogResult.No){e.Cancel=true;if(result==DialogResult.Yes){tray.Visible=true;Hide();}return;}
  }
  exiting=true;timer.Stop();tray.Dispose();ui.Dispose();foreach(var w in school.Values)w.Dispose();
 }
}
sealed class SchoolException:Exception{public readonly string Code;public readonly bool Uncertain;public SchoolException(string code,string message,bool uncertain):base(message){Code=code;Uncertain=uncertain;}}




