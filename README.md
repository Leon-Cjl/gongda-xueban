# 工大学伴

齐鲁工业大学同学自己做的校园小工具：图书馆选座预约、入馆码、签到提醒、空教室查询。安卓和 Windows 共用一套网页界面，直接访问学校官方系统，**没有自建服务器**。

> 非学校官方应用，与学校无关。预约、签到一律以学校系统和《预约须知》为准；仅限本人账号使用，不得代约、转让或倒卖座位。

当前版本：**1.1.15**（安卓包名 `cn.qlucampus.gongda`）。

## 功能

- **图书馆**：按楼层、空座筛选区域，看座位图，收藏常用座位，“立即预约”；预约结果按学校记录核对。
- **入馆码**：手机上一键打开电子借阅证，也可以放进快捷设置磁贴。
- **签到提醒**：预约开始前按设定时间提醒签到（系统闹钟，不常驻后台）。
- **空教室**：按校区、教学楼、节次查空教室；每天第一次打开时把本校区未来 7 天的数据存到本机，没网也能查。
- **学习足迹**：入馆日历、月度小结、成就，全部只用本机累积的学校记录计算。
- **我的**：自动登录（账号密码只加密保存在本机）、主题与深浅色、倒计时、《用户协议与隐私说明》、撤回同意并清除本机数据。

## 技术与代码结构

| 部分 | 技术 |
|---|---|
| 共用界面 | HTML + CSS + 原生 JavaScript（无框架、无 npm 依赖） |
| 安卓 | Java + Android SDK + 系统 WebView，minSdk 24 |
| Windows | C# + .NET Framework 4.x + Windows Forms + WebView2 |

建议阅读顺序：

1. `app/index.html`：页面入口和脚本加载顺序。
2. `app/ui.js`、`app/styles.css`：界面和交互。
3. `app/core.js`：任务执行、状态、统计等共用逻辑（有单元测试）。
4. `app/agent.js`：注入学校页面的接口适配脚本。
5. `android/src/cn/qlucampus/personal/`：安卓宿主（桥接、登录、加密存储、提醒、磁贴）。Java 包名沿用早期工程，安装包名在清单里是 `cn.qlucampus.gongda`。
6. `windows/Program.cs`：Windows 宿主。
7. `tests/`：Node 单元测试、模拟安卓宿主、手机界面自动验收。

## 本机预览与测试

不登录学校也能看界面：

```powershell
python tests/serve-mobile.py
# 浏览器打开 http://127.0.0.1:8769/index.html?s=connected （模拟宿主 + 合成数据）
```

单元测试（Node 18+）：

```powershell
node --test tests/*.test.cjs
```

手机界面自动验收（需要 Python 和本机 Chrome）：`python tests/run-phone-acceptance.py`。

## 构建

**安卓**：准备 JDK 17、Android SDK Platform 35 的 `android.jar`、Build Tools 35（含 aapt2 / d8 / zipalign / apksigner），按下面放好（或用 `-ToolsRoot` 指定），再运行 `.\build-android.ps1`：

```
tools\jdk\<JDK 目录>\bin\javac.exe
tools\android-platform\...\android.jar
tools\android-build\...\aapt2.exe   （同目录 lib\d8.jar、lib\apksigner.jar）
```

不给 `-KeyStorePath` 时，脚本会在 `android\signing\` 生成一把本机签名（已在 `.gitignore` 里）。用不同签名打的包不能覆盖安装作者发布的安装包。

**Windows**：把 WebView2 SDK（NuGet 包 `Microsoft.Web.WebView2`）里的 `Microsoft.Web.WebView2.Core.dll`、`Microsoft.Web.WebView2.WinForms.dll`、`WebView2Loader.dll`（x64）放进 `tools\webview2\`，运行 `.\build-windows.ps1`。编译器用 Windows 自带的 .NET Framework `csc.exe`。

> 构建脚本在包含中文的路径下可能失败（aapt2 的限制），建议把仓库放在英文路径里。

## 隐私

- 账号密码只在本机加密保存（安卓 Keystore / Windows DPAPI），不上传任何服务器。
- 应用只和学校官方域名通信；首次使用前必须同意《用户协议与隐私说明》（见 `用户协议与隐私说明.md`），同意前不发起任何学校请求。
- 仓库里不含签名文件、登录会话或任何个人数据；测试只用合成数据。

## 相关仓库

- [gongda-xueban-naiwa](https://github.com/Leon-Cjl/gongda-xueban-naiwa)：奶蛙宠物版（本项目的分支，多了奶蛙小屋和主题）。
- [campus-dianfei](https://github.com/Leon-Cjl/campus-dianfei)：校园电费。

## 参与开发

由 [Leon-Cjl](https://github.com/Leon-Cjl) 主导，AI 编程助手 [Claude](https://claude.com/claude-code)（Anthropic）、[Codex](https://openai.com/codex)（OpenAI）、[Gemini](https://gemini.google.com)（Google）和 [DeepSeek](https://www.deepseek.com) 参与了代码编写。

## 许可证

代码以 [MIT](LICENSE) 许可证开源。`app/donate.png` 是作者的收款码，请勿在你自己发布的版本里沿用。
