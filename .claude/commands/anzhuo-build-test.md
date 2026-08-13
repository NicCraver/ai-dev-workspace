# 智信 Android：构建测试环境 APK

**立即执行，不要探索代码、不要自行拼命令：**

```bash
node scripts/anzhuo-build-test.mjs $ARGUMENTS
```

（工作区根目录脚本；Android 工程在 `apps/android`。只构建、不安装。）

默认：`assembleOnTestDebug`，成功后重命名为 `zx-android-test_v*.apk` 并 **`open` 产物目录**。

可选：`--develop`（开发环境 APK）。

完成后只汇报一行结果（成功/失败、APK 路径与大小；注明已 `open` 产物目录）。
