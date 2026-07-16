# Android 端一页纸

> 保持在约 120 行以内。由 /distill 定期结晶更新，人工修正错误。最后更新：2026-07-16
> 编码风格对齐 **liuyiling（刘义岭）** 在 IM / AI 相关模块的惯用写法；新功能优先学其「少改存量、按功能新增」的做法。

## 基本信息
- 仓库：apps/android/（独立 git 仓库，Gradle 多模块工程）
- 技术栈：原生 Android，**Java 为主、少量 Kotlin**；AGP 4.2.2 / Gradle 6.5 / Kotlin 1.4.0；compileSdk & targetSdk 28，minSdk 21；AndroidX + multidex + dataBinding。网络：Retrofit2 + OkHttp3 + RxJava3（封装在 `android_net`）。数据库：GreenDAO 3.3.0。IM：融云（`IM`，含 `.so`）。WebView：腾讯 TBS X5 + 文件预览。地图：维智 `wzMap`。推送：个推 + 华为/小米/OPPO/VIVO/魅族/荣耀厂商通道。分享：MobSDK ShareSDK。崩溃：Bugly。出包：360 加固（`jiagu/`）。
- 最低支持版本 / 目标环境：minSdk 21（Android 5.0）/ targetSdk 28（Android 9）；ABI：`armeabi-v7a`、`arm64-v8a`；**构建需 JDK 8 或 11**（Gradle 6.5 不兼容 JDK 17+）。

## 常用命令
```bash
# 构建（Flavor ∈ develop|onTest|preOnline|gray|publish，与 BuildType 组合）：
./gradlew assembleOnTestDebug         # 测试环境（192.168.10.25，与 web dev 代理同域）★真机默认
./gradlew assembleDevelopDebug        # 开发环境 debug（后端 192.168.5.47）
./gradlew assemblePublishRelease      # 正式 release（360 加固基于此包）
# 安装到设备（真机调试默认用 onTest，勿默认 develop）：
./gradlew installOnTestDebug          # 包名 com.cnmts.smart_message.test
# 或：adb install -r smart_message/build/outputs/apk/onTest/debug/*.apk
# 360 加固（自动先 assemblePublish，输出 smart_message/build/outputs/packers/）：
./gradlew protect360
# 清理 / 列任务：./gradlew clean ; ./gradlew tasks
```

## 真机调试流程（默认测试环境）
1. **JDK**：确认 `java -version` 为 8 或 11（Gradle 6.5 不兼容 17+）。
2. **设备**：`adb devices -l`，状态须为 `device`（非 `unauthorized`）；手机弹出 USB 调试/安装提示时点允许。
3. **装包（默认 onTest）**：
   ```bash
   chmod +x ./gradlew   # 仅首次若 permission denied
   ./gradlew installOnTestDebug --no-daemon
   # 若 APK 已是最新构建，可直接：
   # adb install -r smart_message/build/outputs/apk/onTest/debug/smart_message-onTest-debug_*.apk
   ```
4. **启动**：
   ```bash
   adb shell am start -n com.cnmts.smart_message.test/com.cnmts.smart_message.activity.AppStartSplashActivity
   # 或 monkey：adb shell monkey -p com.cnmts.smart_message.test -c android.intent.category.LAUNCHER 1
   ```
5. **注意**：`develop` / `onTest` / 正式包 **applicationId 不同**，可并存；用户说「真机调试」默认走 **onTest**，除非明确要求 develop。
6. **小米等机型**：若报 `INSTALL_FAILED_USER_RESTRICTED`，需在手机上点允许 USB 安装（开发者选项里也可开「USB 安装」）；编译已成功时可只重跑 `adb install -r …`。

> ⚠️ **没有单元测试、没有 lint/checkstyle/detekt**；`lintOptions.abortOnError=false` 实际关掉了 lint；仅 `androidTest` 有默认脚手架。质量靠真机自测。

