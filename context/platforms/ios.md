# iOS 端一页纸

> 保持在约 100 行以内。由 /distill 定期结晶更新，人工修正错误。最后更新：2026-07-07

## 基本信息
- 仓库：apps/ios/
- 技术栈：纯 **Objective-C**（无 Swift）+ Xcode 工程，主入口 `zhixinApp.xcworkspace`（CocoaPods 管理依赖）。融云 IM（`RongCloudIM/IMLib` 5.3.7）+ 个推 GTSDK + 百度地图 4.4.0 + 阿里云 OSS + ShareSDK（QQ/微博/微信/钉钉）+ Bugly + AFNetworking 3.2.1 + Masonry + MJExtension/YYModel + SDWebImage + MJRefresh + FLEX(Debug)。纯代码 + Masonry 布局，MVC + 大量基类化；仅 LaunchScreen 用 Storyboard。
- 最低支持版本 / 目标环境：iOS **13.0**（主 target `zhixinApp`）；`NOtificationService` / `ZXShare` target 为 iOS 11.0。模拟器受融云 5.3.7 仅含 **x86_64** slice 限制（见「已知坑」）。

## 常用命令
```bash
# 安装依赖（首次克隆后必做）：
pod install
# 打开工程（必须用 .xcworkspace，勿用 .xcodeproj）：
open zhixinApp.xcworkspace
# 命令行编译测试包（推荐本地调试，模拟器 id 见 docs/local-run.md）：
xcodebuild -workspace zhixinApp.xcworkspace -scheme zhixinAppTest \
  -configuration Debug \
  -destination 'platform=iOS Simulator,id=<SIM_UDID>' \
  -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
# 安装并启动到模拟器：
xcrun simctl install booted build/DerivedData/Build/Products/Debug-iphonesimulator/zhixinAppTest.app
xcrun simctl launch booted com.zhiguan.iot.test
# 真机：Xcode 选 zhixinAppTest scheme → 配 Team → ⌘R
```
> **无 test target、无单元测试**；**无 lint/SwiftLint**。质量靠人工 + 编译；提交前本地 build 一次。三 scheme：`zhixinApp`(dev)/`zhixinAppTest`(测试,内网)/`zhixinAppProd`(生产)。

## 目录与架构约定
- **两源码根**：`SmartMessage/`（全部业务，按 `ZX_Modules/<功能>/` 分层）+ `zhixinApp/`（壳工程：`main.m`、三套 `Info.plist`、`Assets.xcassets`、`*.entitlements`、`PrefixHeader.pch`）。
- **功能模块** `SmartMessage/ZX_Modules/`：`ZX_AI`/`ZX_AIChat`/`ZX_Message`(融云 IM)/`ZX_Home`/`ZX_Login`/`ZX_Mine`/`ZX_ActionCenter`/`ZX_GroupBulletin`/`ZX_Teamwork`/`ZX_Open`/`ZX_Search`/`ZX_Bluetooth`。每个模块内部约定 `ZX_Controller`/`ZX_View`/`ZX_Logic`/`ZX_NetClient` 四层；**新功能照此分层**。
- **网络层** `SmartMessage/ZX_Kit/ZX_FunctionKit/ZX_NetClient/ZX_Network/ZXNetBaseClient.m`：单例 `sharedClient`，封装 AFHTTPSessionManager + PPNetworkHelper，统一注入 `Authorization: Bearer <UD_AccessToken>` / `clientType: app` / 30s 超时。接口路径宏集中 `SmartMessage/ZX_Defines/ZXApiMacro.h`；环境域名在 `ZXIPMacro.h`。按业务域拆 `ZX_*NetClient`。
- **环境切换是编译期**：`ZXIPMacro.h` 用 `#if TEST` 选域名——`TEST` 宏由 `zhixinAppTest` scheme 的 Preprocessor `TEST=1` 注入 → `http://192.168.10.25`；`#else` → `https://zhixin.zhiguaniot.com`。**改环境必须重新 build，无运行期切换**。
- **状态/持久化**：登录态走 `ZXUserDefault`（NSUserDefaults 封装，常量前缀 `UD_*`，如 `UD_AccessToken`）；DB 用 XTFMDB/FMDB；融云 IM 用 RongIMKit + 自定义 Cell。
- **入口**：`SmartMessage/ZX_Base/ZX_AppDelegate/AppDelegate.m` + 分类 `+ThirdSDKs`/`+AppTools`/`+RCIM`/`+GeTuiSDK`/`+Enter`，`didFinishLaunching` 里依次 config 第三方/DB/个推/根控制器/融云。
- **全局头**：`zhixinApp/PrefixHeader.pch` 统一 import 系统/Pod/自定义宏与基类；**新增全局头/第三方 import 在此登记**，否则编译找不到。

