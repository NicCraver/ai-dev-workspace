# iOS 端一页纸

> 保持在约 100 行以内。由 /distill 定期结晶更新，人工修正错误。最后更新：2026-07-07

## 基本信息
- 仓库：apps/ios/
- 技术栈：Objective-C（纯 OC，无 Swift）+ UIKit + WKWebView。依赖管理用 **CocoaPods**（`Podfile`，`source` 为 GitHub Specs + 阿里云 specs）。核心三方：融云 IM `RongCloudIM/IMLib`+`/Location` `=5.3.7`、AFNetworking 3.2.1、PPNetworkHelper、SDWebImage、Masonry（布局）、MJRefresh/MJExtension、FMDB + XTFMDB、IQKeyboardManager、MBProgressHUD/Toast、Bugly、AliyunOSSiOS、BaiduMapKit 4.4.0、BabyBluetooth、mob_sharesdk（QQ/微博/微信/钉钉）、FLEX（Debug 调试控件）。多 target：`zhixinApp`(开发) / `zhixinAppTest`(测试) / `zhixinAppProd`(生产) / `NOtificationService`(推送扩展) / `ZXShare`(分享扩展)。
- 最低支持版本 / 目标环境：iOS 13.0（`Podfile` `platform :ios, '13.0'`；个别 target 工程配置为 11.0）。本地调试推荐 **iPhone 15 / iOS 17.0** 模拟器（见「已知坑」）。

## 常用命令
```bash
# 安装依赖（首次或 Podfile 变更后）：
pod install
# 打开工程（必须用 .xcworkspace，不要用 .xcodeproj）：
open zhixinApp.xcworkspace
# 编译测试包（推荐本地调试）：
xcodebuild -workspace zhixinApp.xcworkspace -scheme zhixinAppTest \
  -configuration Debug \
  -destination 'platform=iOS Simulator,id=<SIM_UDID>' \
  -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
# 安装并启动（测试包）：
xcrun simctl install booted build/DerivedData/Build/Products/Debug-iphonesimulator/zhixinAppTest.app
xcrun simctl launch booted com.zhiguan.iot.test
# 列可用模拟器：xcrun simctl list devices available
```
> **无单元测试、无 lint**（纯 OC，未集成 OCLint/SwiftLint）。质量靠编译 + 真机/模拟器自测。Scheme 切换对应环境：`zhixinApp`(com.zhiguan.iot) / `zhixinAppTest`(com.zhiguan.iot.test，内网 192.168.10.25，需 VPN) / `zhixinAppProd`(com.zhiguan.iot.prod)。

## 目录与架构约定
- **主工程结构**：`SmartMessage/` 是核心业务库（按 ZX_ 前缀分目录）；`zhixinApp/` 是壳工程（入口 `main.m` + `Info.plist` + 资源/启动图）；`NOtificationService/`、`ZXShare/` 为扩展 target。
- **SmartMessage 分层**：`ZX_Base/`（AppDelegate 分类集群 + 根 Controller/Manager/TabBar）、`ZX_Defines/`（全局宏：`ZXConst.h`/`ZXApiMacro.h` 接口路径/`ZXIPMacro.h` 环境/`ZXMacro.h`/`ZXUiMacro.h`）、`ZX_Kit/`（`ZX_CoreKit` 网络客户端、`ZX_FunctionKit`、`ZX_JSWebKit` WebView 桥、`ZX_Status`）、`ZX_Modules/`（按业务划分：`ZX_AIChat`/`ZX_AI`/`ZX_Message`(融云会话)/`ZX_Home`/`ZX_Login`/`ZX_Mine`/`ZX_Search` 等）、`ZX_DataCache`、`ZX_Resources`、`ZX_Utils`、`ZX_ThridParty`。**新功能在 `ZX_Modules/<模块>/` 内新建，按 Controller/Model/View/Logic 子目录组织。**
- **AppDelegate**：用 Objective-C 分类拆分（`AppDelegate+RCIM` 融云、`+ThirdSDKs`、`+GeTuiSDK` 个推、`+Enter` 启动路由、`+AppTools`），新增 SDK 初始化加一个分类，勿全堆进 `AppDelegate.m`。
- **网络层**：基础用 AFNetworking + PPNetworkHelper 封装；客户端在 `ZX_Kit/ZX_CoreKit/`（`ZX_Client`/`ZX_DataClient`/`ZX_SystemClient`/`ZX_EmojiClient`）。接口路径常量集中在 `ZX_Defines/ZXApiMacro.h`（`API_*` 命名），服务前缀宏在 `ZXIPMacro.h`（`ZXContactAPI`/`ZXRCIMAPI` 等）。**新接口先在 ZXApiMacro.h 加常量，再写调用。**
- **环境切换**：靠预处理器宏 `#if TEST ... #else ...`（见 `ZXIPMacro.h`：TEST → 内网 `192.168.10.25`，否则正式域名 `zhixin.zhiguaniot.com`），由各 scheme 的预处理定义区分（测试/生产包不同 Bundle ID 与 AppKey）。
- **状态/持久化**：FMDB（XTFMDB 封装）做本地数据库；用户态与登录信息走 `ZX_Defines/ZXUserMarco.h` 的常量 + 偏好设置。