## 目录与架构约定
- **多模块**（`settings.gradle`），唯一 application 是 `smart_message`，其余为 library。依赖大致：`smart_message → IM → core_function_api → basis_function_api → android_net → base_data → base_util`；`core_function_api → inspection`；`basis_function_api → wzMap`、`local_repo:tbs_file_view_aar`。
- **主包** `com.cnmts.smart_message`（applicationId 随 flavor 加后缀 `.develop/.test/.preonline`）。入口：`AppStartSplashActivity`(LAUNCHER) → `SplashActivity` → `MainActivity`；Application=`App`（MultiDexApplication，隐私协议同意后才初始化 SDK）。
- **网络层**：`android_net` 模块（`com.zg.android_net`）。`RetrofitHandler.init()` 在 `App.initAgreeService()` 中初始化；base 地址来自 `BuildConfig`（`SERVER_IP`/`IS_HTTPS` + `NEW_BASE_URL`/`AI_BASIC_URL` 等），按 flavor 注入；代理缓存在 `proxy_cache_server`。
- **WebView/JSBridge**：桥接核心在 `core_function_api/bridge/`（`JSBridge`/`IBridgeImpl`/`Callback`）+ `method/BaseJsMethod`（JS 可调方法）+ `view/X5WebView*`（全屏/半屏/内嵌/AI 框容器）；底层 X5 封装在 `smart_message/widget/X5WebView.java`。**协议对照 `context/bridge.md`。**
- **存储**：`PrefManager`（SP：token/用户态）、GreenDAO（`DataCenter`/`GreenDaoHelper`）。

## 编码风格（对齐 liuyiling，必遵）

### 少改存量、能新增就新增
- **禁止**为新功能大改 `ConversationFragment` / `ConversationListBaseView` / `IncrementalDataManager` 等巨型类；这些文件只允许 **薄挂钩**（通常 1～3 行调用 + 一行中文注释）。
- 业务逻辑抽到**新类**：如会话列表入口用 `PersonalAiListCellBinder.bind(...)`，宿主只调一次。
- 能复用布局/控件就复用（inflate 已有 item），不要复制整段巨型方法再改。
- 不做无关重构、不引入 MVVM/Compose/新 DI；跟现有 Java 范式走。

### 按功能建包（文件夹）
新功能代码放进 **snake_case 功能包**，包内再按职责拆文件，参考现有范例：
| 场景 | 包路径示例 |
|------|------------|
| IM 会话列表附属能力 | `IM/.../conversation/<feature>/`（如 `nearsevendays/`、`refer_message_unit/`） |
| 聊天页附属 View | `IM/.../dialogue/<feature>/`（如 `agent_data_check/`） |
| AI 工具 / AI 框宿主 | `IM/.../widge/ai_tool/` |
| 独立小组件 | `IM/.../not_send/`、`IM/.../richEditText/` |
| 网络接口 | `android_net/.../interface_base_package/XxxInterface.java` |
| 接口 Bean | `android_net/.../interface_base_package/bean/<domain>/`（`*ReqDTO`/`*RspDTO`/`*VO`） |
| App 壳 / 主 Tab | `smart_message/.../main_table/<业务>/` 或 `common/manager/` |
| 共享工具 / 多密度图标 | `base_util` |
| JSBridge 方法 | `core_function_api/method/`（协议同步 `bridge.md`） |

个人 AI 框后续：优先 `IM/.../conversation/personal_ai/`（或同级 `personal_ai/` 包），入口 Binder / 选择页 / 桥回传各建新文件；`ConversationListBaseView` 只保留一行 `bind`。

