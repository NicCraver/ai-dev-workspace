# 智信 Android：构建测试环境 APK

**立即执行，不要探索代码、不要自行拼命令：**

```bash
bash apps/android/.cursor/commands/scripts/anzhuo-build-test.sh $ARGUMENTS
```

（脚本以 `apps/android` 为准；本仓库仅转发。）

默认：`assembleOnTestDebug`（包名 `com.cnmts.smart_message.test`），成功后 **`open` 产物目录**  
`smart_message/build/outputs/apk/onTest/debug/`。

可选：`--develop`（开发环境 APK）。

完成后只汇报一行结果（成功/失败、APK 路径与大小；注明已 `open` 产物目录）。