## Mock 开关方式
- **当前无统一 mock 开关 / mock 服务**；现状是组件内零散内存假数据，靠注释标注「后续接接口替换」。
- **页面先行约定**：按 `context/contracts/` 的类型在 `ZX_Modules/<模块>/` 内构造本地假数据（如 `NSMutableArray` 占位），接口到位后删假数据、改回真实网络调用，并在活跃功能 impl-notes 记录差异。
- 联调环境切换走 scheme（`zhixinAppTest` 指内网），不要靠改 `ZXIPMacro.h` 的写死 URL 提交。

## WebView 集成方式
- 内嵌 H5 走 **WKWebView + 自研 JSBridge**（`ZX_Kit/ZX_JSWebKit/`）。核心：`ZXJSWKWebViewBridge`（`+bridgeForWebView:`）通过 `WKScriptMessageHandler` 收 web→原生消息，`registerHandler:handler:` 注册方法、`callHandler:data:responseHandler:` 回调 web。
- **API 按模块注册**：`ZX_WebJSCoreAPI/` 下每个 `ZXJS*API` 类（`ZXJSAIChatAPI`/`ZXJSAuthAPI`/`ZXJSIMAPI`/`ZXJSMediaAPI`/`ZXJSUIAPI`/`ZXJSUtilAPI`/`ZXJSDeviceAPI`/`ZXJSPageAPI`/`ZXJSRuntimeAPI`/`ZXJSBulletinAPI`/`ZXJSO5API`）在 `registerHandlers` 里 `registerHandlerName:` 注册若干方法名。**加新 bridge 方法：在对应模块的 `ZXJS*API.m` 内 `registerHandler`，勿散落。** 协议对照见 `context/bridge.md`。
- **加载入口**：`ZXJSWebLoader`（`ZX_WebJSController/`）封装 WKWebView + Bridge + UA 定制 + 加载态/错误页；`initialize` 里 `dispatch_once` 设置全局自定义 UserAgent（含 `MTCoreApiJS/x.x.x`），UA 一旦设好进程内不可再改。
- AI 会话相关：`ZX_Modules/ZX_AIChat/`（`ZXPersonalAIChatController` 独立聊天页、`ZXAIChatManager`、`AIAgent/` 智能体选择与管理），与 web 端通过 `ZXJSAIChatAPI` 桥互通（如 `selectAiAgent`、`selectDataRangeScope` 数据范围多选、`actionCardTransmit` 转发）。选择页在 `ZX_Modules/ZX_Message/ZX_PersonalAi/SelectAiAgent/`（`selectDataRangeMode` 强制多选）。

## 已知坑
- 融云 SDK `5.3.7` 的 xcframework **只含 x86_64 模拟器 slice，无 arm64 模拟器 slice**：Apple Silicon Mac 上只能用 **iPhone 15 / iOS 17.0** 这类 x86_64 模拟器，iPhone 16e / iOS 26 之类 arm64 模拟器会黑屏/架构不匹配。要跑 arm64 模拟器须按 `docs/local-dev-patch.md` 打本地 patch（融云升 `~>5.10.0`、注释百度地图/Bugly/ShareSDK 平台/阿里云实人/YYImage-WebP，`#if TARGET_OS_SIMULATOR` stub 个推等）——**该 patch 勿提交**。
- 必须用 `zhixinApp.xcworkspace` 打开工程，直接开 `.xcodeproj` 不会链接 Pods。
- 环境由 `#if TEST` 预处理宏切换，改 `ZXIPMacro.h` 后要 clean build；正式包测试环境那段被注释的代码不要随手解开提交。
- `Podfile` `post_install` 对融云各 framework 做 `bitcode_strip` 并统一 `ENABLE_BITCODE=NO`，新增融云子库需把对应 framework 名加进 `RongCloudIM_Frameworks` 列表，否则 archive 可能失败。
- 无 lint/test；提交前请 clean build 通过、至少在 iPhone 15(iOS 17) 模拟器跑起来自测一遍。`zhixinAppTest` 环境需连公司内网/VPN 才能登录。