### 命名与文件职责
- **语言**：业务代码优先 **Java**；仅当改的是已有 `.kt` 文件时才用 Kotlin。
- **类后缀**：`*Activity` / `*Fragment` / `*View`（自定义 View 继承 `FrameLayout`/`LinearLayout`）/ `*Adapter` / `*Manager`（编排、单例）/ `*Binder`（列表 Cell 绑定）/ `*Listener`（独立接口文件）/ `*Util` / `*Para`/`*VO`/`*ReqDTO`/`*RspDTO`。
- **Intent 常量**：`public static String XXX = "xxx"` 写在 Activity 顶部；业务枚举用 `int` + 中文注释（`//0-直接打开；1-勾选消息；2-引用提示词`）。
- **文件头**：`@Author` / `@Date` / `@Description`（中文一句话说明职责）。
- **生命周期切分**：自定义 View 常用 `initView()` → `initData()` / `clickEvent()`；空参早退（`StringUtils.isEmpty` → `return`）。
- **点击防抖**：列表/入口用 `RxView.clicks(...).throttleFirst(2, TimeUnit.SECONDS)`（与 O5 / 个人 AI 入口一致）。
- **网络调用**：`RetrofitHandler` + `XxxInterface` + `DefaultSubscriber` + RxJava3 `Flowable`；新接口先加 Interface 与 Bean，再在 Manager/View 里调。
- **注释**：关键语义用简短中文；魔数必须注释含义；勿写空洞注释。

### 好的做法（学） / 避免（不学）
- ✅ 功能包内聚、宿主薄挂钩、Listener/Bean 独立文件、Manager 收敛异步/轮询。
- ✅ 对齐已有交互骨架（如个人 AI Cell 仿 O5 呼叫 Cell），视觉/行为一致优先于「重写一套」。
- ❌ 把几百行新逻辑塞进已有巨型 Fragment；❌ 为洁癖全局 rename / 抽基类；❌ 无必要上 Kotlin 协程或新架构。

## Mock 开关方式
- **无独立 mock 层**。环境/接口域名切换靠 **productFlavors**：`develop`(192.168.5.47) / `onTest`(192.168.10.25) / `preOnline`(zhixinstage) / `gray`、`publish`(zhixin.zhiguaniot.com)。flavor 同时改 `applicationId`/`app_name`/推送 key/Bugly id 及 `src/<flavor>/assets`。
- **页面先行**：如需 mock，按 `context/contracts/` 类型在 `android_net/bean` 或调用处构造本地数据，并在活跃功能 impl-notes 记录。

## WebView 集成方式
- 加载内嵌 web 用腾讯 **X5（TBS）内核**（`App.initTBS()` 预初始化，失败回退系统 WebView）。
- 双向通信：原生→JS 用 `loadUrl("javascript:...")`；JS→原生用 `addJavascriptInterface` + `@JavascriptInterface`（例：token 刷新——JS 调 `window.NewToken.showInfoFromJs()`，原生刷新后回调 `getTokenFromJava(token)`）。统一封装在 `core_function_api/bridge/JSBridge.java`。
- **协议必须对齐 `context/bridge.md`**；新增桥接方法在 `method/` 扩展并同步契约。
- AI 框 / 个人 AI H5：经 `QuickBean` + `APIMainActivity` / `APIAiFrameWebViewFragment` 打开；URL 拼 `BuildConfig.SERVER_IP` + path（如 `ai-chat/m/personal`），query 带 `corpId`/`accountId` 等。

## 已知坑
- **必须 JDK 8/11**（Gradle 6.5），JDK 17+ 构建失败；`local.properties` 需配 `sdk.dir`。
- `kotlin-android-extensions` 已废弃，新 Kotlin 用 ViewBinding/dataBinding。
- 签名密钥、360 加固账号密码、各厂商推送 key、MobSDK/Bugly 密钥均**明文写在 `build.gradle`/`360protect.gradle`**（既有现状，勿外泄）。
- release **不混淆**（`minifyEnabled false`）；`usesCleartextTraffic=true` 允许明文 HTTP。
- targetSdk 28 偏低，新 Android 的存储/后台/权限限制需自行适配。
- 全量构建慢、内存大（`-Xmx10240m`、`dexOptions.javaMaxHeapSize 7g`）；改单模块可加速。
- X5 内核需联网下载，首次启动可能回退系统 WebView，联调注意内核差异。
- 巨型类（尤其 `ConversationFragment`）合并冲突多：新逻辑务必外置，降低与 liuyiling 并行改动的冲突面。
