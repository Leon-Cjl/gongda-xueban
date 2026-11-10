<div align="center">

# 📚 工大学伴

**齐鲁工业大学校园小工具：图书馆选座 · 入馆码 · 签到提醒 · 空教室查询**

<img src="https://img.shields.io/badge/版本-1.1.26-blue?style=flat-square" />
<img src="https://img.shields.io/badge/platform-Android-green?style=flat-square&logo=android&logoColor=white" />
<img src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square&logo=windows&logoColor=white" />
<img src="https://img.shields.io/badge/language-JavaScript-yellow?style=flat-square&logo=javascript&logoColor=black" />
<img src="https://img.shields.io/badge/license-MIT-yellow?style=flat-square" />
<img src="https://img.shields.io/badge/状态-非官方-orange?style=flat-square" />

[下载最新版](https://github.com/Leon-Cjl/gongda-xueban/releases)

</div>

---

## ⚖️ 法律声明与免责条款

> 本声明依据《中华人民共和国网络安全法》《中华人民共和国个人信息保护法》《中华人民共和国刑法》《中华人民共和国民法典》制定，自项目发布之日起适用。

### 一、非官方性质

本项目为个人开发的非官方应用，与齐鲁工业大学无任何隶属、授权或合作关系。开发者不为学校官方系统的可用性、准确性和稳定性负责。

依据：
- **《民法典》第1165条**：行为人因过错侵害他人民事权益造成损害的，应当承担侵权责任。
- **《民法典》第1194条**：网络用户、网络服务提供者利用网络侵害他人民事权益的，应当承担侵权责任。

### 二、个人信息保护

应用在本地加密保存用户账号密码（安卓 Keystore / Windows DPAPI），不上传任何服务器，仅与学校官方域名通信。首次使用前须同意《用户协议与隐私说明》，同意前不发起任何学校请求。用户可随时撤回同意并清除本机数据。

依据：
- **《个人信息保护法》第13条**：处理个人信息须取得个人同意。
- **《个人信息保护法》第14条**：同意须由个人在充分知情的前提下自愿、明确作出。
- **《个人信息保护法》第15条**：个人有权撤回其同意，处理者应提供便捷的撤回方式。
- **《个人信息保护法》第16条**：不得以个人不同意处理或撤回同意为由拒绝提供服务（处理个人信息属于提供产品或服务所必需的除外）。
- **《个人信息保护法》第17条**：处理前应告知处理者名称、联系方式、处理目的、方式、种类、保存期限及权利行使方式。
- **《个人信息保护法》第28条**：账号密码等属于敏感个人信息，须具有特定目的和充分必要性，并采取严格保护措施。
- **《个人信息保护法》第51条**：应采取加密、去标识化等安全技术措施防止未经授权的访问及个人信息泄露。
- **《网络安全法》第41条**：收集使用个人信息须遵循合法、正当、必要原则，公开收集规则，明示目的、方式和范围，并经被收集者同意。
- **《网络安全法》第42条**：不得泄露、篡改、毁损其收集的个人信息。
- **《网络安全法》第43条**：个人有权要求删除违法收集的信息、更正错误信息。
- **《网络安全法》第44条**：任何个人和组织不得窃取或者以其他非法方式获取个人信息。

### 三、计算机信息系统安全

应用通过 WebView 以用户本人账号正常访问学校官方系统，不侵入、不干扰、不破坏计算机信息系统功能，不提供任何用于侵入或非法控制的程序或工具。

依据：
- **《网络安全法》第27条**：任何个人和组织不得从事非法侵入他人网络、干扰他人网络正常功能、窃取网络数据等危害网络安全的活动；不得提供专门用于从事此类活动的程序、工具。
- **《刑法》第285条第1款**：违反国家规定，侵入国家事务、国防建设、尖端科学技术领域的计算机信息系统的，处三年以下有期徒刑或者拘役。
- **《刑法》第285条第2款**：违反国家规定，获取计算机信息系统中存储、处理或传输的数据，或对其实施非法控制，情节严重的，处三年以下有期徒刑或者拘役，并处或单处罚金。
- **《刑法》第285条第3款**：提供专门用于侵入、非法控制计算机信息系统的程序、工具的，依照前款规定处罚。

### 四、使用限制与责任

- 仅限本人账号使用，**不得代约、转让或倒卖座位**。
- 预约、签到一律以学校系统和《预约须知》为准。
- 仓库不含签名文件、登录会话或个人数据，测试只用合成数据。

依据：
- **《网络安全法》第74条**：违反本法给他人造成损害的依法承担民事责任；构成违反治安管理行为的依法给予治安管理处罚；构成犯罪的依法追究刑事责任。

---

## 功能

| 功能 | 说明 |
|---|---|
| 📖 **图书馆** | 按楼层、空座筛选区域，看座位图，收藏常用座位，"立即预约" |
| 📱 **入馆码** | 手机上一键打开电子借阅证，可放入快捷设置磁贴 |
| ⏰ **签到提醒** | 预约开始前按设定时间提醒（系统闹钟，不常驻后台） |
| 🏫 **空教室** | 按校区、教学楼、节次查空教室；离线缓存未来 7 天数据 |
| 📊 **学习足迹** | 入馆日历、月度小结、成就（全部只用本机累积的学校记录计算） |
| ⚙️ **我的** | 自动登录、主题与深浅色、倒计时、用户协议与隐私说明 |

## 技术与代码结构

| 部分 | 技术 |
|---|---|
| 共用界面 | HTML + CSS + 原生 JavaScript（无框架、无 npm 依赖） |
| 安卓 | Java + Android SDK + 系统 WebView，minSdk 24 |
| Windows | C# + .NET Framework 4.x + Windows Forms + WebView2 |

### 建议阅读顺序

1. `app/index.html` — 页面入口和脚本加载顺序
2. `app/ui.js`、`app/styles.css` — 界面和交互
3. `app/core.js` — 任务执行、状态、统计等共用逻辑（有单元测试）
4. `app/agent.js` — 注入学校页面的接口适配脚本
5. `android/src/cn/qlucampus/personal/` — 安卓宿主（桥接、登录、加密存储、提醒、磁贴）
6. `windows/Program.cs` — Windows 宿主
7. `tests/` — Node 单元测试、模拟安卓宿主、手机界面自动验收

## 本机预览与测试

不登录学校也能看界面：

```powershell
python tests/serve-mobile.py
# 浏览器打开 http://127.0.0.1:8769/index.html?s=connected （模拟宿主 + 合成数据）
```

```powershell
node --test tests/*.test.cjs    # 单元测试（Node 18+）
```

## 构建

<details>
<summary>📱 安卓构建</summary>

准备 JDK 17、Android SDK Platform 35 的 `android.jar`、Build Tools 35（含 aapt2 / d8 / zipalign / apksigner），运行 `.\build-android.ps1`。不给 `-KeyStorePath` 时会在 `android\signing\` 生成本机签名（已在 `.gitignore` 里）。用不同签名打的包不能覆盖安装作者发布的安装包。

</details>

<details>
<summary>💻 Windows 构建</summary>

把 WebView2 SDK 里的 DLL 放进 `tools\webview2\`，运行 `.\build-windows.ps1`。编译器用 Windows 自带的 .NET Framework `csc.exe`。

</details>

> ⚠️ 构建脚本在包含中文的路径下可能失败（aapt2 的限制），建议把仓库放在英文路径里。

## 参与开发

由 [Leon-Cjl](https://github.com/Leon-Cjl) 主导，AI 编程助手 Claude、Codex、Gemini 和 DeepSeek 参与了代码编写。

## 许可证

代码以 [MIT](LICENSE) 许可证开源。`app/donate.png` 是作者的收款码，请勿在你自己发布的版本里沿用。

## 相关项目

[Leon 的项目主页](https://github.com/Leon-Cjl) · [校园电费](https://github.com/Leon-Cjl/campus-dianfei) · [工大学伴](https://github.com/Leon-Cjl/gongda-xueban) · [奶蛙版](https://github.com/Leon-Cjl/gongda-xueban-naiwa) · [宿舍快开](https://github.com/Leon-Cjl/dorm-native-open)
