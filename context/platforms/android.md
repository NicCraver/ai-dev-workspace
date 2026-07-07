# Android 端一页纸

> 保持在约 100 行以内。由 /distill 定期结晶更新，人工修正错误。最后更新：2026-07-07

## 基本信息
- 仓库：apps/android/（独立 git 仓库，Gradle 多模块工程）
- 技术栈：原生 Android，**Java 为主、少量 Kotlin**；AGP 4.2.2 / Gradle 6.5 / Kotlin 1.4.0；compileSdk & targetSdk 28，minSdk 21；AndroidX + multidex + dataBinding。网络：Retrofit2 + OkHttp3 + RxJava3（封装在 `android_net`）。数据库：GreenDAO 3.3.0。IM：融云（`IM`，含 `.so`）。WebView：腾讯 TBS X5 + 文件预览。地图：维智 `wzMap`。推送：个推 + 华为/小米/OPPO/VIVO/魅族/荣耀厂商通道。分享：MobSDK ShareSDK。崩溃：Bugly。出包：360 加固（`jiagu/`）。
- 最低支持版本 / 目标环境：minSdk 21（Android 5.0）/ targetSdk 28（Android 9）；ABI：`armeabi-v7a`、`arm64-v8a`；**构建需 JDK 8 或 11**（Gradle 6.5 不兼容 JDK 17+）。

## 常用命令
```bash
# 构建（Flavor ∈ develop|onTest|preOnline|gray|publish，与 BuildType 组合）：
./gradlew assembleDevelopDebug        # 开发环境 debug（后端 192.168.5.47）
./gradlew assembleOnTestDebug         # 测试环境（192.168.10.25，与 web dev 代理同域）
./gradlew assemblePublishRelease      # 正式 release（360 加固基于此包）
# 安装到设备：
./gradlew installDevelopDebug   # 或 adb install -r <apk>
# 360 加固（自动先 assemblePublish，输出 smart_message/build/outputs/packers/）：
./gradlew protect360
# 清理 / 列任务：./gradlew clean ; ./gradlew tasks
```
> ⚠️ **没有单元测试、没有 lint/checkstyle/detekt**；`lintOptions.abortOnError=false` 实际关掉了 lint；仅 `androidTest` 有默认脚手架。质量靠真机自测。

## 目录与架构约定
- **多模块**（`settings.gradle`），唯一 application 是 `smart_message`，其余为 library。依赖大致：`smart_message → IM → core_function_api → basis_function_api → android_net → base_data → base_util`；`core_function_api → inspection`；`basis_function_api → wzMap`、`local_repo:tbs_file_view_aar`。
- **主包** `com.cnmts.smart_message`（applicationId 随 flavor 加后缀 `.develop/.test/.preonline`）。入口：`AppStartSplashActivity`(LAUNCHER) → `SplashActivity` → `MainActivity`；Application=`App`（MultiDexApplication，隐私协议同意后才初始化 SDK）。
- **网络层**：`android_net` 模块（`com.zg.android_net`）。`RetrofitHandler.init()` 在 `App.initAgreeService()` 中初始化；base 地址来自 `BuildConfig`（`SERVER_IP`/`IS_HTTPS` + `NEW_BASE_URL`/`AI_BASIC_URL` 等），按 flavor 注入；代理缓存在 `proxy_cache_server`。
- **WebView/JSBridge**：桥接核心在 `core_function_api/bridge/`（`JSBridge`/`IBridgeImpl`/`Callback`）+ `method/BaseJsMethod`（JS 可调方法）+ `view/X5WebView*`（全屏/半屏/内嵌/AI 框容器）；底层 X5 封装在 `smart_message/widget/X5WebView.java`。**协议对照 `context/bridge.md`。**
- **存储**：`PrefManager`（SP：token/用户态）、GreenDAO（`DataCenter`/`GreenDaoHelper`）。

## Mock 开关方式
- **无独立 mock 层**。环境/接口域名切换靠 **productFlavors**：`develop`(192.168.5.47) / `onTest`(192.168.10.25) / `preOnline`(zhixinstage) / `gray`、`publish`(zhixin.zhiguaniot.com)。flavor 同时改 `applicationId`/`app_name`/推送 key/Bugly id 及 `src/<flavor>/assets`。
- **页面先行**：如需 mock，按 `context/contracts/` 类型在 `android_net/bean` 或调用处构造本地数据，并在活跃功能 impl-notes 记录。

## WebView 集成方式
- 加载内嵌 web 用腾讯 **X5（TBS）内核**（`App.initTBS()` 预初始化，失败回退系统 WebView）。
- 双向通信：原生→JS 用 `loadUrl("javascript:...")`；JS→原生用 `addJavascriptInterface` + `@JavascriptInterface`（例：token 刷新——JS 调 `window.NewToken.showInfoFromJs()`，原生刷新后回调 `getTokenFromJava(token)`）。统一封装在 `core_function_api/bridge/JSBridge.java`。
- **协议必须对齐 `context/bridge.md`**；新增桥接方法在 `method/` 扩展并同步契约。

## 已知坑
- **必须 JDK 8/11**（Gradle 6.5），JDK 17+ 构建失败；`local.properties` 需配 `sdk.dir`。
- `kotlin-android-extensions` 已废弃，新 Kotlin 用 ViewBinding/dataBinding。
- 签名密钥、360 加固账号密码、各厂商推送 key、MobSDK/Bugly 密钥均**明文写在 `build.gradle`/`360protect.gradle`**（既有现状，勿外泄）。
- release **不混淆**（`minifyEnabled false`）；`usesCleartextTraffic=true` 允许明文 HTTP。
- targetSdk 28 偏低，新 Android 的存储/后台/权限限制需自行适配。
- 全量构建慢、内存大（`-Xmx10240m`、`dexOptions.javaMaxHeapSize 7g`）；改单模块可加速。
- X5 内核需联网下载，首次启动可能回退系统 WebView，联调注意内核差异。
