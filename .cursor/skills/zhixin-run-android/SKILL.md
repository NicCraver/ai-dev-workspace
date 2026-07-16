---
name: zhixin-run-android
description: >-
  智信 Android 真机调试：默认装测试环境 onTest（192.168.10.25），编译/安装/启动。
  用户说真机调试、装包、跑真机、installOnTest、zhixin-run-android，或要在真机验证
  apps/android 改动时使用。
---

# 智信 Android 真机调试（zhixin-run-android）

工作目录：`apps/android/`（独立 git 仓库）。详细平台约定见 `context/platforms/android.md`。

## 默认约定

| 项 | 值 |
|---|---|
| 默认 flavor | **onTest**（测试环境） |
| 后端 | `192.168.10.25`（与 web dev 代理同域） |
| 包名 | `com.cnmts.smart_message.test` |
| LAUNCHER | `com.cnmts.smart_message.activity.AppStartSplashActivity` |
| JDK | **8 或 11**（Gradle 6.5，禁止 17+） |

仅当用户明确说「开发环境 / develop」时才用 `installDevelopDebug`（包名 `.develop`，后端 `192.168.5.47`）。

## 执行流程

按顺序做；任一步失败先解决再继续。用中文向用户汇报关键结果。

### 1. 环境与设备

```bash
java -version          # 须为 1.8 或 11
adb devices -l         # 须出现 device（非 unauthorized / offline）
```

- 无设备 → 提醒插线并开 USB 调试。
- `unauthorized` → 提醒手机点允许调试。
- `./gradlew` permission denied → `chmod +x ./gradlew`。

### 2. 编译并安装（默认 onTest）

**有代码改动或不确定 APK 是否最新：**

```bash
./gradlew installOnTestDebug --no-daemon
```

**APK 已是本次最新构建（仅重装）：**

```bash
adb install -r smart_message/build/outputs/apk/onTest/debug/smart_message-onTest-debug_*.apk
```

安装前可提醒用户：手机若弹出「USB 安装」请点允许。

### 3. 启动

```bash
adb shell am start -n com.cnmts.smart_message.test/com.cnmts.smart_message.activity.AppStartSplashActivity
```

备选：

```bash
adb shell monkey -p com.cnmts.smart_message.test -c android.intent.category.LAUNCHER 1
```

可用 `adb shell dumpsys window | grep mFocusedApp` 确认前台 Activity。

### 4. 安装失败处理

| 错误 | 处理 |
|---|---|
| `INSTALL_FAILED_USER_RESTRICTED` | 提醒开开发者选项「USB 安装」或点允许；**APK 已编好则只重跑 `adb install -r`**，不必重新 Gradle |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | 先 `adb uninstall com.cnmts.smart_message.test` 再装 |
| `BUILD FAILED` / JDK | 确认 JDK 8/11；读 `local.properties` 的 `sdk.dir` |
| 构建被中断 | 重新跑 `installOnTestDebug`；若 outputs 已有新 APK 可直接 `adb install -r` |

## develop 例外（仅用户点名时）

```bash
./gradlew installDevelopDebug --no-daemon
adb shell am start -n com.cnmts.smart_message.develop/com.cnmts.smart_message.activity.AppStartSplashActivity
```

## 注意

- `develop` / `onTest` / 正式包 applicationId 不同，可同机并存。
- 全量构建慢（数分钟）；改完代码再装包时用 Gradle install，不要用过期 APK。
- 本仓库无单元测试；质量靠真机自测。
- 完成后简短告知：flavor、包名、是否启动成功；无需主动 commit。