## Mock 开关方式
- 当前**无统一 mock 开关**。零散实现：`ZXMessageStreamSimulator.m`（智能体流式输出内置 mock 自检，按 `messageUId` 触发，仅 debug 自检用）；源码中散见 `#if DEBUG_Test`（如 `ZXMineSettingController`、`UITableView+SwizzleMethod`），但 build settings **未定义** `DEBUG_Test`，默认关。
- **页面先行约定**：按 `context/contracts/` 类型在 `ZX_NetClient` module 或 controller 内构造本地 mock，注释「后续接接口替换」，接口到位后删 mock、改回真实调用，并在活跃功能 impl-notes 记录差异。

## WebView 集成方式
- **基类** `SmartMessage/ZX_Modules/ZX_Open/ZX_Base/ZX_Controller/ZXWebBaseController`（继承 `ZXMainBaseController`）：同时支持 `UIWebView`(legacy) 与 `WKWebView`（`webType` 切换），内置进度条 `ZXWebProgressView` 与错误页 `ZXWebErrorView`；承载所有 H5 内嵌页。
- **JSBridge**：`SmartMessage/ZX_Kit/ZX_JSWebKit/ZX_WebJSCoreAPI/`，按域分 API 类——`ZXJSAuthAPI`(鉴权/token)、`ZXJSDeviceAPI`(设备/蓝牙/定位/截屏等)、`ZXJSIMAPI`(IM/启动会话)、`ZXJSAIChatAPI`(AI)、`ZXJSO5API`(O5)、`ZXJSBulletinAPI`(公告)、`ZXJSMediaAPI`、`ZXJSPageAPI`、`ZXJSRuntimeAPI`、`ZXJSUIAPI`、`ZXJSUtilAPI`。统一继承 `ZXJSBaseAPI`，子类在 `registerHandlers` 用 `registerHandlerName:handler:` 注册，经 `WKScriptMessageHandler` 回调。**新增 bridge 能力照此模式新增 API 类/方法，协议对照 `context/bridge.md`**。

## 已知坑
- 融云 5.3.7 xcframework 仅 x86_64 模拟器 slice：Apple Silicon 上 iPhone 16e/iOS 26 模拟器无法编译，必须用 **iPhone 15（iOS 17.0）**；或按 `docs/local-dev-patch.md` 升级融云至 5.10+ 并注释百度地图/Bugly/ShareSDK 平台/AlicloudRPSDK/YYImage-WebP（这些仅真机 arm64）——该 patch **勿提交**，Intel 同事用原版 Podfile。
- 环境切换是**编译期**宏，改环境必须重新 build，无运行期/HMR 概念。
- `Pods/`、`build/`、`Podfile.lock` 在 .gitignore（不提交）；仓库里出现的 `Pods/`、`build/DerivedData*` 是本地生成物。
- 无 test target / 无 lint，质量靠人工 + 编译；提交前本地 build 验证一次。
- `DEBUG_Test` 宏未在 build settings 定义，源码中 `#if DEBUG_Test` 段默认不编译；临时调试需在 target Preprocessor Macros 手动加 `DEBUG_Test=1`。
- `PrefixHeader.pch` 全局 import，漏登新头会编译报错。
- 接口实际行为与契约不符时：先改 `context/contracts/`（记 Changelog）再改代码，并在活跃功能 impl-notes「联调坑」补一条。