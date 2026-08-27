# 智信 Android：构建正式（prod）APK

**立即执行，不要探索代码、不要自行拼命令：**

```bash
node scripts/pack.mjs 安卓 正式 $ARGUMENTS
```

（统一入口；Android 工程在 `apps/android`。只构建、不安装。）

默认：`:smart_message:assemblePublishRelease`（flavor `publish` = `com.cnmts.smart_message` / 智物联信，release 签名；**必须带模块前缀**，否则会顺带给 IM 等 library 模块打 release，触发孤立资源校验必挂），成功后重命名为 `zx-android-prod_v*.apk` 并 **`open` 产物目录**（`smart_message/build/outputs/apk/publish/release`）。

可选：`--clean`（先 clean 全量编）、`--no-open`、`--verbose`。

完成后只汇报一行结果（成功/失败、APK 路径与大小；注明已 `open` 产物目录）。
